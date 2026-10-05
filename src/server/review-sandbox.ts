import { DockerSandbox } from '@mastra/docker';
import { type OrganizationSecrets } from './secrets';
import { validateEndpoint } from './review-configuration';
import { fail } from './contracts';
import { type Run } from './reviews';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const executeDocker = promisify(execFile);
export function validateSandboxImage(image: string) {
  if (!/^(?:sha256:[a-f0-9]{64}|[^\s]+@sha256:[a-f0-9]{64})$/.test(image))
    throw Error('Sandbox image must be pinned by digest');
}
async function discardStoppedSandbox(run: Run) {
  const name = `factory-${run.id}`;
  try {
    const info = JSON.parse(
      (await executeDocker('docker', ['inspect', name], { windowsHide: true })).stdout,
    )[0];
    if (
      info.Config.Labels['factory.run'] !== run.id ||
      info.Config.Labels['factory.organization'] !== run.organization ||
      info.State.Running
    )
      throw Error('Sandbox recreation requires matching stopped execution');
    await executeDocker('docker', ['rm', name], { windowsHide: true });
  } catch (e: any) {
    if (!/no such (?:object|container|image or container)/i.test(String(e.stderr))) throw e;
  }
}
export async function confirmSandboxStopped(run: Run) {
  const name = `factory-${run.id}`;
  try {
    const inspected = JSON.parse(
      (await executeDocker('docker', ['inspect', name], { windowsHide: true })).stdout,
    )[0];
    if (
      inspected.Config.Labels['factory.run'] !== run.id ||
      inspected.Config.Labels['factory.organization'] !== run.organization
    )
      throw Error('Recovery container identity mismatch');
    if (inspected.State.Running)
      await executeDocker('docker', ['stop', '--time', '1', name], { windowsHide: true });
    const stopped = JSON.parse(
      (await executeDocker('docker', ['inspect', name], { windowsHide: true })).stdout,
    )[0];
    if (stopped.State.Running) throw Error('Execution is not stopped');
    await executeDocker('docker', ['rm', name], { windowsHide: true });
  } catch (e: any) {
    if (!/no such (?:object|container|image or container)/i.test(String(e.stderr))) throw e;
  }
}

