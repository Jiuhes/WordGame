export function open(app) {
  const { state, els, openModal, storage } = app;

  openModal({
    title: "设置",
    menu: "设置",
    status: "就绪",
    hint: "本地配置",
    size: "wide",
    render(container) {
      function render() {
        const settings = state.settings || storage.getSettings();
        container.innerHTML = `
          <div class="tool-panel">
            <div class="tool-title">播放与体验</div>
            <div class="author-choice-list">
              <label class="author-choice-card">
                <div class="author-choice-heading">
                  <strong>场景过渡动画</strong>
                  <input id="settingsTransitions" type="checkbox" ${
                    settings.enableTransitions ? "checked" : ""
                  }>
                </div>
                <div class="author-choice-meta">在场景切换时启用轻量的淡入淡出动效。</div>
              </label>
              <label class="author-choice-card">
                <div class="author-choice-heading">
                  <strong>按键音效</strong>
                  <input id="settingsSound" type="checkbox" ${
                    settings.enableSound ? "checked" : ""
                  }>
                </div>
                <div class="author-choice-meta">在场景切换或达成新结局时播放极简的系统合成音效。</div>
              </label>
            </div>
            <div class="author-controls">
              <button type="button" id="settingsSaveBtn" class="graph-button">保存设置</button>
            </div>
          </div>
        `;

        container
          .querySelector("#settingsSaveBtn")
          ?.addEventListener("click", () => {
            state.settings = storage.saveSettings({
              enableTransitions: Boolean(
                container.querySelector("#settingsTransitions")?.checked,
              ),
              enableSound: Boolean(
                container.querySelector("#settingsSound")?.checked,
              ),
            });
            els.modalStatusText.textContent = "已保存";
            render();
          });
      }

      render();
    },
  });
}
