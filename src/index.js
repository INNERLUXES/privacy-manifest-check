export { XML_LIMITS, decodeEntities, parseXml, textOf } from './xml.js';
export { PLIST_DOCTYPE, isBinaryPlist, parsePlist, plistGet, lineOf } from './plist.js';
export { SOURCES, MANIFEST_NAME, API_CATEGORIES, DATA_TYPES, PURPOSES, categoryById, categoryOfReason } from './data.js';
export { DETECTORS, SOURCE_EXTENSIONS, maskSource, findApiUses } from './detect.js';
export { parseManifest } from './manifest.js';
export { SKIP_DIRS, LIMITS, scanFolder, readBounded } from './scan.js';
export { SEVERITIES, RANK, FINDINGS, safeText, meetsThreshold, displayPath, checkProject } from './check.js';
export { manifestLine, toText, toMarkdown, toJson, toCsv, csvCell, mdCell } from './report.js';
export { parseArgs, main, USAGE, VERSION } from './cli.js';
