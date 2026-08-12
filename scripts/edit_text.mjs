/*
  Edit the Icelandic text inside data/*.md without needing a re-parse.

  A word's text is stored in five places (list.items twice, list.sentences, list.words,
  tokenized) and its lowercase form in short_audio.wordID_to_text. Sentence text is the
  concatenation of its word array. Editing the raw string in one place silently
  desynchronises the rest, so every edit here goes through the word arrays and rebuilds
  the sentence text from them.

  Usage:
    node scripts/edit_text.mjs <file> rename   <wordId> <newText>
    node scripts/edit_text.mjs <file> sep      <sentenceId> <oldString> <newString>
    node scripts/edit_text.mjs <file> delete   <wordId>
    node scripts/edit_text.mjs <file> merge    <wordId>            # merge with next word
    node scripts/edit_text.mjs <file> split    <wordId> <first> <second>

  `sep` rewrites the punctuation/whitespace strings that sit between words, and the
  sentence text; use it for quote marks, stray spaces and invisible characters.

  Always verify afterwards with:  node scripts/export_translations.mjs
*/

import fs from "fs";

const [file, op, ...args] = process.argv.slice(2);
if (!file || !op) {
  console.error("see usage at the top of this file");
  process.exit(1);
}

const raw = fs.readFileSync(file, "utf8");
const cut = raw.indexOf("---", 3) + 3;
const head = raw.slice(0, cut);
const d = JSON.parse(raw.slice(cut));

const list = d.list || {};
const buckets = [list.items, list.sentences, list.words].filter(Boolean);

/* every sentence object, wherever it is stored */
function sentenceObjects(sid) {
  const out = [];
  for (const b of buckets) if (b[sid]) out.push(b[sid]);
  for (const p of d.tokenized || []) {
    for (const s of p.sentences || []) if (s.id === sid) out.push(s);
  }
  return out;
}

/* every object carrying this word id */
function wordObjects(wid) {
  const out = [];
  for (const b of buckets) {
    if (b[wid]) out.push(b[wid]);
    for (const item of Object.values(b)) {
      if (item && item.words) for (const w of item.words) if (w && w.id === wid) out.push(w);
    }
  }
  for (const p of d.tokenized || []) {
    for (const s of p.sentences || []) {
      for (const w of s.words || []) if (w && w.id === wid) out.push(w);
    }
  }
  return out;
}

function sentenceIdOf(wid) {
  for (const b of buckets) {
    if (b[wid] && b[wid].belongsToSentence) return b[wid].belongsToSentence;
    for (const [sid, item] of Object.entries(b)) {
      if (item && item.words && item.words.some((w) => w && w.id === wid)) return sid;
    }
  }
  return null;
}

/* rebuild sentence.text from its words, keeping the original outer whitespace */
function resync(sid) {
  for (const s of sentenceObjects(sid)) {
    if (!s.words) continue;
    const body = s.words.map((w) => (typeof w === "string" ? w : w.text)).join("");
    const orig = s.text ?? "";
    const lead = orig.slice(0, orig.length - orig.trimStart().length);
    const trail = orig.slice(orig.trimEnd().length);
    s.text = lead + body.trim() + trail;
  }
}

function eachWordsArray(sid, fn) {
  for (const s of sentenceObjects(sid)) if (s.words) fn(s.words, s);
}

let summary = "";

