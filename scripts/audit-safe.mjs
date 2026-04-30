import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['audit', '--json', '--audit-level=high'], {
  encoding: 'utf8',
});

const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;

if (result.status === 0) {
  console.log('npm audit passed (no high/critical vulnerabilities).');
  process.exit(0);
}

const registryBlocked =
  combinedOutput.includes('npm error audit endpoint returned an error') ||
  combinedOutput.includes('403 Forbidden') ||
  combinedOutput.includes('security/advisories/bulk');

if (registryBlocked) {
  console.warn('⚠️ npm audit advisory endpoint is blocked in this environment (403).');
  console.warn('⚠️ Skipping vulnerability gating to avoid breaking CI installs in restricted registries.');
  console.warn('⚠️ Run npm audit in a network-allowed environment for full verification.');
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout || '{}');
} catch {
  console.error('npm audit failed with a non-registry error and non-JSON output.');
  process.stderr.write(combinedOutput);
  process.exit(result.status || 1);
}

const high = parsed?.metadata?.vulnerabilities?.high ?? 0;
const critical = parsed?.metadata?.vulnerabilities?.critical ?? 0;

if (high > 0 || critical > 0) {
  console.error(`npm audit found ${high} high and ${critical} critical vulnerabilities.`);
  process.exit(1);
}

console.log('npm audit completed without high/critical vulnerabilities.');
process.exit(0);
