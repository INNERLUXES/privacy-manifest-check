// Report formats: text for a terminal, Markdown for a pull request or job summary, JSON for other tools, CSV
// for a spreadsheet.

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

function countsLine(c) {
  return `${c.error} error, ${c.warning} warning, ${c.info} info`;
}

function where(f) {
  return `${f.file}:${f.line}`;
}

function trackingText(m) {
  return m.tracking === null ? 'tracking not set' : `tracking ${m.tracking}`;
}

// The facts about one manifest, on one line.
export function manifestLine(m) {
  if (!m.readable) return 'could not be read';
  const cats = m.apiCategories.length ? `declares ${m.apiCategories.map((c) => c.replace('NSPrivacyAccessedAPICategory', '')).join(', ')}` : 'declares no required reason API';
  return [trackingText(m), plural(m.trackingDomains, 'tracking domain'), plural(m.dataTypes, 'collected data type'), cats].join('; ');
}

function usageLine(u) {
  return `${u.name}: ${plural(u.calls, 'call')} in ${plural(u.files, 'file')}, ${u.declared ? 'declared' : 'not declared'}`;
}

function gateLine(r) {
  return r.gate.pass ? `GATE: PASS (--fail-on ${r.gate.failOn})` : `GATE: FAIL - ${r.gate.reason}`;
}

function sourceLine(r) {
  return `${r.scanned.sources.toLocaleString('en-US')} scanned, ${r.scanned.withApis.toLocaleString('en-US')} call required reason API`;
}

export function toText(r) {
  const lines = [`privacy-manifest-check: ${r.folder}`, `manifests: ${r.manifests.length}`];
  for (const m of r.manifests) lines.push(`  ${m.file}: ${manifestLine(m)}`);
  lines.push(`source files: ${sourceLine(r)}`);
  if (r.usage.length) {
    lines.push('required reason API in code:');
    for (const u of r.usage) lines.push(`  ${usageLine(u)}`);
  }
  lines.push(`findings: ${countsLine(r.counts)}`);
  if (!r.findings.length) lines.push('', 'no findings');
  for (const f of r.findings) {
    lines.push('', `${f.severity.toUpperCase().padEnd(7)}  ${f.id}  ${where(f)}`, `         ${f.message}`, `         fix: ${f.fix}`);
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`note: ${note}`);
  lines.push('', gateLine(r));
  return lines.join('\n') + '\n';
}

// A Markdown table cell: backslashes and pipes escaped, line breaks flattened, and <, > and & written as
// entities, so text from an input file cannot break the table or be read as HTML.
export function mdCell(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n|\r/g, ' ');
}

export function toMarkdown(r) {
  const lines = [`## privacy-manifest-check: ${countsLine(r.counts)}`, '', `Folder: \`${mdCell(r.folder).replace(/`/g, "'")}\`. Source files: ${sourceLine(r)}.`];
  if (r.manifests.length) {
    lines.push('', '| Manifest | Settings |', '| --- | --- |');
    for (const m of r.manifests) lines.push(`| ${mdCell(m.file)} | ${mdCell(manifestLine(m))} |`);
  }
  if (r.usage.length) {
    lines.push('', '| Required reason API in code | Calls | Files | Declared |', '| --- | --- | --- | --- |');
    for (const u of r.usage) lines.push(`| ${mdCell(u.name)} | ${u.calls} | ${u.files} | ${u.declared ? 'yes' : 'no'} |`);
  }
  if (!r.findings.length) lines.push('', 'No findings.');
  else {
    lines.push('', '| Severity | Check | Where | Message | Fix |', '| --- | --- | --- | --- | --- |');
    for (const f of r.findings) lines.push(`| ${f.severity} | ${mdCell(f.id)} | ${mdCell(where(f))} | ${mdCell(f.message)} | ${mdCell(f.fix)} |`);
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`- ${mdCell(note)}`);
  lines.push('', r.gate.pass ? `**Gate passed** (--fail-on ${r.gate.failOn}).` : `**Gate failed:** ${mdCell(r.gate.reason)}.`);
  return lines.join('\n') + '\n';
}

export function toJson(r) {
  return JSON.stringify(r, null, 2) + '\n';
}

// RFC 4180 quoting, and a leading quote on cells a spreadsheet would read as a formula.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per finding.
export function toCsv(r) {
  const rows = [['severity', 'id', 'file', 'line', 'subject', 'message', 'fix']];
  for (const f of r.findings) rows.push([f.severity, f.id, f.file, String(f.line), f.subject, f.message, f.fix]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
