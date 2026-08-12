/*
  List data/*.md files that no content page picks up.

  A data file is titled `Data:<Title>` and binds to the content page under not_data/
  whose `title:` (or one of its `redirects:`) is `<Title>`. Matching here is
  case-insensitive, ignores the `Text:`/`Data:`/`Project:` namespace prefixes, and
  tolerates underscores for spaces — a stricter match produces false positives.

  Anything listed has no page to render it. Move those to ARCHIVED/ rather than
  deleting, so the translations stay recoverable.

  Usage:  node scripts/find_unpublished_data.mjs
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

const frontMatter = (p) => {
  const m = fs.readFileSync(p, "utf8").slice(0, 4000).match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : "";
};

const NS = ["text:", "data:", "project:", "file:"];
/* titles stack namespaces, e.g. "Data:Text:A1/Garðvinna" — strip them all */
const stripNS = (s) => {
  for (;;) {
    const n = NS.find((n) => s.toLowerCase().startsWith(n));
    if (!n) return s;
    s = s.slice(n.length);
  }
};
const norm = (s) => stripNS(s).trim().toLowerCase().replace(/_/g, " ");

/* every name a content page answers to */
const names = new Set();
for (const p of walk(path.join(ROOT, "not_data"))) {
  if (p.includes(`${path.sep}files${path.sep}`)) continue;
  const fm = frontMatter(p);
  const t = fm.match(/^title:\s*(.+)$/m);
  if (t) names.add(norm(t[1]));
  const r = fm.match(/^redirects:\n((?:\s*-\s*.*\n?)+)/m);
  if (r) {
    for (const line of r[1].split("\n")) {
      const v = line.replace(/^\s*-\s*/, "").trim();
      if (v) names.add(norm(v));
    }
  }
}

const orphans = [];
for (const p of walk(path.join(ROOT, "data")).sort()) {
  const t = frontMatter(p).match(/^title:\s*(.+)$/m);
  const title = t ? t[1].trim() : "";
  if (!title) {
    orphans.push([path.relative(ROOT, p), "(no title)"]);
    continue;
  }
  const base = norm(title);
  const tries = [base, base.replace(/^[ab][12]\//, "")];
  if (!tries.some((c) => names.has(c))) orphans.push([path.relative(ROOT, p), title]);
}

if (!orphans.length) {
  console.log("Every data file has a content page.");
} else {
  console.log(`${orphans.length} data file(s) with no content page:\n`);
  for (const [p, t] of orphans) console.log(`  ${p}   (title "${t}")`);
}
