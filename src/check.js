// Reads a project folder, compares the required reason API called in its code with what its privacy manifests
// declare, and returns one report. docs/method.md gives the reason behind every finding.

import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { API_CATEGORIES, DATA_TYPES, MANIFEST_NAME, PURPOSES, categoryById, categoryOfReason } from './data.js';
import { findApiUses } from './detect.js';
import { parseManifest } from './manifest.js';
import { scanFolder, readBounded, LIMITS } from './scan.js';

export { LIMITS };
export const SEVERITIES = ['error', 'warning', 'info'];
export const RANK = { error: 0, warning: 1, info: 2 };

// Every finding, in report order within a severity.
export const FINDINGS = [
  { id: 'parse-error', severity: 'error', what: 'A PrivacyInfo.xcprivacy file that cannot be read as an XML property list' },
  { id: 'no-manifest', severity: 'error', what: 'Required reason API is called in code and the folder has no PrivacyInfo.xcprivacy' },
  { id: 'undeclared-api', severity: 'error', what: 'A category of required reason API is called in code and no manifest declares it' },
  { id: 'no-reason', severity: 'error', what: 'A declared category has no reason code' },
  { id: 'invalid-reason', severity: 'error', what: 'A reason code that Apple does not list for that category' },
  { id: 'tracking-without-domains', severity: 'warning', what: 'NSPrivacyTracking is true and NSPrivacyTrackingDomains is empty' },
  { id: 'domains-without-tracking', severity: 'warning', what: 'Tracking domains are listed and NSPrivacyTracking is not true' },
  { id: 'data-type-incomplete', severity: 'warning', what: 'A collected data type without NSPrivacyCollectedDataTypeLinked, NSPrivacyCollectedDataTypeTracking or NSPrivacyCollectedDataTypePurposes' },
  { id: 'unknown-data-type', severity: 'warning', what: 'A collected data type value that Apple does not list' },
  { id: 'unknown-purpose', severity: 'warning', what: 'A collected data purpose value that Apple does not list' },
  { id: 'unknown-api-category', severity: 'warning', what: 'A NSPrivacyAccessedAPIType value that Apple does not list' },
  { id: 'duplicate-category', severity: 'warning', what: 'The same category declared twice in one manifest' },
  { id: 'malformed-entry', severity: 'warning', what: 'An entry that is not a dict, or that lacks its type key' },
  { id: 'invalid-value', severity: 'warning', what: 'A value of the wrong type under a known key' },
  { id: 'unused-category', severity: 'info', what: 'A declared category that no scanned code calls' }
];

const ORDER = Object.fromEntries(FINDINGS.map((f, i) => [f.id, i]));
const BY_ID = Object.fromEntries(FINDINGS.map((f) => [f.id, f]));

