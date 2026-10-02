import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINDINGS } from '../src/index.js';
import {
  BOOT_TIME, DISK_SPACE, FILE_TIMESTAMP, KEYBOARDS, USER_DEFAULTS,
  SWIFT_DEFAULTS, SWIFT_TIMESTAMP, apiEntry, check, dataEntry, find, ids, manifest, plist
} from './helpers.js';

const DEFAULTS_OK = apiEntry(USER_DEFAULTS, ['CA92.1']);

test('check: a project whose code and manifest agree has no findings and passes', async () => {
  const report = await check({
    'App/Store.swift': SWIFT_DEFAULTS,
    'App/Dates.swift': SWIFT_TIMESTAMP,
    'App/PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK, apiEntry(FILE_TIMESTAMP, ['C617.1'])] })
  });
  assert.deepEqual(ids(report), []);
  assert.equal(report.gate.pass, true);
  assert.equal(report.scanned.sources, 2);
  assert.deepEqual(report.usage.map((u) => [u.name, u.declared, u.calls]), [['File timestamp', true, 1], ['User defaults', true, 1]]);
});

test('check: undeclared-api is an error at the first call, and names the category and the valid reasons', async () => {
  const report = await check({
    'a/First.swift': 'import Foundation\n\nlet x = UserDefaults.standard\nlet y = UserDefaults.standard\n',
    'b/Second.m': 'id d = [NSUserDefaults standardUserDefaults];\n',
    'PrivacyInfo.xcprivacy': manifest({ apis: [apiEntry(DISK_SPACE, ['E174.1'])] })
  });
  const [f] = find(report, 'undeclared-api');
  assert.equal(f.severity, 'error');
  assert.equal(f.file, 'a/First.swift');
  assert.equal(f.line, 3);
  assert.equal(f.subject, USER_DEFAULTS);
  assert.match(f.message, /User defaults API \(UserDefaults, NSUserDefaults\) is called 3 times in 2 files, first here/);
  assert.match(f.fix, /CA92\.1, 1C8F\.1, C56D\.1, AC6B\.1/);
  assert.equal(report.gate.pass, false);
  assert.match(report.gate.reason, /1 error/);
});

test('check: one finding per undeclared category', async () => {
  const report = await check({
    'a.swift': 'let a = mach_absolute_time()\nlet b = UITextInputMode.activeInputModes\nlet c = UserDefaults.standard\n',
    'PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK] })
  });
  assert.deepEqual(find(report, 'undeclared-api').map((f) => f.subject).sort(), [KEYBOARDS, BOOT_TIME].sort());
});

test('check: no manifest at all while required reason API is called is one error naming the categories', async () => {
  const report = await check({ 'Sources/A.swift': SWIFT_DEFAULTS, 'Sources/B.swift': SWIFT_TIMESTAMP });
  assert.deepEqual(ids(report), ['no-manifest']);
  const [f] = report.findings;
  assert.equal(f.severity, 'error');
  assert.equal(f.file, 'Sources/A.swift');
  assert.equal(f.line, 2);
  assert.match(f.message, /no PrivacyInfo\.xcprivacy was found.*FileTimestamp, UserDefaults/);
  assert.equal(report.gate.pass, false);
});

test('check: no manifest and no required reason API is a note, not a finding', async () => {
  const report = await check({ 'A.swift': 'print("hello")\n' });
  assert.deepEqual(ids(report), []);
  assert.ok(report.notes.some((n) => /no PrivacyInfo\.xcprivacy was found, and no required reason API/.test(n)));
  assert.equal(report.gate.pass, true);
});

test('check: a declared category with an empty reasons array, or no reasons key, is a no-reason error', async () => {
  const report = await check({
    'PrivacyInfo.xcprivacy': manifest({ apis: [apiEntry(USER_DEFAULTS, []), apiEntry(DISK_SPACE, null)] }),
    'a.swift': SWIFT_DEFAULTS
  });
  const found = find(report, 'no-reason');
  assert.equal(found.length, 2);
  assert.ok(found.every((f) => f.severity === 'error'));
  assert.deepEqual(found.map((f) => f.subject).sort(), [DISK_SPACE, USER_DEFAULTS].sort());
  assert.match(found.find((f) => f.subject === USER_DEFAULTS).fix, /CA92\.1/);
});

