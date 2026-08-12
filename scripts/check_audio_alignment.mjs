/*
  Validate the stored forced-alignment data in data/*.md.

  The reader consumes long_audio[*].sync.list and highlights the DOM elements named
  in each section. A stale sentence/word ID therefore makes part of the read-along
  silently stop highlighting. This check treats IDs as corpus-wide because demo and
  transclusion pages can legitimately align IDs owned by another data document.

  Usage: node scripts/check_audio_alignment.mjs
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(dir, entry.name);
    return entry.isDirectory()
      ? walk(filename)
      : filename.endsWith(".md")
        ? [filename]
        : [];
  });

const load = (file) => {
  const text = fs.readFileSync(file, "utf8");
  const end = text.indexOf("---", 3);
  const body = (end === -1 ? text : text.slice(end + 3)).trim();
  return body.startsWith("{") ? JSON.parse(body) : null;
};

/* Same algorithm as the string-hash package used by Ylhýra's editor. */
const stringHash = (input) => {
  let hash = 5381;
  let index = input.length;
  while (index) hash = (hash * 33) ^ input.charCodeAt(--index);
  return hash >>> 0;
};

const editorXmlHash = (xml) =>
  stringHash(String(xml || "").replace(/^[A-zÀ-ÿ0-9/<>_-]/, "")).toString(36);

const normalizeSpokenText = (text) =>
  String(text || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const sameTime = (a, b) =>
  a === null || b === null ? a === b : Math.abs(Number(a) - Number(b)) < 1e-9;

export function checkAudioAlignments(root = DEFAULT_ROOT) {
  const documents = [];
  const liveItems = new Map();
  const errors = [];
  const textDrift = [];
  let audioFiles = 0;
  let sections = 0;
  let alignedIDs = 0;

  for (const file of walk(path.join(root, "data")).sort()) {
    let data;
    try {
      data = load(file);
    } catch (error) {
      errors.push(`${path.relative(root, file)}: cannot parse data: ${error.message}`);
      continue;
    }
    if (!data) continue;
    const items = {
      ...(data.list?.sentences || {}),
      ...(data.list?.words || {}),
      ...(data.list?.items || {}),
    };
    for (const [id, item] of Object.entries(items)) liveItems.set(id, item);
    documents.push({ file, data });
  }

  for (const { file, data } of documents) {
    const rel = path.relative(root, file);
    for (const [filename, audio] of Object.entries(data.long_audio || {})) {
      audioFiles++;
      const label = `${rel} — ${filename}`;
      const list = audio?.sync?.list;
      if (!Array.isArray(list)) {
        errors.push(`${label}: missing sync.list`);
        continue;
      }

      if (audio.xml_hash !== editorXmlHash(audio.xml)) {
        errors.push(
          `${label}: stale xml_hash ${JSON.stringify(audio.xml_hash)}; expected ` +
            JSON.stringify(editorXmlHash(audio.xml))
        );
      }

      const originalIDs = new Set();
      const visitOriginal = (value) => {
        if (!value || typeof value !== "object") return;
        if (value.id && value.id !== "root") {
          originalIDs.add(value.id);
          if (!liveItems.has(value.id)) {
            errors.push(`${label}: original alignment refers to missing ID ${value.id}`);
          } else if (value.id.startsWith("s_") && Array.isArray(value.lines)) {
            const aligned = normalizeSpokenText(value.lines.join(" "));
            const current = normalizeSpokenText(liveItems.get(value.id)?.text);
            if (aligned !== current) {
              textDrift.push(
                `${label}: ${value.id}: ${JSON.stringify(value.lines.join(" "))} != ` +
                  JSON.stringify(liveItems.get(value.id)?.text || "")
              );
            }
          }
        }
        for (const child of Object.values(value)) visitOriginal(child);
      };
      visitOriginal(audio?.sync?.original_sync_data);

      for (let index = 0; index < list.length; index++) {
        const section = list[index];
        sections++;
        if (!Number.isFinite(section.begin)) {
          errors.push(`${label}: section ${index} has invalid begin time`);
        }
        if (section.end !== null && !Number.isFinite(section.end)) {
          errors.push(`${label}: section ${index} has invalid end time`);
        }
        if (section.end !== null && section.end < section.begin) {
          errors.push(`${label}: section ${index} ends before it begins`);
        }
        const next = list[index + 1];
        if (next && !sameTime(section.end, next.begin)) {
          errors.push(`${label}: gap/overlap between sections ${index} and ${index + 1}`);
        }
        if (!Array.isArray(section.elements)) {
          errors.push(`${label}: section ${index} has no elements array`);
          continue;
        }
        for (const id of section.elements) {
          alignedIDs++;
          if (!liveItems.has(id)) {
            errors.push(`${label}: section ${index} refers to missing ID ${id}`);
          }
          if (originalIDs.size && !originalIDs.has(id)) {
            errors.push(`${label}: section ${index} ID ${id} is absent from original alignment`);
          }
        }
      }

      for (const match of String(audio.xml || "").matchAll(/\bid="([^"]+)"/g)) {
        if (!liveItems.has(match[1])) {
          errors.push(`${label}: stored alignment XML refers to missing ID ${match[1]}`);
        }
      }
    }
  }

  return { audioFiles, sections, alignedIDs, errors, textDrift };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = checkAudioAlignments();
  console.log(
    `${result.audioFiles} audio files, ${result.sections} timed sections, ` +
      `${result.alignedIDs} aligned ID references`
  );
  if (result.errors.length) {
    console.error(`\n${result.errors.length} forced-alignment error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
  }
  if (result.textDrift.length) {
    console.warn(`\n${result.textDrift.length} aligned sentence text drift(s):`);
    for (const drift of result.textDrift) console.warn(`- ${drift}`);
  }
  if (result.errors.length) process.exitCode = 1;
}
