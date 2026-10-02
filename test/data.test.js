import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { API_CATEGORIES, DATA_TYPES, PURPOSES, SOURCES, categoryById, categoryOfReason } from '../src/index.js';

const source = async (name) => readFile(new URL(`../research/sources/${name}.txt`, import.meta.url), 'utf8');

// The "### value NAME" blocks of a saved page: [{ name, lines }].
function blocks(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^### value (.+)$/.exec(line);
    if (m) out.push({ name: m[1], lines: [] });
    else if (out.length) out[out.length - 1].lines.push(line);
  }
  return out;
}

test('data: the categories, their APIs and their reason codes are those of the saved Apple page', async () => {
  const found = blocks(await source('nsprivacyaccessedapitype'));
  assert.deepEqual(found.map((b) => b.name), API_CATEGORIES.map((c) => c.id));
  for (const block of found) {
    const category = categoryById(block.name);
    const codes = block.lines.map((l) => /^- `([0-9A-F]{4}\.\d)`:/.exec(l)).filter(Boolean).map((m) => m[1]);
    assert.deepEqual(category.reasons.map((r) => r.code), codes, block.name);
    const apis = block.lines.map((l) => /^- (.+)$/.exec(l)).filter(Boolean).map((m) => m[1]).filter((a) => !/^`[0-9A-F]{4}\./.test(a)).map((a) => a.replaceAll('`', ''));
    assert.deepEqual(category.apis, apis, block.name);
  }
});

test('data: the reason codes are the values of the saved NSPrivacyAccessedAPITypeReasons page', async () => {
  const codes = blocks(await source('nsprivacyaccessedapitypereasons')).map((b) => b.name);
  assert.deepEqual(API_CATEGORIES.flatMap((c) => c.reasons.map((r) => r.code)), codes);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[0-9A-F]{4}\.\d$/);
});

test('data: the reasons that only a third-party SDK may declare are the ones the page says so for', async () => {
  const page = await source('nsprivacyaccessedapitype');
  const sdkOnly = API_CATEGORIES.flatMap((c) => c.reasons.filter((r) => r.sdkOnly).map((r) => r.code)).sort();
  const said = page.split('\n').filter((l) => l.includes('This reason may only be declared by third-party SDKs')).map((l) => /`([0-9A-F]{4}\.\d)`/.exec(l)[1]).sort();
  assert.deepEqual(sdkOnly, said);
  assert.deepEqual(sdkOnly, ['0A2A.1', 'C56D.1']);
});

test('data: the collected data types are the values of the saved NSPrivacyCollectedDataType page', async () => {
  assert.deepEqual(DATA_TYPES, blocks(await source('nsprivacycollecteddatatype')).map((b) => b.name));
  assert.equal(DATA_TYPES.length, 35);
});

test('data: the purposes are the values of the saved NSPrivacyCollectedDataTypePurposes page', async () => {
  assert.deepEqual(PURPOSES, blocks(await source('nsprivacycollecteddatatypepurposes')).map((b) => b.name));
  assert.equal(PURPOSES.length, 6);
});

test('data: every source page named in the data is saved, with its address on the first line', async () => {
  const files = await readdir(new URL('../research/sources/', import.meta.url));
  for (const s of SOURCES) {
    const name = s.url.split('/').pop();
    assert.ok(files.includes(`${name}.txt`), `${name}.txt is not saved`);
    assert.ok((await source(name)).startsWith(`Source: ${s.url}\n`), name);
  }
});

test('data: the saved pages hold no date or year, and no link to a store deadline', async () => {
  for (const file of await readdir(new URL('../research/sources/', import.meta.url))) {
    const text = await readFile(new URL(`../research/sources/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /\b(?:19|20)\d\d\b/, file);
  }
});

test('data: categoryById and categoryOfReason look a value up exactly, and never by a prototype name', () => {
  assert.equal(categoryById('NSPrivacyAccessedAPICategoryUserDefaults').name, 'User defaults');
  assert.equal(categoryById('nsprivacyaccessedapicategoryuserdefaults'), null);
  assert.equal(categoryById('__proto__'), null);
  assert.equal(categoryById('constructor'), null);
  assert.equal(categoryOfReason('C617.1').name, 'File timestamp');
  assert.equal(categoryOfReason('c617.1'), null);
});