export class RepositorySandbox {
  readonly sandbox: DockerSandbox;
  private baseline = '';
  private signal?: AbortSignal;
  constructor(
    readonly run: Run,
    readonly image: string,
  ) {
    validateSandboxImage(image);
    this.sandbox = new DockerSandbox({
      id: `factory-${run.id}`,
      image,
      workingDirectory: '/workspace',
      readonlyRootfs: true,
      capDrop: ['ALL'],
      securityOpt: ['no-new-privileges:true'],
      privileged: false,
      memory: 512 * 1024 * 1024,
      memorySwap: 512 * 1024 * 1024,
      cpuPeriod: 100000,
      cpuQuota: 100000,
      pidsLimit: 64,
      tmpfs: {
        '/workspace': 'rw,noexec,nosuid,nodev,size=256m,mode=0700',
        '/tmp': 'rw,noexec,nosuid,nodev,size=16m',
      },
      labels: { 'factory.run': run.id, 'factory.organization': run.organization },
      timeout: 30000,
    });
  }
  private async execute(command: string, args: string[], env?: Record<string, string>) {
    const result = await this.sandbox.executeCommand!(command, args, {
      cwd: '/workspace',
      timeout: 30000,
      env,
      maxRetainedBytes: 32768,
      abortSignal: this.signal,
    });
    if (result.exitCode !== 0) fail(503, 'Sandbox operation failed');
    return result.stdout.trim();
  }
  async prepare(
    access: Record<string, any>,
    secrets: OrganizationSecrets,
    allowedHosts: string[],
    allowLoopback: boolean,
    signal: AbortSignal,
    authorize: () => Promise<void>,
  ) {
    this.signal = signal;
    const { sourceCommit, targetCommit, sourceUrl } = this.run.data.inputs!.fields;
    for (const commit of [sourceCommit, targetCommit])
      if (typeof commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit))
        fail(422, 'Commit identifier must be a full object ID');
    await authorize();
    await discardStoppedSandbox(this.run);
    await this.sandbox.start({ abortSignal: signal });
    const info = await this.sandbox.container.inspect();
    if (
      info.Config.Labels?.['factory.run'] !== this.run.id ||
      info.Config.Image !== this.image ||
      info.HostConfig.Privileged ||
      !info.HostConfig.ReadonlyRootfs ||
      info.HostConfig.Memory !== 512 * 1024 * 1024 ||
      info.HostConfig.MemorySwap !== 512 * 1024 * 1024 ||
      info.HostConfig.CpuPeriod !== 100000 ||
      info.HostConfig.CpuQuota !== 100000 ||
      info.HostConfig.PidsLimit !== 64 ||
      info.HostConfig.Tmpfs?.['/workspace'] !== 'rw,noexec,nosuid,nodev,size=256m,mode=0700' ||
      info.HostConfig.Tmpfs?.['/tmp'] !== 'rw,noexec,nosuid,nodev,size=16m' ||
      Boolean(info.HostConfig.Binds?.length) ||
      Boolean(info.Mounts?.some((m: { Type: string }) => m.Type !== 'tmpfs')) ||
      !info.HostConfig.CapDrop?.includes('ALL') ||
      !info.HostConfig.SecurityOpt?.includes('no-new-privileges:true')
    )
      fail(503, 'Sandbox isolation policy mismatch');
    const urls = [sourceUrl ?? access.urls[0], access.urls[0]];
    if (urls.some((url) => !access.urls.includes(url)))
      fail(403, 'Repository credential scope denied');
    for (const url of urls) await validateEndpoint(url, allowedHosts, allowLoopback);
    // Credentials are per-exec data; neither the image nor agent environment receives them.
    await this.execute('git', ['init', '/workspace/repository']);
    for (const [index, commit] of [sourceCommit, targetCommit].entries()) {
      if (signal.aborted) throw signal.reason;
      await authorize();
      const credential = await secrets.read(
        this.run.organization,
        `repository:${access.credential}`,
      );
      const header =
        access.provider === 'github'
          ? `AUTHORIZATION: Basic ${Buffer.from(`x-access-token:${credential}`).toString('base64')}`
          : `AUTHORIZATION: Basic ${Buffer.from(`:${credential}`).toString('base64')}`;
      await this.execute(
        'git',
        [
          '-c',
          'core.hooksPath=/dev/null',
          '-c',
          'core.fsmonitor=false',
          '-c',
          'credential.helper=',
          '-c',
          'http.followRedirects=false',
          '-C',
          '/workspace/repository',
          'fetch',
          '--no-tags',
          '--no-recurse-submodules',
          '--end-of-options',
          urls[index],
          commit,
        ],
        {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: `http.${urls[index]}.extraHeader`,
          GIT_CONFIG_VALUE_0: header,
          GIT_TERMINAL_PROMPT: '0',
        },
      );
    }
    const actual = await this.execute('git', [
      '-C',
      '/workspace/repository',
      'rev-parse',
      `${sourceCommit}^{commit}`,
      `${targetCommit}^{commit}`,
    ]);
    if (actual !== `${sourceCommit}\n${targetCommit}`)
      fail(409, 'Repository commit provenance mismatch');
    this.baseline = await this.execute('git', [
      '-C',
      '/workspace/repository',
      'merge-base',
      sourceCommit,
      targetCommit,
    ]);
    await this.execute('git', [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.fsmonitor=false',
      '-C',
      '/workspace/repository',
      'checkout',
      '--detach',
      sourceCommit,
    ]);
    // Agent exploration has no outbound network and cannot retrieve credentials.
    const networks = (await this.sandbox.container.inspect()).NetworkSettings.Networks ?? {};
    for (const network of Object.keys(networks))
      await new Promise<void>((resolve, reject) =>
        (this.sandbox.container as any).modem.dial(
          {
            path: `/networks/${network}/disconnect`,
            method: 'POST',
            options: { Container: this.sandbox.container.id, Force: true },
            statusCodes: { 200: true, 204: true },
          },
          (error: unknown) => (error ? reject(error) : resolve()),
        ),
      );
    const final = await this.sandbox.container.inspect();
    if (Object.keys(final.NetworkSettings.Networks ?? {}).some((n) => n !== 'none'))
      fail(503, 'Sandbox outbound isolation failed');
    return {
      id: this.sandbox.id,
      container: info.Id,
      image: this.image,
      sourceCommit,
      targetCommit,
      baseline: this.baseline,
      network: 'none',
      memory: 512 * 1024 * 1024,
      checkout: '/workspace/repository',
    };
  }
  async tool(input: Record<string, unknown>) {
    const encoded = Buffer.from(
      JSON.stringify({
        ...input,
        base: this.baseline,
        source: this.run.data.inputs!.fields.sourceCommit,
      }),
    ).toString('base64url');
    const result = JSON.parse(
      await this.execute('node', ['/opt/factory/repository-tool.mjs', encoded]),
    );
    return result.truncated
      ? `${result.output}\n[Repository tool output truncated]`
      : result.output;
  }
  async stop() {
    await confirmSandboxStopped(this.run);
  }
}
