import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findApiUses, maskSource, DETECTORS, SOURCE_EXTENSIONS } from '../src/index.js';
import { BOOT_TIME, DISK_SPACE, FILE_TIMESTAMP, KEYBOARDS, USER_DEFAULTS } from './helpers.js';

const cats = (uses) => uses.map((u) => `${u.category.replace('NSPrivacyAccessedAPICategory', '')}:${u.symbol}:${u.line}`);

test('detect: UserDefaults in Swift and NSUserDefaults in Objective-C', () => {
  assert.deepEqual(cats(findApiUses('let d = UserDefaults.standard\n', 'a.swift')), ['UserDefaults:UserDefaults:1']);
  assert.deepEqual(cats(findApiUses('id x = [[NSUserDefaults standardUserDefaults] objectForKey:k];\n', 'a.m')), ['UserDefaults:NSUserDefaults:1']);
});

test('detect: file timestamp keys, Swift and Objective-C', () => {
  const swift = [
    'let a = try FileManager.default.attributesOfItem(atPath: p)',
    'let m = a[.modificationDate]',
    'let c = a[FileAttributeKey.creationDate]',
    'let v = try url.resourceValues(forKeys: [.contentModificationDateKey, .creationDateKey])',
    'let u = doc.fileModificationDate'
  ].join('\n');
  assert.deepEqual(cats(findApiUses(swift, 'a.swift')), [
    'FileTimestamp:modificationDate:2',
    'FileTimestamp:creationDate:3',
    'FileTimestamp:contentModificationDateKey:4',
    'FileTimestamp:creationDateKey:4',
    'FileTimestamp:fileModificationDate:5'
  ]);
  const objc = 'id a = attrs[NSFileModificationDate]; id b = attrs[NSFileCreationDate]; [u getResourceValue:&v forKey:NSURLContentModificationDateKey error:nil];\n';
  assert.deepEqual(findApiUses(objc, 'a.m').map((u) => u.symbol), ['NSFileModificationDate', 'NSFileCreationDate', 'NSURLContentModificationDateKey']);
});

test('detect: stat family calls are file timestamp API, and a method of another name is not', () => {
  const code = 'var st = stat()\nif stat(path, &st) == 0 {}\nlstat(p, &s); fstat(fd, &s); fstatat(fd, p, &s, 0);\nfile.stat()\nmystat(p)\nlet n = lstatus(p)\n';
  assert.deepEqual(findApiUses(code, 'a.swift').map((u) => `${u.symbol}:${u.line}`), ['stat:1', 'stat:2', 'lstat:3', 'fstat:3', 'fstatat:3']);
});

test('detect: getattrlist is in two categories, getattrlistbulk in one', () => {
  const uses = findApiUses('getattrlist(p, &a, &b, 8, 0);\ngetattrlistbulk(fd, &a, &b, 8, 0);\n', 'a.m');
  assert.deepEqual(uses.map((u) => `${u.category}:${u.symbol}:${u.line}`), [
    `${FILE_TIMESTAMP}:getattrlist:1`,
    `${DISK_SPACE}:getattrlist:1`,
    `${FILE_TIMESTAMP}:getattrlistbulk:2`
  ]);
});

test('detect: system boot time', () => {
  const uses = findApiUses('let t = mach_absolute_time()\nlet u = ProcessInfo.processInfo.systemUptime\n', 'a.swift');
  assert.deepEqual(uses.map((u) => `${u.category}:${u.symbol}`), [`${BOOT_TIME}:mach_absolute_time`, `${BOOT_TIME}:systemUptime`]);
});

