import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import * as parse5 from "parse5";

const rootDir = process.cwd();
const ajv = new Ajv2020({ allErrors: true, strict: false });

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatAjvErrors(errors = []) {
  return errors.map((error) => {
    const at = error.instancePath || "/";
    return `${at} ${error.message}`;
  });
}

function validateHtmlFragment(fragment, label) {
  const parseErrors = [];
  parse5.parseFragment(fragment, {
    sourceCodeLocationInfo: true,
    onParseError: (error) => parseErrors.push(error),
  });

  const manualSignals = [];
  const suspiciousPatterns = [
    {
      pattern: /class='[^']*">/g,
      reason: "mixed class quote (`class='...\">`)",
    },
    { pattern: /class='[^']*'>>/g, reason: "double `>` after class attribute" },
    {
      pattern: /class='[^']*\\?"/g,
      reason: "class attribute contains escaped quote residue",
    },
  ];

  for (const { pattern, reason } of suspiciousPatterns) {
    if (pattern.test(fragment)) {
      manualSignals.push(reason);
    }
  }

  if (parseErrors.length || manualSignals.length) {
    return {
      label,
      parseErrors: parseErrors.map(
        (error) =>
          `${error.code} at line ${error.startLine}, col ${error.startCol}`,
      ),
      manualSignals,
    };
  }

  return null;
}

function normalizeGameFile(entry) {
  return entry.file && entry.file.trim()
    ? entry.file.trim()
    : `data/games/${entry.id}.json`;
}

function collectDeclaredStateKeys(game) {
  const keys = new Set();
  for (const item of game.status || []) {
    if (item && typeof item.key === "string" && item.key.trim()) {
      keys.add(item.key.trim());
    }
  }
  for (const key of Object.keys(game.initialState || {})) {
    keys.add(key);
  }
  return keys;
}

function normalizeCollectibleEntry(entry) {
  if (typeof entry === "string") {
    const id = entry.trim();
    return id ? { id, name: id } : null;
  }
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (!id) {
    return null;
  }
  return {
    id,
    name:
      typeof entry.name === "string" && entry.name.trim()
        ? entry.name.trim()
        : id,
  };
}

function collectDeclaredCollectibles(game) {
  const result = {
    items: new Set(),
    clues: new Set(),
  };
  const collectibles =
    game.collectibles && typeof game.collectibles === "object"
      ? game.collectibles
      : {};
  for (const kind of ["items", "clues"]) {
    for (const entry of collectibles[kind] || []) {
      const normalized = normalizeCollectibleEntry(entry);
      if (normalized) {
        result[kind].add(normalized.id);
      }
    }
  }
  return result;
}

function validateCollectibleReference(
  kind,
  id,
  label,
  declaredCollectibles,
  problems,
) {
  if (typeof id !== "string" || !id.trim()) {
    problems.push(`${label} is missing ${kind.slice(0, -1)} id`);
    return;
  }
  if (
    declaredCollectibles[kind].size > 0 &&
    !declaredCollectibles[kind].has(id.trim())
  ) {
    problems.push(
      `${label} references undeclared ${kind.slice(0, -1)} "${id}"`,
    );
  }
}

function validateActions(
  actions,
  label,
  declaredStateKeys,
  declaredCollectibles,
  problems,
) {
  if (!Array.isArray(actions)) {
    return;
  }
  actions.forEach((action, index) => {
    if (!action || typeof action !== "object") {
      problems.push(`${label}[${index}] is not a valid action object`);
      return;
    }
    const actionLabel = `${label}[${index}]`;
    switch (action.type) {
      case "adjust":
      case "set":
      case "pushUnique":
      case "removeValue":
        if (
          typeof action.key !== "string" ||
          !action.key.trim() ||
          !declaredStateKeys.has(action.key)
        ) {
          problems.push(
            `${actionLabel} references undeclared state key "${action.key}"`,
          );
        }
        break;
      case "gainItem":
      case "loseItem":
        validateCollectibleReference(
          "items",
          action.item,
          `${actionLabel}.item`,
          declaredCollectibles,
          problems,
        );
        break;
      case "gainClue":
      case "loseClue":
        validateCollectibleReference(
          "clues",
          action.clue,
          `${actionLabel}.clue`,
          declaredCollectibles,
          problems,
        );
        break;
      default:
        break;
    }
  });
}

function collectPotentialReachableScenes(game) {
  const visited = new Set();
  const queue = [game.entryScene || "intro"];
  while (queue.length) {
    const sceneId = queue.shift();
    if (!sceneId || visited.has(sceneId) || !game.scenes?.[sceneId]) {
      continue;
    }
    visited.add(sceneId);
    const scene = game.scenes[sceneId];
    for (const choice of scene.choices || []) {
      if (
        choice?.next &&
        choice.next !== "__lobby__" &&
        !visited.has(choice.next)
      ) {
        queue.push(choice.next);
      }
    }
    for (const ruleGroup of ["beforeRender", "afterChoice"]) {
      for (const rule of game.systemRules?.[ruleGroup] || []) {
        if (
          rule?.goto &&
          rule.goto !== "__lobby__" &&
          !visited.has(rule.goto)
        ) {
          queue.push(rule.goto);
        }
      }
    }
  }
  return visited;
}

