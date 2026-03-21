import { loadAllGames, sceneText } from "./content-analysis-lib.mjs";

const buckets = new Map();

for (const { file, game } of loadAllGames()) {
  for (const [sceneId, scene] of Object.entries(game.scenes || {})) {
    const text = sceneText(scene);
    if (!text || text.length < 30) {
      continue;
    }
    const key = text.replace(/\s+/g, " ").trim();
    const entry = buckets.get(key) || [];
    entry.push({ file, sceneId, title: scene.title || "" });
    buckets.set(key, entry);
  }
}

const duplicates = [...buckets.entries()].filter(
  ([, entries]) => entries.length > 1,
);

if (!duplicates.length) {
  console.log("No duplicate scene copy found.");
  process.exit(0);
}

for (const [text, entries] of duplicates) {
  console.log(`TEXT: ${text.slice(0, 120)}`);
  for (const entry of entries) {
    console.log(`  - ${entry.file} :: ${entry.sceneId} :: ${entry.title}`);
  }
  console.log("");
}

console.log(`duplicate_copy_groups=${duplicates.length}`);