if (op === "rename") {
  const [wid, text] = args;
  const objs = wordObjects(wid);
  if (!objs.length) throw new Error(`word ${wid} not found`);
  const before = objs[0].text;
  for (const o of objs) o.text = text;
  if (d.short_audio?.wordID_to_text?.[wid] !== undefined) {
    d.short_audio.wordID_to_text[wid] = text.toLowerCase();
  }
  resync(sentenceIdOf(wid));
  summary = `${objs.length} copies: "${before}" -> "${text}"`;
} else if (op === "sep") {
  const [sid, oldS, newS] = args;
  let n = 0;
  eachWordsArray(sid, (words) => {
    for (let i = 0; i < words.length; i++) {
      if (typeof words[i] === "string" && words[i].includes(oldS)) {
        words[i] = words[i].split(oldS).join(newS);
        n++;
      }
    }
  });
  for (const s of sentenceObjects(sid)) {
    if (s.text?.includes(oldS)) s.text = s.text.split(oldS).join(newS);
  }
  summary = `${n} separator(s) updated in ${sid}`;
} else if (op === "delete") {
  const [wid] = args;
  const sid = sentenceIdOf(wid);
  eachWordsArray(sid, (words, s) => {
    const i = words.findIndex((w) => w && w.id === wid);
    if (i === -1) return;
    // drop the word and the separator that follows it (or precedes, if last)
    const cutCount = typeof words[i + 1] === "string" ? 2 : (typeof words[i - 1] === "string" ? 2 : 1);
    const from = cutCount === 2 && typeof words[i + 1] !== "string" ? i - 1 : i;
    words.splice(from, cutCount);
    s.words = words;
  });
  for (const b of buckets) delete b[wid];
  for (const k of ["arrayOfAllWordIDs", "arrayOfAllItemIDs"]) {
    if (list[k]) list[k] = list[k].filter((x) => x !== wid);
  }
  if (d.translation?.words) delete d.translation.words[wid];
  for (const [h, v] of Object.entries(d.translation?.definitions || {})) {
    if (v?.contains?.includes(wid)) {
      v.contains = v.contains.filter((x) => x !== wid);
      if (!v.contains.length) delete d.translation.definitions[h];
    }
  }
  if (d.short_audio?.wordID_to_text) delete d.short_audio.wordID_to_text[wid];
  resync(sid);
  summary = `deleted word ${wid}`;
} else if (op === "merge") {
  const [wid] = args;
  const sid = sentenceIdOf(wid);
  let removed = null;
  let merged = null;
  eachWordsArray(sid, (words, s) => {
    const i = words.findIndex((w) => w && w.id === wid);
    if (i === -1) return;
    let j = i + 1;
    while (j < words.length && typeof words[j] === "string") j++;
    if (j >= words.length) return;
    removed = words[j].id;
    merged = words[i].text + words[j].text;
    words[i].text = merged;
    words.splice(i + 1, j - i);
    s.words = words;
  });
  if (!removed) throw new Error(`no following word to merge into ${wid}`);
  for (const o of wordObjects(wid)) o.text = merged;
  for (const b of buckets) delete b[removed];
  for (const k of ["arrayOfAllWordIDs", "arrayOfAllItemIDs"]) {
    if (list[k]) list[k] = list[k].filter((x) => x !== removed);
  }
  if (d.translation?.words) delete d.translation.words[removed];
  for (const [h, v] of Object.entries(d.translation?.definitions || {})) {
    if (v?.contains?.includes(removed)) {
      v.contains = [...new Set(v.contains.map((x) => (x === removed ? wid : x)))];
    }
  }
  if (d.short_audio?.wordID_to_text) {
    delete d.short_audio.wordID_to_text[removed];
    if (d.short_audio.wordID_to_text[wid] !== undefined) {
      d.short_audio.wordID_to_text[wid] = merged.toLowerCase();
    }
  }
  resync(sid);
  summary = `merged ${removed} into ${wid} -> "${merged}"`;
} else if (op === "split") {
  const [wid, first, second] = args;
  const sid = sentenceIdOf(wid);
  const taken = new Set([...(list.arrayOfAllItemIDs || []), ...Object.keys(list.items || {})]);
  let newId = `${wid}x`;
  while (taken.has(newId)) newId += "x";
  const template = wordObjects(wid)[0];
  const newWord = { ...template, id: newId, text: second };
  eachWordsArray(sid, (words, s) => {
    const i = words.findIndex((w) => w && w.id === wid);
    if (i === -1) return;
    words[i].text = first;
    words.splice(i + 1, 0, " ", { ...newWord });
    s.words = words;
  });
  for (const o of wordObjects(wid)) o.text = first;
  if (list.words) list.words[newId] = { ...newWord };
  if (list.items) list.items[newId] = { ...newWord };
  if (list.arrayOfAllWordIDs) {
    const at = list.arrayOfAllWordIDs.indexOf(wid);
    list.arrayOfAllWordIDs.splice(at + 1, 0, newId);
  }
  if (list.arrayOfAllItemIDs) {
    const at = list.arrayOfAllItemIDs.indexOf(wid);
    list.arrayOfAllItemIDs.splice(at + 1, 0, newId);
  }
  if (d.short_audio?.wordID_to_text?.[wid] !== undefined) {
    d.short_audio.wordID_to_text[wid] = first.toLowerCase();
  }
  resync(sid);
  summary = `split ${wid} -> "${first}" + new ${newId} "${second}"`;
} else {
  throw new Error(`unknown op ${op}`);
}

fs.writeFileSync(file, head + "\n" + JSON.stringify(d, null, 2) + "\n");
console.log(summary);
