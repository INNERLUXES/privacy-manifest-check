// Shared test helpers: project folders, manifests and source files written inline into a temporary folder
// that is removed after the test.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkProject, main, PLIST_DOCTYPE } from '../src/index.js';

export const FILE_TIMESTAMP = 'NSPrivacyAccessedAPICategoryFileTimestamp';
export const BOOT_TIME = 'NSPrivacyAccessedAPICategorySystemBootTime';
export const DISK_SPACE = 'NSPrivacyAccessedAPICategoryDiskSpace';
export const KEYBOARDS = 'NSPrivacyAccessedAPICategoryActiveKeyboards';
export const USER_DEFAULTS = 'NSPrivacyAccessedAPICategoryUserDefaults';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'privacy-manifest-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// An XML property list holding one dict with the given inner text.
export function plist(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${PLIST_DOCTYPE}\n<plist version="1.0">\n<dict>\n${inner}\n</dict>\n</plist>\n`;
}

const list = (items) => (items.length ? `<array>${items.map((i) => `<string>${i}</string>`).join('')}</array>` : '<array/>');

// One entry of NSPrivacyAccessedAPITypes. reasons: an array of codes, or null for no reasons key.
export function apiEntry(type, reasons) {
  return `<dict><key>NSPrivacyAccessedAPIType</key><string>${type}</string>${reasons === null ? '' : `<key>NSPrivacyAccessedAPITypeReasons</key>${list(reasons)}`}</dict>`;
}

// One entry of NSPrivacyCollectedDataTypes with every key; pass null to leave a key out.
export function dataEntry(type = 'NSPrivacyCollectedDataTypeEmailAddress', { linked = true, tracking = false, purposes = ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] } = {}) {
  const bool = (name, v) => (v === null ? '' : `<key>${name}</key><${v ? 'true' : 'false'}/>`);
  return `<dict>${type === null ? '' : `<key>NSPrivacyCollectedDataType</key><string>${type}</string>`}${bool('NSPrivacyCollectedDataTypeLinked', linked)}${bool('NSPrivacyCollectedDataTypeTracking', tracking)}${purposes === null ? '' : `<key>NSPrivacyCollectedDataTypePurposes</key>${list(purposes)}`}</dict>`;
}

// A whole privacy manifest.
export function manifest({ tracking = false, domains = [], data = [], apis = [] } = {}) {
  return plist([
    tracking === null ? '' : `<key>NSPrivacyTracking</key><${tracking ? 'true' : 'false'}/>`,
    `<key>NSPrivacyTrackingDomains</key>${list(domains)}`,
    `<key>NSPrivacyCollectedDataTypes</key><array>${data.join('')}</array>`,
    `<key>NSPrivacyAccessedAPITypes</key><array>${apis.join('')}</array>`
  ].join('\n'));
}

export const SWIFT_DEFAULTS = 'import Foundation\nlet defaults = UserDefaults.standard\n';
export const SWIFT_TIMESTAMP = 'import Foundation\nfunc modified(_ a: [FileAttributeKey: Any]) -> Any? {\n  return a[.modificationDate]\n}\n';

// Writes the files and checks the folder, with paths shown relative to it.
export async function check(files, options = {}, folder = '.') {
  return withFiles(files, (dir) => checkProject(resolve(dir, folder), { base: dir, ...options }));
}

// Writes the files and runs the command line on the folder (plus args), keeping what it writes.
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main([dir, ...args], { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err };
  });
}

// Runs the command line with exactly these arguments.
export async function cli(argv) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } });
  return { code, out, err };
}

export const ids = (report) => report.findings.map((f) => f.id);
export const find = (report, id) => report.findings.filter((f) => f.id === id);
