import { SERVER_UPLOAD_ENDPOINT_KEY, STORAGE_PREFIX } from "./constants.js";

const SAVE_SLOTS = [
  { id: "auto", label: "Auto" },
  { id: "slot1", label: "Slot 1" },
  { id: "slot2", label: "Slot 2" },
  { id: "slot3", label: "Slot 3" },
];

const DEFAULT_SETTINGS = {
  enableTransitions: true,
  enableSound: false,
};

function legacySaveKey(gameId) {
  return `${STORAGE_PREFIX}${gameId}`;
}

function slotSaveKey(gameId, slotId = "auto") {
  return `${STORAGE_PREFIX}${gameId}:slot:${slotId}`;
}

function statsKey(gameId) {
  return `${STORAGE_PREFIX}${gameId}:stats`;
}

function settingsKey() {
  return `${STORAGE_PREFIX}settings`;
}

function safeParse(raw, fallback = null) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeSavePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (typeof payload.currentSceneId !== "string" || !payload.currentSceneId) {
    return null;
  }
  return {
    currentSceneId: payload.currentSceneId,
    runtimeState:
      payload.runtimeState && typeof payload.runtimeState === "object"
        ? payload.runtimeState
        : {},
    history: Array.isArray(payload.history) ? payload.history.slice(-50) : [],
    updatedAt:
      typeof payload.updatedAt === "number" ? payload.updatedAt : Date.now(),
  };
}

export function createStorageController({ log = console.log } = {}) {
  return {
    getServerUploadEndpoint() {
      return localStorage.getItem(SERVER_UPLOAD_ENDPOINT_KEY) || "";
    },
    setServerUploadEndpoint(value) {
      if (!value) {
        localStorage.removeItem(SERVER_UPLOAD_ENDPOINT_KEY);
        return;
      }
      localStorage.setItem(SERVER_UPLOAD_ENDPOINT_KEY, value);
    },
    getSaveSlots() {
      return SAVE_SLOTS.slice();
    },
    saveProgress(game, sceneId, runtimeState, history, slotId = "auto") {
      if (!game || !sceneId) {
        return;
      }
      localStorage.setItem(
        slotSaveKey(game.id, slotId),
        JSON.stringify({
          currentSceneId: sceneId,
          runtimeState,
          history: history.slice(-50),
          updatedAt: Date.now(),
        }),
      );
    },
    loadProgress(gameId, slotId = "auto") {
      const primary = safeParse(
        localStorage.getItem(slotSaveKey(gameId, slotId)),
      );
      const normalized = normalizeSavePayload(primary);
      if (normalized) {
        return normalized;
      }
      if (slotId !== "auto") {
        return null;
      }
      const legacy = safeParse(localStorage.getItem(legacySaveKey(gameId)));
      const legacyNormalized = normalizeSavePayload(legacy);
      if (legacyNormalized) {
        this.saveProgress(
          { id: gameId },
          legacyNormalized.currentSceneId,
          legacyNormalized.runtimeState,
          legacyNormalized.history,
          "auto",
        );
        localStorage.removeItem(legacySaveKey(gameId));
        return legacyNormalized;
      }
      if (primary || legacy) {
        log(`Bad save for ${gameId}:${slotId}`);
      }
      localStorage.removeItem(slotSaveKey(gameId, slotId));
      return null;
    },
    listSaveSlots(gameId) {
      return SAVE_SLOTS.map((slot) => ({
        ...slot,
        data: this.loadProgress(gameId, slot.id),
      }));
    },
    clearProgress(gameId, slotId = "auto") {
      localStorage.removeItem(slotSaveKey(gameId, slotId));
      if (slotId === "auto") {
        localStorage.removeItem(legacySaveKey(gameId));
      }
    },
    exportProgress(gameId, slotId = "auto") {
      const payload = this.loadProgress(gameId, slotId);
      if (!payload) {
        return "";
      }
      return JSON.stringify(
        {
          gameId,
          slotId,
          ...payload,
        },
        null,
        2,
      );
    },
    importProgress(gameId, slotId, rawText) {
      const parsed = safeParse(rawText);
      const payload = normalizeSavePayload(parsed);
      if (!payload) {
        throw new Error("Invalid save JSON");
      }
      this.saveProgress(
        { id: gameId },
        payload.currentSceneId,
        payload.runtimeState,
        payload.history,
        slotId,
      );
      return payload;
    },
    getEndingStats(gameId) {
      const parsed = safeParse(localStorage.getItem(statsKey(gameId)), {});
      const discovered = Array.isArray(parsed?.discoveredEndings)
        ? parsed.discoveredEndings
        : [];
      return {
        discoveredEndings: discovered,
        totalRuns: Number(parsed?.totalRuns || 0),
        lastEndingAt:
          typeof parsed?.lastEndingAt === "number" ? parsed.lastEndingAt : null,
      };
    },
    recordEnding(gameId, sceneId, title) {
      const current = this.getEndingStats(gameId);
      if (!current.discoveredEndings.some((item) => item.sceneId === sceneId)) {
        current.discoveredEndings.push({
          sceneId,
          title: title || sceneId,
          at: Date.now(),
        });
      }
      current.totalRuns += 1;
      current.lastEndingAt = Date.now();
      localStorage.setItem(statsKey(gameId), JSON.stringify(current));
    },
    getSettings() {
      const parsed = safeParse(localStorage.getItem(settingsKey()), {});
      return {
        ...DEFAULT_SETTINGS,
        ...(parsed && typeof parsed === "object" ? parsed : {}),
      };
    },
    saveSettings(nextSettings) {
      const merged = {
        ...DEFAULT_SETTINGS,
        ...(nextSettings && typeof nextSettings === "object"
          ? nextSettings
          : {}),
      };
      localStorage.setItem(settingsKey(), JSON.stringify(merged));
      return merged;
    },
  };
}
