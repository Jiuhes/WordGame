import {
  makeLocalGameMeta,
  normalizeGameData,
  normalizeGamesIndex,
  normalizeRuntimeState,
} from "./core/game-data.js";
import { createStorageController } from "./core/game-storage.js";
import { escapeHtml, fetchJson, renderContentBlocks } from "./core/utils.js";
import { createRuntimeController } from "./core/runtime.js";
import { createLobbyController } from "./ui/lobby.js";
import { createLocalPlayController } from "./ui/local-play.js";
import { createModalController } from "./ui/modal.js";
import { open as openStats } from "./game-stats.js";
import { open as openSettings } from "./game-settings.js";

const state = {
  games: [],
  currentGame: null,
  currentSceneId: null,
  runtimeState: {},
  history: [],
  settings: {},
};

const els = {
  lobby: document.getElementById("lobby"),
  gameList: document.getElementById("gameList"),
  gameCount: document.getElementById("gameCount"),
  gameContainer: document.getElementById("gameContainer"),
  gameTitle: document.getElementById("gameTitle"),
  statusBar: document.getElementById("statusBar"),
  collectionBar: document.getElementById("collectionBar"),
  feedbackLayer: document.getElementById("feedbackLayer"),
  gameContent: document.getElementById("gameContent"),
  backBtn: document.getElementById("backBtn"),
  closeGameBtn: document.getElementById("closeGameBtn"),
  localGameInput: document.getElementById("localGameInput"),
  fileMenuTrigger: document.getElementById("fileMenuTrigger"),
  fileMenuDropdown: document.getElementById("fileMenuDropdown"),
  openLocalFileAction: document.getElementById("openLocalFileAction"),
  openRemoteJsonAction: document.getElementById("openRemoteJsonAction"),
  pasteLocalJsonAction: document.getElementById("pasteLocalJsonAction"),
  openStatsViewAction: document.getElementById("openStatsViewAction"),
  openSettingsViewAction: document.getElementById("openSettingsViewAction"),
  openStatsViewActionGame: document.getElementById("openStatsViewActionGame"),
  openSettingsViewActionGame: document.getElementById(
    "openSettingsViewActionGame",
  ),
  restartGameAction: document.getElementById("restartGameAction"),
  modalRoot: document.getElementById("modalRoot"),
  modalWindow: document.getElementById("modalWindow"),
  modalTitle: document.getElementById("modalTitle"),
  modalMenuBar: document.getElementById("modalMenuBar"),
  modalContent: document.getElementById("modalContent"),
  modalStatusText: document.getElementById("modalStatusText"),
  modalStatusHint: document.getElementById("modalStatusHint"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
};

function log(message) {
  console.log(message);
}

function explainTopLevelImportError(error) {
  if (error instanceof SyntaxError) {
    return "JSON 格式不合法，先检查逗号、引号和括号是否完整。";
  }
  return error.message || "导入内容无法被当前程序识别。";
}

const storage = createStorageController({ log });
state.settings = storage.getSettings();
const modal = createModalController(els);

const sceneVoiceovers = {
  "paper-shrine": {
    intro: "output/speech/paper-shrine-minimax/001-intro.mp3",
    mourning_hall: "output/speech/paper-shrine-minimax/002-mourning_hall.mp3",
    ledger_room: "output/speech/paper-shrine-minimax/003-ledger_room.mp3",
    well_courtyard: "output/speech/paper-shrine-minimax/004-well_courtyard.mp3",
  },
};

function getSceneVoiceUrl(gameId, sceneId) {
  return sceneVoiceovers[gameId]?.[sceneId] || "";
}

let audioContext = null;
function playUiSound(kind) {
  if (!state.settings?.enableSound) {
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return;
  }
  if (!audioContext) {
    audioContext = new Ctx();
  }
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const presets = {
    choice: { frequency: 440, duration: 0.06, volume: 0.02 },
    scene: { frequency: 320, duration: 0.08, volume: 0.018 },
    ending: { frequency: 220, duration: 0.22, volume: 0.03 },
  };
  const preset = presets[kind] || presets.scene;
  oscillator.type = kind === "ending" ? "triangle" : "sine";
  oscillator.frequency.value = preset.frequency;
  gain.gain.value = preset.volume;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + preset.duration);
}

