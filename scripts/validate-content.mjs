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

function validateCondition(condition, label, declaredStateKeys, problems) {
  if (!condition || typeof condition !== "object") {
    return;
  }

  if (Array.isArray(condition.all)) {
    condition.all.forEach((item, index) => {
      validateCondition(
        item,
        `${label}.all[${index}]`,
        declaredStateKeys,
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
    problems.push(`${label} references undeclared state key "${key}"`);
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
              problems,
            );
          }
          if (choice.visibility) {
            validateCondition(
              choice.visibility,
              `${gameFile} scene "${sceneId}" choices[${choiceIndex}].visibility`,
              declaredStateKeys,
              problems,
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
