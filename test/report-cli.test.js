import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, mdCell, parseArgs, VERSION, USAGE, toText, toMarkdown, toJson, toCsv } from '../src/index.js';
import { USER_DEFAULTS, DISK_SPACE, SWIFT_DEFAULTS, SWIFT_TIMESTAMP, apiEntry, check, cli, manifest, run } from './helpers.js';

const RISKY = {
  'App/PrivacyInfo.xcprivacy': manifest({ tracking: true, apis: [apiEntry(USER_DEFAULTS, ['CA92.1']), apiEntry(DISK_SPACE, ['E174.1'])] }),
  'App/Store.swift': SWIFT_DEFAULTS,
  'App/Dates.swift': SWIFT_TIMESTAMP
};
const CLEAN = {
  'App/PrivacyInfo.xcprivacy': manifest({ apis: [apiEntry(USER_DEFAULTS, ['CA92.1'])] }),
  'App/Store.swift': SWIFT_DEFAULTS
};

test('text report: header, manifests, usage, counts, findings with fix, notes and the gate line', async () => {
  const text = toText(await check(RISKY));
  const lines = text.split('\n');
  assert.equal(lines[0], 'privacy-manifest-check: .');
  assert.ok(text.includes('manifests: 1\n  App/PrivacyInfo.xcprivacy: tracking true; 0 tracking domains; 0 collected data types; declares UserDefaults, DiskSpace\n'));
  assert.ok(text.includes('source files: 2 scanned, 2 call required reason API\n'));
  assert.ok(text.includes('required reason API in code:\n  File timestamp: 1 call in 1 file, not declared\n  User defaults: 1 call in 1 file, declared\n'));
  assert.ok(text.includes('findings: 1 error, 1 warning, 1 info\n'));
  assert.ok(text.includes('ERROR    undeclared-api  App/Dates.swift:3\n         File timestamp API'));
  assert.ok(text.includes('\n         fix: Add an NSPrivacyAccessedAPITypes entry for NSPrivacyAccessedAPICategoryFileTimestamp'));
  assert.ok(text.endsWith('\nGATE: FAIL - 1 error\n'));
});

test('text report: a clean project says there are no findings and the gate passes', async () => {
  const text = toText(await check(CLEAN));
  assert.ok(text.includes('\nno findings\n'));
  assert.ok(text.endsWith('GATE: PASS (--fail-on error)\n'));
});

test('markdown report: tables for manifests, usage and findings, and a gate line', async () => {
  const md = toMarkdown(await check(RISKY));
  assert.ok(md.startsWith('## privacy-manifest-check: 1 error, 1 warning, 1 info\n'));
  assert.ok(md.includes('| Manifest | Settings |'));
  assert.ok(md.includes('| Required reason API in code | Calls | Files | Declared |\n| --- | --- | --- | --- |\n| File timestamp | 1 | 1 | no |'));
  assert.ok(md.includes('| Severity | Check | Where | Message | Fix |'));
  assert.ok(md.includes('| error | undeclared-api | App/Dates.swift:3 |'));
  assert.ok(md.endsWith('**Gate failed:** 1 error.\n'));
});

test('markdown report: pipes, angle brackets and backslashes from the input cannot break a table', () => {
  assert.equal(mdCell('a|b <c> & d\\e\nf'), 'a\\|b &lt;c&gt; &amp; d\\\\e f');
});

test('json report: parses, and holds the manifests, the usage with every call, the findings and the gate', async () => {
  const report = JSON.parse(toJson(await check(RISKY)));
  assert.equal(report.tool, 'privacy-manifest-check');
  assert.equal(report.manifests[0].file, 'App/PrivacyInfo.xcprivacy');
  assert.equal(report.manifests[0].tracking, true);
  assert.deepEqual(report.usage[0].uses, [{ file: 'App/Dates.swift', line: 3, symbol: 'modificationDate' }]);
  assert.deepEqual(report.counts, { error: 1, warning: 1, info: 1 });
  assert.deepEqual(Object.keys(report.findings[0]), ['id', 'severity', 'file', 'line', 'subject', 'message', 'fix']);
  assert.equal(report.gate.pass, false);
  assert.equal(report.gate.failOn, 'error');
});

