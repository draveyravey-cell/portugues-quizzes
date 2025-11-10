"use strict";

/* Histórico (7.2) — sessões, por questão, import/CSV, cards, recentes */
(function () {
  let datasetCache = null; // cache do JSON de exercícios

  function fmtPerc(p) { return `${Math.round((p || 0) * 100)}%`; }
  function fmtDate(ts) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
    catch { return "—"; }
  }

  async function ensureDataset() {
    if (datasetCache) return datasetCache;
    try {
      const resp = await fetch("data/exercicios.json", { cache: "no-store" });
      const data = await resp.json();
      const arr = Array.isArray(data) ? data : (data.questoes || []);
      const map = new Map();
      arr.forEach(q => map.set(String(q.id), q));
      datasetCache = { list: arr, map };
      return datasetCache;
    } catch {
      datasetCache = { list: [], map: new Map() };
      return datasetCache;
    }
  }

  function renderCards(stats) {
    const elStats = document.querySelector("#hist-stats");
    if (!elStats) return;
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

  function renderRecent(stats) {
    const elAttempts = document.querySelector("#hist-attempts");
    if (!elAttempts) return;
    if (!stats.lastAttempts.length) {
      elAttempts.innerHTML = `<p class="empty">Ainda não há tentativas registradas.</p>`;
      return;
    }
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

  function renderSessions(stats) {
    const root = document.querySelector("#hist-sessions");
    if (!root) return;
    const list = stats.sessions || [];
    if (!list.length) { root.innerHTML = `<p class="hint">Nenhuma sessão registrada ainda.</p>`; return; }

    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Início</th>
          <th>Fim</th>
          <th>Questões</th>
          <th>Respondidas</th>
          <th>Acertos</th>
          <th>Acerto %</th>
          <th>Filtros</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector("tbody");

    list.forEach((s) => {
      const total = s.questionIds?.length || (s.results?.length || 0);
      const answered = s.results?.length || 0;
      const correct = s.results ? s.results.filter(r => r.correct).length : 0;
      const acc = answered ? (correct / answered) : 0;

      const f = s.filters || { q: "", cat: "all", dif: "all" };
      const ftxt = [
        f.q ? `q:“${f.q}”` : "",
        f.cat && f.cat !== "all" ? `cat:${f.cat}` : "",
        f.dif && f.dif !== "all" ? `dif:${f.dif}` : ""
      ].filter(Boolean).join(" • ") || "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDate(s.startedAt)}</td>
        <td>${fmtDate(s.finishedAt)}</td>
        <td>${total}</td>
        <td>${answered}</td>
        <td>${correct}</td>
        <td>${fmtPerc(acc)}</td>
        <td>${ftxt}</td>
      `;
      tb.appendChild(tr);
    });

    root.innerHTML = "";
    root.appendChild(table);
  }

  async function renderPerQuestion(stats) {
    const root = document.querySelector("#hist-perq");
    if (!root) return;
    const perQ = stats.perQ || {};
    const keys = Object.keys(perQ);
    if (!keys.length) { root.innerHTML = `<p class="hint">Estatísticas por questão aparecerão aqui após você praticar.</p>`; return; }

    const { map } = await ensureDataset();

    keys.sort((a, b) => (perQ[b].count || 0) - (perQ[a].count || 0));

    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Tema</th>
          <th>Tentativas</th>
          <th>Acertos</th>
          <th>Acerto %</th>
          <th>Melhor sequência</th>
          <th>Última</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector("tbody");

    keys.forEach((qid) => {
      const s = perQ[qid];
      const q = map.get(String(qid));
      const tema = q?.tema || q?.categoria || "—";
      const acc = s.count ? (s.correct / s.count) : 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${qid}</td>
        <td>${tema}</td>
        <td>${s.count}</td>
        <td>${s.correct}</td>
        <td>${fmtPerc(acc)}</td>
        <td>${s.bestStreak || 0}</td>
        <td>${fmtDate(s.lastAt)}</td>
      `;
      tb.appendChild(tr);
    });

    root.innerHTML = "";
    root.appendChild(table);
  }

  function bindActions() {
    const btnExport = document.querySelector("#hist-export");
    const btnExportCsv = document.querySelector("#hist-export-csv");
    const btnImport = document.querySelector("#hist-import");
    const fileInput = document.querySelector("#hist-file");
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
      } catch (e) {
        console.error(e);
        alert("Não foi possível exportar o histórico.");
      }
    });

    btnExportCsv?.addEventListener("click", () => {
      try {
        const db = JSON.parse(window.Store?.exportJSON() || "{}");
        const attempts = Array.isArray(db.attempts) ? db.attempts : [];
        const rows = [["at","sessionId","qid","tipo","categoria","dificuldade","selected","correct"]];
        attempts.forEach((a) => {
          rows.push([
            a.at ? new Date(a.at).toISOString() : "",
            a.sessionId || "",
            a.qid || "",
            a.tipo || "",
            a.categoria || "",
            a.dificuldade || "",
            JSON.stringify(a.value),
            a.correct ? "1" : "0"
          ]);
        });
        const csv = rows.map(r => r.map(cell => String(cell).replace(/"/g,'""')).map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        link.href = URL.createObjectURL(blob);
        link.download = `tentativas-portugues-${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (e) {
        console.error(e);
        alert("Falha ao exportar CSV.");
      }
    });

    btnImport?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const replace = confirm("Importar substituindo totalmente o histórico atual? (OK = substituir; Cancelar = mesclar)");
      try {
        window.Store?.importJSON(text, { replace });
        alert("Importação concluída!");
      } catch (err) {
        console.error(err);
        alert("Falha ao importar. Verifique o arquivo.");
      } finally {
        e.target.value = "";
      }
    });

    btnClear?.addEventListener("click", () => {
      if (confirm("Tem certeza? Isso irá remover todas as sessões e tentativas localmente.")) {
        window.Store?.clear();
      }
    });
  }

  async function renderAll() {
    const stats = window.Store?.getStats();
    if (!stats) return;
    renderCards(stats);
    renderRecent(stats);
    renderSessions(stats);
    await renderPerQuestion(stats);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("#historico")) return;
    bindActions();
    renderAll();
  });
  window.addEventListener("store:changed", renderAll);
})();