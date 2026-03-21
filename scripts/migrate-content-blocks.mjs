import fs from "node:fs";
import path from "node:path";

const targetFile = process.argv[2];

if (!targetFile) {
  console.error(
    "Usage: node scripts/migrate-content-blocks.mjs <game-json-path>",
  );
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), targetFile);
const game = JSON.parse(fs.readFileSync(filePath, "utf8"));

let converted = 0;
for (const scene of Object.values(game.scenes || {})) {
  if (
    typeof scene.content === "string" &&
    !Array.isArray(scene.contentBlocks)
  ) {
    scene.contentBlocks = [
      {
        type: "raw-html",
        html: scene.content,
      },
    ];
    delete scene.content;
    converted += 1;
  }
}

fs.writeFileSync(filePath, JSON.stringify(game, null, 2), "utf8");
console.log(`Migrated ${converted} scenes in ${targetFile}`);