function validateRuleList(
  rules,
  label,
  declaredStateKeys,
  declaredCollectibles,
  problems,
  scenes,
) {
  if (!Array.isArray(rules)) {
    return;
  }
  rules.forEach((rule, index) => {
    if (rule?.when) {
      validateCondition(
        rule.when,
        `${label}[${index}].when`,
        declaredStateKeys,
        declaredCollectibles,
        problems,
      );
    }
    validateActions(
      rule?.actions,
      `${label}[${index}].actions`,
      declaredStateKeys,
      declaredCollectibles,
      problems,
    );
    if (rule?.effects != null) {
      problems.push(
        `${label}[${index}] still uses legacy effects; migrate to actions`,
      );
    }
    if (
      typeof rule?.goto === "string" &&
      rule.goto !== "__lobby__" &&
      !scenes[rule.goto]
    ) {
      problems.push(
        `${label}[${index}].goto points to missing scene "${rule.goto}"`,
      );
    }
  });
}

function validateCondition(
  condition,
  label,
  declaredStateKeys,
  declaredCollectibles,
  problems,
) {
  if (!condition || typeof condition !== "object") {
    return;
  }

  if (Array.isArray(condition.all)) {
    condition.all.forEach((item, index) => {
      validateCondition(
        item,
        `${label}.all[${index}]`,
        declaredStateKeys,
        declaredCollectibles,
        problems,
      );
    });
    return;
  }

  if (Array.isArray(condition.any)) {
    condition.any.forEach((item, index) => {
      validateCondition(
        item,
        `${label}.any[${index}]`,
        declaredStateKeys,
        declaredCollectibles,
        problems,
      );
    });
    return;
  }

  if (condition.not) {
    validateCondition(
      condition.not,
      `${label}.not`,
      declaredStateKeys,
      declaredCollectibles,
      problems,
    );
    return;
  }

  const key = typeof condition.key === "string" ? condition.key.trim() : "";
  if (!key) {
    problems.push(`${label} is missing condition.key`);
    return;
  }
  if (!declaredStateKeys.has(key)) {
    if (key === "$scene") {
      return;
    }
    problems.push(`${label} references undeclared state key "${key}"`);
  }
  if (
    key === "items" &&
    ["includes", "notIncludes"].includes(condition.op) &&
    typeof condition.value === "string"
  ) {
    validateCollectibleReference(
      "items",
      condition.value,
      `${label}.value`,
      declaredCollectibles,
      problems,
    );
  }
  if (
    key === "clues" &&
    ["includes", "notIncludes"].includes(condition.op) &&
    typeof condition.value === "string"
  ) {
    validateCollectibleReference(
      "clues",
      condition.value,
      `${label}.value`,
      declaredCollectibles,
      problems,
    );
  }
}