test('csv report: a header, one row per finding, RFC 4180 quoting and CRLF line ends', async () => {
  const csv = toCsv(await check(RISKY));
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'severity,id,file,line,subject,message,fix');
  assert.equal(lines.length, 5);
  assert.ok(lines[1].startsWith('error,undeclared-api,App/Dates.swift,3,NSPrivacyAccessedAPICategoryFileTimestamp,"File timestamp API'));
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
});

test('csv report: a cell a spreadsheet would read as a formula gets a leading quote', () => {
  for (const start of ['=', '+', '-', '@']) assert.equal(csvCell(`${start}SUM(A1)`), `'${start}SUM(A1)`);
  assert.equal(csvCell(null), '');
});

test('cli: exit 0 for a clean project and the text report on standard output', async () => {
  const r = await run(CLEAN);
  assert.equal(r.code, 0);
  assert.equal(r.err, '');
  assert.ok(r.out.includes('GATE: PASS'));
});

test('cli: exit 1 when a finding is at the --fail-on level', async () => {
  const r = await run(RISKY);
  assert.equal(r.code, 1);
  assert.ok(r.out.includes('GATE: FAIL - 1 error'));
});

test('cli: --fail-on warning fails on a warning, and the default does not', async () => {
  const files = { 'PrivacyInfo.xcprivacy': manifest({ tracking: true }) };
  assert.equal((await run(files)).code, 0);
  assert.equal((await run(files, ['--fail-on', 'warning'])).code, 1);
});

test('cli: --format markdown, json and csv choose the output', async () => {
  assert.ok((await run(CLEAN, ['--format', 'markdown'])).out.startsWith('## privacy-manifest-check'));
  assert.equal(JSON.parse((await run(CLEAN, ['--format', 'json'])).out).tool, 'privacy-manifest-check');
  assert.ok((await run(CLEAN, ['--format', 'csv'])).out.startsWith('severity,id,'));
});

test('cli: --include-deps reads the Pods folder', async () => {
  const files = { ...CLEAN, 'Pods/Lib/l.swift': 'let t = mach_absolute_time()\n' };
  assert.equal((await run(files)).code, 0);
  const deps = await run(files, ['--include-deps']);
  assert.equal(deps.code, 1);
  assert.ok(deps.out.includes('Pods/Lib/l.swift:1'));
});

test('cli: a folder that does not exist is exit 2 with a message on standard error', async () => {
  const r = await cli(['/this/folder/does/not/exist']);
  assert.equal(r.code, 2);
  assert.equal(r.out, '');
  assert.match(r.err, /privacy-manifest-check: .*: no such folder/);
});

test('cli: usage errors are exit 2 and show the usage', async () => {
  for (const argv of [[], ['--format'], ['.', '--format', 'xml'], ['.', '--fail-on', 'info'], ['.', '--bogus'], ['a', 'b'], ['-']]) {
    const r = await cli(argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.ok(r.err.includes('Usage: privacy-manifest-check'));
  }
});

test('cli: a URL is refused, the tool never fetches', async () => {
  const r = await cli(['https://example.test/app']);
  assert.equal(r.code, 2);
  assert.match(r.err, /never fetches a URL/);
});

test('cli: --help and --version exit 0', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  const version = await cli(['--version']);
  assert.equal(version.code, 0);
  assert.equal(version.out, `${VERSION}\n`);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('cli: parseArgs reads the folder and the options', () => {
  assert.deepEqual(parseArgs(['app', '--include-deps', '--format', 'json', '--fail-on', 'warning']), { folder: 'app', includeDeps: true, format: 'json', failOn: 'warning', help: false, version: false });
});

test('cli: an error message with control characters is cleaned before it is printed', async () => {
  const r = await cli([`bad${String.fromCharCode(27)}[2Jfolder`]);
  assert.equal(r.code, 2);
  assert.ok(!r.err.includes(String.fromCharCode(27)));
});
