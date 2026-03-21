function formatTime(value) {
  if (!value) {
    return "无记录";
  }
  return new Date(value).toLocaleString();
}

export function open(app) {
  const { state, els, openModal, escapeHtml, log, runtime, storage } = app;

  if (!state.currentGame) {
    openModal({
      title: "存档",
      menu: "存档",
      status: "未选择游戏",
      hint: "请先打开一个游戏",
      size: "wide",
      render(container) {
        container.innerHTML =
          '<div class="tool-panel"><div class="tool-title">存档槽位</div><p>请先在主界面打开一个游戏。存档管理作用域受限于当前运行的游戏实例。</p></div>';
      },
    });
    return;
  }

  openModal({
    title: "存档",
    menu: "存档",
    status: "就绪",
    hint: state.currentGame.id,
    size: "xwide",
    render(container) {
      function render(exportText = "", selectedSlotId = "slot1") {
        const slots = storage.listSaveSlots(state.currentGame.id);
        container.innerHTML = `
          <div class="author-layout">
            <section class="tool-panel tool-panel-saves">
              <div class="tool-title">存档槽位</div>
              <p class="tool-lead">将每个槽位视为你的独立备忘录，无需退出当前进度即可执行保存、读取、导出或清空槽位数据。</p>
              <div class="author-choice-list">
                ${slots
                  .map(
                    (slot) => `
                    <article class="author-choice-card">
                      <div class="author-choice-heading">
                        <strong>${escapeHtml(slot.label)}</strong>
                        <span>${slot.data ? "存在记录" : "空白槽位"}</span>
                      </div>
                      <div class="author-choice-meta">进度场景: ${escapeHtml(slot.data?.currentSceneId || "-")}</div>
                      <div class="author-choice-meta">更新时间: ${escapeHtml(
                        formatTime(slot.data?.updatedAt),
                      )}</div>
                      <div class="author-controls">
                        <button type="button" class="graph-button" data-save-slot="${escapeHtml(slot.id)}">保存覆盖</button>
                        <button type="button" class="graph-button" data-load-slot="${escapeHtml(slot.id)}"${
                          slot.data ? "" : " disabled"
                        }>读取加载</button>
                        <button type="button" class="graph-button" data-export-slot="${escapeHtml(slot.id)}"${
                          slot.data ? "" : " disabled"
                        }>导出</button>
                        <button type="button" class="graph-button" data-clear-slot="${escapeHtml(slot.id)}"${
                          slot.data ? "" : " disabled"
                        }>清空</button>
                      </div>
                    </article>`,
                  )
                  .join("")}
              </div>
            </section>
            <section class="tool-panel tool-panel-saves">
              <div class="tool-title">导入与导出</div>
              <p class="tool-lead">使用明文 JSON 以极客的方式跨槽位或跨设备迁移全部游玩状态记录。</p>
              <div class="author-controls">
                <label class="graph-label" for="saveImportSlotSelect">写入目标</label>
                <select id="saveImportSlotSelect" class="graph-select">
                  ${storage
                    .getSaveSlots()
                    .filter((slot) => slot.id !== "auto")
                    .map(
                      (slot) =>
                        `<option value="${escapeHtml(slot.id)}"${
                          slot.id === selectedSlotId ? " selected" : ""
                        }>${escapeHtml(slot.label)}</option>`,
                    )
                    .join("")}
                </select>
              </div>
              <textarea id="saveTransferText" class="system-modal-textarea author-textarea">${escapeHtml(
                exportText,
              )}</textarea>
              <div class="author-controls">
                <button type="button" id="saveImportBtn" class="graph-button">执行写入</button>
              </div>
            </section>
          </div>
        `;

        container.querySelectorAll("[data-save-slot]").forEach((button) => {
          button.addEventListener("click", () => {
            runtime.saveToSlot(button.dataset.saveSlot);
            els.modalStatusText.textContent = "已保存";
            render("", selectedSlotId);
          });
        });

        container.querySelectorAll("[data-load-slot]").forEach((button) => {
          button.addEventListener("click", () => {
            const ok = runtime.loadFromSlot(button.dataset.loadSlot);
            els.modalStatusText.textContent = ok ? "已读取" : "读取失败";
            render("", selectedSlotId);
          });
        });

        container.querySelectorAll("[data-export-slot]").forEach((button) => {
          button.addEventListener("click", async () => {
            const slotId = button.dataset.exportSlot;
            const text = runtime.exportSlot(slotId);
            try {
              await navigator.clipboard?.writeText?.(text);
            } catch (error) {
              log(`save export clipboard failed: ${error.message}`);
            }
            els.modalStatusText.textContent = "已导出 (已复制到剪贴板)";
            render(text, selectedSlotId);
          });
        });

        container.querySelectorAll("[data-clear-slot]").forEach((button) => {
          button.addEventListener("click", () => {
            runtime.clearSlot(button.dataset.clearSlot);
            els.modalStatusText.textContent = "已清空";
            render("", selectedSlotId);
          });
        });

        container
          .querySelector("#saveImportBtn")
          ?.addEventListener("click", () => {
            const slotId =
              container.querySelector("#saveImportSlotSelect")?.value ||
              "slot1";
            const rawText =
              container.querySelector("#saveTransferText")?.value || "";
            try {
              runtime.importSlot(slotId, rawText);
              els.modalStatusText.textContent = "已导入";
              render("", slotId);
            } catch (error) {
              log(`save import failed: ${error.message}`);
              els.modalStatusText.textContent = "数据毁坏，导入失败";
            }
          });
      }

      render();
    },
  });
}
