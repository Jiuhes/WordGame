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

function getPhaseLabel(phaseId) {
  const phaseMap = {
    early: "EARLY",
    mid: "MID",
    late: "LATE",
    final: "FINAL",
    default: "ACTIVE",
  };
  if (typeof phaseId !== "string" || !phaseId.trim()) {
    return phaseMap.default;
  }
  return phaseMap[phaseId] || phaseId;
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
  getSceneVoiceUrl = () => "",
}) {
  let feedbackTimer = null;

  function ensureArrayState(key) {
    if (!Array.isArray(state.runtimeState[key])) {
      state.runtimeState[key] = [];
    }
    return state.runtimeState[key];
  }

  function normalizeRuntimeCollections() {
    ensureArrayState("tags");
    ensureArrayState("items");
    ensureArrayState("clues");
    ensureArrayState("__firedSystemRules");
    if (state.runtimeState.phase == null) {
      state.runtimeState.phase =
        typeof state.currentGame?.phases?.[0]?.id === "string"
          ? state.currentGame.phases[0].id
          : "default";
    }
  }

  function showLobby() {
    els.gameContainer.style.display = "none";
    els.backBtn.style.display = "none";
    els.lobby.style.display = "block";
    els.lobby.classList.remove("animate-page-enter");
    void els.lobby.offsetWidth;
    els.lobby.classList.add("animate-page-enter");
  }

  function showGame() {
    els.lobby.style.display = "none";
    els.gameContainer.style.display = "block";
    els.backBtn.style.display = "block";
    els.gameContainer.classList.remove("animate-page-enter");
    void els.gameContainer.offsetWidth;
    els.gameContainer.classList.add("animate-page-enter");
  }

  function getStatusConfig(key) {
    return (state.currentGame?.status || []).find((item) => item.key === key);
  }

  function getStatusLabel(key) {
    return getStatusConfig(key)?.label || key;
  }

  function evaluateRule(rule) {
    const currentValue =
      rule.key === "$scene"
        ? state.currentSceneId
        : state.runtimeState[rule.key];
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

  function syncDerivedState() {
    normalizeRuntimeCollections();
    const phases = Array.isArray(state.currentGame?.phases)
      ? state.currentGame.phases
      : [];
    for (const phase of phases) {
      if (
        phase &&
        typeof phase.id === "string" &&
        (!phase.conditions || evaluateCondition(phase.conditions))
      ) {
        state.runtimeState.phase = phase.id;
        return;
      }
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

  function matchesChoiceRule(choice, scene, match = {}) {
    const choiceTags = Array.isArray(choice?.tags) ? choice.tags : [];
    const sceneTags = Array.isArray(scene?.tags) ? scene.tags : [];
    if (
      Array.isArray(match.tagsAny) &&
      !match.tagsAny.some((tag) => choiceTags.includes(tag))
    ) {
      return false;
    }
    if (
      Array.isArray(match.tagsAll) &&
      !match.tagsAll.every((tag) => choiceTags.includes(tag))
    ) {
      return false;
    }
    if (
      Array.isArray(match.sceneTagsAny) &&
      !match.sceneTagsAny.some((tag) => sceneTags.includes(tag))
    ) {
      return false;
    }
    if (
      Array.isArray(match.sceneTagsAll) &&
      !match.sceneTagsAll.every((tag) => sceneTags.includes(tag))
    ) {
      return false;
    }
    if (typeof match.next === "string" && choice?.next !== match.next) {
      return false;
    }
    if (
      typeof match.sceneId === "string" &&
      state.currentSceneId !== match.sceneId
    ) {
      return false;
    }
    return true;
  }

  function getGlobalChoiceAvailability(choice, scene) {
    const rules = Array.isArray(state.currentGame?.systemRules?.choiceRules)
      ? state.currentGame.systemRules.choiceRules
      : [];
    let result = null;
    for (const rule of rules) {
      if (rule?.when && !evaluateCondition(rule.when)) {
        continue;
      }
      if (!matchesChoiceRule(choice, scene, rule?.match || {})) {
        continue;
      }
      if (rule?.action === "hide") {
        return { visible: false, enabled: false, reason: rule.reason || "" };
      }
      if (rule?.action === "disable") {
        result = {
          visible: true,
          enabled: false,
          reason: rule.reason || "",
        };
      }
    }
    return result;
  }

  function getChoiceAvailability(choice, scene) {
    const globalAvailability = getGlobalChoiceAvailability(choice, scene);
    if (globalAvailability) {
      return globalAvailability;
    }
    if (choice.visibility && !evaluateCondition(choice.visibility)) {
      return { visible: false, enabled: false, reason: "" };
    }
    if (choice.once && hasChosenOnce(choice)) {
      return {
        visible: true,
        enabled: false,
        reason: choice.disabledReason || "这个特殊选项只能执行一次。",
      };
    }
    if (choice.conditions && !evaluateCondition(choice.conditions)) {
      return {
        visible: true,
        enabled: false,
        reason: choice.disabledReason || "当前还未满足解锁这个动作所需的条件。",
      };
    }
    return { visible: true, enabled: true, reason: "" };
  }

  function getCollectibleMeta(kind, id) {
    const normalizedId = typeof id === "string" ? id.trim() : "";
    if (!normalizedId) {
      return null;
    }
    return (
      state.currentGame?.collectiblesIndex?.[kind]?.[normalizedId] || {
        id: normalizedId,
        name: normalizedId,
        description: "",
        icon: "",
      }
    );
  }

  function getCollectibleLabel(kind, id) {
    return getCollectibleMeta(kind, id)?.name || String(id || "");
  }

  function collectActions(container) {
    return Array.isArray(container?.actions)
      ? container.actions.filter(
          (action) => action && typeof action === "object",
        )
      : [];
  }

  function getChoiceTimeCost(choice) {
    return collectActions(choice).reduce((total, action) => {
      if (action.type !== "advanceTime") {
        return total;
      }
      return total + Number(action.amount || 0);
    }, 0);
  }

  function getChoiceMetaPills(choice) {
    const pills = [];
    for (const action of collectActions(choice)) {
      switch (action.type) {
        case "advanceTime":
          if (Number(action.amount || 0) > 0) {
            pills.push({ tone: "cost", text: `耗时 ${action.amount}` });
          }
          break;
        case "gainItem":
          pills.push({
            tone: "gain",
            text: `获得物品: ${getCollectibleLabel("items", action.item)}`,
          });
          break;
        case "loseItem":
          pills.push({
            tone: "cost",
            text: `消耗物品: ${getCollectibleLabel("items", action.item)}`,
          });
          break;
        case "gainClue":
          pills.push({
            tone: "gain",
            text: `获得线索: ${getCollectibleLabel("clues", action.clue)}`,
          });
          break;
        case "loseClue":
          pills.push({
            tone: "cost",
            text: `消耗线索: ${getCollectibleLabel("clues", action.clue)}`,
          });
          break;
        default:
          break;
      }
    }
    return pills;
  }

  function getEndingProgressSnapshot(scene) {
    const total = countEndingScenes(state.currentGame);
    const stats = storage.getEndingStats(state.currentGame.id);
    const discovered = Array.isArray(stats?.discoveredEndings)
      ? stats.discoveredEndings
      : [];
    const alreadyCounted = discovered.some(
      (item) => item.sceneId === state.currentSceneId,
    );
    const unlocked = discovered.length + (alreadyCounted ? 0 : 1);
    const remaining = Math.max(0, total - unlocked);
    return { total, unlocked, remaining };
  }

  function renderEndingSummary(scene) {
    if (!isEndingScene(scene, state.currentGame)) {
      return "";
    }
    const progress = getEndingProgressSnapshot(scene);
    return `<div class="ending-summary">
      <div class="ending-summary-title">结局进度</div>
      <div class="ending-summary-pills">
        <span class="ending-summary-pill">已发现 ${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)}</span>
        <span class="ending-summary-pill">还差 ${escapeHtml(progress.remaining)} 个</span>
      </div>
    </div>`;
  }

  function choiceConsumesCriticalResource(choice) {
    return collectActions(choice).some((action) =>
      ["loseItem", "loseClue"].includes(action.type),
    );
  }

  function getChoiceConfirmationMessage(choice) {
    if (typeof choice?.confirmText === "string" && choice.confirmText.trim()) {
      return choice.confirmText.trim();
    }
    if (isEndingScene(getCurrentSceneData(), state.currentGame)) {
      return "";
    }
    if (choice?.reset) {
      return "这会放弃当前进度并从头开始，是否继续？";
    }
    if (choice?.irreversible) {
      return "这是一个不可逆的关键选择，是否继续？";
    }
    if (choiceConsumesCriticalResource(choice)) {
      return "这一步会消耗关键物品或线索，是否继续？";
    }
    if (isEndingChoice(choice, state.currentGame)) {
      return "这一步会直接结束当前流程，是否继续？";
    }
    return "";
  }

  function shouldConfirmChoice(choice) {
    return Boolean(getChoiceConfirmationMessage(choice));
  }

  function clearChoiceFeedback() {
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    if (els.feedbackLayer) {
      els.feedbackLayer.innerHTML = "";
    }
  }

  function showChoiceFeedback(messages) {
    if (!els.feedbackLayer) {
      return;
    }
    const visible = messages.filter(
      (message) =>
        message && typeof message.text === "string" && message.text.trim(),
    );
    if (!visible.length) {
      clearChoiceFeedback();
      return;
    }
    els.feedbackLayer.innerHTML = visible
      .slice(0, 5)
      .map(
        (message) =>
          `<div class="feedback-toast feedback-toast-${escapeHtml(
            message.tone || "info",
          )}">${escapeHtml(message.text)}</div>`,
      )
      .join("");
    feedbackTimer = setTimeout(() => {
      if (els.feedbackLayer) {
        els.feedbackLayer.innerHTML = "";
      }
      feedbackTimer = null;
    }, 3200);
  }

  function describeActionFeedback(action) {
    switch (action.type) {
      case "advanceTime":
        return Number(action.amount || 0) > 0
          ? { tone: "info", text: `时间推进 ${action.amount}` }
          : null;
      case "adjust": {
        const amount = Number(action.amount || 0);
        if (!amount) {
          return null;
        }
        return {
          tone: amount > 0 ? "gain" : "loss",
          text: `${getStatusLabel(action.key)} ${amount > 0 ? "+" : ""}${amount}`,
        };
      }
      case "gainItem":
        return {
          tone: "gain",
          text: `获得物品: ${getCollectibleLabel("items", action.item)}`,
        };
      case "loseItem":
        return {
          tone: "loss",
          text: `失去物品: ${getCollectibleLabel("items", action.item)}`,
        };
      case "gainClue":
        return {
          tone: "gain",
          text: `获得线索: ${getCollectibleLabel("clues", action.clue)}`,
        };
      case "loseClue":
        return {
          tone: "loss",
          text: `失去线索: ${getCollectibleLabel("clues", action.clue)}`,
        };
      case "addTag":
        return {
          tone: "info",
          text: `状态变化: ${action.tag}`,
        };
      default:
        return null;
    }
  }

  function getRenderableChoices(scene) {
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    return choices
      .map((choice, index) => ({
        choice,
        index,
        availability: getChoiceAvailability(choice, scene),
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
      timeCost: getChoiceTimeCost(choice),
      once: Boolean(choice.once),
      hasChosenOnce: Boolean(choice.once && hasChosenOnce(choice)),
      visibility:
        choice.visibility != null ? describeCondition(choice.visibility) : null,
      conditions:
        choice.conditions != null ? describeCondition(choice.conditions) : null,
      availability: getChoiceAvailability(choice, scene),
      disabledReason: choice.disabledReason || "",
    }));
  }

  function applyActions(actions) {
    if (!Array.isArray(actions) || !actions.length) {
      return;
    }
    for (const action of actions) {
      if (
        !action ||
        typeof action !== "object" ||
        typeof action.type !== "string"
      ) {
        continue;
      }
      const current = state.runtimeState[action.key];
      switch (action.type) {
        case "advanceTime": {
          const amount = Number(action.amount || 0);
          state.runtimeState.time =
            (Number(state.runtimeState.time) || 0) + amount;
          break;
        }
        case "adjust": {
          const next =
            (typeof current === "number" ? current : 0) +
            Number(action.amount || 0);
          const statusConfig = getStatusConfig(action.key);
          state.runtimeState[action.key] =
            statusConfig && typeof statusConfig.max === "number"
              ? Math.max(0, Math.min(statusConfig.max, next))
              : next;
          break;
        }
        case "set":
          state.runtimeState[action.key] = action.value;
          break;
        case "addTag": {
          const tags = ensureArrayState("tags");
          if (!tags.includes(action.tag)) {
            tags.push(action.tag);
          }
          break;
        }
        case "removeTag": {
          const tags = ensureArrayState("tags");
          state.runtimeState.tags = tags.filter((item) => item !== action.tag);
          break;
        }
        case "gainItem": {
          const items = ensureArrayState("items");
          if (!items.includes(action.item)) {
            items.push(action.item);
          }
          break;
        }
        case "loseItem": {
          const items = ensureArrayState("items");
          state.runtimeState.items = items.filter(
            (item) => item !== action.item,
          );
          break;
        }
        case "gainClue": {
          const clues = ensureArrayState("clues");
          if (!clues.includes(action.clue)) {
            clues.push(action.clue);
          }
          break;
        }
        case "loseClue": {
          const clues = ensureArrayState("clues");
          state.runtimeState.clues = clues.filter(
            (item) => item !== action.clue,
          );
          break;
        }
        case "pushUnique": {
          const values = ensureArrayState(action.key);
          if (!values.includes(action.value)) {
            values.push(action.value);
          }
          break;
        }
        case "removeValue": {
          const values = ensureArrayState(action.key);
          state.runtimeState[action.key] = values.filter(
            (item) => item !== action.value,
          );
          break;
        }
        default:
          break;
      }
    }
    syncDerivedState();
  }

  function hasTriggeredSystemRule(rule) {
    return Boolean(
      rule?.id &&
      Array.isArray(state.runtimeState.__firedSystemRules) &&
      state.runtimeState.__firedSystemRules.includes(rule.id),
    );
  }

  function markSystemRuleTriggered(rule) {
    if (!rule?.id) {
      return;
    }
    const fired = ensureArrayState("__firedSystemRules");
    if (!fired.includes(rule.id)) {
      fired.push(rule.id);
    }
  }

  function runSystemRules(stage, fallbackSceneId = null) {
    const rules = Array.isArray(state.currentGame?.systemRules?.[stage])
      ? state.currentGame.systemRules[stage]
      : [];
    let nextSceneId = fallbackSceneId;
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") {
        continue;
      }
      if (rule.once && hasTriggeredSystemRule(rule)) {
        continue;
      }
      if (rule.when && !evaluateCondition(rule.when)) {
        continue;
      }
      applyActions(rule.actions);
      if (rule.once) {
        markSystemRuleTriggered(rule);
      }
      if (typeof rule.goto === "string" && rule.goto.trim()) {
        nextSceneId = rule.goto.trim();
      }
    }
    return nextSceneId;
  }

  function renderStatusBar() {
    const statuses = state.currentGame?.status || [];
    if (!statuses.length) {
      els.statusBar.innerHTML =
        "<span style='color:#666'>暂无状态栏数据</span>";
    } else {
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

    const items = Array.isArray(state.runtimeState.items)
      ? state.runtimeState.items
      : [];
    const clues = Array.isArray(state.runtimeState.clues)
      ? state.runtimeState.clues
      : [];

    if (els.collectionBar) {
      els.collectionBar.innerHTML = [
        {
          className: "inventory",
          title: "持有物品",
          values: items,
          empty: "暂时没有拿到关键物品。",
        },
        {
          className: "clue-box",
          title: "已掌握线索",
          values: clues,
          empty: "关键线索仍然空白。",
        },
      ]
        .map(
          (section) => `<div class="${section.className}">
            <div class="inventory-title">${escapeHtml(section.title)}</div>
            <div class="inventory-list">${
              section.values.length
                ? section.values
                    .map(
                      (value) =>
                        `<span class="item">${escapeHtml(
                          getCollectibleLabel(
                            section.className === "inventory"
                              ? "items"
                              : "clues",
                            value,
                          ),
                        )}</span>`,
                    )
                    .join("")
                : `<span class="inventory-empty">${escapeHtml(section.empty)}</span>`
            }</div>
          </div>`,
        )
        .join("");
    }
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
      content: `<div class='game-over bad'><h2>节点分支已损坏</h2><div class='text danger'>找不到系统标识名为 <strong>${escapeHtml(sceneId)}</strong> 的场景实例。</div></div>`,
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
            "你当前携带的综合状态不满足切入这个分支的前置条件。",
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
    syncDerivedState();
    state.currentSceneId = runSystemRules("beforeRender", sceneId) || sceneId;
    const scene = getScene(state.currentSceneId);
    const voiceUrl = getSceneVoiceUrl(
      state.currentGame?.id,
      state.currentSceneId,
    );
    const endingSummary = renderEndingSummary(scene);
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    const renderedChoices = getRenderableChoices(scene);
    const sceneMeta = `
      <div class="scene-shell-meta" aria-label="当前局内状态摘要">
        <span class="scene-shell-pill scene-shell-pill-phase">${escapeHtml(
          getPhaseLabel(state.runtimeState.phase),
        )}</span>
        <span class="scene-shell-pill">时间 ${escapeHtml(
          Number(state.runtimeState.time) || 0,
        )}</span>
        <span class="scene-shell-pill">线索 ${escapeHtml(
          Array.isArray(state.runtimeState.clues)
            ? state.runtimeState.clues.length
            : 0,
        )}</span>
        <span class="scene-shell-pill">物品 ${escapeHtml(
          Array.isArray(state.runtimeState.items)
            ? state.runtimeState.items.length
            : 0,
        )}</span>
      </div>
    `;
    const choiceHtml = renderedChoices.length
      ? `<div class="choices"><div class="choice-title">决定你的下一步</div>${renderedChoices
          .map(({ choice, index, availability }) => {
            const metaPills = getChoiceMetaPills(choice);
            return `<button class="choice${availability.enabled ? "" : " is-disabled"}" type="button" data-choice-index="${index}" ${
              availability.enabled ? "" : "disabled"
            } title="${escapeHtml(availability.reason)}">${escapeHtml(choice.text)}${
              metaPills.length
                ? `<span class="choice-meta">${metaPills
                    .map(
                      (pill) =>
                        `<span class="choice-pill choice-pill-${escapeHtml(
                          pill.tone,
                        )}">${escapeHtml(pill.text)}</span>`,
                    )
                    .join("")}</span>`
                : ""
            }</button>${
              availability.enabled || !availability.reason
                ? ""
                : `<div class="text narrator choice-disabled-reason">${escapeHtml(availability.reason)}</div>`
            }`;
          })
          .join("")}</div>`
      : isEndingScene(scene, state.currentGame)
        ? `<div class="choices">
          <div class="choice-title">已到达终点</div>
          <button class="choice" type="button" data-ending-action="restart">从头重开</button>
          <button class="choice" type="button" data-ending-action="lobby">返回大厅</button>
        </div>`
        : "<div class='text narrator'>这里没有任何能继续进行下去的手段。</div>";

    const voicePlayer = voiceUrl
      ? `<div class="scene-voice-box">
          <div class="scene-voice-title">场景语音试听</div>
          <audio class="scene-voice-player" controls preload="metadata" src="${escapeHtml(
            voiceUrl,
          )}"></audio>
        </div>`
      : "";

    els.gameContent.innerHTML = `<div class="scene active">${sceneMeta}${voicePlayer}<div class="scene-title">${escapeHtml(
      scene.title || state.currentGame.title,
    )}</div>${renderSceneBody(scene)}${endingSummary}${choiceHtml}</div>`;

    els.gameContent
      .querySelectorAll("[data-choice-index]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          handleChoice(choices[Number(button.dataset.choiceIndex)]);
        });
      });
    els.gameContent
      .querySelectorAll("[data-ending-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          if (button.dataset.endingAction === "restart") {
            restartCurrentGame();
            return;
          }
          backToLobby();
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
    syncDerivedState();
    renderScene(saved.currentSceneId);
  }

  function resetIntoGame(game, targetSceneId, slotId = "auto") {
    state.currentGame = game;
    els.gameTitle.textContent = game.title;
    showGame();
    clearChoiceFeedback();

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
    syncDerivedState();
    renderScene(targetSceneId || game.entryScene);
  }

  async function loadGame(gameMeta, slotId = "auto") {
    try {
      const rawGame = await fetchJson(gameMeta.file);
      const game = normalizeGameData(rawGame, gameMeta);
      resetIntoGame(game, game.entryScene, slotId);
    } catch (error) {
      log(`loadGame failed: ${error.message}`);
      showGame();
      els.gameTitle.textContent = gameMeta.name || gameMeta.id;
      els.statusBar.innerHTML =
        "<span style='color:#ff6b6b'>资源损坏或加载失败</span>";
      els.gameContent.innerHTML = `<div class='text danger'>解析读取游戏剧本时发生错误: ${escapeHtml(error.message)}</div>`;
    }
  }

  function backToLobby() {
    clearChoiceFeedback();
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
    if (shouldConfirmChoice(choice)) {
      const confirmed = window.confirm(getChoiceConfirmationMessage(choice));
      if (!confirmed) {
        return;
      }
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
    const actions = collectActions(choice);
    const actionFeedback = actions
      .map((action) => describeActionFeedback(action))
      .filter(Boolean);
    applyActions(actions);
    state.history.push({
      from: state.currentSceneId,
      to: choice.next,
      text: choice.text,
      at: Date.now(),
    });
    const targetSceneId =
      runSystemRules("afterChoice", choice.next || state.currentSceneId) ||
      choice.next ||
      state.currentSceneId;
    renderScene(targetSceneId);
    showChoiceFeedback(actionFeedback);
  }

  function restartCurrentGame() {
    if (!state.currentGame) {
      return false;
    }
    storage.clearProgress(state.currentGame.id);
    state.runtimeState = normalizeRuntimeState(state.currentGame);
    state.history = [];
    clearChoiceFeedback();
    syncDerivedState();
    renderScene(state.currentGame.entryScene);
    showChoiceFeedback([{ tone: "info", text: "已从开头重新开始" }]);
    return true;
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
        phase: state.runtimeState.phase ?? null,
        tags: Array.isArray(state.runtimeState.tags)
          ? state.runtimeState.tags
          : [],
        items: Array.isArray(state.runtimeState.items)
          ? state.runtimeState.items
          : [],
        clues: Array.isArray(state.runtimeState.clues)
          ? state.runtimeState.clues
          : [],
        choices: scene
          ? getRenderableChoices(scene).map(({ choice, availability }) => {
              const suffix = getChoiceTimeCost(choice)
                ? ` [time: ${getChoiceTimeCost(choice)}]`
                : "";
              return availability.enabled
                ? `${choice.text}${suffix}`
                : `${choice.text}${suffix} [disabled: ${availability.reason}]`;
            })
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
    syncDerivedState();
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
      throw new Error("存档指针依赖的底层场景已经损坏缺失");
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
    restartCurrentGame,
    isEndingScene: (scene) => isEndingScene(scene, state.currentGame),
    countEndingScenes: () => countEndingScenes(state.currentGame),
  };
}
