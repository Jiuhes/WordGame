export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function slugify(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `local_${Date.now()}`;
}

export function renderContentBlocks(blocks) {
  const typeLabels = {
    narrator: "旁白描述",
    dialogue: "角色对话",
    danger: "危险警告",
    safe: "安全区域",
    clue: "关键线索",
    item: "物品道具",
    ghost: "异常信号",
    boss: "强敌头目",
    hero: "正面勇者",
    rival: "竞争对手",
    zombie: "受感染者",
    wife: "游戏中的妻子",
    husband: "游戏中的丈夫",
    secret: "绝密信息",
  };

  return blocks
    .map((block, index) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      if (block.type === "raw-html" && typeof block.html === "string") {
        return block.html;
      }
      const type = escapeHtml(block.type || "narrator");
      const label = escapeHtml(
        block.eyebrow || typeLabels[block.type] || "Log",
      );
      const order = String(index + 1).padStart(2, "0");
      const speaker = block.speaker
        ? `<span class="text-block-speaker">${escapeHtml(block.speaker)}</span>`
        : "";
      const emphasisClass = block.emphasis
        ? ` text-block-emphasis-${escapeHtml(block.emphasis)}`
        : "";
      const aside = block.aside
        ? `<div class="text-block-aside">${escapeHtml(block.aside)}</div>`
        : "";
      if (typeof block.text === "string") {
        return `<section class="text-block ${type}${emphasisClass}" data-block-type="${type}">
          <div class="text-block-meta">
            <div class="text-block-meta-main">
              <span class="text-block-kicker">${label}</span>
              ${speaker}
            </div>
            <span class="text-block-index">${order}</span>
          </div>
          <div class="text ${type}">${escapeHtml(block.text)}</div>
          ${aside}
        </section>`;
      }
      if (typeof block.html === "string") {
        return `<section class="text-block ${type}${emphasisClass}" data-block-type="${type}">
          <div class="text-block-meta">
            <div class="text-block-meta-main">
              <span class="text-block-kicker">${label}</span>
              ${speaker}
            </div>
            <span class="text-block-index">${order}</span>
          </div>
          <div class="text ${type}">${block.html}</div>
          ${aside}
        </section>`;
      }
      return "";
    })
    .join("");
}

export async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

export function clipText(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