function main() {
  const gamesSchema = loadJson(
    path.join(rootDir, "schemas", "games.schema.json"),
  );
  const gameSchema = loadJson(
    path.join(rootDir, "schemas", "game.schema.json"),
  );
  const validateGamesIndex = ajv.compile(gamesSchema);
  const validateGame = ajv.compile(gameSchema);

  const gamesIndexPath = path.join(rootDir, "data", "games.json");
  const gamesIndex = loadJson(gamesIndexPath);
  const problems = [];

  if (!validateGamesIndex(gamesIndex)) {
    problems.push(
      ...formatAjvErrors(validateGamesIndex.errors).map(
        (message) => `data/games.json schema: ${message}`,
      ),
    );
  }

  const seenIds = new Set();
  for (const entry of gamesIndex.games || []) {
    if (seenIds.has(entry.id)) {
      problems.push(`data/games.json duplicate id: ${entry.id}`);
      continue;
    }
    seenIds.add(entry.id);

    const gameFile = normalizeGameFile(entry);
    const gamePath = path.join(rootDir, gameFile);
    if (!fs.existsSync(gamePath)) {
      problems.push(`missing game file: ${gameFile}`);
      continue;
    }

    const game = loadJson(gamePath);
    if (!validateGame(game)) {
      problems.push(
        ...formatAjvErrors(validateGame.errors).map(
          (message) => `${gameFile} schema: ${message}`,
        ),
      );
      continue;
    }
    const declaredStateKeys = collectDeclaredStateKeys(game);
    const declaredCollectibles = collectDeclaredCollectibles(game);
    for (const [phaseIndex, phase] of (game.phases || []).entries()) {
      if (phase?.conditions) {
        validateCondition(
          phase.conditions,
          `${gameFile} phases[${phaseIndex}].conditions`,
          declaredStateKeys,
          declaredCollectibles,
          problems,
        );
      }
    }

    validateRuleList(
      game.systemRules?.afterChoice,
      `${gameFile} systemRules.afterChoice`,
      declaredStateKeys,
      declaredCollectibles,
      problems,
      game.scenes,
    );
    validateRuleList(
      game.systemRules?.beforeRender,
      `${gameFile} systemRules.beforeRender`,
      declaredStateKeys,
      declaredCollectibles,
      problems,
      game.scenes,
    );
    validateRuleList(
      game.systemRules?.choiceRules,
      `${gameFile} systemRules.choiceRules`,
      declaredStateKeys,
      declaredCollectibles,
      problems,
      game.scenes,
    );

    for (const kind of ["items", "clues"]) {
      for (const [index, entry] of (
        game.collectibles?.[kind] || []
      ).entries()) {
        if (!normalizeCollectibleEntry(entry)) {
          problems.push(
            `${gameFile} collectibles.${kind}[${index}] is invalid`,
          );
        }
      }
    }

    const entryScene = game.entryScene || "intro";
    if (!game.scenes[entryScene]) {
      problems.push(`${gameFile} missing entry scene: ${entryScene}`);
    }

    for (const [sceneId, scene] of Object.entries(game.scenes)) {
      if (scene.conditions) {
        validateCondition(
          scene.conditions,
          `${gameFile} scene "${sceneId}".conditions`,
          declaredStateKeys,
          declaredCollectibles,
          problems,
        );
      }

      if (Array.isArray(scene.choices)) {
        scene.choices.forEach((choice, choiceIndex) => {
          if (
            choice.next &&
            choice.next !== "__lobby__" &&
            !game.scenes[choice.next]
          ) {
            problems.push(
              `${gameFile} scene "${sceneId}" points to missing scene "${choice.next}"`,
            );
          }
          if (choice.conditions) {
            validateCondition(
              choice.conditions,
              `${gameFile} scene "${sceneId}" choices[${choiceIndex}].conditions`,
              declaredStateKeys,
              declaredCollectibles,
              problems,
            );
          }
          if (choice.visibility) {
            validateCondition(
              choice.visibility,
              `${gameFile} scene "${sceneId}" choices[${choiceIndex}].visibility`,
              declaredStateKeys,
              declaredCollectibles,
              problems,
            );
          }
          validateActions(
            choice.actions,
            `${gameFile} scene "${sceneId}" choices[${choiceIndex}].actions`,
            declaredStateKeys,
            declaredCollectibles,
            problems,
          );
          if (choice.effects != null) {
            problems.push(
              `${gameFile} scene "${sceneId}" choices[${choiceIndex}] still uses legacy effects; migrate to actions`,
            );
          }
          if (choice.timeCost != null) {
            problems.push(
              `${gameFile} scene "${sceneId}" choices[${choiceIndex}] still uses legacy timeCost; use actions.advanceTime`,
            );
          }
        });
      }

      if (typeof scene.content === "string") {
        problems.push(
          `${gameFile} scene "${sceneId}" still uses legacy content; migrate to contentBlocks`,
        );
      }

      if (Array.isArray(scene.contentBlocks)) {
        scene.contentBlocks.forEach((block, index) => {
          const blockLabel = `${gameFile} scene "${sceneId}" contentBlocks[${index}]`;
          if (typeof block.text === "string" && !block.text.trim()) {
            problems.push(`${blockLabel}.text is empty`);
          }

          if (!block.text && !block.html) {
            problems.push(`${blockLabel} has neither text nor html`);
          }

          if (typeof block.speaker === "string" && !block.speaker.trim()) {
            problems.push(`${blockLabel}.speaker is empty`);
          }

          if (typeof block.eyebrow === "string" && !block.eyebrow.trim()) {
            problems.push(`${blockLabel}.eyebrow is empty`);
          }

          if (typeof block.aside === "string" && !block.aside.trim()) {
            problems.push(`${blockLabel}.aside is empty`);
          }

          if (typeof block.html === "string") {
            const htmlProblem = validateHtmlFragment(
              block.html,
              `${blockLabel}.html`,
            );
            if (htmlProblem) {
              problems.push(
                `${htmlProblem.label}: ${[...htmlProblem.parseErrors, ...htmlProblem.manualSignals].join("; ")}`,
              );
            }
          }
        });
      }
    }

    const reachableScenes = collectPotentialReachableScenes(game);
    for (const sceneId of Object.keys(game.scenes || {})) {
      if (!reachableScenes.has(sceneId)) {
        problems.push(
          `${gameFile} scene "${sceneId}" is not reachable from entry scene`,
        );
      }
    }
  }

  if (problems.length) {
    console.error("Content validation failed:");
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Content validation passed.");
}

main();
