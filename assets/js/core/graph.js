import { DEFAULT_ENTRY_SCENE } from "./constants.js";
import { clipText, escapeHtml, normalizeText } from "./utils.js";
import { getScenePreview } from "./game-data.js";

export function makeGraphData(rawGame, meta) {
  const scenes = rawGame.scenes || {};
  const entryScene = rawGame.entryScene || DEFAULT_ENTRY_SCENE;
  const ids = Object.keys(scenes);
  const incoming = new Map(ids.map((id) => [id, []]));
  const outgoing = new Map(ids.map((id) => [id, []]));
  const missingTargets = [];

  for (const [sceneId, scene] of Object.entries(scenes)) {
    for (const choice of scene.choices || []) {
      if (!choice.next || choice.next === "__lobby__") {
        continue;
      }
      const edge = { from: sceneId, to: choice.next, text: choice.text || "" };
      if (choice.visibility) {
        edge.visibility = choice.visibility;
      }
      if (choice.conditions) {
        edge.conditions = choice.conditions;
      }
      if (choice.disabledReason) {
        edge.disabledReason = choice.disabledReason;
      }
      if (choice.once) {
        edge.once = true;
      }
      outgoing.get(sceneId).push(edge);
      if (incoming.has(choice.next)) {
        incoming.get(choice.next).push(edge);
      } else {
        missingTargets.push(edge);
      }
    }
  }

  const depths = new Map();
  const parents = new Map();
  if (scenes[entryScene]) {
    const queue = [{ id: entryScene, depth: 0 }];
    depths.set(entryScene, 0);
    while (queue.length) {
      const current = queue.shift();
      for (const edge of outgoing.get(current.id) || []) {
        if (!scenes[edge.to] || depths.has(edge.to)) {
          continue;
        }
        depths.set(edge.to, current.depth + 1);
        parents.set(edge.to, current.id);
        queue.push({ id: edge.to, depth: current.depth + 1 });
      }
    }
  }

  return {
    meta,
    game: rawGame,
    entryScene,
    scenes,
    incoming,
    outgoing,
    depths,
    parents,
    missingTargets,
    stats: {
      scenes: ids.length,
      endings: ids.filter((id) => (outgoing.get(id) || []).length === 0).length,
      deadEnds: ids.filter((id) => {
        const scene = scenes[id];
        return (outgoing.get(id) || []).length === 0 && !scene?.ending;
      }).length,
      oversized: ids.filter((id) => (outgoing.get(id) || []).length >= 8)
        .length,
      conditional: ids.filter((id) => Boolean(scenes[id]?.conditions)).length,
      unreachable: ids.filter((id) => !depths.has(id)).length,
      brokenEdges: missingTargets.length,
    },
  };
}

export function getPrimaryPath(graph, sceneId) {
  const path = [];
  const visited = new Set();
  let currentId = sceneId;
  while (currentId && !visited.has(currentId) && graph.scenes[currentId]) {
    path.unshift(currentId);
    visited.add(currentId);
    currentId = graph.parents.get(currentId) || null;
  }
  return path;
}

export function getVisibleOutgoing(graph, sceneId, graphState) {
  const edges = graph.outgoing.get(sceneId) || [];
  const keyword = graphState.searchKeyword;
  const filtered = edges.filter((edge) => {
    if (!keyword) {
      return true;
    }
    const target = graph.scenes[edge.to] || {};
    return (
      normalizeText(edge.text).includes(keyword) ||
      normalizeText(edge.to).includes(keyword) ||
      normalizeText(target.title).includes(keyword)
    );
  });
  const count =
    graphState.expandedBranches.get(sceneId) || graphState.branchPageSize;
  return {
    all: edges,
    filtered,
    visible: filtered.slice(0, count),
    hiddenCount: Math.max(0, filtered.length - count),
  };
}

function getSceneClasses(graph, sceneId, graphState, extraClasses) {
  const classes = ["graph-node"];
  if (extraClasses) {
    classes.push(...extraClasses);
  }
  if ((graph.outgoing.get(sceneId) || []).length === 0) {
    classes.push("ending");
  }
  if ((graph.outgoing.get(sceneId) || []).length >= 8) {
    classes.push("oversized");
  }
  if (graph.scenes[sceneId]?.conditions) {
    classes.push("conditional");
  }
  if (!graph.depths.has(sceneId)) {
    classes.push("unreachable");
  }
  if (
    (graph.outgoing.get(sceneId) || []).some((edge) => !graph.scenes[edge.to])
  ) {
    classes.push("problem");
  }
  if (sceneId === graphState.selectedSceneId) {
    classes.push("selected");
  }
  return classes.join(" ");
}

export function renderSceneCard(graph, sceneId, graphState, options = {}) {
  const scene = graph.scenes[sceneId];
  if (!scene) {
    return "";
  }
  const outgoingCount = (graph.outgoing.get(sceneId) || []).length;
  const incomingCount = (graph.incoming.get(sceneId) || []).length;
  return `<div class="${escapeHtml(
    getSceneClasses(graph, sceneId, graphState, options.classes),
  )}" data-scene-id="${escapeHtml(sceneId)}"><div class="graph-node-id">${escapeHtml(
    sceneId,
  )}</div><div class="graph-node-title">${escapeHtml(
    clipText(scene.title || sceneId, options.compact ? 28 : 48),
  )}</div><div class="graph-node-meta"><span class="graph-badge">流出 ${outgoingCount}</span><span class="graph-badge">流入 ${incomingCount}</span>${
    scene.conditions ? '<span class="graph-badge">准入条件</span>' : ""
  }${
    outgoingCount >= 8 ? '<span class="graph-badge">宽幅节点</span>' : ""
  }</div></div>`;
}

export { getScenePreview };
