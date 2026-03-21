import {
  isPlaceholderScene,
  loadAllGames,
  sceneText,
} from "./content-analysis-lib.mjs";

const warnings = [];

for (const { file, game } of loadAllGames()) {
  const incoming = new Map(
    Object.keys(game.scenes || {}).map((sceneId) => [sceneId, 0]),
  );
  const endings = new Map();

  for (const [sceneId, scene] of Object.entries(game.scenes || {})) {
    const choices = scene.choices || [];
    const onlyChoice = choices[0];
    for (const choice of choices) {
      if (
        choice.next &&
        choice.next !== "__lobby__" &&
        incoming.has(choice.next)
      ) {
        incoming.set(choice.next, incoming.get(choice.next) + 1);
      }
    }

    if (choices.length === 0) {
      const endingKey = sceneText(scene).replace(/\s+/g, " ").trim();
      if (endingKey) {
        const bucket = endings.get(endingKey) || [];
        bucket.push(sceneId);
        endings.set(endingKey, bucket);
      }
    }

    if (isPlaceholderScene(scene)) {
      warnings.push(`${file} :: placeholder scene :: ${sceneId}`);
    }

    const looksLikeEnding =
      choices.length === 0 ||
      (choices.length > 0 &&
        choices.every(
          (choice) =>
            choice.reset ||
            choice.next === "__lobby__" ||
            choice.next === (game.entryScene || "intro"),
        ));

    const isForcedBridge =
      choices.length === 1 &&
      onlyChoice &&
      !onlyChoice.reset &&
      onlyChoice.next &&
      onlyChoice.next !== "__lobby__" &&
      incoming.get(sceneId) <= 1 &&
      incoming.get(onlyChoice.next) <= 2 &&
      sceneText(scene).length >= 120;

    if (
      choices.length === 1 &&
      !scene.conditions &&
      !looksLikeEnding &&
      !isForcedBridge
    ) {
      warnings.push(
        `${file} :: weak branching density :: ${sceneId} has ${choices.length} choice`,
      );
    }
  }

  for (const [sceneId, count] of incoming.entries()) {
    if (sceneId !== (game.entryScene || "intro") && count === 0) {
      warnings.push(`${file} :: unused scene :: ${sceneId}`);
    }
  }

  for (const [endingText, sceneIds] of endings.entries()) {
    if (sceneIds.length > 1) {
      warnings.push(
        `${file} :: repeated ending copy :: ${sceneIds.join(", ")} :: ${endingText.slice(0, 80)}`,
      );
    }
  }
}

if (!warnings.length) {
  console.log("Content lint passed.");
  process.exit(0);
}

for (const warning of warnings) {
  console.log(warning);
}

console.log(`content_lint_warnings=${warnings.length}`);
