import { execFileSync } from 'node:child_process';

let output = '';
try {
  output = execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/installation.ts', 'status'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    },
  );
} catch (error) {
  const stdout = error.stdout;
  output = typeof stdout === 'string' ? stdout : (stdout?.toString('utf8') ?? '');
}

let status;
try {
  status = JSON.parse(output);
} catch {
  process.exit(1);
}

const backupInProgress = status.backup?.state === 'running';
const restoreHoldActive = status.restoreHold?.activated === false;
const webAvailable = status.web === true;
const workerAvailable = status.worker === true || restoreHoldActive;

process.exitCode =
  status.coordinator === 'running' && (backupInProgress || (webAvailable && workerAvailable))
    ? 0
    : 1;
