import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { BrowserClient } from './support/provider';
import { observation, sourceInput } from './support/observations';
import { createReviewBoundary } from '../docker/evaluation/review-boundary';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const factoryOrigin =
  process.env.FACTORY_EVALUATION_ORIGIN ?? process.env.FACTORY_ORIGIN ?? 'http://127.0.0.1:18030';
const boundaryOrigin = process.env.FACTORY_EVALUATION_BOUNDARY_ORIGIN ?? 'http://127.0.0.1:18082';
const composeFile = resolve(repositoryRoot, 'docker/evaluation/compose.yaml');
const evidenceFile = resolve(repositoryRoot, '.runtime/docker-evaluation/review-acceptance.json');
const sourceId = 'docker-evaluation';
const sourceSecret = 'docker-evaluation-source-fixture-secret-keep-local-only';
const alphaAiKey = 'docker-evaluation-alpha-ai-fixture-key';
const betaAiKey = 'docker-evaluation-beta-ai-fixture-key';
const repositoryKey = 'docker-evaluation-read-fixture-key';
const publicationKey = 'docker-evaluation-write-fixture-key';
const factoryService = process.env.FACTORY_COMPOSE_FACTORY_SERVICE ?? 'factory';
const waitTimeoutMs = 120_000;
const execFileAsync = promisify(execFile);

type BoundaryMetadata = {
  sourceCommit: string;
  targetCommit: string;
  unchangedContent: string;
};

type EvaluationEvidence = {
  createdAt: string;
  factoryOrigin: string;
  alphaWorkItem: string;
  alphaReport: string;
  alphaReviewRun: string;
  betaWorkItem: string;
  betaReport: string;
  betaReviewRun: string;
  sourceCommit: string;
  targetCommit: string;
};

function checkStatus(actual: number, expected: number, label: string) {
  assert.equal(actual, expected, `${label}: expected HTTP ${expected}, received ${actual}`);
}

async function jsonAt(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  return { response, body: (await response.json()) as any };
}

