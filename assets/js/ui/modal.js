export function createModalController(els) {
  const modalState = {
    resolver: null,
    allowOverlayClose: true,
  };

  function createButton(label, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `system-modal-btn${options.primary ? " primary" : ""}${options.extraClass ? ` ${options.extraClass}` : ""}`;
    button.textContent = label;
    return button;
  }

  function closeModal(value) {
    if (!modalState.resolver) {
      return;
    }
    const resolve = modalState.resolver;
    modalState.resolver = null;
    els.modalRoot.hidden = true;
    els.modalContent.innerHTML = "";
    els.modalWindow.classList.remove("wide", "xwide");
    document.body.classList.remove("modal-open");
    resolve(value);
  }

  function openModal(config) {
    return new Promise((resolve) => {
      modalState.resolver = resolve;
      modalState.allowOverlayClose = config.allowOverlayClose !== false;
      els.modalWindow.classList.remove("wide", "xwide");
      if (config.size === "wide" || config.size === "xwide") {
        els.modalWindow.classList.add(config.size);
      }
      els.modalTitle.textContent = config.title || "系统对话框";
      els.modalMenuBar.textContent = config.menu || "对话框";
      els.modalStatusText.textContent = config.status || "就绪";
      els.modalStatusHint.textContent = config.hint || "等待输入";
      els.modalContent.innerHTML = "";
      config.render(els.modalContent, closeModal);
      els.modalRoot.hidden = false;
      document.body.classList.add("modal-open");
    });
  }

  function showInfoModal(config) {
    return openModal({
      title: config.title,
      menu: config.menu,
      status: config.status,
      hint: config.hint,
      size: config.size || "wide",
      render(container) {
        container.innerHTML = config.html;
        if (typeof config.afterRender === "function") {
          config.afterRender(container);
        }
      },
    });
  }

  return {
    createButton,
    openModal,
    closeModal,
    showInfoModal,
    modalState,
  };
}
