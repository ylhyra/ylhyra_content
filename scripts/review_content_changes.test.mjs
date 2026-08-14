import test from "node:test";
import assert from "node:assert/strict";
import { classifyFile, hasTextChange, inlineDiff, reviewVocabularyFile } from "./review_content_changes.mjs";

test("filters the comparison to learner-facing files", () => {
  assert.equal(classifyFile("data/Sund.md"), "translations");
  assert.equal(classifyFile("ARCHIVED/data/Test.md"), null);
  assert.equal(classifyFile("not_data/content/course/Test.md"), "articles");
  assert.equal(classifyFile("not_data/vocabulary/vocabulary.yml"), "vocabulary");
  assert.equal(classifyFile("scripts/export_translations.mjs"), null);
  assert.equal(classifyFile("OVERVIEW.md"), null);
});

test("highlights changed words while retaining context", () => {
  const result = inlineDiff(
    "Hot water is cheaper in Iceland, so pools are cheap.",
    "Hot water is cheap in Iceland, so pools are affordable.",
  );
  assert.match(result.before, /<mark class="removed">cheaper<\/mark>/);
  assert.match(result.after, /<mark class="added">cheap<\/mark>/);
  assert.match(result.after, /<mark class="added">affordable<\/mark>/);
});

test("uses character-level highlighting for spelling fixes", () => {
  const result = inlineDiff("flaschard", "flashcard");
  assert.equal(result.before, 'flasc<mark class="removed">h</mark>ard');
  assert.equal(result.after, 'flas<mark class="added">h</mark>card');
});

test("uses whole words for semantically unrelated replacements", () => {
  const result = inlineDiff("hot", "white");
  assert.equal(result.before, '<mark class="removed">hot</mark>');
  assert.equal(result.after, '<mark class="added">white</mark>');
});

test("groups vocabulary fields while hiding IDs and bookkeeping", () => {
  const before = `rows:\n  - icelandic: Þessi pottur er of heitur.\n    english: This pot is too hot.\n    note_regarding_english: Old note.\n    lemmas: pottur, heitur\n    row_id: 42\n    last_seen: "2021-01-01"\n`;
  const after = `rows:\n  - icelandic: Þessi pottur er of heitur.\n    english: This saucepan is too hot.\n    note_regarding_english: Clearer note.\n    lemmas: pottur, heitur\n    row_id: 42\n    last_seen: "2026-01-01"\n`;
  const changes = reviewVocabularyFile(before, after);
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].fields.map(({ label }) => label), ["English", "Note regarding English"]);
  assert.deepEqual(changes[0].extras, [{ label: "Lemmas", value: "pottur, heitur" }]);
  assert.equal(changes[0].subject, "Þessi pottur er of heitur.");
});

test("ignores changes that only trim surrounding whitespace", () => {
  assert.equal(hasTextChange("  same text  ", "same text"), false);
  assert.equal(hasTextChange("same  text", "same text"), true);

  const before = `rows:\n  - icelandic: Halló.\n    english: " Hello. "\n    note_regarding_english: " Keep me. "\n    row_id: 7\n`;
  const after = `rows:\n  - icelandic: Halló.\n    english: Hello.\n    note_regarding_english: Keep me.\n    row_id: 7\n`;
  assert.deepEqual(reviewVocabularyFile(before, after), []);
});
