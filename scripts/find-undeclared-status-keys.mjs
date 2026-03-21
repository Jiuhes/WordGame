import {
  collectDeclaredStateKeys,
  loadAllGames,
  walkConditions,
} from "./content-analysis-lib.mjs";

const findings = [];

for (const { file, game } of loadAllGames()) {
  const declared = collectDeclaredStateKeys(game);
  for (const [sceneId, scene] of Object.entries(game.scenes || {})) {
    if (scene.conditions) {
      walkConditions(scene.conditions, (rule, trail) => {
        if (rule.key && !declared.has(rule.key)) {
          findings.push(
            `${file} :: scene ${sceneId} :: conditions.${trail.join(".")} :: ${rule.key}`,
          );
        }
      });
    }
    for (const [choiceIndex, choice] of (scene.choices || []).entries()) {
      for (const [label, condition] of [
        ["conditions", choice.conditions],
        ["visibility", choice.visibility],
      ]) {
        if (!condition) {
          continue;
        }
        walkConditions(condition, (rule, trail) => {
          if (rule.key && !declared.has(rule.key)) {
            findings.push(
              `${file} :: scene ${sceneId} :: choice ${choiceIndex} :: ${label}.${trail.join(".")} :: ${rule.key}`,
            );
          }
        });
      }
    }
  }
}

if (!findings.length) {
  console.log("No undeclared status keys found.");
  process.exit(0);
}

for (const finding of findings) {
  console.log(finding);
}

console.log(`undeclared_keys=${findings.length}`);
