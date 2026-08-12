/*
  Export the inline translation data embedded in data/*.md into review-friendly files.

  This deliberately reuses the ylhyra source rather than reimplementing it:

    - The item/word/sentence maps are rebuilt by calling the app's own
      ~/ylhyra/src/documents/parse/Tokenize/List.js on the `tokenized` paragraphs
      stored in each data file. (List.js has no imports, so it is loaded straight
      from source as a data: URL module — no build step and no node_modules needed.)

    - Definitions are resolved exactly as the app does in
      ~/ylhyra/src/documents/parse/Compiler/1_Precompile/MergeWords.js:

          const definition = translation.definitions[translation.words[id]];

      A definition that no word in the document points at never renders. Those are
      reported as `dead` — they are superseded glosses or leftovers from re-tokenising,
      not things a learner ever sees.

  Point YLHYRA at a different checkout with the YLHYRA env var.

  Outputs, into exports/:
    sentences.tsv          source, id, Icelandic, English, other fields
    definitions.tsv        source, hash, Icelandic, English, context, other fields, status
    definitions_unique.tsv deduplicated Icelandic -> English pairs with frequency
    translations.json      full structured dump
    review/<source>.md     per-source human-readable review file
    checks.md              orphans, mechanical defects, inconsistent glosses

  Usage:  node scripts/export_translations.mjs
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "exports");
const YLHYRA = process.env.YLHYRA || path.join(path.dirname(ROOT), "ylhyra");
const LIST_JS = path.join(YLHYRA, "src/documents/parse/Tokenize/List.js");

/* Other English-bearing fields that sit alongside `meaning` */
const EXTRA_FIELDS = ["direct", "note", "inline_translation", "base_meaning", "base_note"];