// Text from the input: control, line separator and direction characters replaced by a space, length capped.
export function safeText(value, max = 300) {
  const s = String(value).replace(/[\u0000-\u001f\u007f-\u009f\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g, ' ');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

export function meetsThreshold(severity, failOn) {
  return RANK[severity] <= RANK[failOn];
}

function toPosix(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

// How a path is shown: relative to base, with forward slashes, when it is inside base; otherwise absolute.
export function displayPath(path, base) {
  const rel = relative(base, path);
  if (rel === '') return '.';
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return toPosix(path);
  return toPosix(rel);
}

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

function shortName(id) {
  return id.replace('NSPrivacyAccessedAPICategory', '');
}

function codesOf(category) {
  return category.reasons.map((r) => r.code).join(', ');
}

// The line a parse error names, and its text without the label in front.
function splitParseError(message) {
  const m = /^manifest: (?:line (\d+): )?([\s\S]*)$/.exec(String(message));
  return m ? { line: m[1] ? Number(m[1]) : 1, text: m[2] } : { line: 1, text: String(message) };
}

// Runs the scan and the checks on a folder. options: { includeDeps, failOn, base, version, limits }. base is the
// folder paths are shown relative to (default: the current folder). A folder that is missing or not a folder
// stops the run with an error.
export async function checkProject(folder, { includeDeps = false, failOn = 'error', base = process.cwd(), version = '1.0.0', limits = LIMITS } = {}) {
  const root = resolve(folder);
  let info;
  try {
    info = await stat(root);
  } catch (error) {
    throw new Error(`${safeText(folder)}: ${error.code === 'ENOENT' ? 'no such folder' : `cannot be read (${error.code ?? 'error'})`}`);
  }
  if (!info.isDirectory()) throw new Error(`${safeText(folder)}: a file, not a folder; give the folder of the project`);
  const baseDir = resolve(base);
  const show = (p) => safeText(displayPath(p, baseDir));

  const found = await scanFolder(root, { includeDeps, limits });
  const notes = [];
  const note = (text) => notes.push(safeText(text, 600));
  const all = [];
  const add = (id, file, line, subject, message, fix) => {
    all.push({
      id,
      severity: BY_ID[id].severity,
      file,
      line: Math.max(1, Number(line) || 1),
      subject: safeText(subject),
      message: safeText(message, 1200),
      fix: safeText(fix, 1200)
    });
  };

  // Source files: the required reason API each one calls.
  const uses = new Map();
  let scanned = 0;
  let withApis = 0;
  let unreadSources = 0;
  for (const path of found.sources) {
    let bytes;
    try {
      bytes = await readBounded(path, limits);
    } catch (error) {
      unreadSources += 1;
      note(`${show(path)}: not scanned (${error.reason ?? error.message})`);
      continue;
    }
    scanned += 1;
    const file = show(path);
    const fileUses = findApiUses(bytes.toString('utf8'), path);
    if (fileUses.length) withApis += 1;
    for (const u of fileUses) {
      if (!uses.has(u.category)) uses.set(u.category, []);
      uses.get(u.category).push({ file, line: u.line, symbol: u.symbol });
    }
  }
  for (const list of uses.values()) list.sort((a, b) => compare(a.file, b.file) || a.line - b.line || compare(a.symbol, b.symbol));

  // Manifests.
  const manifests = [];
  for (const path of found.manifests) {
    const file = show(path);
    try {
      const model = parseManifest(await readBounded(path, limits), 'manifest');
      manifests.push({ file, model });
    } catch (error) {
      const { line, text } = splitParseError(error.reason ? `manifest: ${error.reason}` : error.message);
      add('parse-error', file, line, MANIFEST_NAME, `${file} cannot be read: ${text}`, 'Fix the file so that it is an XML property list (Xcode writes it that way; a binary one is converted with plutil -convert xml1), then run the check again');
      manifests.push({ file, model: null });
    }
  }
  manifests.sort((a, b) => compare(a.file, b.file));
  const readable = manifests.filter((m) => m.model);

  // Declared categories, across every readable manifest.
  const declared = new Map();
  for (const m of readable) {
    const seen = new Set();
    for (const entry of m.model.apiTypes) {
      const known = categoryById(entry.type);
      if (!known) {
        add('unknown-api-category', m.file, entry.line, entry.type, `NSPrivacyAccessedAPIType ${safeText(entry.type, 120)} is not one of the categories Apple lists (${API_CATEGORIES.map((c) => shortName(c.id)).join(', ')}); its reasons cannot be checked`, 'Check the spelling against the list in Apple\'s documentation of NSPrivacyAccessedAPIType');
        continue;
      }
      if (seen.has(entry.type)) add('duplicate-category', m.file, entry.line, entry.type, `${shortName(entry.type)} is declared twice in this manifest`, 'Merge the two entries into one with all the reasons');
      seen.add(entry.type);
      if (!declared.has(entry.type)) declared.set(entry.type, []);
      declared.get(entry.type).push({ file: m.file, entry });
      const reasons = entry.reasons ?? [];
      if (reasons.length === 0) {
        add('no-reason', m.file, entry.reasonsLine, entry.type, `${shortName(entry.type)} is declared with no reason code in NSPrivacyAccessedAPITypeReasons`, `Add the reason that matches the use. Apple lists these for ${known.name.toLowerCase()}: ${codesOf(known)}`);
      }
      for (const reason of reasons) {
        if (known.reasons.some((r) => r.code === reason.value)) continue;
        const other = categoryOfReason(reason.value);
        add('invalid-reason', m.file, reason.line, entry.type, `${safeText(reason.value, 80).trim() || '(empty)'} is not a reason Apple lists for ${shortName(entry.type)}${other ? `; it belongs to ${shortName(other.id)}` : ''}`, `Use one of ${codesOf(known)}`);
      }
    }
  }

  // Code against declarations.
  if (found.manifests.length === 0) {
    if (uses.size) {
      const first = [...uses.values()].map((list) => list[0]).sort((a, b) => compare(a.file, b.file) || a.line - b.line)[0];
      const names = API_CATEGORIES.filter((c) => uses.has(c.id)).map((c) => shortName(c.id));
      add('no-manifest', first.file, first.line, names.join(', '), `no ${MANIFEST_NAME} was found in the folder, and the code calls required reason API (${names.join(', ')}); the first call is ${first.symbol}`, 'Add a privacy manifest (Xcode: File > New > File > App Privacy) to the app or SDK target, with one NSPrivacyAccessedAPITypes entry and its reasons for each category used');
    } else {
      note('no PrivacyInfo.xcprivacy was found, and no required reason API is called in the code that was scanned');
    }
  } else if (readable.length === 0 && uses.size) {
    note(`${plural(uses.size, 'category', 'categories')} of required reason API are called in code, but no manifest could be read, so they were not compared`);
  } else {
    for (const category of API_CATEGORIES) {
      const list = uses.get(category.id);
      if (list && !declared.has(category.id)) {
        const symbols = [...new Set(list.map((u) => u.symbol))].join(', ');
        const first = list[0];
        const files = new Set(list.map((u) => u.file)).size;
        add('undeclared-api', first.file, first.line, category.id, `${category.name} API (${symbols}) is called ${plural(list.length, 'time')} in ${plural(files, 'file')}, first here, and no PrivacyInfo.xcprivacy declares ${category.id}`, `Add an NSPrivacyAccessedAPITypes entry for ${category.id} with the reason that matches the use. Apple lists: ${codesOf(category)}`);
      }
    }
    if (scanned > 0) {
      for (const [id, places] of declared) {
        if (uses.has(id)) continue;
        const category = categoryById(id);
        for (const place of places) {
          add('unused-category', place.file, place.entry.line, id, `${category.name} (${id}) is declared, and no scanned code calls it`, 'Remove the entry if no code or linked SDK in this target calls the API; keep it if the call is in code this scan does not read (a precompiled library, another language)');
        }
      }
    } else if (declared.size) {
      note('no Swift or Objective-C source file was scanned, so declared categories were not compared with code');
    }
  }

  // Tracking, data types and the other keys.
  for (const m of readable) {
    const model = m.model;
    if (model.tracking === true && model.domains.length === 0) {
      add('tracking-without-domains', m.file, model.trackingLine, 'NSPrivacyTracking', 'NSPrivacyTracking is true and NSPrivacyTrackingDomains is empty or missing: Apple asks for the internet domains the app or SDK connects to for tracking', 'List the tracking domains in NSPrivacyTrackingDomains, or set NSPrivacyTracking to false if nothing is used for tracking');
    }
    if (model.tracking !== true && model.domains.length > 0) {
      add('domains-without-tracking', m.file, model.domainsLine, 'NSPrivacyTrackingDomains', `${plural(model.domains.length, 'tracking domain')} listed, and NSPrivacyTracking is ${model.tracking === false ? 'false' : 'not set (it defaults to false)'}: Apple blocks these domains only when tracking is declared`, 'Set NSPrivacyTracking to true if the domains are used for tracking, or remove the list');
    }
    for (const entry of model.dataTypes) {
      const label = entry.type ? entry.type.value : `entry ${entry.index}`;
      if (!entry.has.type) {
        add('malformed-entry', m.file, entry.line, 'NSPrivacyCollectedDataTypes', `entry ${entry.index} of NSPrivacyCollectedDataTypes has no NSPrivacyCollectedDataType`, 'Add NSPrivacyCollectedDataType with one of the values Apple lists for data types');
      } else if (entry.type && !DATA_TYPES.includes(entry.type.value)) {
        add('unknown-data-type', m.file, entry.type.line, entry.type.value, `NSPrivacyCollectedDataType ${safeText(entry.type.value, 120)} is not one of the values Apple lists; Xcode does not build the privacy report correctly with a value of your own`, 'Use a value from the list in Apple\'s documentation of NSPrivacyCollectedDataType');
      }
      const missing = [];
      if (!entry.has.linked) missing.push('NSPrivacyCollectedDataTypeLinked');
      if (!entry.has.tracking) missing.push('NSPrivacyCollectedDataTypeTracking');
      if (!entry.has.purposes) missing.push('NSPrivacyCollectedDataTypePurposes');
      else if (entry.purposes && entry.purposes.length === 0) missing.push('NSPrivacyCollectedDataTypePurposes (empty)');
      if (missing.length) {
        add('data-type-incomplete', m.file, entry.line, label, `${safeText(label, 120)} lacks ${missing.join(', ')}`, 'Give every collected data type its Linked and Tracking booleans and at least one purpose');
      }
      for (const purpose of entry.purposes ?? []) {
        if (!PURPOSES.includes(purpose.value)) {
          add('unknown-purpose', m.file, purpose.line, purpose.value, `NSPrivacyCollectedDataTypePurposes value ${safeText(purpose.value, 120)} is not one of the values Apple lists for purposes`, 'Use a value from the list in Apple\'s documentation of NSPrivacyCollectedDataTypePurposes');
        }
      }
    }
    for (const issue of model.issues) {
      add('invalid-value', m.file, issue.line, issue.subject, issue.message, 'Use the type Apple documents for the key');
    }
    for (const issue of model.malformed) {
      add('malformed-entry', m.file, issue.line, issue.subject, issue.message, 'Each entry is a dict with the keys Apple documents for it');
    }
  }

  if (found.skippedDirs.size) note(`left out ${plural(found.skippedDirs.size, 'kind of folder', 'kinds of folders')} (${[...found.skippedDirs].sort().join(', ')}); use --include-deps to read them`);
  if (found.links) note(`${plural(found.links, 'symbolic link')} not followed`);
  for (const u of found.unreadable) note(`${show(u.path)}: folder cannot be listed (${u.code})`);
  if (found.tooDeep) note(`${plural(found.tooDeep, 'folder')} nested more than ${limits.maxDepth} deep left out`);
  if (found.truncated) note(`stopped after ${limits.maxFiles.toLocaleString('en-US')} directory entries`);
  if (found.sources.length === 0) note('no .swift, .m, .mm or .h file was found');
  if (unreadSources) note(`${plural(unreadSources, 'source file')} could not be read`);

  const findings = all.sort((a, b) => RANK[a.severity] - RANK[b.severity]
    || ORDER[a.id] - ORDER[b.id]
    || compare(a.file, b.file)
    || a.line - b.line
    || compare(a.subject, b.subject));
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  const failing = findings.filter((f) => meetsThreshold(f.severity, failOn));
  const reason = failOn === 'error'
    ? plural(counts.error, 'error')
    : [counts.error ? plural(counts.error, 'error') : '', counts.warning ? plural(counts.warning, 'warning') : ''].filter(Boolean).join(', ');
  return {
    tool: 'privacy-manifest-check',
    version,
    folder: safeText(displayPath(root, baseDir)),
    scanned: { sources: scanned, withApis },
    manifests: manifests.map((m) => ({
      file: m.file,
      readable: Boolean(m.model),
      tracking: m.model ? m.model.tracking : null,
      trackingDomains: m.model ? m.model.domains.length : 0,
      dataTypes: m.model ? m.model.dataTypes.length : 0,
      apiCategories: m.model ? [...new Set(m.model.apiTypes.map((e) => e.type))].map((t) => safeText(t, 120)) : []
    })),
    usage: API_CATEGORIES.filter((c) => uses.has(c.id)).map((c) => ({
      category: c.id,
      name: c.name,
      declared: declared.has(c.id),
      calls: uses.get(c.id).length,
      files: new Set(uses.get(c.id).map((u) => u.file)).size,
      uses: uses.get(c.id)
    })),
    counts,
    findings,
    notes,
    gate: { failOn, pass: failing.length === 0, reason: failing.length ? reason : null }
  };
}
