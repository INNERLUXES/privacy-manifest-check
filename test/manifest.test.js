import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManifest } from '../src/index.js';
import { apiEntry, dataEntry, manifest, plist, USER_DEFAULTS } from './helpers.js';

test('manifest: reads tracking, domains, data types and API types with their lines', () => {
  const text = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<plist version="1.0">',
    '<dict>',
    '<key>NSPrivacyTracking</key>',
    '<true/>',
    '<key>NSPrivacyTrackingDomains</key>',
    '<array><string>tracker.example.test</string></array>',
    '<key>NSPrivacyCollectedDataTypes</key>',
    '<array>',
    '<dict>',
    '<key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeName</string>',
    '<key>NSPrivacyCollectedDataTypeLinked</key><true/>',
    '<key>NSPrivacyCollectedDataTypeTracking</key><true/>',
    '<key>NSPrivacyCollectedDataTypePurposes</key><array><string>NSPrivacyCollectedDataTypePurposeAnalytics</string></array>',
    '</dict>',
    '</array>',
    '<key>NSPrivacyAccessedAPITypes</key>',
    '<array>',
    `<dict><key>NSPrivacyAccessedAPIType</key><string>${USER_DEFAULTS}</string>`,
    '<key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array></dict>',
    '</array>',
    '</dict>',
    '</plist>'
  ].join('\n');
  const m = parseManifest(text);
  assert.equal(m.tracking, true);
  assert.equal(m.trackingLine, 4);
  assert.deepEqual(m.domains, [{ value: 'tracker.example.test', line: 7 }]);
  assert.equal(m.domainsLine, 6);
  assert.equal(m.dataTypes.length, 1);
  assert.equal(m.dataTypes[0].type.value, 'NSPrivacyCollectedDataTypeName');
  assert.equal(m.dataTypes[0].linked, true);
  assert.equal(m.dataTypes[0].tracking, true);
  assert.deepEqual(m.dataTypes[0].purposes.map((p) => p.value), ['NSPrivacyCollectedDataTypePurposeAnalytics']);
  assert.equal(m.apiTypes.length, 1);
  assert.equal(m.apiTypes[0].type, USER_DEFAULTS);
  assert.equal(m.apiTypes[0].line, 19);
  assert.deepEqual(m.apiTypes[0].reasons.map((r) => r.value), ['CA92.1']);
  assert.deepEqual(m.issues, []);
});

test('manifest: a file without the keys is read as empty, and tracking stays null', () => {
  const m = parseManifest(plist(''));
  assert.equal(m.tracking, null);
  assert.deepEqual(m.domains, []);
  assert.deepEqual(m.dataTypes, []);
  assert.deepEqual(m.apiTypes, []);
});

test('manifest: values of the wrong type are listed as issues and left out of the model', () => {
  const m = parseManifest(plist('<key>NSPrivacyTracking</key><string>yes</string><key>NSPrivacyTrackingDomains</key><string>x</string><key>NSPrivacyAccessedAPITypes</key><dict/>'));
  assert.equal(m.tracking, null);
  assert.deepEqual(m.domains, []);
  assert.deepEqual(m.apiTypes, []);
  assert.deepEqual(m.issues.map((i) => i.subject), ['NSPrivacyTracking', 'NSPrivacyTrackingDomains', 'NSPrivacyAccessedAPITypes']);
});

test('manifest: a reasons array with a number in it keeps the strings and lists the number', () => {
  const m = parseManifest(plist(`<key>NSPrivacyAccessedAPITypes</key><array><dict><key>NSPrivacyAccessedAPIType</key><string>${USER_DEFAULTS}</string><key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string><integer>5</integer></array></dict></array>`));
  assert.deepEqual(m.apiTypes[0].reasons.map((r) => r.value), ['CA92.1']);
  assert.equal(m.issues.length, 1);
  assert.match(m.issues[0].message, /holds <integer> where a string was expected/);
});

test('manifest: an API entry without its type key, or that is not a dict, is listed as malformed', () => {
  const m = parseManifest(plist('<key>NSPrivacyAccessedAPITypes</key><array><dict><key>NSPrivacyAccessedAPITypeReasons</key><array/></dict><string>x</string></array>'));
  assert.deepEqual(m.apiTypes, []);
  assert.equal(m.malformed.length, 2);
  assert.match(m.malformed[0].message, /has no NSPrivacyAccessedAPIType/);
  assert.match(m.malformed[1].message, /is <string>, not a dict/);
});

test('manifest: a top value that is not a dict is refused', () => {
  assert.throws(() => parseManifest('<plist version="1.0"><array/></plist>', 'm'), /m: line 1: the top value is <array>, not a dict/);
});

test('manifest: the builders of the tests produce what the reader expects', () => {
  const m = parseManifest(manifest({ tracking: true, domains: ['a.example.test'], data: [dataEntry()], apis: [apiEntry(USER_DEFAULTS, ['CA92.1'])] }));
  assert.equal(m.tracking, true);
  assert.equal(m.domains.length, 1);
  assert.equal(m.dataTypes[0].has.purposes, true);
  assert.equal(m.apiTypes[0].reasons[0].value, 'CA92.1');
});