/* Load the app's List.js straight from source (it has no imports of its own). */
async function loadList() {
  if (!fs.existsSync(LIST_JS)) {
    console.warn(`! ${LIST_JS} not found — falling back to the stored list maps.`);
    return null;
  }
  const src = fs.readFileSync(LIST_JS, "utf8");
  const url = "data:text/javascript;base64," + Buffer.from(src).toString("base64");
  return (await import(url)).default;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

function load(file) {
  const text = fs.readFileSync(file, "utf8");
  const end = text.indexOf("---", 3);
  const body = (end === -1 ? text : text.slice(end + 3)).trim();
  return body.startsWith("{") ? JSON.parse(body) : null;
}

const clean = (s) => String(s ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
const fmtExtra = (extra) =>
  EXTRA_FIELDS.filter((k) => extra[k]).map((k) => `${k}=${extra[k]}`).join("; ");

const List = await loadList();

fs.mkdirSync(path.join(OUT, "review"), { recursive: true });

const allData = {};
const sentRows = [];
const defRows = [];
const listDrift = [];
const missingSentences = [];
const missingWords = [];

for (const file of walk(path.join(ROOT, "data")).sort()) {
  const rel = path.relative(ROOT, file);
  let d;
  try {
    d = load(file);
  } catch (e) {
    console.error("PARSE ERROR", rel, e.message);
    continue;
  }
  if (!d) continue;

  const stored = d.list || {};
  /* Rebuild with the app's own tokenizer output shaper when we can. */
  let list = stored;
  if (List && d.tokenized) {
    const derived = List(d.tokenized);
    list = derived;
    const a = Object.keys(derived.items).length;
    const b = Object.keys(stored.items || {}).length;
    if (stored.items && a !== b) listDrift.push(`${rel}: derived ${a} items, stored ${b}`);
  }
  /* List.js guarantees items === sentences ∪ words; older saves lack `items`. */
  const items = { ...(list.sentences || {}), ...(list.words || {}), ...(list.items || {}) };

  const tr = d.translation || {};
  const definitions = tr.definitions || {};
  const wordsMap = tr.words || {};
  const sentences = tr.sentences || {};

  /* MergeWords.js: definitions[words[id]] for each word in the document. */
  const wordIDs = list.arrayOfAllWordIDs || Object.keys(list.words || {});
  const reachable = new Set();
  for (const id of wordIDs) {
    const hash = wordsMap[id];
    if (hash && definitions[hash]) reachable.add(hash);
  }

  /* word id -> owning sentence id (List.js stamps belongsToSentence on words) */
  const owner = {};
  for (const [id, item] of Object.entries(items)) {
    if (!item || typeof item !== "object") continue;
    for (const w of item.words || []) if (w && w.id) owner[w.id] = id;
    if (item.belongsToSentence) owner[id] = item.belongsToSentence;
  }
  const wordText = (id) => (items[id] && items[id].text) || "?";

  const fileSents = [];
  for (const [sid, sv] of Object.entries(sentences)) {
    const meaning = typeof sv === "object" && sv ? sv.meaning : sv;
    const extra = {};
    if (sv && typeof sv === "object") {
      for (const k of EXTRA_FIELDS) if (sv[k]) extra[k] = sv[k];
    }
    const ice = (items[sid] && items[sid].text) || "";
    const status = sid in items ? "live" : "dead";
    fileSents.push({ id: sid, is: ice, en: meaning || "", status, ...extra });
    sentRows.push([rel, sid, ice, meaning || "", fmtExtra(extra), status]);
  }

  const fileDefs = [];
  for (const [hash, dv] of Object.entries(definitions)) {
    const meaning = typeof dv === "object" && dv ? dv.meaning : dv;
    const contains = (dv && dv.contains) || [];
    const extra = {};
    if (dv && typeof dv === "object") {
      for (const k of EXTRA_FIELDS) if (dv[k]) extra[k] = dv[k];
    }
    const term = contains.map(wordText).join(" ");
    const sids = [...new Set(contains.map((w) => owner[w]).filter(Boolean))];
    const ctx = sids.filter((s) => items[s]).map((s) => items[s].text).join(" / ");
    const status = reachable.has(hash) ? "live" : "dead";
    // InlineTranslation.js renders `inline_translation || meaning`, so a definition with
    // only an inline_translation is fully translated — it is NOT an empty gloss.
    const en = meaning || extra.inline_translation || "(EMPTY GLOSS)";
    fileDefs.push({ hash, is: term, en, context: ctx, status, ...extra });
    defRows.push([rel, hash, term, en, ctx, fmtExtra(extra), status]);
  }

  /* Coverage: live Icelandic text that has no translation at all.
     A sentence of a single word needs no sentence translation — the word gloss
     carries it — so those are only reported if the word is unglossed too. */
  for (const sid of Object.keys(list.sentences || {})) {
    const s = items[sid];
    if (!s) continue;
    const wordsIn = (s.words || []).filter((w) => w && w.id);
    const sv = sentences[sid];
    const hasSentence = !!(sv && (typeof sv === "object" ? sv.meaning : sv));
    const glossed = (id) => {
      const h = wordsMap[id];
      return !!(h && definitions[h] && definitions[h].meaning);
    };
    if (wordsIn.length <= 1) {
      if (!wordsIn.every((w) => glossed(w.id)) && !hasSentence) {
        missingSentences.push([rel, sid, s.text || "", "single word, no gloss"]);
      }
    } else if (!hasSentence) {
      missingSentences.push([rel, sid, s.text || "", "no sentence translation"]);
    }
  }
  /* Names and numbers are routinely left unglossed on purpose. Treat a word as
     "likely a name" if it is capitalised and is not the first word of its sentence. */
  const firstWordOf = new Set();
  for (const s of Object.values(items)) {
    if (!s || typeof s !== "object") continue;
    const first = (s.words || []).find((w) => w && w.id);
    if (first) firstWordOf.add(first.id);
  }
  for (const id of wordIDs) {
    const h = wordsMap[id];
    if (h && definitions[h] && definitions[h].meaning) continue;
    const text = wordText(id);
    const sid = owner[id];
    const numeric = /^[\d.,-]+$/.test(text);
    const name = !firstWordOf.has(id) && /^\p{Lu}/u.test(text);
    missingWords.push([rel, id, text, (sid && items[sid] && items[sid].text) || "",
                       numeric ? "number" : name ? "likely a name" : "gap"]);
  }

  if (fileSents.length || fileDefs.length) {
    allData[rel] = { sentences: fileSents, definitions: fileDefs };
    writeReview(rel, fileSents, fileDefs);
  }
}

/* Review files show only what learners actually see. Dead entries are assumed to be on
   their way out, so they are omitted rather than shown and skipped. The TSVs and
   checks.md keep everything, with a status column. */
function writeReview(rel, allSents, allDefs) {
  // keep Icelandic letters in the filename — \w would strip them
  const name = rel.slice("data/".length).replace(/\.md$/, "").replace(/[^\p{L}\p{N}.-]/gu, "_");
  const sents = allSents.filter((s) => s.status === "live");
  const defs = allDefs.filter((d) => d.status === "live");
  const skipped = allSents.length - sents.length + (allDefs.length - defs.length);
  const f = [`# ${rel}\n`];
  if (skipped) {
    f.push(`_${skipped} dead entries omitted — nothing in the text points at them. ` +
           "See `exports/checks.md`._\n");
  }
  if (sents.length) {
    f.push("## Sentences\n");
    for (const s of sents) {
      f.push(`- **IS:** ${s.is}`);
      f.push(`  - **EN:** ${s.en}`);
      for (const k of EXTRA_FIELDS) if (s[k]) f.push(`  - *${k}:* ${s[k]}`);
    }
    f.push("");
  }
  if (defs.length) {
    f.push("## Word / phrase glosses\n");
    f.push("| Icelandic | English | Other fields | Context |");
    f.push("|---|---|---|---|");
    for (const d of [...defs].sort((a, b) => a.is.toLowerCase().localeCompare(b.is.toLowerCase()))) {
      const extra = EXTRA_FIELDS.filter((k) => d[k]).map((k) => `${k}: ${esc(d[k])}`).join("; ");
      f.push(`| ${d.is} | ${esc(d.en)} | ${extra} | ${esc(d.context)} |`);
    }
    f.push("");
  }
  fs.writeFileSync(path.join(OUT, "review", name + ".md"), f.join("\n"));
}

/* ---------- write the exports ---------- */

const tsv = (file, header, rows) =>
  fs.writeFileSync(
    path.join(OUT, file),
    header + "\n" + rows.map((r) => r.map(clean).join("\t")).join("\n") + "\n"
  );

tsv("sentences.tsv", "source\tid\ticelandic\tenglish\tother_fields\tstatus", sentRows);
tsv("definitions.tsv",
    "source\thash\ticelandic\tenglish\tcontext\tother_fields\tstatus", defRows);

const counts = new Map();
for (const r of defRows) {
  const key = r[2] + "\t" + r[3];
  const e = counts.get(key) || { n: 0, srcs: new Set() };
  e.n++;
  e.srcs.add(r[0]);
  counts.set(key, e);
}
fs.writeFileSync(
  path.join(OUT, "definitions_unique.tsv"),
  "count\ticelandic\tenglish\tsources\n" +
    [...counts.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .map(([k, v]) => `${v.n}\t${k}\t${[...v.srcs].sort().join("; ")}`)
      .join("\n") + "\n"
);

fs.writeFileSync(path.join(OUT, "translations.json"), JSON.stringify(allData, null, 1));

/* ---------- checks ---------- */

const isSpanish = (r) => r[0].includes("/Español/");
const liveDefs = defRows.filter((r) => !isSpanish(r));
const liveSents = sentRows.filter((r) => !isSpanish(r));
const out = [];
const say = (s = "") => out.push(s);

say("# Automated checks\n");
say("Generated by `node scripts/export_translations.mjs`. Spanish (`data/Español/`) is excluded.\n");

say("## Missing translations — live Icelandic text with no English\n");
const missS = missingSentences.filter((r) => !r[0].includes("/Español/"));
const missW = missingWords.filter((r) => !r[0].includes("/Español/"));
say(`${missS.length} sentences and ${missW.length} words. A one-word sentence needs no`);
say("sentence translation (the word gloss covers it) and is only listed if that word is");
say("unglossed too.\n");
say("### Sentences with no translation\n");
const missSBy = new Map();
for (const r of missS) missSBy.set(r[0], [...(missSBy.get(r[0]) || []), r]);
for (const [src, rs] of [...missSBy.entries()].sort((a, b) => b[1].length - a[1].length)) {
  say(`\n**${src}** (${rs.length})\n`);
  for (const r of rs) say(`- \`${r[1]}\` — ${r[2]} _(${r[3]})_`);
}
/* A capitalised word at the start of a sentence is ambiguous. If the same word also
   appears unglossed mid-sentence somewhere, it is a name there too — reclassify. */
const knownNames = new Set(missW.filter((r) => r[4] === "likely a name").map((r) => r[2]));
for (const r of missW) {
  if (r[4] === "gap" && knownNames.has(r[2])) r[4] = "likely a name";
}
const gaps = missW.filter((r) => r[4] === "gap");
say(`\n### Words with no gloss — genuine gaps (${gaps.length})\n`);
say("Numbers and capitalised mid-sentence words (names) are excluded here; they are");
say(`routinely left unglossed on purpose (${missW.length - gaps.length} of those).\n`);
const gapBy = new Map();
for (const r of gaps) gapBy.set(r[0], [...(gapBy.get(r[0]) || []), r]);
for (const [src, rs] of [...gapBy.entries()].sort((a, b) => b[1].length - a[1].length)) {
  say(`\n**${src}** (${rs.length}): ` + rs.map((r) => `\`${r[2]}\``).join(", "));
}
say("\n### Words with no gloss — numbers and likely names\n");
const nameBy = new Map();
for (const r of missW.filter((r) => r[4] !== "gap")) {
  nameBy.set(r[0], [...(nameBy.get(r[0]) || []), r]);
}
for (const [src, rs] of [...nameBy.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const uniq = [...new Set(rs.map((r) => r[2]))];
  say(`\n**${src}** (${rs.length}): ` + uniq.map((t) => `\`${t}\``).join(", "));
}
say("");

say("## Dead definitions (no word in the document points at them)\n");
const deadBy = new Map();
for (const r of liveDefs) {
  const e = deadBy.get(r[0]) || { dead: 0, total: 0 };
  e.total++;
  if (r[6] === "dead") e.dead++;
  deadBy.set(r[0], e);
}
let deadTotal = 0;
let deadFiles = 0;
for (const [src, e] of [...deadBy.entries()].sort((a, b) => b[1].dead - a[1].dead)) {
  if (!e.dead) continue;
  deadTotal += e.dead;
  deadFiles++;
  say(`- ${src}: ${e.dead} of ${e.total}`);
}
say(`\nTotal: ${deadTotal} of ${liveDefs.length} definitions across ${deadFiles} files.\n`);

say("## Dead sentence translations (sentence ID not in the current text)\n");
const deadSentBy = new Map();
for (const r of liveSents.filter((r) => r[5] === "dead")) {
  deadSentBy.set(r[0], (deadSentBy.get(r[0]) || 0) + 1);
}
for (const [src, n] of [...deadSentBy.entries()].sort((a, b) => b[1] - a[1])) {
  say(`- ${src}: ${n}`);
}
say(`\nTotal: ${[...deadSentBy.values()].reduce((a, b) => a + b, 0)} across ${deadSentBy.size} files.\n`);

say("## Live multi-word definitions with a missing word\n");
say("These still render (another word in the phrase points at them), but one of the word IDs");
say("in `contains` is gone from the text, so `readSiblings` in MergeWords.js cannot merge the");
say("full phrase. Shown with `?` where the missing word was.\n");
for (const r of liveDefs.filter((r) => r[6] === "live" && r[2].split(" ").includes("?"))) {
  say(`- \`${r[0]}\` — **${r[2]}**: "${r[3]}"`);
}
say("");

say("## Empty glosses\n");
for (const r of liveDefs.filter((r) => r[3] === "(EMPTY GLOSS)")) {
  say(`- \`${r[0]}\` — **${r[2]}** (${r[6]})`);
}
say("");

say("## Mechanical defects\n");
say("### Leading/trailing whitespace\n");
for (const r of liveDefs) {
  if (r[3] !== r[3].trim()) say(`- \`${r[0]}\` — **${r[2]}**: ${JSON.stringify(r[3])} (${r[6]})`);
}
const COMMON_SHORT = new Set(
  "a i it is in on at to of he we me my so up no or by do go as an be if us ok oh uh am hi ah eh ye".split(" ")
);
say("\n### Suspiciously short — likely truncated while typing\n");
const seenShort = new Set();
for (const r of liveDefs) {
  const g = r[3].trim();
  if (g.length <= 2 && !COMMON_SHORT.has(g.toLowerCase()) && !/^\d+$/.test(g)) {
    const k = g + "|" + r[2];
    if (seenShort.has(k)) continue;
    seenShort.add(k);
    say(`- \`${r[0]}\` — **${r[2]}**: ${JSON.stringify(g)} (${r[6]})`);
  }
}
say("\n### Sentence translations with stray whitespace\n");
for (const r of liveSents) {
  if (r[3] !== r[3].trim()) say(`- \`${r[0]}\` (${r[1]}): ${JSON.stringify(r[3])}`);
}
say("");

/* ---- gloss-convention consistency ----
   Two conventions worth holding steady across the corpus:
     1. definiteness — a definite Icelandic form is glossed "the x", consistently
     2. case is NOT spelled out — a genitive is glossed "the fjords", not "of the fjords",
        because the sentence translation already supplies the preposition
   These are reported, never enforced; the right convention is the author's call. */
const singleWord = liveDefs.filter((r) => r[2] && r[2] !== "?" && !r[2].includes(" "));
const glossesOf = new Map();
for (const r of singleWord) {
  const k = r[2].toLowerCase();
  if (!glossesOf.has(k)) glossesOf.set(k, new Map());
  const m = glossesOf.get(k);
  m.set(r[3], (m.get(r[3]) || 0) + 1);
}

say("## Gloss convention: same word glossed both with and without \"the\"\n");
let bothWays = 0;
for (const [term, gl] of [...glossesOf.entries()].sort()) {
  const withThe = [...gl.keys()].filter((g) => /^the /i.test(g));
  const bare = [...gl.keys()].filter((g) => !/^(the |to |an? |of )/i.test(g));
  if (withThe.length && bare.length) {
    bothWays++;
    say(`- **${term}**: ${withThe.map((g) => `"${g}"`).join(", ")} — vs — ` +
        bare.map((g) => `"${g}"`).join(", "));
  }
}
say(`\nTotal: ${bothWays}\n`);

say("## Gloss convention: case spelled out with \"of\"\n");
say("A genitive glossed \"of the x\" states in the gloss what the sentence already says.");
say("Consider \"the x\" (or just \"x\"), unless the word is inherently possessive.\n");
const ofGlosses = [...new Set(singleWord
  .filter((r) => /^of( the)? /i.test(r[3]))
  .map((r) => `- **${r[2]}**: "${r[3]}"`))].sort();
for (const l of ofGlosses) say(l);
say(`\nTotal: ${ofGlosses.length}\n`);

/* Definite suffixes that are unambiguous on a noun (-inn/-in/-ið are skipped: they
   collide with adjective and past-participle endings and produce mostly noise). */
const DEFINITE = ["unum", "arinnar", "irnar", "urnar", "arnir", "sins", "inum", "inni",
                  "unni", "anna", "inu", "num", "ins", "nir", "nar"];
say("## Gloss convention: definite noun forms glossed without \"the\"\n");
say("Heuristic — the term ends in an unambiguous definite suffix but its most common");
say("gloss does not start with \"the\". Adjectives and verbs sharing those endings will");
say("still slip through, so read before acting.\n");
let missingThe = 0;
for (const [term, gl] of [...glossesOf.entries()].sort()) {
  if (term.length < 6 || !DEFINITE.some((s) => term.endsWith(s))) continue;
  const top = [...gl.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (/^(the |to |of )/i.test(top)) continue;
  missingThe++;
  say(`- **${term}**: "${top}"`);
}
say(`\nTotal: ${missingThe}\n`);

say("## Icelandic terms with more than one gloss (used >= 3 times)\n");
const byTerm = new Map();
for (const r of liveDefs) {
  if (!r[2] || r[2] === "?") continue;
  const t = r[2].toLowerCase();
  const m = byTerm.get(t) || new Map();
  m.set(r[3], (m.get(r[3]) || 0) + 1);
  byTerm.set(t, m);
}
const rows = [];
for (const [term, gl] of byTerm) {
  const total = [...gl.values()].reduce((a, b) => a + b, 0);
  if (gl.size > 1 && total >= 3) rows.push([total, term, gl]);
}
for (const [total, term, gl] of rows.sort((a, b) => b[0] - a[0]).slice(0, 150)) {
  const variants = [...gl.entries()].sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `"${g}" (${n})`).join(", ");
  say(`- **${term}** (${total}×): ${variants}`);
}
say("");

if (listDrift.length) {
  say("## Stored `list` differs from what List.js rebuilds\n");
  for (const l of listDrift) say(`- ${l}`);
  say("");
}

fs.writeFileSync(path.join(OUT, "checks.md"), out.join("\n"));

console.log(
  `${Object.keys(allData).length} sources, ${sentRows.length} sentence translations, ` +
  `${defRows.length} definitions (${counts.size} unique pairs)\n` +
  `dead: ${deadTotal} definitions, ` +
  `${[...deadSentBy.values()].reduce((a, b) => a + b, 0)} sentence translations\n` +
  `list drift: ${listDrift.length} file(s)\n` +
  `wrote exports/ (review/, *.tsv, translations.json, checks.md)`
);
