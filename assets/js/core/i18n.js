const translations = {
  zh: {
    app: {
      title: "游戏大厅",
      loading: "加载中...",
      ready: "就绪",
    },
    menu: {
      file: "文件",
      openLocal: "打开本地 JSON",
      importFromUrl: "从链接导入",
      pasteJson: "粘贴 JSON",
      stats: "统计",
      settings: "设置",
      restart: "重开",
    },
    lobby: {
      gameCount: "{count} 个游戏",
      localGame: "本地游戏",
    },
    game: {
      status: "实时存档",
      running: "运行中",
      continue: "继续游戏",
      startNew: "开始新游戏",
      noSave: "无存档",
    },
    scene: {
      decide: "决定你的下一步",
      noChoices: "这里没有任何能继续进行下去的手段。",
      atEnd: "已到达终点",
      restart: "从头重开",
      backToLobby: "返回大厅",
      phase: "阶段",
      time: "时间",
      clues: "线索",
      items: "物品",
    },
    status: {
      noStatus: "暂无状态栏数据",
      cluesCount: "已掌握线索",
      itemsCount: "持有物品",
      emptyClues: "关键线索仍然空白。",
      emptyItems: "暂时没有拿到关键物品。",
    },
    choices: {
      gainItem: "获得物品",
      loseItem: "消耗物品",
      gainClue: "获得线索",
      loseClue: "消耗线索",
      timeCost: "耗时",
      onceOnly: "这个特殊选项只能执行一次。",
      conditionsNotMet: "当前还未满足解锁这个动作所需的条件。",
    },
    confirmation: {
      reset: "这会放弃当前进度并从头开始，是否继续？",
      irreversible: "这是一个不可逆的关键选择，是否继续？",
      consumeResource: "这一步会消耗关键物品或线索，是否继续？",
      endFlow: "这一步会直接结束当前流程，是否继续？",
      general: "确定要继续吗？",
    },
    errors: {
      loadFailed: "资源损坏或加载失败",
      parseFailed: "解析读取游戏剧本时发生错误",
      sceneNotFound: "找不到系统标识名为 {sceneId} 的场景实例。",
      nodeBroken: "节点分支已损坏",
      conditionNotMet: "无法进入此分支",
      conditionReason: "你当前携带的综合状态不满足切入这个分支的前置条件。",
      jsonInvalid: "JSON 格式不合法，请先检查逗号、引号和括号是否完整。",
      importFailed: "导入内容无法被当前程序识别。",
    },
    ending: {
      title: "结局进度",
      discovered: "已发现 {current} / {total}",
      remaining: "还差 {count} 个",
    },
    feedback: {
      restarted: "已从开头重新开始",
      timeAdvanced: "时间推进 {amount}",
    },
    modal: {
      title: "系统对话框",
      localMode: "本地模式",
      close: "关闭",
      confirm: "确定",
      cancel: "取消",
    },
    accessibility: {
      back: "返回大厅",
      closeGame: "关闭游戏",
      ending: "结局统计",
    },
  },
  en: {
    app: {
      title: "Game Lobby",
      loading: "Loading...",
      ready: "Ready",
    },
    menu: {
      file: "File",
      openLocal: "Open Local JSON",
      importFromUrl: "Import from URL",
      pasteJson: "Paste JSON",
      stats: "Stats",
      settings: "Settings",
      restart: "Restart",
    },
    lobby: {
      gameCount: "{count} game(s)",
      localGame: "Local Game",
    },
    game: {
      status: "Auto Save",
      running: "Running",
      continue: "Continue",
      startNew: "Start New",
      noSave: "No Save",
    },
    scene: {
      decide: "Decide Your Next Step",
      noChoices: "There are no ways to continue from here.",
      atEnd: "Reached the End",
      restart: "Restart from Beginning",
      backToLobby: "Back to Lobby",
      phase: "Phase",
      time: "Time",
      clues: "Clues",
      items: "Items",
    },
    status: {
      noStatus: "No status data",
      cluesCount: "Known Clues",
      itemsCount: "Inventory",
      emptyClues: "No key clues yet.",
      emptyItems: "No key items yet.",
    },
    choices: {
      gainItem: "Gain Item",
      loseItem: "Consume Item",
      gainClue: "Gain Clue",
      loseClue: "Consume Clue",
      timeCost: "Time Cost",
      onceOnly: "This option can only be used once.",
      conditionsNotMet: "Conditions for this action are not yet met.",
    },
    confirmation: {
      reset: "This will abandon current progress and start over. Continue?",
      irreversible: "This is an irreversible key choice. Continue?",
      consumeResource: "This step will consume key items or clues. Continue?",
      endFlow: "This will end the current flow. Continue?",
      general: "Are you sure you want to continue?",
    },
    errors: {
      loadFailed: "Resource corrupted or failed to load",
      parseFailed: "Error parsing game data",
      sceneNotFound: "Cannot find scene with identifier {sceneId}.",
      nodeBroken: "Node branch corrupted",
      conditionNotMet: "Cannot enter this branch",
      conditionReason:
        "Your current state does not meet the prerequisites for this branch.",
      jsonInvalid:
        "Invalid JSON format. Please check commas, quotes, and brackets.",
      importFailed: "Import content could not be recognized.",
    },
    ending: {
      title: "Ending Progress",
      discovered: "Discovered {current} / {total}",
      remaining: "{count} remaining",
    },
    feedback: {
      restarted: "Restarted from beginning",
      timeAdvanced: "Time advanced by {amount}",
    },
    modal: {
      title: "System Dialog",
      localMode: "Local Mode",
      close: "Close",
      confirm: "Confirm",
      cancel: "Cancel",
    },
    accessibility: {
      back: "Back to Lobby",
      closeGame: "Close Game",
      ending: "Ending Statistics",
    },
  },
};

let currentLocale = "zh";

export function setLocale(locale) {
  if (translations[locale]) {
    currentLocale = locale;
  }
}

export function getLocale() {
  return currentLocale;
}

export function t(key, params = {}) {
  const keys = key.split(".");
  let value = translations[currentLocale];

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      value = translations.zh;
      for (const fallbackKey of keys) {
        if (value && typeof value === "object" && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key;
        }
      }
      break;
    }
  }

  if (typeof value !== "string") {
    return key;
  }

  return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
    return params[paramKey] !== undefined ? params[paramKey] : `{${paramKey}}`;
  });
}

export function getAvailableLocales() {
  return Object.keys(translations);
}
