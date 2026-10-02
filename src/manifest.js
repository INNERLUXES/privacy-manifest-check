// Reads a PrivacyInfo.xcprivacy file into a plain model that keeps the line of every key and value. The file
// is an XML property list. A file that is not a well-formed XML property list, or whose top value is not a
// dict, is refused with its line. A value of the wrong type under a known key does not stop the read: it is
// kept out of the model and listed in issues, so the report can name it.

import { parsePlist, plistGet, lineOf } from './plist.js';

function typeName(node) {
  return node.type === 'boolean' ? 'a boolean' : `<${node.type}>`;
}

// The strings of an array node as [{ value, line }]; anything else in the array is an issue.
function strings(node, key, issues) {
  const out = [];
  if (node.type !== 'array') {
    issues.push({ line: lineOf(node), subject: key, message: `${key} is ${typeName(node)}, not an array of strings` });
    return null;
  }
  for (const item of node.value) {
    if (item.type === 'string') out.push({ value: item.value, line: item.line });
    else issues.push({ line: item.line, subject: key, message: `${key} holds ${typeName(item)} where a string was expected` });
  }
  return out;
}

function readBool(node, key, issues) {
  if (node.type === 'boolean') return node.value;
  issues.push({ line: lineOf(node), subject: key, message: `${key} is ${typeName(node)}, not true or false` });
  return null;
}

function readDataTypes(node, issues, malformed) {
  if (node.type !== 'array') {
    issues.push({ line: lineOf(node), subject: 'NSPrivacyCollectedDataTypes', message: `NSPrivacyCollectedDataTypes is ${typeName(node)}, not an array` });
    return [];
  }
  const out = [];
  node.value.forEach((entry, index) => {
    if (entry.type !== 'dict') {
      malformed.push({ line: entry.line, subject: 'NSPrivacyCollectedDataTypes', message: `entry ${index + 1} of NSPrivacyCollectedDataTypes is ${typeName(entry)}, not a dict` });
      return;
    }
    const type = plistGet(entry, 'NSPrivacyCollectedDataType');
    const linked = plistGet(entry, 'NSPrivacyCollectedDataTypeLinked');
    const tracking = plistGet(entry, 'NSPrivacyCollectedDataTypeTracking');
    const purposes = plistGet(entry, 'NSPrivacyCollectedDataTypePurposes');
    const item = { index: index + 1, line: entry.line, type: null, linked: null, tracking: null, purposes: null };
    if (type) {
      if (type.type === 'string') item.type = { value: type.value, line: lineOf(type) };
      else issues.push({ line: lineOf(type), subject: 'NSPrivacyCollectedDataType', message: `NSPrivacyCollectedDataType is ${typeName(type)}, not a string` });
    }
    if (linked) item.linked = readBool(linked, 'NSPrivacyCollectedDataTypeLinked', issues);
    if (tracking) item.tracking = readBool(tracking, 'NSPrivacyCollectedDataTypeTracking', issues);
    if (purposes) item.purposes = strings(purposes, 'NSPrivacyCollectedDataTypePurposes', issues);
    item.has = { type: type !== null, linked: linked !== null, tracking: tracking !== null, purposes: purposes !== null };
    out.push(item);
  });
  return out;
}

function readApiTypes(node, issues, malformed) {
  if (node.type !== 'array') {
    issues.push({ line: lineOf(node), subject: 'NSPrivacyAccessedAPITypes', message: `NSPrivacyAccessedAPITypes is ${typeName(node)}, not an array` });
    return [];
  }
  const out = [];
  node.value.forEach((entry, index) => {
    if (entry.type !== 'dict') {
      malformed.push({ line: entry.line, subject: 'NSPrivacyAccessedAPITypes', message: `entry ${index + 1} of NSPrivacyAccessedAPITypes is ${typeName(entry)}, not a dict` });
      return;
    }
    const type = plistGet(entry, 'NSPrivacyAccessedAPIType');
    const reasons = plistGet(entry, 'NSPrivacyAccessedAPITypeReasons');
    if (!type || type.type !== 'string') {
      malformed.push({
        line: entry.line,
        subject: 'NSPrivacyAccessedAPITypes',
        message: type ? `NSPrivacyAccessedAPIType in entry ${index + 1} is ${typeName(type)}, not a string` : `entry ${index + 1} of NSPrivacyAccessedAPITypes has no NSPrivacyAccessedAPIType`
      });
      return;
    }
    out.push({
      index: index + 1,
      line: lineOf(type),
      type: type.value,
      reasons: reasons ? strings(reasons, 'NSPrivacyAccessedAPITypeReasons', issues) : null,
      reasonsLine: reasons ? lineOf(reasons) : lineOf(type)
    });
  });
  return out;
}

// Reads the bytes or text of one privacy manifest.
//   { tracking: boolean|null, trackingLine, domains: [{ value, line }], domainsLine, dataTypes, apiTypes,
//     issues, malformed }
// tracking is null when NSPrivacyTracking is absent (Apple's default is false).
export function parseManifest(input, label = 'input') {
  const top = parsePlist(input, label);
  if (top.type !== 'dict') throw new Error(`${label}: line ${top.line}: the top value is ${typeName(top)}, not a dict`);
  const issues = [];
  const malformed = [];
  const model = { tracking: null, trackingLine: 1, domains: [], domainsLine: 1, dataTypes: [], apiTypes: [], issues, malformed };
  const tracking = plistGet(top, 'NSPrivacyTracking');
  if (tracking) {
    model.tracking = readBool(tracking, 'NSPrivacyTracking', issues);
    model.trackingLine = lineOf(tracking);
  }
  const domains = plistGet(top, 'NSPrivacyTrackingDomains');
  if (domains) {
    model.domains = strings(domains, 'NSPrivacyTrackingDomains', issues) ?? [];
    model.domainsLine = lineOf(domains);
  }
  const dataTypes = plistGet(top, 'NSPrivacyCollectedDataTypes');
  if (dataTypes) model.dataTypes = readDataTypes(dataTypes, issues, malformed);
  const apiTypes = plistGet(top, 'NSPrivacyAccessedAPITypes');
  if (apiTypes) model.apiTypes = readApiTypes(apiTypes, issues, malformed);
  return model;
}
