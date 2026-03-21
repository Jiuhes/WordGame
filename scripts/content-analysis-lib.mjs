import fs from "node:fs";
import path from "node:path";

export const rootDir = process.cwd();

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function getIndexedGames() {
  const indexPath = path.join(rootDir, "data", "games.json");
  const index = loadJson(indexPath);
  return (index.games || []).map((entry) => ({
    id: entry.id,
    file: entry.file?.trim() || `data/games/${entry.id}.json`,
  }));
}

export function loadAllGames() {
  return getIndexedGames().map((entry) => ({
    ...entry,
    game: loadJson(path.join(rootDir, entry.file)),
  }));
}

export function sceneText(scene) {
  return (scene.contentBlocks || [])
    .map((block) => {
      const text = String(block?.text || "").trim();
      const html = String(block?.html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return text || html;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function collectDeclaredStateKeys(game) {
  const keys = new Set(Object.keys(game.initialState || {}));
  for (const item of game.status || []) {
    if (item?.key) {
      keys.add(item.key);
    }
  }
  return keys;
}

export function walkConditions(condition, visit, trail = []) {
  if (!condition || typeof condition !== "object") {
    return;
  }
  if (Array.isArray(condition.all)) {
    condition.all.forEach((item, index) =>
      walkConditions(item, visit, [...trail, `all[${index}]`]),
    );
    return;
  }
  if (Array.isArray(condition.any)) {
    condition.any.forEach((item, index) =>
      walkConditions(item, visit, [...trail, `any[${index}]`]),
    );
    return;
  }
  if (condition.not) {
    walkConditions(condition.not, visit, [...trail, "not"]);
    return;
  }
  visit(condition, trail);
}

export function isPlaceholderScene(scene) {
  const title = String(scene.title || "").toLowerCase();
  const text = sceneText(scene).toLowerCase();
  return (
    /\b(todo|placeholder|tbd|coming soon)\b/.test(title) ||
    /\b(todo|placeholder|tbd|coming soon)\b/.test(text) ||
    text.length < 20
  );
}
