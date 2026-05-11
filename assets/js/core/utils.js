const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  #minLevel;
  #handlers;
  #context;

  constructor(minLevel = "info", handlers = ["console"], context = {}) {
    this.#minLevel = LOG_LEVELS[minLevel] ?? LOG_LEVELS.info;
    this.#handlers = handlers;
    this.#context = context;
  }

  #shouldLog(level) {
    return LOG_LEVELS[level] >= this.#minLevel;
  }

  #formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.#context).length
      ? ` [${Object.entries(this.#context)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}]`
      : "";
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}${dataStr}`;
  }

  #log(level, message, data) {
    if (!this.#shouldLog(level)) return;

    const formatted = this.#formatMessage(level, message, data);

    for (const handler of this.#handlers) {
      switch (handler) {
        case "console":
          switch (level) {
            case "debug":
              console.debug(formatted);
              break;
            case "info":
              console.info(formatted);
              break;
            case "warn":
              console.warn(formatted);
              break;
            case "error":
              console.error(formatted);
              break;
            default:
              console.log(formatted);
          }
          break;
        case "memory":
          break;
      }
    }
  }

  debug(message, data) {
    this.#log("debug", message, data);
  }

  info(message, data) {
    this.#log("info", message, data);
  }

  warn(message, data) {
    this.#log("warn", message, data);
  }

  error(message, data) {
    this.#log("error", message, data);
  }

  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.#minLevel = LOG_LEVELS[level];
    }
  }

  setContext(context) {
    this.#context = { ...this.#context, ...context };
  }

  child(context) {
    return new Logger(
      Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === this.#minLevel) ||
        "info",
      this.#handlers,
      { ...this.#context, ...context },
    );
  }
}

function createLogger(minLevel, handlers, context) {
  return new Logger(minLevel, handlers, context);
}

export const logger = createLogger(
  import.meta.env?.DEV ? "debug" : "error",
  ["console"],
  { app: "wordgame" },
);

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function clone(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  if (value instanceof Map) {
    return new Map(clone([...value]));
  }

  if (value instanceof Set) {
    return new Set(clone([...value]));
  }

  if (Array.isArray(value)) {
    return value.map((item) => clone(item));
  }

  const cloned = {};
  for (const key of Object.keys(value)) {
    cloned[key] = clone(value[key]);
  }
  return cloned;
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

export async function fetchJson(path, options = {}) {
  const { timeout = 10000, retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(path, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to load ${path}: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`Request to ${path} timed out after ${timeout}ms`);
      }

      if (attempt === retries) {
        throw error;
      }
    }
  }
}

export function clipText(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