test('check: a reason code that is not valid for the category is an invalid-reason error with its line', async () => {
  const text = [
    '<key>NSPrivacyAccessedAPITypes</key>',
    '<array>',
    '<dict>',
    `<key>NSPrivacyAccessedAPIType</key><string>${USER_DEFAULTS}</string>`,
    '<key>NSPrivacyAccessedAPITypeReasons</key>',
    '<array>',
    '<string>CA92.1</string>',
    '<string>C617.1</string>',
    '<string>ZZZZ.9</string>',
    '</array>',
    '</dict>',
    '</array>'
  ].join('\n');
  const report = await check({ 'PrivacyInfo.xcprivacy': plist(text), 'a.swift': SWIFT_DEFAULTS });
  const found = find(report, 'invalid-reason');
  assert.equal(found.length, 2);
  const [other, unknown] = found;
  assert.equal(other.severity, 'error');
  assert.equal(other.file, 'PrivacyInfo.xcprivacy');
  assert.equal(other.line, 12);
  assert.match(other.message, /C617\.1 is not a reason Apple lists for UserDefaults; it belongs to FileTimestamp/);
  assert.equal(unknown.line, 13);
  assert.match(unknown.message, /ZZZZ\.9 is not a reason Apple lists for UserDefaults$/);
  assert.match(unknown.fix, /Use one of CA92\.1, 1C8F\.1, C56D\.1, AC6B\.1/);
});

test('check: reason codes are compared exactly, case included, and an empty string is invalid', async () => {
  const report = await check({
    'PrivacyInfo.xcprivacy': manifest({ apis: [apiEntry(USER_DEFAULTS, ['ca92.1', ' CA92.1', ''])] }),
    'a.swift': SWIFT_DEFAULTS
  });
  assert.equal(find(report, 'invalid-reason').length, 3);
  assert.match(find(report, 'invalid-reason')[2].message, /\(empty\) is not a reason/);
});

test('check: every valid reason of every category is accepted', async () => {
  const { API_CATEGORIES } = await import('../src/index.js');
  const apis = API_CATEGORIES.map((c) => apiEntry(c.id, c.reasons.map((r) => r.code)));
  const report = await check({
    'PrivacyInfo.xcprivacy': manifest({ apis }),
    'a.swift': 'UserDefaults\nmach_absolute_time()\nactiveInputModes\nvolumeTotalCapacityKey\n[.modificationDate]\n'
  });
  assert.deepEqual(ids(report), []);
});

