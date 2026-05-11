import { describe, it, expect } from "vitest";
import {
  normalizeGameMeta,
  normalizeGamesIndex,
  normalizeGameData,
  makeLocalGameMeta,
  normalizeRuntimeState,
} from "../assets/js/core/game-data.js";

describe("normalizeGameMeta", () => {
  it("should normalize a valid game meta entry", () => {
    const entry = {
      id: "test-game",
      file: "data/games/test.json",
      name: "Test Game",
      icon: "🎮",
      desc: "A test game",
      category: "Adventure",
    };

    const result = normalizeGameMeta(entry, 0);

    expect(result.id).toBe("test-game");
    expect(result.file).toBe("data/games/test.json");
    expect(result.name).toBe("Test Game");
    expect(result.icon).toBe("🎮");
    expect(result.desc).toBe("A test game");
    expect(result.category).toBe("Adventure");
  });

  it("should use default values for missing optional fields", () => {
    const entry = { id: "minimal-game" };
    const result = normalizeGameMeta(entry, 0);

    expect(result.id).toBe("minimal-game");
    expect(result.file).toBe("data/games/minimal-game.json");
    expect(result.name).toBe("minimal-game");
    expect(result.icon).toBe("🎃");
    expect(result.desc).toBe("");
    expect(result.category).toBe("");
  });

  it("should throw error for invalid entry", () => {
    expect(() => normalizeGameMeta(null, 0)).toThrow();
    expect(() => normalizeGameMeta("not-an-object", 0)).toThrow();
  });

  it("should throw error for missing id", () => {
    expect(() => normalizeGameMeta({}, 0)).toThrow();
    expect(() => normalizeGameMeta({ name: "No ID" }, 0)).toThrow();
  });

  it("should trim whitespace from string fields", () => {
    const entry = {
      id: "  spaced-id  ",
      name: "  Spaced Name  ",
    };
    const result = normalizeGameMeta(entry, 0);

    expect(result.id).toBe("spaced-id");
    expect(result.name).toBe("Spaced Name");
  });
});

describe("normalizeGamesIndex", () => {
  it("should normalize a valid games index", () => {
    const data = {
      games: [
        { id: "game1", name: "Game 1" },
        { id: "game2", name: "Game 2" },
      ],
    };

    const result = normalizeGamesIndex(data);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("game1");
    expect(result[1].id).toBe("game2");
  });

  it("should throw error for invalid data", () => {
    expect(() => normalizeGamesIndex(null)).toThrow();
    expect(() => normalizeGamesIndex({})).toThrow();
    expect(() => normalizeGamesIndex({ games: null })).toThrow();
  });

  it("should throw error for duplicate ids", () => {
    const data = {
      games: [{ id: "duplicate" }, { id: "duplicate" }],
    };

    expect(() => normalizeGamesIndex(data)).toThrow(/duplicate/);
  });
});

describe("normalizeGameData", () => {
  const meta = {
    id: "test-game",
    file: "data/games/test.json",
    name: "Test Game",
  };

  it("should normalize valid game data", () => {
    const raw = {
      title: "Test Game",
      entryScene: "intro",
      scenes: {
        intro: { title: "Introduction", contentBlocks: [] },
      },
      initialState: { health: 100 },
    };

    const result = normalizeGameData(raw, meta);

    expect(result.id).toBe("test-game");
    expect(result.title).toBe("Test Game");
    expect(result.entryScene).toBe("intro");
    expect(result.scenes).toBeDefined();
    expect(result.collectibles.items).toEqual([]);
    expect(result.collectibles.clues).toEqual([]);
  });

  it("should throw error for invalid game data", () => {
    expect(() => normalizeGameData(null, meta)).toThrow();
    expect(() => normalizeGameData({}, meta)).toThrow(/scenes/);
  });

  it("should throw error for missing entry scene", () => {
    const raw = {
      scenes: { other: {} },
    };

    expect(() => normalizeGameData(raw, meta)).toThrow(/entry scene/);
  });

  it("should handle optional fields", () => {
    const raw = {
      entryScene: "start",
      scenes: { start: {} },
      status: [{ key: "health", value: 100 }],
      phases: [{ id: "early" }],
      systemRules: {},
      collectibles: {
        items: ["sword"],
        clues: ["secret"],
      },
    };

    const result = normalizeGameData(raw, meta);

    expect(result.status).toHaveLength(1);
    expect(result.phases).toHaveLength(1);
    expect(result.collectibles.items).toHaveLength(1);
    expect(result.collectibles.clues).toHaveLength(1);
  });
});

describe("makeLocalGameMeta", () => {
  it("should create meta from file", () => {
    const file = { name: "my-game.json" };
    const result = makeLocalGameMeta(file, {});

    expect(result.id).toBe("local:my-game");
    expect(result.name).toBe("my-game");
    expect(result.file).toBe("my-game.json");
  });

  it("should create meta from raw game data", () => {
    const rawGame = { title: "Imported Game" };
    const result = makeLocalGameMeta(null, rawGame);

    expect(result.id).toBe("local:imported_game");
    expect(result.name).toBe("Imported Game");
  });

  it("should handle empty input", () => {
    const result = makeLocalGameMeta(null, null);

    expect(result.id).toBe("local:local_game");
  });
});

describe("normalizeRuntimeState", () => {
  it("should initialize default collections", () => {
    const game = { initialState: {}, status: [] };
    const result = normalizeRuntimeState(game);

    expect(result.tags).toEqual([]);
    expect(result.items).toEqual([]);
    expect(result.clues).toEqual([]);
    expect(result.__firedSystemRules).toEqual([]);
    expect(result.phase).toBe("default");
  });

  it("should preserve initial state values", () => {
    const game = {
      initialState: { health: 100, mana: 50 },
      status: [],
    };
    const result = normalizeRuntimeState(game);

    expect(result.health).toBe(100);
    expect(result.mana).toBe(50);
  });

  it("should initialize status values", () => {
    const game = {
      initialState: {},
      status: [
        { key: "health", value: 100 },
        { key: "mana", value: 50 },
      ],
    };
    const result = normalizeRuntimeState(game);

    expect(result.health).toBe(100);
    expect(result.mana).toBe(50);
  });

  it("should not override existing initial state values with status defaults", () => {
    const game = {
      initialState: { health: 80 },
      status: [{ key: "health", value: 100 }],
    };
    const result = normalizeRuntimeState(game);

    expect(result.health).toBe(80);
  });

  it("should set phase from first phase definition", () => {
    const game = {
      initialState: {},
      status: [],
      phases: [{ id: "intro" }, { id: "main" }],
    };
    const result = normalizeRuntimeState(game);

    expect(result.phase).toBe("intro");
  });
});