test('detect: disk space keys, attributes and calls', () => {
  const code = [
    'let k = URLResourceKey.volumeAvailableCapacityForImportantUsageKey',
    'let s = try fm.attributesOfFileSystem(forPath: p)[.systemFreeSize]',
    'id f = fs[NSFileSystemFreeSize]; id t = NSURLVolumeTotalCapacityKey;',
    'statfs(p, &buf); statvfs(p, &v); fstatfs(fd, &buf); fstatvfs(fd, &v);'
  ].join('\n');
  const uses = findApiUses(code, 'a.mm');
  assert.ok(uses.every((u) => u.category === DISK_SPACE));
  assert.deepEqual(uses.map((u) => u.symbol), [
    'volumeAvailableCapacityForImportantUsageKey', 'systemFreeSize', 'NSFileSystemFreeSize', 'NSURLVolumeTotalCapacityKey', 'statfs', 'statvfs', 'fstatfs', 'fstatvfs'
  ]);
});

test('detect: active keyboards', () => {
  const uses = findApiUses('let modes = UITextInputMode.activeInputModes\n', 'a.swift');
  assert.deepEqual(uses.map((u) => u.category), [KEYBOARDS]);
});

test('detect: names that only contain a symbol are not a match', () => {
  const code = 'let a = UserDefaultsKey.token\nlet b = MyUserDefaults()\nlet c = systemUptimeSeconds\nlet d = volumeAvailableCapacityKeyName\n';
  assert.deepEqual(findApiUses(code, 'a.swift'), []);
});

test('detect: comments and string literals are not code', () => {
  const swift = [
    '// UserDefaults in a line comment',
    '/* stat(path, &st) in a block comment /* nested UserDefaults */ still a comment mach_absolute_time() */',
    'let s = "UserDefaults.standard and mach_absolute_time()"',
    'let m = """',
    'UserDefaults in a multi-line string',
    '"""',
    'let r = #"systemUptime "quoted" activeInputModes"#',
    'let real = UserDefaults.standard'
  ].join('\n');
  assert.deepEqual(cats(findApiUses(swift, 'a.swift')), ['UserDefaults:UserDefaults:8']);
});

test('detect: Objective-C strings, character literals and comments keep the code after them visible', () => {
  const objc = [
    "char q = '\"'; // [NSUserDefaults standardUserDefaults]",
    'NSString *s = @"NSUserDefaults \\" still text"; id d = [NSUserDefaults standardUserDefaults];',
    "char c = '\\''; mach_absolute_time();"
  ].join('\n');
  assert.deepEqual(cats(findApiUses(objc, 'a.m')), ['UserDefaults:NSUserDefaults:2', 'SystemBootTime:mach_absolute_time:3']);
});

test('detect: line numbers stay right with CRLF line breaks and across multi-line strings and comments', () => {
  const code = ['/*', 'one', '*/', 'let a = """', 'x', '"""', 'let d = UserDefaults.standard'].join('\r\n');
  assert.deepEqual(findApiUses(code, 'a.swift').map((u) => u.line), [7]);
});

test('detect: masking keeps the length and the line breaks of the text', () => {
  const code = 'a // c\n"b" /* d\ne */ f\n';
  const masked = maskSource(code, true);
  assert.equal(masked.length, code.length);
  assert.equal(masked.split('\n').length, code.split('\n').length);
  assert.equal(masked, 'a     \n" "     \n     f\n');
});

test('detect: a use is listed once per category, symbol and line', () => {
  const uses = findApiUses('let a = UserDefaults.standard; let b = UserDefaults.standard\n', 'a.swift');
  assert.equal(uses.length, 1);
});

test('detect: the detectors cover every category and the source extensions are the four documented ones', () => {
  const covered = new Set(DETECTORS.flatMap((d) => d.categories));
  assert.deepEqual([...covered].sort(), [BOOT_TIME, DISK_SPACE, FILE_TIMESTAMP, KEYBOARDS, USER_DEFAULTS].sort());
  assert.deepEqual(SOURCE_EXTENSIONS, ['.swift', '.m', '.mm', '.h']);
});

test('detect: a long line of repeated text is read in a short time', () => {
  const started = Date.now();
  findApiUses(`${'stat '.repeat(50_000)}\n${'/*'.repeat(20_000)}\n`, 'a.swift');
  assert.ok(Date.now() - started < 3000);
});
