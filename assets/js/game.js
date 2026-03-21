import { DEFAULT_BRANCH_SIZE, GUIDE_PROMPT } from "./core/constants.js";
import {
  makeLocalGameMeta,
  normalizeGameData,
  normalizeGamesIndex,
  normalizeRuntimeState,
} from "./core/game-data.js";
import { createStorageController } from "./core/game-storage.js";
import {
  getPrimaryPath,
  getScenePreview,
  getVisibleOutgoing,
  makeGraphData,
  renderSceneCard,
} from "./core/graph.js";
import {
  escapeHtml,
  fetchJson,
  normalizeText,
  renderContentBlocks,
} from "./core/utils.js";
import { createRuntimeController } from "./core/runtime.js";
import { createLobbyController } from "./ui/lobby.js";
import { createLocalPlayController } from "./ui/local-play.js";
import { createModalController } from "./ui/modal.js";
import { open as openGuide } from "./game-guide.js";
import { open as openGraph } from "./game-graph.js";
import { open as openAuthor } from "./game-author.js";
import { open as openSaves } from "./game-saves.js";
import { open as openStats } from "./game-stats.js";
import { open as openSettings } from "./game-settings.js";

const state = {
  games: [],
  currentGame: null,
  currentSceneId: null,
  runtimeState: {},
  history: [],
  settings: {},
  graph: {
    current: null,
    selectedSceneId: null,
    branchPageSize: DEFAULT_BRANCH_SIZE,
    expandedBranches: new Map(),
    searchKeyword: "",
  },
};

const els = {
  lobby: document.getElementById("lobby"),
  gameList: document.getElementById("gameList"),
  gameCount: document.getElementById("gameCount"),
  gameContainer: document.getElementById("gameContainer"),
  gameTitle: document.getElementById("gameTitle"),
  statusBar: document.getElementById("statusBar"),
  gameContent: document.getElementById("gameContent"),
  backBtn: document.getElementById("backBtn"),
  closeGameBtn: document.getElementById("closeGameBtn"),
  localGameInput: document.getElementById("localGameInput"),
  fileMenuTrigger: document.getElementById("fileMenuTrigger"),
  fileMenuDropdown: document.getElementById("fileMenuDropdown"),
  openLocalFileAction: document.getElementById("openLocalFileAction"),
  pasteLocalJsonAction: document.getElementById("pasteLocalJsonAction"),
  openGraphViewAction: document.getElementById("openGraphViewAction"),
  openGuideViewAction: document.getElementById("openGuideViewAction"),
  openAuthorViewAction: document.getElementById("openAuthorViewAction"),
  openStatsViewAction: document.getElementById("openStatsViewAction"),
  openSettingsViewAction: document.getElementById("openSettingsViewAction"),
  openSaveViewActionGame: document.getElementById("openSaveViewActionGame"),
  openStatsViewActionGame: document.getElementById("openStatsViewActionGame"),
  openSettingsViewActionGame: document.getElementById(
    "openSettingsViewActionGame",
  ),
  openAuthorViewActionGame: document.getElementById("openAuthorViewActionGame"),
  modalRoot: document.getElementById("modalRoot"),
  modalWindow: document.getElementById("modalWindow"),
  modalTitle: document.getElementById("modalTitle"),
  modalMenuBar: document.getElementById("modalMenuBar"),
  modalContent: document.getElementById("modalContent"),
  modalStatusText: document.getElementById("modalStatusText"),
  modalStatusHint: document.getElementById("modalStatusHint"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  debug: document.getElementById("debug"),
};

function log(message) {
  console.log(message);
  if (els.debug) {
    els.debug.textContent += `${message}\n`;
  }
}

const storage = createStorageController({ log });
state.settings = storage.getSettings();
const modal = createModalController(els);

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
});

const lobby = createLobbyController({
  state,
  els,
  log,
  escapeHtml,
  fetchJson,
  normalizeGamesIndex,
  getGameStats: (gameId) => storage.getEndingStats(gameId),
  onSelectGame: (game) => runtime.loadGame(game),
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
  GUIDE_PROMPT,
  DEFAULT_BRANCH_SIZE,
  log,
  storage,
  escapeHtml,
  normalizeText,
  openModal: modal.openModal,
  showInfoModal: modal.showInfoModal,
  fetchJson,
  makeGraphData,
  getPrimaryPath,
  getVisibleOutgoing: (graph, sceneId) =>
    getVisibleOutgoing(graph, sceneId, state.graph),
  renderSceneCard: (graph, sceneId, options) =>
    renderSceneCard(graph, sceneId, state.graph, options),
  getScenePreview,
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
  els.pasteLocalJsonAction.addEventListener("click", async () => {
    lobby.setFileMenuOpen(false);
    try {
      await localPlay.handlePastedJson();
    } catch (error) {
      runtime.showGame();
      els.gameTitle.textContent = "从剪贴板加载的数据";
      els.statusBar.innerHTML =
        "<span style='color:#ff6b6b'>加载失败</span>";
      els.gameContent.innerHTML = `<div class='text danger'>尝试解析粘贴的测试数据时发生崩溃：${escapeHtml(error.message)}</div>`;
    }
  });

  els.openGuideViewAction?.addEventListener("click", () => openGuide(appApi));
  els.openGraphViewAction?.addEventListener("click", () => openGraph(appApi));
  els.openAuthorViewAction?.addEventListener("click", () => openAuthor(appApi));
  els.openAuthorViewActionGame?.addEventListener("click", () =>
    openAuthor(appApi),
  );
  els.openSaveViewActionGame?.addEventListener("click", () =>
    openSaves(appApi),
  );
  els.openStatsViewAction?.addEventListener("click", () => openStats(appApi));
  els.openStatsViewActionGame?.addEventListener("click", () =>
    openStats(appApi),
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
