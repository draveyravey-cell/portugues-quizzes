"use strict";

/* Histórico (7.2 safe) — sessões, por questão, import/CSV, cards, recentes */
(function () {
  let datasetCache = null; // cache do JSON de exercícios
  const ls = {
    attPage: "hist.att.page",
    attSize: "hist.att.size",
    sesPage: "hist.ses.page",
    sesSize: "hist.ses.size",
    perPage: "hist.per.page",
    perSize: "hist.per.size"
  };
  const st = {
    attPage: 1,
    attSize: 10,
    sesPage: 1,
    sesSize: 10,
    perPage: 1,
    perSize: 20
  };
  function restorePagerState() {
    try {
      const ap = parseInt(localStorage.getItem(ls.attPage) || "1", 10); st.attPage = isFinite(ap) && ap > 0 ? ap : 1;
      const as = parseInt(localStorage.getItem(ls.attSize) || "10", 10); st.attSize = isFinite(as) && as > 0 ? as : 10;
      const sp = parseInt(localStorage.getItem(ls.sesPage) || "1", 10); st.sesPage = isFinite(sp) && sp > 0 ? sp : 1;
      const ss = parseInt(localStorage.getItem(ls.sesSize) || "10", 10); st.sesSize = isFinite(ss) && ss > 0 ? ss : 10;
      const pp = parseInt(localStorage.getItem(ls.perPage) || "1", 10); st.perPage = isFinite(pp) && pp > 0 ? pp : 1;
      const ps = parseInt(localStorage.getItem(ls.perSize) || "20", 10); st.perSize = isFinite(ps) && ps > 0 ? ps : 20;
    } catch {}
  }
  function persistPagerState() {
    try {
      localStorage.setItem(ls.attPage, String(st.attPage));
      localStorage.setItem(ls.attSize, String(st.attSize));
      localStorage.setItem(ls.sesPage, String(st.sesPage));
      localStorage.setItem(ls.sesSize, String(st.sesSize));
      localStorage.setItem(ls.perPage, String(st.perPage));
      localStorage.setItem(ls.perSize, String(st.perSize));
    } catch {}
  }
  function renderPager(root, cfg) {
    if (!root) return;
    const total = Math.max(0, cfg.totalItems || 0);
    const pageSize = Math.max(1, cfg.pageSize || 10);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    let page = Math.max(1, Math.min(cfg.page || 1, totalPages));
    const summary = document.createElement("div"); summary.className = "pager__summary";
    const start = total ? (page - 1) * pageSize + 1 : 0;
    const end = total ? Math.min(page * pageSize, total) : 0;
    summary.textContent = `Exibindo ${start}–${end} de ${total}`;
    const nav = document.createElement("div"); nav.className = "pager__nav";
    const makeBtn = (label, targetPage, disabled, active, title, aria) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "pager__btn";
      if (active) b.classList.add("is-active"); if (disabled) b.disabled = true;
      b.textContent = label; if (title) b.title = title; b.setAttribute("aria-label", aria || label);
      if (active) b.setAttribute("aria-current", "page");
      b.addEventListener("click", () => { if (disabled || targetPage === page) return; page = targetPage; cfg.onChange?.({ page, pageSize }); });
      return b;
    };
    const first = makeBtn("«", 1, page === 1, false, "Primeira página");
    const prev = makeBtn("‹", Math.max(1, page - 1), page === 1, false, "Página anterior");
    nav.appendChild(first); nav.appendChild(prev);
    const windowSize = 5; const startPage = Math.max(1, page - 2); const endPage = Math.min(totalPages, startPage + windowSize - 1);
    for (let p = startPage; p <= endPage; p++) nav.appendChild(makeBtn(String(p), p, false, p === page));
    if (endPage < totalPages) { const ell = document.createElement("span"); ell.className = "pager__ellipsis"; ell.textContent = "…"; nav.appendChild(ell); nav.appendChild(makeBtn(String(totalPages), totalPages, false, page === totalPages)); }
    const next = makeBtn("›", Math.min(totalPages, page + 1), page === totalPages, false, "Próxima página");
    const last = makeBtn("»", totalPages, page === totalPages, false, "Última página");
    nav.appendChild(next); nav.appendChild(last);
    const sizeWrap = document.createElement("div"); sizeWrap.className = "pager__size";
    const lab = document.createElement("label"); lab.textContent = "Itens por página:"; lab.className = "sr-only";
    const sel = document.createElement("select"); sel.setAttribute("aria-label", "Itens por página");
    [5,10,20,30,50].forEach(n => { const opt = document.createElement("option"); opt.value = String(n); opt.textContent = String(n); if (n === pageSize) opt.selected = true; sel.appendChild(opt); });
    sel.addEventListener("change", () => { const n = parseInt(sel.value, 10) || pageSize; cfg.onChange?.({ page: 1, pageSize: Math.max(1, n) }); });
    root.innerHTML = ""; root.appendChild(summary); root.appendChild(nav); if (cfg.includePageSize) { sizeWrap.appendChild(lab); sizeWrap.appendChild(sel); root.appendChild(sizeWrap); }
  }

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

  // getStats com fallback: se a Store ainda não estiver pronta, inicializa e tenta novamente
  function getStatsSafe() {
    try {
      const s = window.Store?.getStats();
      if (s) return s;
    } catch (_) {
      // ignora e tenta init
    }
    try {
      window.Store?.init?.();
      return window.Store?.getStats?.() || null;
    } catch (_) {
      return null;
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
    const elPager = document.querySelector("#hist-attempts-pager");
    if (!elAttempts) return;
    if (!stats.lastAttempts.length) {
      elAttempts.innerHTML = `<p class="empty">Ainda não há tentativas registradas.</p>`;
      if (elPager) elPager.innerHTML = "";
      return;
    }
    const total = stats.lastAttempts.length;
    const totalPages = Math.max(1, Math.ceil(total / st.attSize));
    if (st.attPage > totalPages) st.attPage = totalPages;
    if (st.attPage < 1) st.attPage = 1;
    const start = (st.attPage - 1) * st.attSize;
    const end = Math.min(start + st.attSize, total);
    const pageItems = stats.lastAttempts.slice(start, end);
    const ul = document.createElement("ul");
    ul.className = "options";
    pageItems.forEach((a) => {
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
    renderPager(elPager, { totalItems: total, page: st.attPage, pageSize: st.attSize, includePageSize: true, onChange: ({ page, pageSize }) => { st.attPage = page; st.attSize = pageSize; persistPagerState(); renderRecent(stats); } });
  }

  function renderSessions(stats) {
    const root = document.querySelector("#hist-sessions");
    const elPager = document.querySelector("#hist-sessions-pager");
    if (!root) return;
    const list = stats.sessions || [];
    if (!list.length) { root.innerHTML = `<p class="hint">Nenhuma sessão registrada ainda.</p>`; if (elPager) elPager.innerHTML = ""; return; }

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

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / st.sesSize));
    if (st.sesPage > totalPages) st.sesPage = totalPages;
    if (st.sesPage < 1) st.sesPage = 1;
    const startIdx = (st.sesPage - 1) * st.sesSize;
    const endIdx = Math.min(startIdx + st.sesSize, total);
    const pageItems = list.slice(startIdx, endIdx);

    pageItems.forEach((s) => {
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
    renderPager(elPager, { totalItems: list.length, page: st.sesPage, pageSize: st.sesSize, includePageSize: true, onChange: ({ page, pageSize }) => { st.sesPage = page; st.sesSize = pageSize; persistPagerState(); renderSessions(stats); } });
  }

  async function renderPerQuestion(stats) {
    const root = document.querySelector("#hist-perq");
    const elPager = document.querySelector("#hist-perq-pager");
    if (!root) return;
    const perQ = stats.perQ || {};
    const keys = Object.keys(perQ);
    if (!keys.length) { root.innerHTML = `<p class="hint">Estatísticas por questão aparecerão aqui após você praticar.</p>`; if (elPager) elPager.innerHTML = ""; return; }

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

    const total = keys.length;
    const totalPages = Math.max(1, Math.ceil(total / st.perSize));
    if (st.perPage > totalPages) st.perPage = totalPages;
    if (st.perPage < 1) st.perPage = 1;
    const startIdx = (st.perPage - 1) * st.perSize;
    const endIdx = Math.min(startIdx + st.perSize, total);
    const pageKeys = keys.slice(startIdx, endIdx);

    pageKeys.forEach((qid) => {
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
    renderPager(elPager, { totalItems: keys.length, page: st.perPage, pageSize: st.perSize, includePageSize: true, onChange: ({ page, pageSize }) => { st.perPage = page; st.perSize = pageSize; persistPagerState(); renderPerQuestion(stats); } });
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
    const stats = getStatsSafe();
    if (!stats) return;
    renderCards(stats);
    renderRecent(stats);
    renderSessions(stats);
    await renderPerQuestion(stats);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("#historico")) return;
    // Garante a Store pronta antes do primeiro render
    try { window.Store?.init?.(); } catch (_) {}
    restorePagerState();
    bindActions();
    renderAll();
  });
  window.addEventListener("store:changed", renderAll);
})();