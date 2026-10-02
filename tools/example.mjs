// Runs the README examples, checks that they report what the README shows, and writes the reports of the
// risky example project to examples/output. CI runs it and then fails if those files changed, so the example
// output in the repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, LIMITS } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// Runs the tool on a folder of the repository; paths in the report are relative to the repository.
async function run(argv) {
  let out = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => process.stderr.write(t) }, LIMITS, root);
  return { code, out };
}

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})`);
  }
}

const risky = await run([resolve(root, 'examples/ios-app')]);
process.stdout.write(risky.out);
expect('risky orders app', risky, 1, [
  'privacy-manifest-check: examples/ios-app',
  '  examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy: tracking false; 0 tracking domains; 1 collected data type; declares UserDefaults, DiskSpace',
  'source files: 3 scanned, 3 call required reason API',
  '  File timestamp: 2 calls in 2 files, not declared',
  '  User defaults: 2 calls in 2 files, declared',
  'findings: 1 error, 1 warning, 1 info',
  'ERROR    undeclared-api  examples/ios-app/OrdersApp/Legacy/OrderSync.m:17',
  'WARNING  data-type-incomplete  examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy:11',
  'INFO     unused-category  examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy:29',
  'note: left out 1 kind of folder (Pods); use --include-deps to read them',
  'GATE: FAIL - 1 error'
], ['GATE: PASS']);

process.stdout.write('\n');
const clean = await run([resolve(root, 'examples/ios-app-fixed'), '--fail-on', 'warning']);
process.stdout.write(clean.out);
expect('fixed orders app with --fail-on warning', clean, 0, [
  '  File timestamp: 2 calls in 2 files, declared',
  'findings: 0 error, 0 warning, 0 info',
  'GATE: PASS (--fail-on warning)'
], ['ERROR', 'WARNING', 'note:']);

// Pods is read when --include-deps is given: the boot time call there is not declared by the app manifest.
const deps = await run([resolve(root, 'examples/ios-app'), '--include-deps', '--format', 'csv']);
if (!deps.out.includes('Pods/Analytics/Tracker.swift,') || deps.out.includes('left out')) problems.push('--include-deps: the Pods folder was not read');

// The README shows both runs as they are printed.
const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
if (!readme.includes(risky.out)) problems.push('README: the sample output of the risky app differs from a real run');
if (!readme.includes(clean.out)) problems.push('README: the sample output of the fixed app differs from a real run');

// The same project in the other formats, kept as examples of what each one looks like.
await mkdir(resolve(root, 'examples/output'), { recursive: true });
await writeFile(resolve(root, 'examples/output/ios-app.txt'), risky.out);
for (const [format, name] of [['markdown', 'ios-app.md'], ['json', 'ios-app.json'], ['csv', 'ios-app.csv']]) {
  const r = await run([resolve(root, 'examples/ios-app'), '--format', format]);
  if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output', name), r.out);
}

if (problems.length) {
  for (const p of problems) console.error(`example: ${p}`);
  process.exit(1);
}