const runtime = createRuntimeController({
  state,
  els,
  storage,
  log,
  escapeHtml,
  fetchJson,
  renderContentBlocks,
  normalizeGameData,
  normalizeRuntimeState,
  playUiSound,
  getSceneVoiceUrl,
});

const lobby = createLobbyController({
  state,
  els,
  log,
  escapeHtml,
  fetchJson,
  normalizeGamesIndex,
  getGameStats: (gameId) => storage.getEndingStats(gameId),
  getLatestSave: (gameId) => storage.loadProgress(gameId, "auto"),
  onSelectGame: (game) => runtime.loadGame(game),
  onResumeGame: (game) => runtime.loadGame(game, "auto"),
});

const localPlay = createLocalPlayController({
  state,
  els,
  modal,
  storage,
  runtime,
  log,
  escapeHtml,
  normalizeGameData,
  makeLocalGameMeta,
});

const appApi = {
  state,
  els,
  log,
  storage,
  escapeHtml,
  openModal: modal.openModal,
  fetchJson,
  runtime,
};

window.WordGameApp = appApi;
window.backToLobby = runtime.backToLobby;
window.render_game_to_text = runtime.renderGameToText;
window.advanceTime = function advanceTime() {
  return window.render_game_to_text();
};

document.addEventListener("DOMContentLoaded", () => {
  els.backBtn.addEventListener("click", runtime.backToLobby);
  els.closeGameBtn.addEventListener("click", runtime.backToLobby);
  els.modalCloseBtn.addEventListener("click", () => modal.closeModal(null));
  els.modalRoot.addEventListener("click", (event) => {
    if (
      event.target &&
      event.target.hasAttribute("data-modal-close") &&
      modal.modalState.allowOverlayClose
    ) {
      modal.closeModal(null);
    }
  });

  els.fileMenuTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    lobby.setFileMenuOpen(!els.fileMenuDropdown.classList.contains("open"));
  });
  els.fileMenuTrigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      lobby.setFileMenuOpen(!els.fileMenuDropdown.classList.contains("open"));
    }
    if (event.key === "Escape") {
      lobby.setFileMenuOpen(false);
    }
  });
  document.addEventListener("click", () => lobby.setFileMenuOpen(false));
  els.fileMenuDropdown.addEventListener("click", (event) =>
    event.stopPropagation(),
  );

  els.openLocalFileAction.addEventListener("click", () => {
    lobby.setFileMenuOpen(false);
    els.localGameInput.click();
  });
  els.openRemoteJsonAction?.addEventListener("click", async () => {
    lobby.setFileMenuOpen(false);
    try {
      await localPlay.handleRemoteJson();
    } catch (error) {
      runtime.showGame();
      els.gameTitle.textContent = "从链接加载的数据";
      els.statusBar.innerHTML = "<span style='color:#ff6b6b'>加载失败</span>";
      els.gameContent.innerHTML = `<div class='text danger'>尝试读取链接 JSON 时发生错误：${escapeHtml(explainTopLevelImportError(error))}</div>`;
    }
  });
  els.pasteLocalJsonAction.addEventListener("click", async () => {
    lobby.setFileMenuOpen(false);
    try {
      await localPlay.handlePastedJson();
    } catch (error) {
      runtime.showGame();
      els.gameTitle.textContent = "从剪贴板加载的数据";
      els.statusBar.innerHTML = "<span style='color:#ff6b6b'>加载失败</span>";
      els.gameContent.innerHTML = `<div class='text danger'>尝试解析粘贴的测试数据时发生错误：${escapeHtml(explainTopLevelImportError(error))}</div>`;
    }
  });

  els.openStatsViewAction?.addEventListener("click", () => openStats(appApi));
  els.openStatsViewActionGame?.addEventListener("click", () =>
    openStats(appApi),
  );
  els.restartGameAction?.addEventListener("click", () =>
    runtime.restartCurrentGame(),
  );
  els.openSettingsViewAction?.addEventListener("click", () =>
    openSettings(appApi),
  );
  els.openSettingsViewActionGame?.addEventListener("click", () =>
    openSettings(appApi),
  );
  els.localGameInput.addEventListener("change", () => {
    const [file] = els.localGameInput.files || [];
    localPlay.loadLocalGame(file);
  });

  lobby.renderLobby();
});
