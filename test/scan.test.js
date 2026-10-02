import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlink } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { scanFolder, readBounded, displayPath, SKIP_DIRS } from '../src/index.js';
import { manifest, withFiles, check, SWIFT_DEFAULTS } from './helpers.js';

const rel = (dir, list) => list.map((p) => relative(dir, p).split(sep).join('/'));

test('scan: Pods, Carthage, build, DerivedData, .git and node_modules are left out by default', async () => {
  const files = { 'App/a.swift': 'x' };
  for (const d of SKIP_DIRS) files[`${d}/lib.swift`] = 'x';
  files['Sub/Pods/inner.swift'] = 'x';
  await withFiles(files, async (dir) => {
    const found = await scanFolder(dir);
    assert.deepEqual(rel(dir, found.sources), ['App/a.swift']);
    assert.deepEqual([...found.skippedDirs].sort(), [...SKIP_DIRS].sort());
  });
});

test('scan: the skipped folders are read with includeDeps', async () => {
  const files = { 'a.swift': 'x', 'Pods/p.swift': 'x', 'Pods/Lib/PrivacyInfo.xcprivacy': '<plist/>', 'node_modules/n.h': 'x' };
  await withFiles(files, async (dir) => {
    const found = await scanFolder(dir, { includeDeps: true });
    assert.deepEqual(rel(dir, found.sources), ['Pods/p.swift', 'a.swift', 'node_modules/n.h'].sort());
    assert.deepEqual(rel(dir, found.manifests), ['Pods/Lib/PrivacyInfo.xcprivacy']);
    assert.equal(found.skippedDirs.size, 0);
  });
});

test('scan: only .swift, .m, .mm and .h files are source files, and the extension is compared exactly', async () => {
  const files = { 'a.swift': 'x', 'b.m': 'x', 'c.mm': 'x', 'd.h': 'x', 'e.c': 'x', 'f.txt': 'x', 'g.swift.bak': 'x', 'h.SWIFT': 'x', 'swift': 'x' };
  await withFiles(files, async (dir) => {
    assert.deepEqual(rel(dir, (await scanFolder(dir)).sources), ['a.swift', 'b.m', 'c.mm', 'd.h']);
  });
});

test('scan: the manifest name is compared exactly, letter case included', async () => {
  const files = { 'a/PrivacyInfo.xcprivacy': '<plist/>', 'b/privacyinfo.xcprivacy': '<plist/>', 'c/PrivacyInfo.xcprivacy.bak': '<plist/>', 'd/PrivacyInfo.XCPRIVACY': '<plist/>' };
  await withFiles(files, async (dir) => {
    assert.deepEqual(rel(dir, (await scanFolder(dir)).manifests), ['a/PrivacyInfo.xcprivacy']);
  });
});

test('scan: the list is sorted by name and the same on every run', async () => {
  const files = { 'z/b.swift': 'x', 'z/a.swift': 'x', 'a/z.swift': 'x', 'B.swift': 'x', 'a.swift': 'x' };
  await withFiles(files, async (dir) => {
    const first = rel(dir, (await scanFolder(dir)).sources);
    const second = rel(dir, (await scanFolder(dir)).sources);
    assert.deepEqual(first, second);
    assert.deepEqual(first, ['B.swift', 'a.swift', 'a/z.swift', 'z/a.swift', 'z/b.swift']);
  });
});

