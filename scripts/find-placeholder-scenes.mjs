import {
  isPlaceholderScene,
  loadAllGames,
  sceneText,
} from "./content-analysis-lib.mjs";

const results = [];

for (const { file, game } of loadAllGames()) {
  for (const [sceneId, scene] of Object.entries(game.scenes || {})) {
    if (!isPlaceholderScene(scene)) {
      continue;
    }
    results.push({
      file,
      sceneId,
      title: scene.title || "",
      preview: sceneText(scene).slice(0, 80),
    });
  }
}

if (!results.length) {
  console.log("No placeholder scenes found.");
  process.exit(0);
}

for (const item of results) {
  console.log(
    `${item.file} :: ${item.sceneId} :: ${item.title} :: ${item.preview}`,
  );
}

console.log(`\nplaceholder_scenes=${results.length}`);
