import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('.', import.meta.url));
const checkpoints = fileURLToPath(new URL('../docs/fe-integration-test-checkpoints.md', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tasks = [
  ...(process.argv.includes('--clean') ? [['CP-04', 'Clean dependency install', npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund']]] : []),
  ['CP-02', 'Merged Node suites', npm, ['run', 'test:unit']],
  ['CP-03', 'App component integration', npm, ['exec', '--', 'vitest', 'run', '--reporter=verbose']],
  ['CP-04', 'Production build', npm, ['run', 'build']],
  ['CP-04', 'Whitespace verification', 'git', ['diff', '--check']],
];

function status(id, value) {
  const source = readFileSync(checkpoints, 'utf8');
  writeFileSync(checkpoints, source.replace(new RegExp(`(\\| ${id} \\|[^\\n]*?\\| )(PENDING|RUNNING|PASS|FAIL|BLOCKED)( \\|)`), `$1${value}$3`));
}

appendFileSync(checkpoints, `\n## Automated run ${new Date().toISOString()}\n\nRuntime: ${process.version}. Each task updates this file before and after execution. Test output below records each individual test result.\n`);
for (const [id, title, command, args] of tasks) {
  status(id, 'RUNNING');
  appendFileSync(checkpoints, `\n### ${id}: ${title} — RUNNING\n\nCommand from frontend: \`${command} ${args.join(' ')}\`\n`);
  const result = spawnSync(command, args, { cwd: frontend, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((line) => line.trimEnd()).join('\n');
  process.stdout.write(output);
  const passed = result.status === 0;
  status(id, passed ? 'PASS' : 'FAIL');
  appendFileSync(checkpoints, `\nResult: **${passed ? 'PASS' : 'FAIL'}**, exit ${result.status ?? 'not started'}.\n\n\`\`\`text\n${output}\n\`\`\`\n`);
  if (!passed) process.exit(result.status ?? 1);
}
