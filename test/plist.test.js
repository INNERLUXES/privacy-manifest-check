import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlist, plistGet, lineOf, isBinaryPlist, parseXml, decodeEntities, textOf, XML_LIMITS, PLIST_DOCTYPE } from '../src/index.js';
import { plist } from './helpers.js';

test('plist: reads dict, array, string and booleans, with the line of each key', () => {
  const top = parsePlist(plist('<key>NSPrivacyTracking</key>\n<false/>\n<key>NSPrivacyTrackingDomains</key>\n<array>\n<string>tracker.example.test</string>\n</array>'));
  assert.equal(top.type, 'dict');
  const tracking = plistGet(top, 'NSPrivacyTracking');
  assert.equal(tracking.type, 'boolean');
  assert.equal(tracking.value, false);
  assert.equal(lineOf(tracking), 5);
  const domains = plistGet(top, 'NSPrivacyTrackingDomains');
  assert.equal(domains.value[0].value, 'tracker.example.test');
  assert.equal(lineOf(domains), 7);
  assert.equal(plistGet(top, 'missing'), null);
});

test('plist: an empty array and a true value are read', () => {
  const top = parsePlist(plist('<key>a</key><array/><key>b</key><true/>'));
  assert.deepEqual(plistGet(top, 'a').value, []);
  assert.equal(plistGet(top, 'b').value, true);
});

test('plist: the older "Apple Computer" DOCTYPE, a byte order mark and CRLF line breaks are accepted', () => {
  const text = String.fromCharCode(0xfeff) + plist('<key>a</key><string>x</string>').replace('//Apple//', '//Apple Computer//').split('\n').join('\r\n');
  const top = parsePlist(text);
  assert.equal(plistGet(top, 'a').value, 'x');
});

test('plist: a DOCTYPE with an internal subset is refused', () => {
  const text = `<?xml version="1.0"?>\n<!DOCTYPE plist [<!ENTITY x "boom">]>\n<plist version="1.0"><dict/></plist>`;
  assert.throws(() => parsePlist(text, 'a.xcprivacy'), /a\.xcprivacy: line 2: a DOCTYPE declaration is refused/);
});

test('plist: the public DOCTYPE line with something added is refused', () => {
  const text = plist('').replace(PLIST_DOCTYPE, PLIST_DOCTYPE.replace('>', ' [<!ENTITY x "y">]>'));
  assert.throws(() => parsePlist(text), /DOCTYPE declaration is refused/);
});

test('plist: an entity other than the five predefined ones is refused, and the five are decoded', () => {
  assert.throws(() => parsePlist(plist('<key>a</key><string>&xxe;</string>')), /the entity &xxe; is not one of/);
  assert.equal(decodeEntities('a &lt; b &amp; c &#65;&#x42;'), 'a < b & c AB');
  assert.throws(() => decodeEntities('a & b'), /bare "&"/);
});

test('plist: a binary property list is refused with the command that converts it', () => {
  const bytes = Buffer.from('bplist00\u0000\u0001', 'latin1');
  assert.equal(isBinaryPlist(bytes), true);
  assert.throws(() => parsePlist(bytes, 'PrivacyInfo.xcprivacy'), /binary property list.*plutil -convert xml1/);
});

test('plist: malformed input names the line of the fault', () => {
  assert.throws(() => parsePlist('<plist version="1.0">\n<dict>\n<key>a</key>\n</plist>', 'm'), /m: line 4: <\/plist> does not close <dict> from line 2/);
  assert.throws(() => parsePlist('<plist><dict>', 'm'), /m: line 1: <dict> from line 1 is not closed/);
  assert.throws(() => parsePlist('', 'm'), /m: line 1: no root element/);
  assert.throws(() => parsePlist('<plist><dict/></plist><plist/>', 'm'), /a second root element/);
});

test('plist: a root that is not <plist>, a dict with a key and no value, and a duplicate key are refused', () => {
  assert.throws(() => parsePlist('<html/>', 'm'), /the root element is <html>, not <plist>/);
  assert.throws(() => parsePlist(plist('<key>a</key>'), 'm'), /a <dict> needs a value after every <key>/);
  assert.throws(() => parsePlist(plist('<key>a</key><true/><key>a</key><false/>'), 'm'), /the key "a" appears twice/);
  assert.throws(() => parsePlist(plist('<key>a</key><bogus/>'), 'm'), /<bogus> is not a property list value/);
});

test('plist: nesting past the depth limit and past the element limit is refused', () => {
  const deep = '<array>'.repeat(XML_LIMITS.maxDepth + 1) + '</array>'.repeat(XML_LIMITS.maxDepth + 1);
  assert.throws(() => parseXml(`<plist>${deep}</plist>`, 'm'), /nested more than 64 deep/);
  assert.throws(() => parseXml('<a><b/><b/><b/></a>', 'm', { limits: { maxDepth: 64, maxElements: 3 } }), /more than 3 elements/);
});

test('plist: a key named __proto__ is plain data and changes no prototype', () => {
  const top = parsePlist(plist('<key>__proto__</key><string>x</string>'));
  assert.equal(plistGet(top, '__proto__').value, 'x');
  assert.equal(Object.getPrototypeOf(top.value), null);
  assert.equal({}.x, undefined);
});

test('xml: text and CDATA of an element are joined, and a text outside the root is refused', () => {
  const root = parseXml('<a>one <![CDATA[<two>]]> three</a>', 'm');
  assert.equal(textOf(root), 'one <two> three');
  assert.throws(() => parseXml('hello <a/>', 'm'), /text outside the root element/);
});