test('check: a declared category that no code calls is an unused-category info and does not fail the gate', async () => {
  const report = await check({ 'a.swift': SWIFT_DEFAULTS, 'PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK, apiEntry(DISK_SPACE, ['E174.1'])] }) });
  assert.deepEqual(ids(report), ['unused-category']);
  assert.equal(report.findings[0].severity, 'info');
  assert.equal(report.findings[0].subject, DISK_SPACE);
  assert.equal(report.gate.pass, true);
});

test('check: unused categories are not judged when no source file was scanned', async () => {
  const report = await check({ 'PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK] }) });
  assert.deepEqual(ids(report), []);
  assert.ok(report.notes.some((n) => /no Swift or Objective-C source file was scanned/.test(n)));
});

test('check: NSPrivacyTracking true with no tracking domains is a warning at the key', async () => {
  const report = await check({ 'PrivacyInfo.xcprivacy': manifest({ tracking: true }) });
  const [f] = find(report, 'tracking-without-domains');
  assert.equal(f.severity, 'warning');
  assert.equal(f.file, 'PrivacyInfo.xcprivacy');
  assert.equal(f.line, 5);
  assert.equal(report.gate.pass, true);
});

test('check: tracking domains listed while NSPrivacyTracking is false, or missing, is a warning', async () => {
  const off = await check({ 'PrivacyInfo.xcprivacy': manifest({ tracking: false, domains: ['t.example.test'] }) });
  assert.match(find(off, 'domains-without-tracking')[0].message, /1 tracking domain listed, and NSPrivacyTracking is false/);
  const unset = await check({ 'PrivacyInfo.xcprivacy': manifest({ tracking: null, domains: ['t.example.test', 'u.example.test'] }) });
  assert.match(find(unset, 'domains-without-tracking')[0].message, /2 tracking domains listed, and NSPrivacyTracking is not set/);
  const on = await check({ 'PrivacyInfo.xcprivacy': manifest({ tracking: true, domains: ['t.example.test'] }) });
  assert.deepEqual(ids(on), []);
});

test('check: a collected data type without Linked, Tracking or Purposes is a warning that names what is missing', async () => {
  const report = await check({
    'PrivacyInfo.xcprivacy': manifest({ data: [dataEntry(undefined, { linked: null, tracking: null, purposes: null }), dataEntry('NSPrivacyCollectedDataTypeName', { purposes: [] }), dataEntry('NSPrivacyCollectedDataTypeUserID')] })
  });
  const found = find(report, 'data-type-incomplete');
  assert.equal(found.length, 2);
  assert.equal(found[0].severity, 'warning');
  assert.match(found[0].message, /NSPrivacyCollectedDataTypeEmailAddress lacks NSPrivacyCollectedDataTypeLinked, NSPrivacyCollectedDataTypeTracking, NSPrivacyCollectedDataTypePurposes$/);
  assert.match(found[1].message, /NSPrivacyCollectedDataTypeName lacks NSPrivacyCollectedDataTypePurposes \(empty\)$/);
});

test('check: a data type or a purpose that Apple does not list is a warning', async () => {
  const report = await check({
    'PrivacyInfo.xcprivacy': manifest({ data: [dataEntry('NSPrivacyCollectedDataTypeShoeSize', { purposes: ['NSPrivacyCollectedDataTypePurposeAnalytics', 'Marketing'] })] })
  });
  assert.deepEqual(ids(report), ['unknown-data-type', 'unknown-purpose']);
  assert.ok(report.findings.every((f) => f.severity === 'warning'));
  assert.equal(report.findings[1].subject, 'Marketing');
});

test('check: every collected data type and purpose Apple lists is accepted', async () => {
  const { DATA_TYPES, PURPOSES } = await import('../src/index.js');
  const report = await check({ 'PrivacyInfo.xcprivacy': manifest({ data: DATA_TYPES.map((t) => dataEntry(t, { purposes: PURPOSES })) }) });
  assert.deepEqual(ids(report), []);
});

test('check: an API category that Apple does not list is a warning, and its reasons are not judged', async () => {
  const report = await check({ 'PrivacyInfo.xcprivacy': manifest({ apis: [apiEntry('NSPrivacyAccessedAPICategoryBattery', ['XXXX.1'])] }), 'a.swift': 'let a = 1\n' });
  assert.deepEqual(ids(report), ['unknown-api-category']);
});

test('check: the same category declared twice in one manifest is a warning', async () => {
  const report = await check({ 'PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK, apiEntry(USER_DEFAULTS, ['1C8F.1'])] }), 'a.swift': SWIFT_DEFAULTS });
  assert.deepEqual(ids(report), ['duplicate-category']);
});

test('check: the same category in two manifests is not a duplicate, and either one declares it', async () => {
  const report = await check({
    'App/PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK] }),
    'Kit/PrivacyInfo.xcprivacy': manifest({ apis: [apiEntry(FILE_TIMESTAMP, ['C617.1'])] }),
    'App/a.swift': SWIFT_DEFAULTS,
    'Kit/b.swift': SWIFT_TIMESTAMP
  });
  assert.deepEqual(ids(report), []);
  assert.equal(report.manifests.length, 2);
});

test('check: a wrong type under a known key, and an entry without its type key, are warnings', async () => {
  const report = await check({
    'PrivacyInfo.xcprivacy': plist('<key>NSPrivacyTracking</key><string>no</string><key>NSPrivacyAccessedAPITypes</key><array><dict/></array><key>NSPrivacyCollectedDataTypes</key><array><dict/></array>')
  });
  assert.deepEqual(ids(report), ['data-type-incomplete', 'malformed-entry', 'malformed-entry', 'invalid-value']);
  assert.ok(report.findings.every((f) => f.severity === 'warning'));
});

test('check: a manifest that cannot be parsed is a parse-error with its path and line, and the others are still checked', async () => {
  const report = await check({
    'Broken/PrivacyInfo.xcprivacy': '<plist version="1.0">\n<dict>\n<key>a</key>\n</plist>',
    'Good/PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK] }),
    'Good/a.swift': SWIFT_TIMESTAMP
  });
  const [parse, undeclared] = report.findings;
  assert.equal(parse.id, 'parse-error');
  assert.equal(parse.severity, 'error');
  assert.equal(parse.file, 'Broken/PrivacyInfo.xcprivacy');
  assert.equal(parse.line, 4);
  assert.match(parse.message, /Broken\/PrivacyInfo\.xcprivacy cannot be read: <\/plist> does not close <dict> from line 2/);
  assert.equal(undeclared.id, 'undeclared-api');
  assert.equal(report.manifests.find((m) => m.file === 'Broken/PrivacyInfo.xcprivacy').readable, false);
  assert.equal(report.gate.pass, false);
});

test('check: a binary manifest is a parse-error that says how to convert it', async () => {
  const report = await check({ 'PrivacyInfo.xcprivacy': Buffer.from([0x62, 0x70, 0x6c, 0x69, 0x73, 0x74, 0x30, 0x30, 0x00]) });
  assert.equal(report.findings[0].id, 'parse-error');
  assert.match(report.findings[0].message, /plutil -convert xml1/);
});

test('check: when no manifest can be read, code is not compared and a note says so', async () => {
  const report = await check({ 'PrivacyInfo.xcprivacy': 'not xml at all', 'a.swift': SWIFT_DEFAULTS });
  assert.deepEqual(ids(report), ['parse-error']);
  assert.ok(report.notes.some((n) => /no manifest could be read, so they were not compared/.test(n)));
});

test('check: a manifest in the Pods folder is ignored by default and read with includeDeps', async () => {
  const files = { 'a.swift': SWIFT_DEFAULTS, 'PrivacyInfo.xcprivacy': manifest({ apis: [DEFAULTS_OK] }), 'Pods/Lib/PrivacyInfo.xcprivacy': 'broken', 'Pods/Lib/l.swift': 'let x = 1\n' };
  assert.deepEqual(ids(await check(files)), []);
  const deps = await check(files, { includeDeps: true });
  assert.deepEqual(ids(deps), ['parse-error']);
  assert.equal(deps.findings[0].file, 'Pods/Lib/PrivacyInfo.xcprivacy');
});

test('check: --fail-on warning gates on warnings, and the default gates on errors only', async () => {
  const files = { 'PrivacyInfo.xcprivacy': manifest({ tracking: true }) };
  assert.equal((await check(files)).gate.pass, true);
  const strict = await check(files, { failOn: 'warning' });
  assert.equal(strict.gate.pass, false);
  assert.equal(strict.gate.reason, '1 warning');
});

test('check: findings are ordered errors first, then by check, file and line', async () => {
  const report = await check({
    'z.swift': 'let a = mach_absolute_time()\n',
    'PrivacyInfo.xcprivacy': manifest({ tracking: true, apis: [apiEntry(DISK_SPACE, ['E174.1'])] })
  });
  assert.deepEqual(ids(report), ['undeclared-api', 'tracking-without-domains', 'unused-category']);
});

test('check: the report never holds the text of a source file, only names and positions', async () => {
  const secret = 'value-that-must-not-appear-in-a-report';
  const report = await check({ 'a.swift': `let token = "${secret}"\nlet d = UserDefaults.standard\n`, 'b.m': `NSString *p = @"${secret}"; mach_absolute_time();\n` });
  assert.ok(!JSON.stringify(report).includes(secret));
});

test('check: control and direction characters from the input are replaced in every text of the report', async () => {
  const esc = String.fromCharCode(0x1b);
  const report = await check({ 'PrivacyInfo.xcprivacy': manifest({ apis: [apiEntry('NSPrivacy&#x1B;[31mBad&#x202E;', ['&#x07;X'])] }) });
  const json = JSON.stringify(report);
  assert.ok(!json.includes(esc));
  assert.ok(!json.includes(String.fromCharCode(0x202e)));
  assert.ok(!json.includes(String.fromCharCode(7)));
  assert.equal(report.findings[0].id, 'unknown-api-category');
});

test('check: a file given instead of a folder, and a folder that does not exist, are errors', async () => {
  const { checkProject } = await import('../src/index.js');
  const { withFiles } = await import('./helpers.js');
  await withFiles({ 'a.swift': 'x' }, async (dir) => {
    await assert.rejects(checkProject(`${dir}/a.swift`), /a file, not a folder/);
    await assert.rejects(checkProject(`${dir}/none`), /no such folder/);
  });
});

test('check: a source file over the size limit is left out with a note, and the run goes on', async () => {
  const { checkProject } = await import('../src/index.js');
  const { withFiles } = await import('./helpers.js');
  await withFiles({ 'big.swift': 'x'.repeat(100), 'PrivacyInfo.xcprivacy': '<plist version="1.0"><dict/></plist>' }, async (dir) => {
    const report = await checkProject(dir, { base: dir, limits: { maxFileBytes: 50, maxFiles: 1000, maxDepth: 10 } });
    assert.equal(report.scanned.sources, 0);
    assert.ok(report.notes.some((n) => /big\.swift: not scanned \(100 bytes is over the/.test(n)));
  });
});

test('check: every finding id is documented, and ids and severities are unique and valid', async () => {
  const { readFile } = await import('node:fs/promises');
  const method = await readFile(new URL('../docs/method.md', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.equal(new Set(FINDINGS.map((f) => f.id)).size, FINDINGS.length);
  for (const f of FINDINGS) {
    assert.ok(['error', 'warning', 'info'].includes(f.severity));
    assert.ok(method.includes(`\`${f.id}\``), `docs/method.md does not describe ${f.id}`);
    assert.ok(readme.includes(`\`${f.id}\``), `README.md does not list ${f.id}`);
  }
});