test('scan: a symbolic link is not followed', async () => {
  await withFiles({ 'real/a.swift': 'x' }, async (dir) => {
    // A junction is the link a Windows user can make without extra rights; elsewhere a directory symlink.
    await symlink(resolve(dir, 'real'), resolve(dir, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    let expected = 1;
    if (process.platform !== 'win32') {
      await symlink(resolve(dir, 'real/a.swift'), resolve(dir, 'alias.swift'), 'file');
      expected = 2;
    }
    const found = await scanFolder(dir);
    assert.deepEqual(rel(dir, found.sources), ['real/a.swift']);
    assert.equal(found.links, expected);
  });
});

test('scan: folders nested past the depth limit and past the entry limit are named, not followed', async () => {
  await withFiles({ 'a/b/c/d.swift': 'x', 'top.swift': 'x' }, async (dir) => {
    const shallow = await scanFolder(dir, { limits: { maxFileBytes: 1000, maxFiles: 1000, maxDepth: 1 } });
    assert.deepEqual(rel(dir, shallow.sources), ['top.swift']);
    assert.equal(shallow.tooDeep, 1);
    const few = await scanFolder(dir, { limits: { maxFileBytes: 1000, maxFiles: 1, maxDepth: 5 } });
    assert.equal(few.truncated, true);
  });
});

test('scan: readBounded reads a file, and refuses a missing one, a folder and one over the limit', async () => {
  await withFiles({ 'a.txt': 'hello', 'dir/x': 'y' }, async (dir) => {
    assert.equal((await readBounded(resolve(dir, 'a.txt'))).toString(), 'hello');
    await assert.rejects(readBounded(resolve(dir, 'none')), (e) => e.reason === 'no such file');
    await assert.rejects(readBounded(resolve(dir, 'dir')), (e) => /folder|not a regular file|cannot be read/.test(e.reason));
    await assert.rejects(readBounded(resolve(dir, 'a.txt'), { maxFileBytes: 4 }), (e) => /5 bytes is over the/.test(e.reason));
  });
});

test('paths: findings use forward slashes and are relative to the base, for a nested project', async () => {
  const report = await check({ 'app/Sources/Deep/Store.swift': SWIFT_DEFAULTS, 'app/PrivacyInfo.xcprivacy': manifest() });
  const f = report.findings.find((x) => x.id === 'undeclared-api');
  assert.equal(f.file, 'app/Sources/Deep/Store.swift');
  assert.equal(f.line, 2);
  assert.equal(report.manifests[0].file, 'app/PrivacyInfo.xcprivacy');
  assert.equal(report.folder, '.');
  for (const x of report.findings) assert.ok(!x.file.includes('\\'));
});

test('paths: a folder given as a subfolder is shown relative to the base', async () => {
  const report = await check({ 'app/Sources/Store.swift': SWIFT_DEFAULTS }, {}, 'app');
  assert.equal(report.folder, 'app');
  assert.equal(report.findings[0].file, 'app/Sources/Store.swift');
});

test('paths: a project outside the base is shown with its absolute path, in forward slashes', async () => {
  await withFiles({ 'Store.swift': SWIFT_DEFAULTS }, async (dir) => {
    const { checkProject } = await import('../src/index.js');
    const elsewhere = resolve(dir, '..', 'not-the-project');
    const report = await checkProject(dir, { base: elsewhere });
    const shown = report.findings[0].file;
    assert.ok(shown.endsWith('/Store.swift'));
    assert.ok(!shown.includes('\\'));
    assert.equal(displayPath(resolve(dir, 'a', 'b'), dir), 'a/b');
    assert.equal(displayPath(dir, dir), '.');
    assert.equal(displayPath(resolve(dir, '..'), dir).includes('\\'), false);
  });
});

test('paths: a folder with a space in its name and a trailing separator is read', async () => {
  const report = await check({ 'My App/Store.swift': SWIFT_DEFAULTS }, {}, `My App${sep}`);
  assert.equal(report.findings[0].file, 'My App/Store.swift');
});

test('paths: on a system with case-sensitive names, a manifest in the wrong case is not found', async () => {
  const report = await check({ 'a/Store.swift': SWIFT_DEFAULTS, 'a/privacyinfo.xcprivacy': manifest() });
  assert.deepEqual(report.manifests, []);
  assert.equal(report.findings[0].id, 'no-manifest');
});

test('paths: a backslash in a file name is kept where it is a normal character', async () => {
  const name = sep === '\\' ? 'sub/plain.swift' : 'sub/odd\\name.swift';
  const report = await check({ [name]: SWIFT_DEFAULTS, 'PrivacyInfo.xcprivacy': manifest() });
  assert.equal(report.findings[0].file, name);
});
