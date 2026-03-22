export function createLocalPlayController({
  state,
  els,
  modal,
  storage,
  runtime,
  log,
  escapeHtml,
  normalizeGameData,
  makeLocalGameMeta,
}) {
  function explainImportError(error) {
    if (error instanceof SyntaxError) {
      return "JSON 格式不合法，通常是缺了逗号、引号或花括号。";
    }
    if (/missing entry scene/i.test(error.message)) {
      return "剧本缺少入口场景，检查 entryScene 是否存在于 scenes 里。";
    }
    if (/missing a scenes object/i.test(error.message)) {
      return "剧本没有 scenes 对象，程序无法开始运行。";
    }
    if (/schema/i.test(error.message)) {
      return "剧本结构不符合当前格式要求。";
    }
    return error.message || "导入内容无法被当前程序识别。";
  }

  function askRemoteJsonUrl() {
    return modal.openModal({
      title: "从链接导入 JSON",
      menu: "链接导入",
      status: "请输入可直接访问的 JSON 地址",
      hint: "链接地址",
      render(container, done) {
        const input = document.createElement("input");
        input.className = "system-modal-input";
        input.type = "text";
        input.value = "";
        input.placeholder = "https://example.com/game.json";
        container.appendChild(input);

        const actions = document.createElement("div");
        actions.className = "system-modal-actions";
        const cancelBtn = modal.createButton("取消");
        cancelBtn.addEventListener("click", () => done(null));
        actions.appendChild(cancelBtn);

        const confirmBtn = modal.createButton("导入", { primary: true });
        confirmBtn.addEventListener("click", () => done(input.value.trim()));
        actions.appendChild(confirmBtn);
        container.appendChild(actions);
      },
    });
  }

  function askUploadOption() {
    return modal.openModal({
      title: "服务端同步上传",
      menu: "上传",
      status: "是否执行同步上传",
      hint: "上传",
      render(container, done) {
        const copy = document.createElement("div");
        copy.className = "system-modal-copy";
        copy.textContent =
          "是否同时上传到服务器？选择“仅本地游玩”则不会发起网络请求。";
        container.appendChild(copy);

        const actions = document.createElement("div");
        actions.className = "system-modal-actions";

        const localBtn = modal.createButton("仅本地游玩");
        localBtn.addEventListener("click", () => done(false));
        actions.appendChild(localBtn);

        const uploadBtn = modal.createButton("上传并游玩", { primary: true });
        uploadBtn.addEventListener("click", () => done(true));
        actions.appendChild(uploadBtn);

        const cancelBtn = modal.createButton("取消");
        cancelBtn.addEventListener("click", () => done(null));
        actions.appendChild(cancelBtn);

        container.appendChild(actions);
      },
    });
  }

  function askServerEndpoint(defaultValue) {
    return modal.openModal({
      title: "配置上传接口",
      menu: "接口地址",
      status: "请输入目标 POST 接口地址",
      hint: "链接地址",
      render(container, done) {
        const input = document.createElement("input");
        input.className = "system-modal-input";
        input.type = "text";
        input.value = defaultValue || "";
        input.placeholder = "http://127.0.0.1:3000/upload";
        container.appendChild(input);

        const actions = document.createElement("div");
        actions.className = "system-modal-actions";
        const cancelBtn = modal.createButton("取消");
        cancelBtn.addEventListener("click", () => done(null));
        actions.appendChild(cancelBtn);

        const confirmBtn = modal.createButton("确定", { primary: true });
        confirmBtn.addEventListener("click", () => done(input.value.trim()));
        actions.appendChild(confirmBtn);
        container.appendChild(actions);
      },
    });
  }

  function askJsonText() {
    return modal.openModal({
      title: "粘贴 JSON 剧本",
      menu: "粘贴源码",
      status: "请粘贴完整的 JSON 对象内容",
      hint: "JSON 文本",
      allowOverlayClose: false,
      render(container, done) {
        const textarea = document.createElement("textarea");
        textarea.className = "system-modal-textarea";
        textarea.placeholder = '{\n  "title": "我的游戏"\n}';
        container.appendChild(textarea);

        const actions = document.createElement("div");
        actions.className = "system-modal-actions";
        const cancelBtn = modal.createButton("取消");
        cancelBtn.addEventListener("click", () => done(null));
        actions.appendChild(cancelBtn);

        const runBtn = modal.createButton("运行", { primary: true });
        runBtn.addEventListener("click", () => done(textarea.value.trim()));
        actions.appendChild(runBtn);
        container.appendChild(actions);
      },
    });
  }

  async function uploadLocalGameToServer(file, endpoint) {
    const formData = new FormData();
    formData.append("file", file, file.name || "本地游戏副本.json");
    const response = await fetch(endpoint, { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(`服务端上传失败：${response.status}`);
    }
  }

  async function maybeUploadLocalSource(fileLike) {
    const uploadChoice = await askUploadOption();
    if (uploadChoice == null || uploadChoice === false) {
      return;
    }
    let endpoint = storage.getServerUploadEndpoint();
    if (!endpoint) {
      endpoint =
        (await askServerEndpoint("http://127.0.0.1:3000/upload"))?.trim() || "";
      if (endpoint) {
        storage.setServerUploadEndpoint(endpoint);
      }
    }
    if (endpoint) {
      await uploadLocalGameToServer(fileLike, endpoint);
    }
  }

  async function startLocalGameFromText(rawText, sourceName) {
    const rawGame = JSON.parse(rawText);
    return startLocalGameFromObject(rawGame, sourceName);
  }

  async function startLocalGameFromObject(rawGame, sourceName) {
    const meta = makeLocalGameMeta({ name: sourceName }, rawGame);
    const game = normalizeGameData(rawGame, meta);
    runtime.resetIntoGame(game, game.entryScene);
  }

  async function loadRemoteGame(url) {
    if (!url) {
      return;
    }
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`远程 JSON 加载失败：${response.status}`);
    }
    const rawGame = await response.json();
    await startLocalGameFromObject(rawGame, url);
  }

  async function loadLocalGame(file) {
    if (!file) {
      return;
    }
    try {
      const rawText = await file.text();
      await maybeUploadLocalSource(file);
      await startLocalGameFromText(rawText, file.name);
    } catch (error) {
      log(`loadLocalGame failed: ${error.message}`);
      runtime.showGame();
      els.gameTitle.textContent = "本地游戏";
      els.statusBar.innerHTML = "<span style='color:#ff6b6b'>加载失败</span>";
      els.gameContent.innerHTML = `<div class='text danger'>本地 JSON 加载失败：${escapeHtml(explainImportError(error))}</div>`;
    } finally {
      els.localGameInput.value = "";
    }
  }

  async function handlePastedJson() {
    const rawText = await askJsonText();
    if (!rawText) {
      return;
    }
    const blob = new Blob([rawText], { type: "application/json" });
    const fileLike = new File([blob], "粘贴获得的测试剧本.json", {
      type: "application/json",
    });
    await maybeUploadLocalSource(fileLike);
    await startLocalGameFromText(rawText, "粘贴获得的测试剧本.json");
  }

  async function handleRemoteJson() {
    const url = await askRemoteJsonUrl();
    if (!url) {
      return;
    }
    await loadRemoteGame(url);
  }

  return {
    loadLocalGame,
    handlePastedJson,
    handleRemoteJson,
  };
}
