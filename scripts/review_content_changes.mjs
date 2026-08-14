#!/usr/bin/env node

/* Export a compact, human-oriented HTML review of learner-facing changes.
 *
 * Usage:
 *   node scripts/review_content_changes.mjs
 *   node scripts/review_content_changes.mjs --from content@origin --to @
 *   node scripts/review_content_changes.mjs --output /tmp/review.html
 *   node scripts/review_content_changes.mjs --stdout
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const YLHYRA = process.env.YLHYRA || path.join(path.dirname(ROOT), "ylhyra");
const DEFAULT_OUTPUT = path.join(ROOT, "exports", "content-change-review.html");
const TRANSLATION_FIELDS = ["meaning", "direct", "note", "inline_translation", "base_meaning", "base_note"];
const require = createRequire(import.meta.url);

let jsDiff = null;
let yaml = null;
try {
  jsDiff = require("diff");
} catch {
  try {
    jsDiff = require(path.join(YLHYRA, "node_modules", "diff"));
  } catch {
    // A small built-in LCS fallback below keeps the report portable.
  }
}
try {
  yaml = require("js-yaml");
} catch {
  try {
    yaml = require(path.join(YLHYRA, "node_modules", "js-yaml"));
  } catch {
    // Vocabulary YAML falls back to the ordinary line-oriented review below.
  }
}

function parseArgs(argv) {
  const result = { from: "content@origin", to: "@", output: DEFAULT_OUTPUT, stdout: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--from") result.from = argv[++i];
    else if (argv[i] === "--to") result.to = argv[++i];
    else if (argv[i] === "--output") result.output = path.resolve(argv[++i]);
    else if (argv[i] === "--stdout") result.stdout = true;
    else if (argv[i] === "--help" || argv[i] === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return result;
}

function jj(args, { allowFailure = false } = {}) {
  const result = spawnSync("jj", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`jj ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function fileFileset(file) {
  return `file:"${file.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

export function classifyFile(file) {
  if (/^ARCHIVED\//u.test(file)) return null;
  if (/^data\/.*\.md$/u.test(file)) return "translations";
  if (/^not_data\/vocabulary\//u.test(file)) return "vocabulary";
  if (/^not_data\/content\/.*\.md$/u.test(file)) return "articles";
  return null;
}

function readAtRevision(revision, file) {
  const result = jj(["file", "show", "-r", revision, fileFileset(file)], { allowFailure: true });
  return result.status === 0 ? result.stdout : null;
}

function parseData(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

const stringValue = (value) => (value === undefined || value === null ? "" : String(value));
export const hasTextChange = (before, after) => stringValue(before).trim() !== stringValue(after).trim();
const tokenize = (value) => stringValue(value).match(/\s+|[\p{L}\p{M}\p{N}]+(?:['’_-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu) ?? [];

function escapeHtml(value) {
  return stringValue(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function sequenceDiff(before, after) {
  const rows = before.length + 1;
  const columns = after.length + 1;
  const table = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const parts = [];
  const append = (value, kind) => {
    const previous = parts.at(-1);
    const property = kind === "added" ? "added" : kind === "removed" ? "removed" : null;
    if (previous && Boolean(previous.added) === (property === "added") && Boolean(previous.removed) === (property === "removed")) {
      previous.value += value;
    } else parts.push({ value, ...(property ? { [property]: true } : {}) });
  };
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      append(before[i], "same"); i += 1; j += 1;
    } else if (j >= after.length || (i < before.length && table[i + 1][j] >= table[i][j + 1])) {
      append(before[i++], "removed");
    } else append(after[j++], "added");
  }
  return parts;
}

function changedFlags(before, after) {
  const table = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const beforeChanged = Array(before.length).fill(true);
  const afterChanged = Array(after.length).fill(true);
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      beforeChanged[i] = false;
      afterChanged[j] = false;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return { beforeChanged, afterChanged };
}

function diffWords(before, after) {
  return jsDiff?.diffWordsWithSpace
    ? jsDiff.diffWordsWithSpace(before, after)
    : sequenceDiff(tokenize(before), tokenize(after));
}

function diffCharacters(before, after) {
  return jsDiff?.diffChars
    ? jsDiff.diffChars(before, after)
    : sequenceDiff(Array.from(before), Array.from(after));
}

function editDistance(before, after) {
  const left = Array.from(before);
  const right = Array.from(after);
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous.at(-1);
}

function isSpellingScale(removed, added) {
  if (removed.length !== 1 || added.length !== 1) return false;
  const before = removed[0].value.trim();
  const after = added[0].value.trim();
  const lexicalWord = /^[\p{L}\p{M}\p{N}'’_-]+$/u;
  if (!lexicalWord.test(before) || !lexicalWord.test(after)) return false;
  const longest = Math.max(Array.from(before).length, Array.from(after).length);
  return longest <= 30 && editDistance(before, after) / longest <= 0.5;
}

function focusPair(beforeValue, afterValue, padding = 24, maximum = 120) {
  const before = tokenize(beforeValue);
  const after = tokenize(afterValue);
  const { beforeChanged, afterChanged } = changedFlags(before, after);
  const crop = (list, changed) => {
    const indexes = changed.flatMap((yes, index) => yes ? [index] : []);
    if (!indexes.length || list.length <= maximum) return { text: list.join(""), croppedStart: false, croppedEnd: false };
    const first = indexes[0];
    const last = indexes.at(-1);
    let start = Math.max(0, first - padding);
    let end = Math.min(list.length, last + padding + 1);
    if (end - start > maximum) {
      start = Math.max(0, first - padding);
      end = Math.min(list.length, start + maximum);
    }
    return { text: list.slice(start, end).join(""), croppedStart: start > 0, croppedEnd: end < list.length };
  };
  return { before: crop(before, beforeChanged), after: crop(after, afterChanged) };
}

function renderSide(parts, side) {
  const rendered = [];
  for (const part of parts) {
    if (side === "before" && part.added) continue;
    if (side === "after" && part.removed) continue;
    const value = escapeHtml(part.value);
    if ((side === "before" && part.removed) || (side === "after" && part.added)) {
      rendered.push(`<mark class="${side === "before" ? "removed" : "added"}">${value}</mark>`);
    } else rendered.push(value);
  }
  return rendered.join("");
}

export function inlineDiff(beforeValue, afterValue) {
  const focused = focusPair(beforeValue, afterValue);
  const wordParts = diffWords(focused.before.text, focused.after.text);
  const removed = wordParts.filter((part) => part.removed && part.value.trim());
  const added = wordParts.filter((part) => part.added && part.value.trim());
  const parts = isSpellingScale(removed, added)
    ? diffCharacters(focused.before.text, focused.after.text)
    : wordParts;
  const empty = '<span class="empty">empty</span>';
  return {
    before: stringValue(beforeValue)
      ? `${focused.before.croppedStart ? '<span class="ellipsis">…</span> ' : ""}${renderSide(parts, "before")}${focused.before.croppedEnd ? ' <span class="ellipsis">…</span>' : ""}`
      : empty,
    after: stringValue(afterValue)
      ? `${focused.after.croppedStart ? '<span class="ellipsis">…</span> ' : ""}${renderSide(parts, "after")}${focused.after.croppedEnd ? ' <span class="ellipsis">…</span>' : ""}`
      : empty,
  };
}

function compact(value, maximum = 420) {
  const clean = stringValue(value).replace(/\s+/gu, " ").trim();
  return clean.length <= maximum ? clean : `${clean.slice(0, maximum - 1).trimEnd()}…`;
}

function buildIndex(document) {
  const sentences = document?.list?.sentences ?? {};
  const words = document?.list?.words ?? {};
  const order = (document?.list?.arrayOfAllItemIDs ?? []).filter((id) => sentences[id]);
  return { sentences, words, order, positions: new Map(order.map((id, index) => [id, index])) };
}

function sentenceContext(document, sentenceId) {
  if (!document) return null;
  const index = buildIndex(document);
  const sentence = index.sentences[sentenceId];
  if (!sentence) return null;
  const position = index.positions.get(sentenceId);
  return {
    current: sentence.text,
    before: position > 0 ? index.sentences[index.order[position - 1]]?.text : "",
    after: position !== undefined && position + 1 < index.order.length ? index.sentences[index.order[position + 1]]?.text : "",
  };
}

function definitionContext(document, definitionId, definition) {
  const index = buildIndex(document);
  const contained = definition?.contains?.length
    ? definition.contains
    : Object.entries(document?.translation?.words ?? {})
      .filter(([, id]) => id === definitionId)
      .map(([wordId]) => wordId);
  const wordObjects = contained.map((id) => index.words[id]).filter(Boolean);
  const sentenceId = wordObjects[0]?.belongsToSentence;
  return {
    phrase: wordObjects.map((word) => word.text).join(" "),
    sentence: sentenceId ? sentenceContext(document, sentenceId) : null,
  };
}

function changedFields(before, after) {
  const textual = new Set([
    ...TRANSLATION_FIELDS,
    ...Object.entries(before ?? {}).filter(([, value]) => typeof value === "string").map(([field]) => field),
    ...Object.entries(after ?? {}).filter(([, value]) => typeof value === "string").map(([field]) => field),
  ]);
  return [...textual].filter((field) => hasTextChange(before?.[field], after?.[field]));
}

const fieldLabel = (field) => ({
  meaning: "Translation",
  direct: "Literal translation",
  note: "Explanation",
  inline_translation: "Inline translation",
  base_meaning: "Base meaning",
  base_note: "Base note",
  english: "English",
  icelandic: "Icelandic",
  note_regarding_english: "Note regarding English",
  text: "Text",
}[field] ?? field.replace(/_/gu, " ").replace(/^./u, (letter) => letter.toUpperCase()));

function makeFields(fields, before, after) {
  return fields.map((field) => ({
    label: fieldLabel(field),
    before: stringValue(before?.[field]),
    after: stringValue(after?.[field]),
  }));
}

function supportingFields(changed, before, after) {
  const record = after ?? before ?? {};
  return Object.entries(record)
    .filter(([field, value]) => typeof value === "string" && value.trim() && !changed.includes(field))
    .map(([field, value]) => ({ label: fieldLabel(field), value }));
}

const VOCABULARY_HIDDEN_FIELDS = new Set([
  "row_id", "last_seen", "level", "importance", "difficulty",
]);

function vocabularyFields(record) {
  return Object.entries(record ?? {})
    .filter(([field, value]) => !VOCABULARY_HIDDEN_FIELDS.has(field) && typeof value === "string");
}

function vocabularyKey(record, index) {
  return record?.row_id !== undefined ? `id:${record.row_id}` : `text:${record?.icelandic ?? index}`;
}

export function reviewVocabularyFile(beforeText, afterText) {
  if (!yaml || !afterText) return null;
  let beforeRows;
  let afterRows;
  try {
    beforeRows = beforeText ? yaml.load(beforeText)?.rows : [];
    afterRows = afterText ? yaml.load(afterText)?.rows : [];
  } catch {
    return null;
  }
  if (!Array.isArray(beforeRows) || !Array.isArray(afterRows)) return null;
  const before = new Map(beforeRows.map((record, index) => [vocabularyKey(record, index), record]));
  const after = new Map(afterRows.map((record, index) => [vocabularyKey(record, index), record]));
  const changes = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const oldRecord = before.get(key);
    const newRecord = after.get(key);
    const fields = new Set([
      ...vocabularyFields(oldRecord).map(([field]) => field),
      ...vocabularyFields(newRecord).map(([field]) => field),
    ]);
    const changed = [...fields].filter((field) => hasTextChange(oldRecord?.[field], newRecord?.[field]));
    if (!changed.length) continue;
    const visibleRecord = newRecord ?? oldRecord;
    const icelandic = stringValue(visibleRecord?.icelandic);
    const extras = vocabularyFields(visibleRecord)
      .filter(([field, value]) => value.trim() && field !== "icelandic" && !changed.includes(field))
      .map(([field, value]) => ({ label: fieldLabel(field), value }));
    changes.push({
      kind: "vocabulary",
      subject: icelandic,
      context: icelandic ? { current: icelandic } : null,
      fields: makeFields(changed, oldRecord, newRecord),
      extras,
    });
  }
  return changes;
}

function reviewDataFile(beforeText, afterText) {
  const before = parseData(beforeText);
  const after = parseData(afterText);
  if (!before && !after) return [];
  if (before && !after) {
    return [{
      kind: "removal",
      label: "Translation source removed",
      summary: `${Object.keys(before.list?.sentences ?? {}).length} Icelandic sentences and ${Object.keys(before.translation?.definitions ?? {}).length} definition records`,
    }];
  }
  const changes = [];
  const oldSentences = before?.translation?.sentences ?? {};
  const newSentences = after?.translation?.sentences ?? {};
  for (const id of new Set([...Object.keys(oldSentences), ...Object.keys(newSentences)])) {
    const fields = changedFields(oldSentences[id], newSentences[id]);
    if (!fields.length) continue;
    // Review only translations attached to a sentence that renders now. Old
    // parser fragments and superseded sentence IDs are intentionally invisible.
    const context = sentenceContext(after, id);
    if (!context) continue;
    changes.push({
      kind: "translation",
      context,
      fields: makeFields(fields, oldSentences[id], newSentences[id]),
      extras: supportingFields(fields, oldSentences[id], newSentences[id]),
    });
  }

  const oldDefinitions = before?.translation?.definitions ?? {};
  const newDefinitions = after?.translation?.definitions ?? {};
  for (const id of new Set([...Object.keys(oldDefinitions), ...Object.keys(newDefinitions)])) {
    const fields = changedFields(oldDefinitions[id], newDefinitions[id]);
    if (!fields.length) continue;
    // The renderer reaches definitions through translation.words. Requiring a
    // current mapping excludes every orphan regardless of stale `contains` data.
    const currentWordIds = Object.entries(after?.translation?.words ?? {})
      .filter(([, definitionId]) => definitionId === id)
      .map(([wordId]) => wordId);
    if (!currentWordIds.length) continue;
    const context = definitionContext(after, id, { contains: currentWordIds });
    if (!context.phrase && !context.sentence) continue;
    changes.push({
      kind: "translation",
      label: context.phrase ? "Word or phrase" : "Word translation",
      subject: context.phrase,
      context: context.sentence,
      fields: makeFields(fields, oldDefinitions[id], newDefinitions[id]),
      extras: supportingFields(fields, oldDefinitions[id], newDefinitions[id]),
    });
  }

  const oldSource = before?.list?.sentences ?? {};
  const newSource = after?.list?.sentences ?? {};
  for (const id of new Set([...Object.keys(oldSource), ...Object.keys(newSource)])) {
    const oldText = oldSource[id]?.text;
    const newText = newSource[id]?.text;
    if (!hasTextChange(oldText, newText)) continue;
    const context = sentenceContext(after, id) ?? sentenceContext(before, id);
    changes.push({
      kind: "source",
      label: "Icelandic source text",
      context: context ? { before: context.before, after: context.after } : null,
      fields: [{ label: "Icelandic", before: stringValue(oldText), after: stringValue(newText) }],
    });
  }
  return changes;
}

function parseUnifiedDiff(text) {
  const hunks = [];
  let hunk = null;
  for (const line of text.split("\n")) {
    const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u);
    if (match) {
      hunk = { oldLine: Number(match[1]), newLine: Number(match[2]), lines: [] };
      hunks.push(hunk);
    } else if (hunk && /^[ +\-]/u.test(line) && !/^\+\+\+|^---/u.test(line)) hunk.lines.push(line);
  }
  return hunks;
}

function genericReview(file, category, from, to, beforeText, afterText) {
  if (beforeText !== null && afterText === null) {
    return [{ kind: "removal", label: "File removed", summary: `${beforeText.replace(/\n$/u, "").split("\n").length} lines` }];
  }
  const result = jj(["diff", "--from", from, "--to", to, "--git", "--context", "2", fileFileset(file)]);
  const changes = [];
  for (const hunk of parseUnifiedDiff(result.stdout)) {
    let oldLine = hunk.oldLine;
    let newLine = hunk.newLine;
    let beforeContext = [];
    let removed = [];
    let added = [];
    let afterContext = [];
    const flush = () => {
      if (!removed.length && !added.length) return;
      const count = Math.max(removed.length, added.length);
      for (let i = 0; i < count; i += 1) {
        const oldEntry = removed[i];
        const newEntry = added[i];
        if (!hasTextChange(oldEntry?.text, newEntry?.text)) continue;
        changes.push({
          kind: category === "vocabulary" ? "vocabulary" : "article",
          label: category === "vocabulary" ? "Vocabulary" : "Article text",
          location: newEntry?.line ?? oldEntry?.line,
          context: {
            before: beforeContext.findLast((value) => value.trim()) ?? "",
            after: afterContext.find((value) => value.trim()) ?? "",
          },
          fields: [{ label: "Text", before: oldEntry?.text ?? "", after: newEntry?.text ?? "" }],
        });
      }
      removed = [];
      added = [];
      beforeContext = afterContext.slice(-2);
      afterContext = [];
    };
    for (let index = 0; index < hunk.lines.length; index += 1) {
      const line = hunk.lines[index];
      if (line.startsWith("-")) { removed.push({ line: oldLine++, text: line.slice(1) }); }
      else if (line.startsWith("+")) { added.push({ line: newLine++, text: line.slice(1) }); }
      else {
        const value = line.slice(1);
        if (removed.length || added.length) {
          afterContext.push(value);
          const next = hunk.lines[index + 1];
          if (!next || next.startsWith("-") || next.startsWith("+")) flush();
        } else beforeContext.push(value);
        oldLine += 1;
        newLine += 1;
      }
    }
    flush();
  }
  return changes;
}

function humanName(file) {
  return file
    .replace(/^data\//u, "")
    .replace(/^not_data\/content\//u, "")
    .replace(/^not_data\/vocabulary\//u, "Vocabulary / ")
    .replace(/\.md$|\.ya?ml$/u, "")
    .replace(/_/gu, " ")
    .split("/")
    .join(" › ");
}

function highlightPhrase(text, phrase) {
  if (!phrase) return escapeHtml(text);
  let cursor = 0;
  let output = "";
  let found = false;
  while (cursor < text.length) {
    const index = text.indexOf(phrase, cursor);
    if (index < 0) break;
    found = true;
    output += escapeHtml(text.slice(cursor, index));
    output += `<span class="translated-word">${escapeHtml(phrase)}</span>`;
    cursor = index + phrase.length;
  }
  return found ? output + escapeHtml(text.slice(cursor)) : escapeHtml(text);
}

function renderContext(context, phrase) {
  if (!context || (!context.before && !context.current && !context.after)) return "";
  return `<div class="context" lang="is">${context.before ? `<span class="neighbour">${escapeHtml(context.before)} </span>` : ""}${context.current ? `<span class="current">${highlightPhrase(context.current, phrase)}</span>` : ""}${context.after ? `<span class="neighbour"> ${escapeHtml(context.after)}</span>` : ""}</div>`;
}

function renderChange(change) {
  if (change.kind === "removal") {
    return `<article class="change removal-card"><p><strong>${escapeHtml(change.label)}:</strong> ${escapeHtml(change.summary)}</p></article>`;
  }
  const multipleFields = change.fields.length > 1;
  const fields = change.fields.map((field) => {
    const diff = inlineDiff(field.before, field.after);
    return `${multipleFields ? `<div class="field-label interface">${escapeHtml(field.label)}</div>` : ""}<div class="version before"><div class="value">${diff.before}</div></div><div class="version after"><div class="value">${diff.after}</div></div>`;
  }).join("");
  const extras = change.extras?.length
    ? `<div class="supporting">${change.extras.map((extra) => `<span><b class="interface">${escapeHtml(extra.label)}</b> ${escapeHtml(extra.value)}</span>`).join("")}</div>`
    : "";
  return `<article class="change">${renderContext(change.context, change.subject)}<div class="diff-grid">${fields}</div>${extras}</article>`;
}

function directoryName(file) {
  return path.dirname(file).replace(/_/gu, " ").split("/").join(" › ");
}

function fileName(file) {
  return path.basename(file).replace(/\.md$|\.ya?ml$/u, "").replace(/_/gu, " ");
}

function renderFile(entry) {
  return `<section class="file"><header class="file-header interface"><h3>${escapeHtml(fileName(entry.file))}</h3><span>${entry.changes.length}</span></header><div class="changes">${entry.changes.map(renderChange).join("")}</div></section>`;
}

function renderDirectories(entries) {
  const directories = new Map();
  for (const entry of entries) {
    const directory = directoryName(entry.file);
    if (!directories.has(directory)) directories.set(directory, []);
    directories.get(directory).push(entry);
  }
  return [...directories].map(([directory, files]) => `<section class="directory"><h2 class="directory-name interface">${escapeHtml(directory)}</h2>${files.map(renderFile).join("")}</section>`).join("");
}

function revisionDescription(revision) {
  return jj(["log", "-r", revision, "--no-graph", "-T", 'commit_id.short() ++ " " ++ description.first_line()']).stdout.trim();
}

function page(entries, options) {
  const counts = Object.fromEntries(["translations", "articles", "vocabulary"].map((category) => [category, entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.changes.length, 0)]));
  const total = entries.reduce((sum, entry) => sum + entry.changes.length, 0);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ylhýra content review</title>
<style>
:root{color-scheme:light dark;--bg:#f5f3ef;--paper:#fff;--ink:#222;--muted:#777;--line:#d9d5ce;--focus:#e9f6ff;--word:#fff0a6;--old:#ffdfdd;--old-ink:#7d241e;--new:#dcf3df;--new-ink:#1c6327}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.48 "Times New Roman",Times,serif}.interface,.top{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.top{background:var(--paper);border-bottom:1px solid var(--line)}.top-inner{max-width:1440px;margin:auto;padding:18px 26px}.top h1{font-size:25px;line-height:1.1;margin:0}.top p{margin:5px 0 0;color:var(--muted);font-size:12px}.summary{margin-top:8px;color:var(--muted);font-size:13px}main{max-width:1440px;margin:28px auto 80px;padding:0 26px}.directory{margin:0 0 42px}.directory-name{position:sticky;top:0;z-index:2;margin:0 0 12px;padding:8px 12px;background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(10px);border-bottom:2px solid var(--ink);font-size:14px;letter-spacing:.02em}.file{background:var(--paper);border:1px solid var(--line);margin:0 0 24px}.file-header{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-bottom:1px solid var(--line);background:#eeece7;color:#333}.file-header h3{font-size:14px;margin:0}.file-header span{font-size:11px;color:var(--muted)}.changes{padding:0 12px 12px}.change{padding:11px 0;border-bottom:1px solid var(--line)}.change:last-child{border-bottom:0}.context{margin:0 0 7px;padding:5px 8px;color:#666}.context .current{background:var(--focus);color:#172d3b;padding:2px 4px;border-radius:3px}.translated-word{background:var(--word);color:#352b00;padding:1px 2px;border-radius:2px;font-weight:bold}.diff-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line)}.field-label{grid-column:1/-1;padding:3px 9px;background:var(--bg);border-bottom:1px solid var(--line);font-size:10px;color:var(--muted)}.version{padding:7px 10px;min-width:0}.version.before{border-right:1px solid var(--line)}.value{white-space:pre-wrap;overflow-wrap:anywhere}.supporting{padding:6px 8px 0;color:#5f5b55;font-size:14px}.supporting span{display:block}.supporting b{font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-right:5px;color:var(--muted)}mark{border-radius:2px;padding:0 1px;color:inherit}.removed{background:var(--old);color:var(--old-ink)}.added{background:var(--new);color:var(--new-ink)}.empty,.ellipsis{color:var(--muted);font-style:italic}.removal-card p{margin:0;color:var(--muted)}
@media(max-width:760px){body{font-size:16px}.top-inner,main{padding-left:10px;padding-right:10px}.diff-grid{grid-template-columns:1fr}.version.before{border-right:0;border-bottom:1px solid var(--line)}}
@media(prefers-color-scheme:dark){:root{--bg:#181817;--paper:#222220;--ink:#eeeae3;--muted:#aaa49b;--line:#3c3935;--focus:#203844;--word:#5c4e17;--old:#542725;--old-ink:#ffb7b1;--new:#203f28;--new-ink:#a9e5b0}.file-header{background:#302e2a;color:var(--ink)}.context{color:#bbb}.context .current{color:#e8f5ff}.translated-word{color:#fff5bd}.supporting{color:#bbb}}
@media print{.directory-name{position:static}.file{break-inside:avoid}}
</style></head>
<body><header class="top"><div class="top-inner"><h1>Ylhýra content review</h1><p>${escapeHtml(revisionDescription(options.from))} → ${escapeHtml(revisionDescription(options.to))}</p><div class="summary">${total} changes in ${entries.length} files · ${counts.translations} translations · ${counts.articles} articles · ${counts.vocabulary} vocabulary</div></div></header><main>${renderDirectories(entries)}</main></body></html>`;
}

function help() {
  return `Usage: node scripts/review_content_changes.mjs [options]\n\n` +
    `  --from REV       Starting revision (default: content@origin)\n` +
    `  --to REV         Ending revision (default: @)\n` +
    `  --output FILE    HTML output (default: exports/content-change-review.html)\n` +
    `  --stdout         Print HTML instead of writing it\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(help()); return; }
  const changed = jj(["diff", "--from", options.from, "--to", options.to, "--name-only"])
    .stdout.split("\n").filter(Boolean)
    .map((file) => ({ file, category: classifyFile(file) }))
    .filter((entry) => entry.category);
  const entries = [];
  for (const entry of changed) {
    const before = readAtRevision(options.from, entry.file);
    const after = readAtRevision(options.to, entry.file);
    let changes;
    if (entry.category === "translations") changes = reviewDataFile(before, after);
    else if (entry.category === "vocabulary") {
      changes = reviewVocabularyFile(before, after)
        ?? genericReview(entry.file, entry.category, options.from, options.to, before, after);
    } else changes = genericReview(entry.file, entry.category, options.from, options.to, before, after);
    if (changes.length) entries.push({ ...entry, changes });
  }
  const html = page(entries, options);
  if (options.stdout) process.stdout.write(html);
  else {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, html);
    console.log(`Wrote ${options.output}`);
    console.log(`${entries.reduce((sum, entry) => sum + entry.changes.length, 0)} review items across ${entries.length} files`);
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
