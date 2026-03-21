export function createLobbyController({
  state,
  els,
  log,
  escapeHtml,
  fetchJson,
  normalizeGamesIndex,
  getGameStats,
  onSelectGame,
}) {
  function setFileMenuOpen(open) {
    els.fileMenuDropdown.classList.toggle("open", open);
    els.fileMenuTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  async function renderLobby() {
    els.gameList.innerHTML = "<div class='loading'>正在加载游戏列表...</div>";
    try {
      const rawIndex = await fetchJson("data/games.json");
      const available = normalizeGamesIndex(rawIndex);
      state.games = available;
      els.gameCount.textContent = `${available.length} 个游戏`;
      els.gameList.innerHTML = available
        .map((game) => {
          const desc = game.category
            ? `${game.category} 璺?${game.desc}`
            : game.desc;
          const stats = getGameStats ? getGameStats(game.id) : null;
          const totalEndings = stats?.totalEndings || 0;
          const discoveredEndings = stats?.discoveredEndings?.length || 0;
          const completion = totalEndings
            ? Math.round((discoveredEndings / totalEndings) * 100)
            : 0;
          const statsCopy = stats
            ? `<div class="game-card-stats">
                <span class="game-stat-pill">已解锁 ${discoveredEndings}${totalEndings ? ` / ${totalEndings}` : ""} 个结局</span>
                <span class="game-stat-pill">收集度 ${completion}%</span>
              </div>`
            : "";
          const badge = game.category
            ? `<div class="game-card-topline"><span class="game-category-badge">${escapeHtml(game.category)}</span><span class="game-id-tag">${escapeHtml(game.id)}</span></div>`
            : `<div class="game-card-topline"><span class="game-id-tag">${escapeHtml(game.id)}</span></div>`;
          return `<button class="game-item" type="button" data-game-id="${escapeHtml(game.id)}">
            <div class="game-icon">${escapeHtml(game.icon)}</div>
            <div class="game-meta">
              ${badge}
              <div class="game-name">${escapeHtml(game.name)}</div>
              <div class="game-desc">${escapeHtml(desc)}</div>
              ${statsCopy}
            </div>
          </button>`;
        })
        .join("");

      els.gameList.querySelectorAll("[data-game-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const game = available.find(
            (entry) => entry.id === item.dataset.gameId,
          );
          if (game) {
            onSelectGame(game);
          }
        });
      });
    } catch (error) {
      log(`renderLobby failed: ${error.message}`);
      els.gameList.innerHTML = `<div class='text danger'>无法加载 data/games.json: ${escapeHtml(error.message)}</div>`;
    }
  }

  return {
    setFileMenuOpen,
    renderLobby,
  };
}
