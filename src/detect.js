// Finds calls of required reason API in Swift and Objective-C source text. The text is read, never compiled:
// comments and the inside of string literals are blanked first (line numbers stay the same), then each line is
// matched against the patterns below. A pattern names the API symbols of data.js as they are written in code;
// the Objective-C constants of the same symbols (NSFileModificationDate for FileAttributeKey.modificationDate)
// are included. docs/limits.md says what this cannot see.

const FILE_TIMESTAMP = 'NSPrivacyAccessedAPICategoryFileTimestamp';
const BOOT_TIME = 'NSPrivacyAccessedAPICategorySystemBootTime';
const DISK_SPACE = 'NSPrivacyAccessedAPICategoryDiskSpace';
const KEYBOARDS = 'NSPrivacyAccessedAPICategoryActiveKeyboards';
const USER_DEFAULTS = 'NSPrivacyAccessedAPICategoryUserDefaults';

// Each pattern has one capture group: the symbol as written. Patterns start at a word boundary, so a longer
// name that contains a symbol (UserDefaultsKey, mystat) is not a match. A call such as stat( must not follow
// a dot, which would make it a method of some other type.
export const DETECTORS = [
  { re: /(?:\bFileAttributeKey\s*\.\s*|\[\s*\.\s*)(creationDate|modificationDate)\b/g, categories: [FILE_TIMESTAMP] },
  { re: /\b(NSFileCreationDate|NSFileModificationDate)\b/g, categories: [FILE_TIMESTAMP] },
  { re: /\b(fileModificationDate)\b/g, categories: [FILE_TIMESTAMP] },
  { re: /\b(contentModificationDateKey|creationDateKey)\b/g, categories: [FILE_TIMESTAMP] },
  { re: /\b(NSURLContentModificationDateKey|NSURLCreationDateKey)\b/g, categories: [FILE_TIMESTAMP] },
  { re: /(?<![\w.$])(fstatat|fstat|lstat|stat)\s*\(/g, categories: [FILE_TIMESTAMP] },
  { re: /(?<![\w$])(getattrlistbulk)\s*\(/g, categories: [FILE_TIMESTAMP] },
  { re: /(?<![\w$])(getattrlistat|fgetattrlist|getattrlist)\s*\(/g, categories: [FILE_TIMESTAMP, DISK_SPACE] },

  { re: /\b(systemUptime)\b/g, categories: [BOOT_TIME] },
  { re: /(?<![\w$])(mach_absolute_time)\s*\(/g, categories: [BOOT_TIME] },

  { re: /\b(volumeAvailableCapacityKey|volumeAvailableCapacityForImportantUsageKey|volumeAvailableCapacityForOpportunisticUsageKey|volumeTotalCapacityKey)\b/g, categories: [DISK_SPACE] },
  { re: /\b(NSURLVolumeAvailableCapacityKey|NSURLVolumeAvailableCapacityForImportantUsageKey|NSURLVolumeAvailableCapacityForOpportunisticUsageKey|NSURLVolumeTotalCapacityKey)\b/g, categories: [DISK_SPACE] },
  { re: /(?:\bFileAttributeKey\s*\.\s*|\[\s*\.\s*)(systemFreeSize|systemSize)\b/g, categories: [DISK_SPACE] },
  { re: /\b(NSFileSystemFreeSize|NSFileSystemSize)\b/g, categories: [DISK_SPACE] },
  { re: /(?<![\w$])(fstatvfs|statvfs|fstatfs|statfs)\s*\(/g, categories: [DISK_SPACE] },

  { re: /\b(activeInputModes)\b/g, categories: [KEYBOARDS] },

  { re: /\b((?:NS)?UserDefaults)\b/g, categories: [USER_DEFAULTS] }
];

export const SOURCE_EXTENSIONS = ['.swift', '.m', '.mm', '.h'];

// Replaces the inside of comments and string literals with spaces. The text keeps its length and its line
// breaks. Swift block comments nest; C ones do not. Swift has raw strings (#"..."#) and multi-line strings
// ("""..."""); the C family has character literals. An unterminated string ends at the end of its line.
export function maskSource(text, swift = false) {
  const s = String(text);
  const out = s.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '/') {
      let end = s.indexOf('\n', i);
      if (end < 0) end = s.length;
      blank(i, end);
      i = end;
    } else if (c === '/' && d === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < s.length && depth > 0) {
        if (s[j] === '*' && s[j + 1] === '/') {
          depth -= 1;
          j += 2;
        } else if (swift && s[j] === '/' && s[j + 1] === '*') {
          depth += 1;
          j += 2;
        } else j += 1;
      }
      blank(i, j);
      i = j;
    } else if (swift && (c === '#' || c === '"')) {
      let hashes = 0;
      let j = i;
      while (s[j] === '#') {
        hashes += 1;
        j += 1;
      }
      if (s[j] !== '"') {
        i += 1;
        continue;
      }
      const closer = '"'.repeat(s.startsWith('"""', j) ? 3 : 1) + '#'.repeat(hashes);
      const start = j + closer.length - hashes;
      const multiline = closer.length - hashes === 3;
      let k = start;
      let end = -1;
      while (k < s.length) {
        if (s[k] === '\\' && hashes === 0) {
          k += 2;
          continue;
        }
        if (s.startsWith(closer, k)) {
          end = k;
          break;
        }
        if (!multiline && s[k] === '\n') {
          end = k;
          break;
        }
        k += 1;
      }
      if (end < 0) end = s.length;
      blank(start, end);
      i = Math.min(s.length, end + (s[end] === '\n' ? 0 : closer.length));
    } else if (!swift && (c === '"' || c === "'")) {
      let k = i + 1;
      while (k < s.length && s[k] !== c && s[k] !== '\n') k += s[k] === '\\' ? 2 : 1;
      blank(i + 1, Math.min(k, s.length));
      i = Math.min(s.length, k + 1);
    } else i += 1;
  }
  return out.join('');
}

// The required reason API calls in the text of one source file: [{ category, symbol, line }], in line order,
// each (category, symbol, line) once.
export function findApiUses(text, file = 'input.swift') {
  const masked = maskSource(text, file.endsWith('.swift')).split('\n');
  const uses = [];
  const seen = new Set();
  masked.forEach((line, index) => {
    const found = [];
    for (const { re, categories } of DETECTORS) {
      for (const m of line.matchAll(re)) {
        for (const category of categories) found.push({ category, symbol: m[1], line: index + 1, column: m.index });
      }
    }
    // In the order they stand in the line (the sort is stable, so one symbol in two categories keeps its order).
    found.sort((x, y) => x.column - y.column);
    for (const u of found) {
      const key = `${u.category} ${u.symbol} ${u.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uses.push({ category: u.category, symbol: u.symbol, line: u.line });
    }
  });
  return uses;
}
