import { DEFAULT_ENTRY_SCENE } from "./constants.js";
import { clone, slugify } from "./utils.js";

function normalizeCollectibleEntry(entry) {
  if (!entry) {
    return null;
  }
  if (typeof entry === "string") {
    const id = entry.trim();
    return id ? { id, name: id, description: "", icon: "" } : null;
  }
  if (typeof entry !== "object") {
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
    description:
      typeof entry.description === "string" ? entry.description.trim() : "",
    icon: typeof entry.icon === "string" ? entry.icon.trim() : "",
  };
}

function normalizeCollectibleGroup(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const seen = new Set();
  return entries
    .map((entry) => normalizeCollectibleEntry(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
}

function buildCollectiblesIndex(collectibles) {
  const index = {
    items: Object.create(null),
    clues: Object.create(null),
  };
  for (const type of ["items", "clues"]) {
    for (const entry of collectibles[type]) {
      index[type][entry.id] = entry;
    }
  }
  return index;
}

export function normalizeGameMeta(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`games.json item ${index + 1} is invalid`);
  }
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (!id) {
    throw new Error(`games.json item ${index + 1} missing id`);
  }
  return {
    id,
    file:
      typeof entry.file === "string" && entry.file.trim()
        ? entry.file.trim()
        : `data/games/${id}.json`,
    name:
      typeof entry.name === "string" && entry.name.trim()
        ? entry.name.trim()
        : id,
    icon:
      typeof entry.icon === "string" && entry.icon.trim()
        ? entry.icon.trim()
        : "🎃",
    desc: typeof entry.desc === "string" ? entry.desc.trim() : "",
    category: typeof entry.category === "string" ? entry.category.trim() : "",
  };
}

export function normalizeGamesIndex(data) {
  if (!data || !Array.isArray(data.games)) {
    throw new Error("games.json must contain a games array");
  }
  const seen = new Set();
  return data.games.map((entry, index) => {
    const game = normalizeGameMeta(entry, index);
    if (seen.has(game.id)) {
      throw new Error(`games.json duplicate id: ${game.id}`);
    }
    seen.add(game.id);
    return game;
  });
}

export function normalizeGameData(raw, meta) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${meta.file} is not a valid JSON object`);
  }
  if (!raw.scenes || typeof raw.scenes !== "object") {
    throw new Error(`${meta.file} is missing a scenes object`);
  }
  const entryScene =
    typeof raw.entryScene === "string" && raw.entryScene.trim()
      ? raw.entryScene.trim()
      : DEFAULT_ENTRY_SCENE;
  if (!raw.scenes[entryScene]) {
    throw new Error(`${meta.file} is missing entry scene ${entryScene}`);
  }
  const collectibles =
    raw.collectibles && typeof raw.collectibles === "object"
      ? {
          items: normalizeCollectibleGroup(raw.collectibles.items),
          clues: normalizeCollectibleGroup(raw.collectibles.clues),
        }
      : { items: [], clues: [] };
  return {
    ...raw,
    id: meta.id,
    file: meta.file,
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : meta.name,
    entryScene,
    status: Array.isArray(raw.status) ? raw.status : [],
    phases: Array.isArray(raw.phases) ? raw.phases : [],
    systemRules:
      raw.systemRules && typeof raw.systemRules === "object"
        ? raw.systemRules
        : {},
    collectibles,
    collectiblesIndex: buildCollectiblesIndex(collectibles),
    initialState:
      raw.initialState && typeof raw.initialState === "object"
        ? raw.initialState
        : {},
  };
}

export function makeLocalGameMeta(file, rawGame) {
  const baseId = slugify(file?.name || rawGame?.title || "local_game");
  return {
    id: `local:${baseId}`,
    file: file?.name || "local-upload.json",
    name: rawGame?.title || baseId,
    icon: "📂",
    desc: "本地导入",
    category: "本地游戏",
  };
}

export function normalizeRuntimeState(game) {
  const runtime = clone(game.initialState || {});
  if (!Array.isArray(runtime.tags)) {
    runtime.tags = [];
  }
  if (!Array.isArray(runtime.items)) {
    runtime.items = [];
  }
  if (!Array.isArray(runtime.clues)) {
    runtime.clues = [];
  }
  if (!Array.isArray(runtime.__firedSystemRules)) {
    runtime.__firedSystemRules = [];
  }
  if (runtime.phase == null) {
    runtime.phase =
      typeof game.phases?.[0]?.id === "string" ? game.phases[0].id : "default";
  }
  for (const item of game.status || []) {
    if (runtime[item.key] == null) {
      runtime[item.key] = item.value;
    }
  }
  return runtime;
}
