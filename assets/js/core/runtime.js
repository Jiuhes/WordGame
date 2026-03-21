function isEndingChoice(choice, game) {
  return Boolean(
    choice?.reset ||
    choice?.next === "__lobby__" ||
    choice?.next === game?.entryScene,
  );
}

function isEndingScene(scene, game) {
  const choices = Array.isArray(scene?.choices) ? scene.choices : [];
  if (!choices.length) {
    return true;
  }
  return choices.every((choice) => isEndingChoice(choice, game));
}

function countEndingScenes(game) {
  return Object.values(game?.scenes || {}).filter((scene) =>
    isEndingScene(scene, game),
  ).length;
}

export function createRuntimeController({
  state,
  els,
  storage,
  log,
  escapeHtml,
  fetchJson,
  renderContentBlocks,
  normalizeGameData,
  normalizeRuntimeState,
  playUiSound = () => {},
}) {
  function showLobby() {
    els.gameContainer.style.display = "none";
    els.backBtn.style.display = "none";
    els.lobby.style.display = "block";
  }

  function showGame() {
    els.lobby.style.display = "none";
    els.gameContainer.style.display = "block";
    els.backBtn.style.display = "block";
  }

  function getStatusConfig(key) {
    return (state.currentGame?.status || []).find((item) => item.key === key);
  }

  function evaluateRule(rule) {
    const currentValue = state.runtimeState[rule.key];
    switch (rule.op) {
      case "eq":
        return currentValue === rule.value;
      case "ne":
        return currentValue !== rule.value;
      case "gt":
        return Number(currentValue) > Number(rule.value);
      case "gte":
        return Number(currentValue) >= Number(rule.value);
      case "lt":
        return Number(currentValue) < Number(rule.value);
      case "lte":
        return Number(currentValue) <= Number(rule.value);
      case "includes":
        return Array.isArray(currentValue)
          ? currentValue.includes(rule.value)
          : String(currentValue ?? "").includes(String(rule.value ?? ""));
      case "notIncludes":
        return Array.isArray(currentValue)
          ? !currentValue.includes(rule.value)
          : !String(currentValue ?? "").includes(String(rule.value ?? ""));
      case "exists":
        return currentValue != null;
      default:
        return false;
    }
  }

  function evaluateCondition(condition) {
    if (!condition) {
      return true;
    }
    if (Array.isArray(condition.all)) {
      return condition.all.every((item) => evaluateCondition(item));
    }
    if (Array.isArray(condition.any)) {
      return condition.any.some((item) => evaluateCondition(item));
    }
    if (condition.not) {
      return !evaluateCondition(condition.not);
    }
    return evaluateRule(condition);
  }

  function describeCondition(condition) {
    if (!condition) {
      return null;
    }
    if (Array.isArray(condition.all)) {
      const items = condition.all.map((item) => describeCondition(item));
      return {
        type: "all",
        passed: items.every((item) => item?.passed !== false),
        items,
      };
    }
    if (Array.isArray(condition.any)) {
      const items = condition.any.map((item) => describeCondition(item));
      return {
        type: "any",
        passed: items.some((item) => item?.passed === true),
        items,
      };
    }
    if (condition.not) {
      const item = describeCondition(condition.not);
      return {
        type: "not",
        passed: !item?.passed,
        item,
      };
    }
    const currentValue = state.runtimeState[condition.key];
    return {
      type: "rule",
      key: condition.key,
      op: condition.op,
      expected: Object.prototype.hasOwnProperty.call(condition, "value")
        ? condition.value
        : null,
      actual: currentValue,
      passed: evaluateRule(condition),
    };
  }

  function hasChosenOnce(choice) {
    return state.history.some(
      (entry) =>
        entry.from === state.currentSceneId &&
        entry.to === choice.next &&
        entry.text === choice.text,
    );
  }

  function getChoiceAvailability(choice) {
    if (choice.visibility && !evaluateCondition(choice.visibility)) {
      return { visible: false, enabled: false, reason: "" };
    }
    if (choice.once && hasChosenOnce(choice)) {
      return {
        visible: true,
        enabled: false,
        reason: choice.disabledReason || "这个特殊的选项仅能被执行一次。",
      };
    }
    if (choice.conditions && !evaluateCondition(choice.conditions)) {
      return {
        visible: true,
        enabled: false,
        reason:
          choice.disabledReason ||
          "当前尚未满足解锁此动作所需的隐秘条件。",
      };
    }
    return { visible: true, enabled: true, reason: "" };
  }

  function getRenderableChoices(scene) {
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    return choices
      .map((choice, index) => ({
        choice,
        index,
        availability: getChoiceAvailability(choice),
      }))
      .filter((entry) => entry.availability.visible);
  }

  function getCurrentSceneChoicesWithAvailability() {
    const scene = getCurrentSceneData();
    if (!scene) {
      return [];
    }
    return (scene.choices || []).map((choice, index) => ({
      index,
      text: choice.text || "",
      next: choice.next || "",
      once: Boolean(choice.once),
      hasChosenOnce: Boolean(choice.once && hasChosenOnce(choice)),
      visibility:
        choice.visibility != null ? describeCondition(choice.visibility) : null,
      conditions:
        choice.conditions != null ? describeCondition(choice.conditions) : null,
      availability: getChoiceAvailability(choice),
      disabledReason: choice.disabledReason || "",
    }));
  }

  function applyEffects(effects) {
    if (!effects || typeof effects !== "object") {
      return;
    }
    for (const [key, delta] of Object.entries(effects)) {
      const current = state.runtimeState[key];
      if (typeof delta === "number") {
        const next = (typeof current === "number" ? current : 0) + delta;
        const statusConfig = getStatusConfig(key);
        state.runtimeState[key] =
          statusConfig && typeof statusConfig.max === "number"
            ? Math.max(0, Math.min(statusConfig.max, next))
            : next;
      } else {
        state.runtimeState[key] = delta;
      }
    }
  }

  function renderStatusBar() {
    const statuses = state.currentGame?.status || [];
    if (!statuses.length) {
      els.statusBar.innerHTML =
        "<span style='color:#666'>暂无状态栏数据</span>";
      return;
    }

    els.statusBar.innerHTML = statuses
      .map((item) => {
        const value = state.runtimeState[item.key] ?? item.value ?? 0;
        const display =
          typeof item.max === "number" ? `${value}/${item.max}` : value;
        const meter =
          typeof item.max === "number" && Number(item.max) > 0
            ? `<div class="status-meter"><div class="status-meter-fill ${escapeHtml(
                item.key,
              )}" style="width:${Math.max(
                0,
                Math.min(
                  100,
                  Math.round((Number(value) / Number(item.max)) * 100),
                ),
              )}%"></div></div>`
            : "";
        return `<div class="status status-card"><div class="status-label">${escapeHtml(
          item.label || item.key,
        )}</div><div class="status-value ${escapeHtml(item.key)}">${escapeHtml(
          display,
        )}</div>${meter}</div>`;
      })
      .join("");
  }

  function applyScenePresentation(scene) {
    if (state.settings?.enableTransitions) {
      els.gameContent.classList.remove("scene-transition");
      els.gameContent.classList.add("scene-transition");
      setTimeout(() => {
        els.gameContent.classList.remove("scene-transition");
      }, 280);
    }
    playUiSound(isEndingScene(scene, state.currentGame) ? "ending" : "scene");
  }

  function missingScene(sceneId) {
    return {
      title: "场景不存在",
      content: `<div class='game-over bad'><h2>节点分支已毁坏</h2><div class='text danger'>找不到系统标识名为 <strong>${escapeHtml(sceneId)}</strong> 的场景实例。</div></div>`,
      choices: [
        { text: "重新开始", next: state.currentGame.entryScene, reset: true },
        { text: "返回大厅", next: "__lobby__" },
      ],
    };
  }

  function getScene(sceneId) {
    const scene = state.currentGame.scenes[sceneId];
    if (!scene) {
      return missingScene(sceneId);
    }
    if (scene.conditions && !evaluateCondition(scene.conditions)) {
      return {
        title: scene.title || "准入条件未满足",
        content: `<div class='game-over bad'><h2>无法进入此分支</h2><div class='text danger'>${escapeHtml(
          scene.disabledReason ||
            "你所携带的当前综合状态树不满足强行切入此分支的前提校验条件。",
        )}</div></div>`,
        choices: [{ text: "返回大厅", next: "__lobby__" }],
      };
    }
    return scene;
  }

  function renderSceneBody(scene) {
    if (Array.isArray(scene.contentBlocks) && scene.contentBlocks.length) {
      return renderContentBlocks(scene.contentBlocks);
    }
    return scene.content || "";
  }

  function saveProgress(slotId = "auto") {
    storage.saveProgress(
      state.currentGame,
      state.currentSceneId,
      state.runtimeState,
      state.history,
      slotId,
    );
  }

  function renderScene(sceneId) {
    state.currentSceneId = sceneId;
    const scene = getScene(sceneId);
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    const renderedChoices = getRenderableChoices(scene);
    const choiceHtml = renderedChoices.length
      ? `<div class="choices"><div class="choice-title">决定你的下一步</div>${renderedChoices
          .map(
            ({ choice, index, availability }) =>
              `<button class="choice${availability.enabled ? "" : " is-disabled"}" type="button" data-choice-index="${index}" ${
                availability.enabled ? "" : "disabled"
              } title="${escapeHtml(availability.reason)}">${escapeHtml(choice.text)}</button>${
                availability.enabled || !availability.reason
                  ? ""
                  : `<div class="text narrator choice-disabled-reason">${escapeHtml(availability.reason)}</div>`
              }`,
          )
          .join("")}</div>`
      : "<div class='text narrator'>这里查无任何继续进行下去的手段。</div>";

    els.gameContent.innerHTML = `<div class="scene active"><div class="scene-title">${escapeHtml(
      scene.title || state.currentGame.title,
    )}</div>${renderSceneBody(scene)}${choiceHtml}</div>`;

    els.gameContent
      .querySelectorAll("[data-choice-index]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          handleChoice(choices[Number(button.dataset.choiceIndex)]);
        });
      });

    renderStatusBar();
    saveProgress();
    if (isEndingScene(scene, state.currentGame)) {
      storage.recordEnding(
        state.currentGame.id,
        state.currentSceneId,
        scene.title || state.currentSceneId,
      );
    }
    applyScenePresentation(scene);
  }

  function applySavedState(game, saved) {
    state.runtimeState = {
      ...normalizeRuntimeState(game),
      ...(saved.runtimeState || {}),
    };
    state.history = Array.isArray(saved.history) ? saved.history : [];
    renderScene(saved.currentSceneId);
  }

  function resetIntoGame(game, targetSceneId, slotId = "auto") {
    state.currentGame = game;
    els.gameTitle.textContent = game.title;
    showGame();

    const saved = storage.loadProgress(game.id, slotId);
    const canResume =
      saved &&
      typeof saved.currentSceneId === "string" &&
      game.scenes[saved.currentSceneId];
    if (canResume) {
      applySavedState(game, saved);
      return;
    }

    state.runtimeState = normalizeRuntimeState(game);
    state.history = [];
    renderScene(targetSceneId || game.entryScene);
  }

  async function loadGame(gameMeta) {
    try {
      const rawGame = await fetchJson(gameMeta.file);
      const game = normalizeGameData(rawGame, gameMeta);
      resetIntoGame(game, game.entryScene);
    } catch (error) {
      log(`loadGame failed: ${error.message}`);
      showGame();
      els.gameTitle.textContent = gameMeta.name || gameMeta.id;
      els.statusBar.innerHTML =
        "<span style='color:#ff6b6b'>资源损坏装载失败</span>";
      els.gameContent.innerHTML = `<div class='text danger'>解析读取游戏剧本时抛出异常：${escapeHtml(error.message)}</div>`;
    }
  }

  function backToLobby() {
    state.currentGame = null;
    state.currentSceneId = null;
    state.runtimeState = {};
    state.history = [];
    showLobby();
  }

  function handleChoice(choice) {
    if (!choice) {
      return;
    }
    const availability = getChoiceAvailability(choice);
    if (!availability.enabled) {
      return;
    }
    playUiSound("choice");
    if (choice.next === "__lobby__") {
      backToLobby();
      return;
    }
    if (choice.reset) {
      storage.clearProgress(state.currentGame.id);
      state.runtimeState = normalizeRuntimeState(state.currentGame);
      state.history = [];
      renderScene(choice.next || state.currentGame.entryScene);
      return;
    }
    applyEffects(choice.effects);
    state.history.push({
      from: state.currentSceneId,
      to: choice.next,
      text: choice.text,
      at: Date.now(),
    });
    renderScene(choice.next || state.currentSceneId);
  }

  function renderGameToText() {
    const scene =
      state.currentGame && state.currentSceneId
        ? getScene(state.currentSceneId)
        : null;
    return JSON.stringify(
      {
        mode: state.currentGame ? "playing" : "lobby",
        gameId: state.currentGame ? state.currentGame.id : null,
        sceneId: state.currentSceneId,
        sceneTitle: scene ? scene.title : null,
        status: state.runtimeState,
        choices: scene
          ? getRenderableChoices(scene).map(({ choice, availability }) =>
              availability.enabled
                ? choice.text
                : `${choice.text} [disabled: ${availability.reason}]`,
            )
          : state.games.map((game) => game.name),
        coordinateSystem: "not_applicable_text_adventure",
      },
      null,
      2,
    );
  }

  function jumpToScene(sceneId) {
    if (!state.currentGame || !sceneId || !state.currentGame.scenes[sceneId]) {
      return false;
    }
    renderScene(sceneId);
    return true;
  }

  function replaceRuntimeState(nextState) {
    if (!state.currentGame || !nextState || typeof nextState !== "object") {
      return false;
    }
    state.runtimeState = {
      ...normalizeRuntimeState(state.currentGame),
      ...nextState,
    };
    renderScene(state.currentSceneId || state.currentGame.entryScene);
    return true;
  }

  function getCurrentSceneData() {
    if (!state.currentGame || !state.currentSceneId) {
      return null;
    }
    return state.currentGame.scenes[state.currentSceneId] || null;
  }

  function getCurrentSaveData() {
    if (!state.currentGame) {
      return null;
    }
    return storage.loadProgress(state.currentGame.id);
  }

  function getDebugSnapshot() {
    const scene = getCurrentSceneData();
    return {
      gameId: state.currentGame?.id || null,
      currentSceneId: state.currentSceneId,
      runtimeState: state.runtimeState,
      saveData: getCurrentSaveData(),
      history: state.history,
      scene: scene
        ? {
            id: state.currentSceneId,
            title: scene.title || state.currentSceneId,
            conditions: scene.conditions
              ? describeCondition(scene.conditions)
              : null,
            disabledReason: scene.disabledReason || "",
          }
        : null,
      choices: getCurrentSceneChoicesWithAvailability(),
    };
  }

  function saveToSlot(slotId) {
    if (!state.currentGame || !state.currentSceneId) {
      return false;
    }
    saveProgress(slotId);
    return true;
  }

  function loadFromSlot(slotId) {
    if (!state.currentGame) {
      return false;
    }
    const saved = storage.loadProgress(state.currentGame.id, slotId);
    if (!saved || !state.currentGame.scenes[saved.currentSceneId]) {
      return false;
    }
    applySavedState(state.currentGame, saved);
    return true;
  }

  function clearSlot(slotId) {
    if (!state.currentGame) {
      return false;
    }
    storage.clearProgress(state.currentGame.id, slotId);
    return true;
  }

  function exportSlot(slotId) {
    if (!state.currentGame) {
      return "";
    }
    return storage.exportProgress(state.currentGame.id, slotId);
  }

  function importSlot(slotId, rawText) {
    if (!state.currentGame) {
      return false;
    }
    const payload = storage.importProgress(
      state.currentGame.id,
      slotId,
      rawText,
    );
    if (!state.currentGame.scenes[payload.currentSceneId]) {
      storage.clearProgress(state.currentGame.id, slotId);
      throw new Error("存档指针所依赖的底层场景已毁损缺失");
    }
    return true;
  }

  function getCompletionStats() {
    if (!state.currentGame) {
      return null;
    }
    const stats = storage.getEndingStats(state.currentGame.id);
    return {
      ...stats,
      totalEndings: countEndingScenes(state.currentGame),
    };
  }

  return {
    showLobby,
    showGame,
    getScene,
    resetIntoGame,
    loadGame,
    backToLobby,
    renderGameToText,
    jumpToScene,
    replaceRuntimeState,
    getCurrentSceneData,
    getCurrentSaveData,
    getCurrentSceneChoicesWithAvailability,
    getDebugSnapshot,
    evaluateConditionForDebug: describeCondition,
    saveToSlot,
    loadFromSlot,
    clearSlot,
    exportSlot,
    importSlot,
    getCompletionStats,
    isEndingScene: (scene) => isEndingScene(scene, state.currentGame),
    countEndingScenes: () => countEndingScenes(state.currentGame),
  };
}
