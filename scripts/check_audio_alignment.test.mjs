import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkAudioAlignments } from "./check_audio_alignment.mjs";

const hash = (input) => {
  let value = 5381;
  let index = input.length;
  while (index) value = (value * 33) ^ input.charCodeAt(--index);
  return (value >>> 0).toString(36);
};

const fixture = (alignedID = "s_one") => {
  const xml = '<div id="s_one">Halló.</div>';
  return {
    list: {
      sentences: {
        s_one: { id: "s_one", text: "Halló." },
      },
    },
    long_audio: {
      "example.mp3": {
        sync: {
          list: [
            { begin: 0, elements: [alignedID], end: 1 },
            { begin: 1, elements: [], end: null },
          ],
          original_sync_data: {
            fragments: [
              {
                id: "root",
                children: [
                  {
                    id: alignedID,
                    begin: "0.000",
                    end: "1.000",
                    children: [],
                    lines: ["Halló."],
                  },
                ],
              },
            ],
          },
        },
        xml,
        xml_hash: hash(xml.replace(/^[A-zÀ-ÿ0-9/<>_-]/, "")),
      },
    },
  };
};

const withFixture = (data, callback) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ylhyra-alignment-"));
  try {
    fs.mkdirSync(path.join(root, "data"));
    fs.writeFileSync(
      path.join(root, "data", "fixture.md"),
      `---\ntitle: Data:Fixture\n---\n${JSON.stringify(data)}`
    );
    callback(checkAudioAlignments(root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

test("accepts coherent forced-alignment data", () => {
  withFixture(fixture(), (result) => {
    assert.equal(result.audioFiles, 1);
    assert.equal(result.sections, 2);
    assert.equal(result.alignedIDs, 1);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.textDrift, []);
  });
});

test("reports an aligned ID that no longer exists", () => {
  withFixture(fixture("s_old"), (result) => {
    assert(result.errors.some((error) => error.includes("missing ID s_old")));
  });
});