async function waitFor<T>(label: string, read: () => Promise<T>, ready: (value: T) => boolean) {
  const deadline = Date.now() + waitTimeoutMs;
  let latest: T | undefined;
  while (Date.now() < deadline) {
    latest = await read();
    if (ready(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not reach its expected state before timeout`);
}

async function boundaryMetadata(): Promise<BoundaryMetadata> {
  const { response, body } = await jsonAt(`${boundaryOrigin}/metadata`);
  checkStatus(response.status, 200, 'Evaluation boundary metadata');
  assert.match(body.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(body.targetCommit, /^[a-f0-9]{40}$/);
  assert.equal(typeof body.unchangedContent, 'string');
  return body as BoundaryMetadata;
}

async function boundarySummary() {
  const { response, body } = await jsonAt(`${boundaryOrigin}/summary`);
  checkStatus(response.status, 200, 'Evaluation boundary summary');
  return body as {
    gitFetches: number;
    aiRequests: number;
    aiByOrganization: { alpha: number; beta: number };
    readResultConfirmed: boolean;
    changesResultConfirmed: boolean;
    effects: { id: number; digest: string }[];
  };
}

function invokeOperator(
  command: 'source-put' | 'review-configure' | 'repository-access' | 'publication-configure',
  input: unknown,
) {
  const path = '/tmp/tbfactory-docker-evaluation-seed.json';
  const shell = `cat > ${path} && node --import tsx scripts/operator.ts ${command} ${path}; result=$?; rm -f ${path}; exit "$result"`;
  try {
    execFileSync(
      'docker',
      ['compose', '-f', composeFile, 'exec', '-T', factoryService, 'sh', '-c', shell],
      {
        cwd: repositoryRoot,
        input: JSON.stringify(input),
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  } catch {
    throw new Error(`Factory operator seeding command failed: ${command}`);
  }
}

function sourceConfiguration() {
  const source = sourceInput('github');
  return {
    ...source,
    source: sourceId,
    secret: sourceSecret,
    external: { provider: 'github' as const, repository: '12345' },
  };
}

function reviewConfiguration(organization: 'alpha' | 'beta', key: string) {
  return {
    organization,
    enabled: true,
    mode: 'organization',
    entitled: false,
    key,
    ai: {
      adapter: 'openai-chat',
      url: 'http://host.docker.internal:18082/v1',
      model: 'docker-evaluation-model',
      permittedModels: [{ id: 'docker-evaluation-model', tools: true, reasoning: [] }],
    },
    limits: { calls: 10, aiMs: 120_000, executionMs: 240_000, subordinateAgents: 0 },
    rules: { enabled: false, repositories: [], targetBranches: [], includeDrafts: false },
  };
}

function repositoryAccess(organization: 'alpha' | 'beta') {
  return {
    organization,
    repository: `${organization}-repo`,
    provider: 'github',
    credential: `docker-evaluation-${organization}-repository`,
    urls: ['http://host.docker.internal:18082/repository.git'],
    key: repositoryKey,
    enabled: true,
  };
}

function publicationConfiguration() {
  return {
    organization: 'alpha',
    repository: 'alpha-repo',
    source: sourceId,
    enabled: true,
    credential: 'docker-evaluation-publication',
    endpoint: 'http://host.docker.internal:18082',
    githubRepository: 'example/code',
    key: publicationKey,
    defaultMode: 'confirmed-content',
  };
}

async function configureEvaluation() {
  const source = sourceConfiguration();
  invokeOperator('source-put', source);
  invokeOperator('review-configure', reviewConfiguration('alpha', alphaAiKey));
  invokeOperator('review-configure', reviewConfiguration('beta', betaAiKey));
  invokeOperator('repository-access', repositoryAccess('alpha'));
  invokeOperator('repository-access', repositoryAccess('beta'));
  invokeOperator('publication-configure', publicationConfiguration());
}

async function publicJson(browser: BrowserClient, path: string, body?: unknown) {
  const result = await browser.json(factoryOrigin, path, body);
  checkStatus(result.status, 200, `${body ? 'POST' : 'GET'} ${path}`);
  return result.body;
}

async function reviewView(browser: BrowserClient, organization: string, workItem: string) {
  return publicJson(browser, `/api/organizations/${organization}/work-items/${workItem}/reviews`);
}

async function waitForReview(
  browser: BrowserClient,
  organization: string,
  workItem: string,
  status: string,
) {
  return waitFor(
    `Review Workflow ${status}`,
    () => reviewView(browser, organization, workItem),
    (view) => view.runs.some((run: any) => run.workflow === 'review-v1' && run.status === status),
  );
}

async function requestReview(
  browser: BrowserClient,
  organization: 'alpha' | 'beta',
  workItem: string,
) {
  const base = `/api/organizations/${organization}/work-items/${workItem}`;
  const prepared = await publicJson(browser, `${base}/transition-requests`, {
    operationId: `docker-eval-prepare-${workItem}`,
    transition: 'prepare-review',
    expectedState: 'registered',
    version: 4,
    inputs: {
      reviewBrief: 'Explore the changed code and inspect the relevant unchanged configuration.',
    },
  });
  assert.equal(prepared.workItem.state, 'ready-for-review');
  const requested = await publicJson(browser, `${base}/transition-requests`, {
    operationId: `docker-eval-review-${workItem}`,
    transition: 'request-review',
    expectedState: 'ready-for-review',
    version: 4,
    inputs: {
      reviewBrief: 'Explore the changed code and inspect the relevant unchanged configuration.',
    },
  });
  assert.equal(requested.accepted, true);
  return waitForReview(browser, organization, workItem, 'waiting-review');
}

async function importAlphaPullRequest(browser: BrowserClient, metadata: BoundaryMetadata) {
  const source = sourceConfiguration();
  const payload = observation('github') as any;
  payload.pull_request.head = {
    sha: metadata.sourceCommit,
    ref: 'feature',
    repo: payload.repository,
  };
  payload.pull_request.base = {
    sha: metadata.targetCommit,
    ref: 'main',
    repo: payload.repository,
  };
  const event = new Request(
    `${factoryOrigin}/api/organizations/alpha/sources/${sourceId}/observations`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': randomUUID(),
        'x-hub-signature-256': `sha256=${createHmac('sha256', sourceSecret)
          .update(JSON.stringify(payload))
          .digest('hex')}`,
      },
      body: JSON.stringify(payload),
    },
  );
  const response = await fetch(event);
  checkStatus(response.status, 200, 'Signed GitHub pull request import');
  const imported = (await response.json()) as any;
  assert.equal(typeof imported.workItemId, 'string');
  return imported.workItemId as string;
}

async function createBetaWorkItem(browser: BrowserClient, metadata: BoundaryMetadata) {
  const base = '/api/organizations/beta';
  await publicJson(browser, `${base}/work-item-types`, {
    operationId: `docker-eval-type-beta-${randomUUID()}`,
    type: 'pull-request-review',
    version: 4,
    enabled: true,
  });
  const created = await publicJson(browser, `${base}/work-items`, {
    operationId: `docker-eval-create-beta-${randomUUID()}`,
    title: 'Docker evaluation Organization boundary review',
    project: 'beta-project',
    repository: 'beta-repo',
    type: 'pull-request-review',
  });
  const workItem = String(created.workItem.id);
  await publicJson(browser, `${base}/work-items/${workItem}/review-facts`, {
    operationId: `docker-eval-inputs-beta-${workItem}`,
    fields: {
      sourceBranch: 'feature',
      targetBranch: 'main',
      sourceCommit: metadata.sourceCommit,
      targetCommit: metadata.targetCommit,
    },
  });
  return workItem;
}

async function startHeldReviews() {
  await boundaryMetadata();
  const ready = await fetch(factoryOrigin);
  assert.equal(ready.ok, true, 'Factory public endpoint must be ready');
  await configureEvaluation();

  const browser = new BrowserClient();
  await browser.login(factoryOrigin, 'alice');
  const organizations = await publicJson(browser, '/api/organizations');
  assert.ok(organizations.items?.some((row: any) => row.id === 'alpha'));
  assert.ok(organizations.items?.some((row: any) => row.id === 'beta'));
  for (const organization of ['alpha', 'beta'] as const)
    await publicJson(browser, `/api/organizations/${organization}/work-item-types`, {
      operationId: `docker-eval-type-${organization}-${randomUUID()}`,
      type: 'pull-request-review',
      version: 4,
      enabled: true,
    });

  const metadata = await boundaryMetadata();
  const alphaWorkItem = await importAlphaPullRequest(browser, metadata);
  const alphaReviews = await requestReview(browser, 'alpha', alphaWorkItem);
  const alphaRun = alphaReviews.runs.find(
    (run: any) => run.workflow === 'review-v1' && run.status === 'waiting-review',
  );
  const alphaReport = alphaReviews.reports.find((report: any) => report.run === alphaRun.id);
  assert.ok(alphaReport, 'The Docker worker must retain a private report at the human wait');
  assert.equal(alphaReport.findings.length, 1);
  assert.equal(alphaReport.findings[0].location.path, 'unchanged.ts');
  assert.equal(alphaRun.sandbox.network, 'none');
  assert.equal(alphaRun.sandbox.memory, 512 * 1024 * 1024);
  assert.equal(alphaRun.sandbox.sourceCommit, metadata.sourceCommit);
  assert.equal(alphaRun.sandbox.targetCommit, metadata.targetCommit);

  const artifactPath = `/api/organizations/alpha/work-items/${alphaWorkItem}/reviews/${alphaReport.id}/artifact`;
  const artifact = await browser.request(`${factoryOrigin}${artifactPath}`);
  checkStatus(artifact.status, 200, 'Private report Artifact');
  assert.match(await artifact.text(), /unchanged\.ts/);
  const anonymous = await fetch(`${factoryOrigin}${artifactPath}`);
  assert.equal(anonymous.status, 401, 'An anonymous caller must not read the private Artifact');
  const otherOrganization = await browser.json(
    factoryOrigin,
    `/api/organizations/beta/work-items/${alphaWorkItem}/reviews`,
  );
  assert.equal(otherOrganization.status, 404, 'A report must not cross Organization scope');

  const betaWorkItem = await createBetaWorkItem(browser, metadata);
  const betaReviews = await requestReview(browser, 'beta', betaWorkItem);
  const betaRun = betaReviews.runs.find(
    (run: any) => run.workflow === 'review-v1' && run.status === 'waiting-review',
  );
  const betaReport = betaReviews.reports.find((report: any) => report.run === betaRun.id);
  assert.ok(betaReport, 'The beta Organization must retain its own private report');
  assert.notEqual(betaReport.id, alphaReport.id);

  const fixture = await boundarySummary();
  assert.ok(fixture.gitFetches >= 4, 'The Docker sandboxes must fetch both bound commits');
  assert.ok(fixture.aiByOrganization.alpha >= 2);
  assert.ok(fixture.aiByOrganization.beta >= 2);
  assert.equal(fixture.readResultConfirmed, true, 'AI must receive the Git read tool result');
  assert.equal(fixture.changesResultConfirmed, true, 'AI must receive the Git changes tool result');

  const evidence: EvaluationEvidence = {
    createdAt: new Date().toISOString(),
    factoryOrigin,
    alphaWorkItem,
    alphaReport: alphaReport.id,
    alphaReviewRun: alphaRun.id,
    betaWorkItem,
    betaReport: betaReport.id,
    betaReviewRun: betaRun.id,
    sourceCommit: metadata.sourceCommit,
    targetCommit: metadata.targetCommit,
  };
  await mkdir(join(repositoryRoot, '.runtime', 'docker-evaluation'), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    JSON.stringify({
      ready: true,
      stage: 'waiting-review',
      factoryOrigin,
      alphaWorkItem,
      alphaReport: alphaReport.id,
      betaWorkItem,
      betaReport: betaReport.id,
      evidenceFile,
      checks: [
        'Public OIDC browser login and signed provider observation import',
        'Containerized Factory worker launched isolated Docker sandboxes and fetched bound Git commits',
        'Controlled AI received actual read and changes tool results in two Organization configurations',
        'Private report Artifact is denied anonymously and across Organization scope',
        'Alpha and beta Workflows retain separate reports at the human Review Decision wait',
      ],
    }),
  );
}

async function latestDecision(
  browser: BrowserClient,
  organization: string,
  workItem: string,
  report: any,
) {
  let view = await reviewView(browser, organization, workItem);
  const run = view.runs.find(
    (row: any) => row.workflow === 'review-v1' && row.report === report.id,
  );
  assert.ok(run, 'The retained Review Workflow must bind the selected report');
  let decision = view.decisions?.find((row: any) => row.payload?.reportVersion === report.id);
  if (!decision) {
    const result = await publicJson(
      browser,
      `/api/organizations/${organization}/work-items/${workItem}/review-decisions`,
      {
        operationId: `docker-eval-decision-${workItem}-${report.id}`,
        run: run.id,
        reportVersion: report.id,
        reviewed: true,
        findings: report.findings.map((finding: any) => ({
          finding: finding.id,
          decision: 'confirmed',
        })),
      },
    );
    decision = result.fact;
  }
  assert.equal(decision.kind, 'review.decision');
  assert.equal(decision.payload.reportVersion, report.id);
  return { runId: run.id, decisionId: decision.id };
}

async function waitForReviewCompletion(
  browser: BrowserClient,
  organization: string,
  workItem: string,
  runId: string,
) {
  return waitFor(
    'Review Workflow completion',
    () => reviewView(browser, organization, workItem),
    (view) => view.runs.some((row: any) => row.id === runId && row.status === 'completed'),
  );
}

async function completeHeldReviews() {
  const evidence = JSON.parse(await readFile(evidenceFile, 'utf8')) as EvaluationEvidence;
  const browser = new BrowserClient();
  await browser.login(factoryOrigin, 'alice');
  const before = await boundarySummary();

  const alphaReviews = await reviewView(browser, 'alpha', evidence.alphaWorkItem);
  const alphaReport = alphaReviews.reports.find(
    (report: any) => report.id === evidence.alphaReport,
  );
  assert.ok(alphaReport, 'The alpha report must survive Factory backup and restart');
  const priorAlphaPublication = alphaReviews.publications.find(
    (row: any) => row.run === evidence.alphaReviewRun,
  );
  const alpha = await latestDecision(browser, 'alpha', evidence.alphaWorkItem, alphaReport);
  const alphaAfterDecision = await waitForReviewCompletion(
    browser,
    'alpha',
    evidence.alphaWorkItem,
    alpha.runId,
  );
  assert.ok(alphaAfterDecision.decisions?.some((row: any) => row.id === alpha.decisionId));

  const betaReviews = await reviewView(browser, 'beta', evidence.betaWorkItem);
  const betaReport = betaReviews.reports.find((report: any) => report.id === evidence.betaReport);
  assert.ok(betaReport, 'The beta report must survive Factory backup and restart');
  const beta = await latestDecision(browser, 'beta', evidence.betaWorkItem, betaReport);
  await waitForReviewCompletion(browser, 'beta', evidence.betaWorkItem, beta.runId);

  const alphaPath = `/api/organizations/alpha/work-items/${evidence.alphaWorkItem}`;
  const publicationOperation = `docker-eval-publish-${evidence.alphaWorkItem}`;
  const publicationResult = await publicJson(browser, `${alphaPath}/review-publications`, {
    operationId: publicationOperation,
    run: alpha.runId,
    decision: alpha.decisionId,
  });
  assert.ok(['queued', 'completed'].includes(publicationResult.publication.status));
  const completedPublicationView = await waitFor(
    'Confirmed-content publication',
    () => reviewView(browser, 'alpha', evidence.alphaWorkItem),
    (view) =>
      view.publications.some(
        (row: any) => row.id === publicationResult.publication.id && row.status === 'completed',
      ),
  );
  const publication = completedPublicationView.publications.find(
    (row: any) => row.id === publicationResult.publication.id,
  );
  assert.equal(publication.status, 'completed');
  let effects = await boundarySummary();
  assert.equal(
    effects.effects.length,
    before.effects.length + (priorAlphaPublication?.status === 'completed' ? 0 : 1),
    'A confirmed publication must create exactly one controlled provider effect',
  );

  const replayedPublication = await publicJson(browser, `${alphaPath}/review-publications`, {
    operationId: publicationOperation,
    run: alpha.runId,
    decision: alpha.decisionId,
  });
  assert.equal(replayedPublication.publication.id, publication.id);
  effects = await boundarySummary();
  const expectedEffectCount =
    before.effects.length + (priorAlphaPublication?.status === 'completed' ? 0 : 1);
  assert.equal(
    effects.effects.length,
    expectedEffectCount,
    'Idempotent replay must not duplicate the provider effect',
  );

  if (process.argv.includes('--await-finalization')) {
    const board = await publicJson(
      browser,
      '/api/organizations/alpha/board?type=pull-request-review',
    );
    const finalize = board.items
      .find((item: any) => item.id === evidence.alphaWorkItem)
      ?.transitions.find((transition: any) => transition.id === 'finalize-review');
    assert.equal(finalize?.available, true);
    assert.equal(finalize.currentReportVersion, evidence.alphaReport);
    assert.equal((await publicJson(browser, alphaPath)).state, 'ready-for-review');
    console.log(
      JSON.stringify({
        ready: true,
        stage: 'publication-complete',
        alphaWorkItem: evidence.alphaWorkItem,
        alphaReport: evidence.alphaReport,
        alphaReviewRun: alpha.runId,
        alphaDecision: alpha.decisionId,
        alphaPublication: publication.id,
        betaWorkItem: evidence.betaWorkItem,
        betaReport: evidence.betaReport,
        betaReviewRun: beta.runId,
        betaDecision: beta.decisionId,
        state: 'ready-for-review',
        finalizeAvailable: finalize.available,
        providerEffectCount: effects.effects.length,
        checks: [
          'Human Review Decisions bind the retained reports and complete Review Workflows',
          'Explicit publication produces or retains one controlled GitHub effect',
          'The public Board offers distinct finalization for the confirmed published report',
          'No Finalization Workflow is requested before the operator UI checkpoint',
        ],
      }),
    );
    return;
  }

  const finalization = await publicJson(browser, `${alphaPath}/transition-requests`, {
    operationId: `docker-eval-finalize-${evidence.alphaWorkItem}`,
    transition: 'finalize-review',
    expectedState: 'ready-for-review',
    version: 4,
    inputs: { reportVersion: evidence.alphaReport },
  });
  assert.equal(finalization.workflowRun.workflow, 'review-finalization-v1');
  const finalizedItem = await waitFor(
    'Review Finalization Workflow',
    () => publicJson(browser, alphaPath),
    (item) => item.state === 'completed',
  );
  assert.equal(finalizedItem.state, 'completed');
  const finalReviews = await reviewView(browser, 'alpha', evidence.alphaWorkItem);
  assert.equal(
    finalReviews.runs.filter((row: any) => row.id === alpha.runId).length,
    1,
    'Finalization must preserve the original Review Workflow identity',
  );
  effects = await boundarySummary();
  assert.equal(
    effects.effects.length,
    expectedEffectCount,
    'Finalization must not replay publication',
  );

  console.log(
    JSON.stringify({
      ready: true,
      stage: 'completed',
      alphaWorkItem: evidence.alphaWorkItem,
      alphaReport: evidence.alphaReport,
      alphaReviewRun: alpha.runId,
      alphaDecision: alpha.decisionId,
      alphaPublication: publication.id,
      betaWorkItem: evidence.betaWorkItem,
      betaReport: evidence.betaReport,
      betaReviewRun: beta.runId,
      betaDecision: beta.decisionId,
      state: finalizedItem.state,
      providerEffectCount: effects.effects.length,
      checks: [
        'Review reports and human waits survive the operator backup and Factory restart',
        'Public Decision binds each retained report version and completes each Review Workflow once',
        'Publication is explicitly requested after human confirmation and produces one controlled GitHub effect',
        'Repeated publication request returns the same Activity without another provider effect',
        'Review Finalization Workflow separately completes the alpha Work Item without replaying publication',
      ],
    }),
  );
}

async function verifyRestoredWaits() {
  const evidence = JSON.parse(await readFile(evidenceFile, 'utf8')) as EvaluationEvidence;
  const browser = new BrowserClient();
  await browser.login(factoryOrigin, 'alice');
  const organizations = await publicJson(browser, '/api/organizations');
  assert.ok(organizations.items?.some((row: any) => row.id === 'alpha'));
  assert.ok(organizations.items?.some((row: any) => row.id === 'beta'));

  for (const [organization, workItem, reportId, reviewRun] of [
    ['alpha', evidence.alphaWorkItem, evidence.alphaReport, evidence.alphaReviewRun],
    ['beta', evidence.betaWorkItem, evidence.betaReport, evidence.betaReviewRun],
  ] as const) {
    const path = `/api/organizations/${organization}/work-items/${workItem}`;
    const item = await publicJson(browser, path);
    assert.equal(item.state, 'ready-for-review');
    assert.ok(item.activeRun, 'The retained human wait must keep Work Item ownership');
    const view = await reviewView(browser, organization, workItem);
    const report = view.reports.find((row: any) => row.id === reportId);
    const run = view.runs.find((row: any) => row.id === reviewRun);
    assert.ok(report, `The ${organization} report identity must survive isolated restore`);
    assert.ok(run, `The ${organization} Review Workflow identity must survive isolated restore`);
    assert.equal(run.status, 'waiting-review');
    assert.equal(
      view.decisions.length,
      0,
      'Restore verification must not invent a human Review Decision',
    );
    const artifact = await browser.request(`${factoryOrigin}${path}/reviews/${reportId}/artifact`);
    checkStatus(artifact.status, 200, `Restored private ${organization} report Artifact`);
    const anonymous = await fetch(`${factoryOrigin}${path}/reviews/${reportId}/artifact`);
    assert.equal(anonymous.status, 401);
  }
  const denied = await browser.json(
    factoryOrigin,
    `/api/organizations/beta/work-items/${evidence.alphaWorkItem}/reviews`,
  );
  assert.equal(denied.status, 404);
  const summary = await boundarySummary();
  assert.equal(summary.effects.length, 0, 'Restore hold must precede every publication effect');

  const verificationFile = resolve(
    repositoryRoot,
    '.runtime/docker-evaluation/restored-review-verification.json',
  );
  await writeFile(
    verificationFile,
    `${JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        factoryOrigin,
        alphaWorkItem: evidence.alphaWorkItem,
        alphaReport: evidence.alphaReport,
        alphaReviewRun: evidence.alphaReviewRun,
        betaWorkItem: evidence.betaWorkItem,
        betaReport: evidence.betaReport,
        betaReviewRun: evidence.betaReviewRun,
        publicationEffects: summary.effects.length,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify({
      ready: true,
      stage: 'restored-waits-verified',
      factoryOrigin,
      alphaWorkItem: evidence.alphaWorkItem,
      alphaReport: evidence.alphaReport,
      alphaReviewRun: evidence.alphaReviewRun,
      betaWorkItem: evidence.betaWorkItem,
      betaReport: evidence.betaReport,
      betaReviewRun: evidence.betaReviewRun,
      evidenceFile: verificationFile,
      checks: [
        'Restored Organizations expose the same retained Work Item and Review Workflow identities',
        'Both restored Work Items retain Review Decision waits and single-run ownership',
        'Restored report Artifacts remain private to authenticated Organization members',
        'No publication or Review Decision was created during read-only restore verification',
      ],
    }),
  );
}

async function checkFixture() {
  const directory = resolve(
    repositoryRoot,
    `.runtime/docker-evaluation/fixture-check-${randomUUID()}`,
  );
  await mkdir(directory, { recursive: true });
  const boundary = await createReviewBoundary({
    port: 0,
    host: '127.0.0.1',
    dataDirectory: directory,
  });
  try {
    const metadata = await boundaryMetadataAt(boundary.origin);
    const gitDirectory = join(directory, 'git-client');
    await execFileAsync('git', ['init', gitDirectory], { windowsHide: true, timeout: 30_000 });
    await execFileAsync(
      'git',
      [
        '-C',
        gitDirectory,
        'fetch',
        '--no-tags',
        `${boundary.origin}/repository.git`,
        metadata.sourceCommit,
      ],
      {
        windowsHide: true,
        timeout: 30_000,
        env: {
          ...process.env,
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: `http.${boundary.origin}/repository.git.extraHeader`,
          GIT_CONFIG_VALUE_0: `AUTHORIZATION: Basic ${Buffer.from(`x-access-token:${repositoryKey}`).toString('base64')}`,
          GIT_TERMINAL_PROMPT: '0',
        },
      },
    );
    const fetched = execFileSync('git', ['-C', gitDirectory, 'rev-parse', 'FETCH_HEAD'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
    assert.equal(
      fetched,
      metadata.sourceCommit,
      'The dumb-HTTP fixture must serve a real Git commit',
    );

    const first = await fetch(`${boundary.origin}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${alphaAiKey}` },
      body: JSON.stringify({
        model: 'docker-evaluation-model',
        messages: [{ role: 'user', content: 'Inspect the repository.' }],
      }),
    });
    checkStatus(first.status, 200, 'Controlled AI tool request');
    const toolCall = (await first.json()) as any;
    assert.equal(toolCall.choices[0].finish_reason, 'tool_calls');
    const final = await fetch(`${boundary.origin}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${alphaAiKey}` },
      body: JSON.stringify({
        model: 'docker-evaluation-model',
        messages: [
          { role: 'user', content: 'Inspect the repository.' },
          { role: 'tool', name: 'read', content: metadata.unchangedContent },
          { role: 'tool', name: 'changes', content: 'changed.ts' },
        ],
      }),
    });
    checkStatus(final.status, 200, 'Controlled AI result after Git tool execution');
    assert.equal(((await final.json()) as any).choices[0].finish_reason, 'stop');

    const publication = await fetch(`${boundary.origin}/repos/example/code/issues/42/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${publicationKey}` },
      body: JSON.stringify({ body: 'Confirmed fixture report' }),
    });
    checkStatus(publication.status, 201, 'Controlled GitHub publication');
    const firstEffect = (await publication.json()) as any;
    await boundary.close();

    const restarted = await createReviewBoundary({
      port: 0,
      host: '127.0.0.1',
      dataDirectory: directory,
    });
    try {
      const comments = await fetch(`${restarted.origin}/repos/example/code/issues/42/comments`, {
        headers: { authorization: `Bearer ${publicationKey}` },
      });
      checkStatus(comments.status, 200, 'Persisted controlled GitHub effects');
      const retained = (await comments.json()) as any[];
      assert.equal(retained.length, 1);
      assert.equal(retained[0].id, firstEffect.id);
      assert.equal(retained[0].body, 'Confirmed fixture report');
      const summaryResponse = await fetch(`${restarted.origin}/summary`);
      const summary = (await summaryResponse.json()) as any;
      assert.equal(
        summary.effects.length,
        1,
        'The effect journal must survive boundary process restart',
      );
    } finally {
      await restarted.close();
    }
  } finally {
    // The boundary may have been restarted above, so close is idempotent.
    await boundary.close().catch(() => {});
  }
  console.log(
    JSON.stringify({
      ready: true,
      stage: 'fixture-check',
      checks: [
        'Git dumb-HTTP commit fetch',
        'OpenAI-compatible tool-call and result flow',
        'Persistent mock publication survives boundary restart',
      ],
    }),
  );
}

async function boundaryMetadataAt(origin: string): Promise<BoundaryMetadata> {
  const { response, body } = await jsonAt(`${origin}/metadata`);
  checkStatus(response.status, 200, 'Local fixture metadata');
  return body as BoundaryMetadata;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--fixture-check')) return checkFixture();
  if (args.has('--hold')) return startHeldReviews();
  if (args.has('--verify')) return verifyRestoredWaits();
  if (args.has('--complete')) return completeHeldReviews();
  throw new Error('Choose --fixture-check, --hold, --verify, or --complete');
}

await main();
