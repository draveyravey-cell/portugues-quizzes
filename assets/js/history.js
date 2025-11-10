"use strict";

/* Histórico (7.1) — métricas básicas + tentativas recentes + export/limpar */
(function () {
  function fmtPerc(p) {
    const n = Math.round((p || 0) * 100);
    return `${n}%`;
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return "—";
    }
  }

  function render() {
    const stats = window.Store?.getStats();
    if (!stats) return;

    const elStats = document.querySelector("#hist-stats");
    const elAttempts = document.querySelector("#hist-attempts");

    // Cards
    if (elStats) {
      elStats.innerHTML = "";
      const frag = document.createDocumentFragment();
      const cards = [
        { label: "Tentativas", value: String(stats.totals.attempts) },
        { label: "Acertos", value: `${stats.totals.correct} (${fmtPerc(stats.totals.accuracy)})` },
        { label: "Questões distintas", value: String(stats.totals.uniqueQ) },
        { label: "Última atividade", value: fmtDate(stats.totals.lastAt) }
      ];
      cards.forEach((c) => {
        const div = document.createElement("div");
        div.className = "stat-card";
        div.innerHTML = `<div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div>`;
        frag.appendChild(div);
      });
      elStats.appendChild(frag);
    }

    // Tentativas recentes
    if (elAttempts) {
      if (!stats.lastAttempts.length) {
        elAttempts.innerHTML = `<p class="empty">Ainda não há tentativas registradas.</p>`;
      } else {
        const ul = document.createElement("ul");
        ul.className = "options";
        stats.lastAttempts.forEach((a) => {
          const li = document.createElement("li");
          li.className = "option";
          const icon = a.correct ? "✅" : "❌";
          li.innerHTML = `
            <div style="display:flex; gap:.6rem; align-items:center;">
              <span style="min-width:1.2rem; display:inline-block">${icon}</span>
              <span>Q${a.qid} — ${a.categoria || "Português"} • ${a.tipo.replace("_"," ")}</span>
              <span style="margin-left:auto; color:var(--muted); font-size:.9rem;">${fmtDate(a.at)}</span>
            </div>
          `;
          ul.appendChild(li);
        });
        elAttempts.innerHTML = "";
        elAttempts.appendChild(ul);
      }
    }
  }

  function bindActions() {
    const btnExport = document.querySelector("#hist-export");
    const btnClear = document.querySelector("#hist-clear");

    btnExport?.addEventListener("click", () => {
      try {
        const json = window.Store?.exportJSON() || "{}";
        const blob = new Blob([json], { type: "application/json" });
        const a = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = URL.createObjectURL(blob);
        a.download = `historico-portugues-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        console.error(e);
        alert("Não foi possível exportar o histórico.");
      }
    });

    btnClear?.addEventListener("click", () => {
      if (confirm("Tem certeza? Isso irá remover todas as sessões e tentativas localmente.")) {
        window.Store?.clear();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("#historico")) return;
    bindActions();
    render();
  });
  window.addEventListener("store:changed", render);
})();