"use strict";

/* App com paginação + favoritos + caderno de erros + deep link + highlight + status + coleções */
const state = {
  questoes: [],
  filtroTexto: "",
  filtroCategoria: "all",
  filtroDificuldade: "all",
  viewMode: "all", // all | fav | err
  page: 1,
  pageSize: 12
};

const els = {
  busca: null,
  lista: null,
  msg: null,
  toggleTheme: null,
  navLinks: [],
  fCategoria: null,
  fDificuldade: null,
  fClear: null,
  pagerTop: null,
  pagerBottom: null,
  viewAll: null,
  viewFav: null,
  viewErr: null,
  statusWrap: null,
  statusText: null
};

const STORAGE = { q: "f.q", cat: "f.cat", dif: "f.dif" };
const PAGER = { page: "pg.page", size: "pg.size" };
const VIEW = { mode: "view.mode" };
const OV_KEYS = { data: "pp.data.override", enabled: "pp.data.override.enabled" };

let viewItems = [];

// Status badge
let lastSyncAt = null;
let pendingSync = false;

document.addEventListener("DOMContentLoaded", () => {
  // DOM
  els.busca = document.querySelector("#busca");
  els.lista = document.querySelector("#lista-questoes");
  els.msg = document.querySelector("#msg");
  els.toggleTheme = document.querySelector("#theme-toggle");
  els.navLinks = Array.from(document.querySelectorAll(".nav a"));
  els.fCategoria = document.querySelector("#f-categoria");
  els.fDificuldade = document.querySelector("#f-dificuldade");
  els.fClear = document.querySelector("#f-clear");
  els.pagerTop = document.querySelector("#pager-top");
  els.pagerBottom = document.querySelector("#pager-bottom");
  els.viewAll = document.querySelector("#view-all");
  els.viewFav = document.querySelector("#view-fav");
  els.viewErr = document.querySelector("#view-err");
  els.statusWrap = document.querySelector("#status-badge");
  els.statusText = document.querySelector("#status-badge-text");

  window.Store?.init();

  // Restaura do URL (se houver) ou de localStorage
  const hadUrlParams = restoreFromUrl();
  if (!hadUrlParams) {
    restoreFilters();
    restorePager();
    restoreViewMode();
    syncControlsToState();
    updateUrl(false); // normaliza URL inicial sem poluir histórico
  }

  // Busca
  if (els.busca) {
    els.busca.value = state.filtroTexto;
    els.busca.addEventListener("input", (e) => {
      state.filtroTexto = e.target.value || "";
      persist("q", state.filtroTexto);
      resetToFirstPage();
      renderLista();
      updateUrl(false); // replaceState durante digitação
    });
    els.busca.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        state.filtroTexto = "";
        els.busca.value = "";
        persist("q", "");
        resetToFirstPage();
        renderLista();
        updateUrl(true);
      }
    });
  }

  // Filtros
  if (els.fCategoria) {
    els.fCategoria.addEventListener("change", () => {
      state.filtroCategoria = els.fCategoria.value || "all";
      persist("cat", state.filtroCategoria);
      resetToFirstPage();
      renderLista();
      updateUrl(true);
    });
  }
  if (els.fDificuldade) {
    els.fDificuldade.addEventListener("change", () => {
      state.filtroDificuldade = els.fDificuldade.value || "all";
      persist("dif", state.filtroDificuldade);
      resetToFirstPage();
      renderLista();
      updateUrl(true);
    });
  }
  if (els.fClear) {
    els.fClear.addEventListener("click", () => {
      clearFilters();
      resetToFirstPage();
      renderLista();
      activateViewChip("all");
      updateUrl(true);
    });
  }

  // Chips de visão
  els.viewAll?.addEventListener("click", () => { setViewMode("all"); updateUrl(true); });
  els.viewFav?.addEventListener("click", () => { setViewMode("fav"); updateUrl(true); });
  els.viewErr?.addEventListener("click", () => { setViewMode("err"); updateUrl(true); });

  // Tema + navegação + layout
  initTheme();
  initActiveNav();
  updateHeaderHeight();
  window.addEventListener("resize", debounce(updateHeaderHeight, 150));

  window.Player?.init();

  // Dados
  carregarQuestoes();

  window.addEventListener("dataset:override-changed", () => {
    carregarQuestoes();
  });

  // Mudanças no store (favoritos, coleções, etc) => re-render (não altera URL)
  window.addEventListener("store:changed", (ev) => {
    if (ev?.detail?.type === "favorites") renderLista();
    if (ev?.detail?.type === "collections") {
      // atualizações no grid são feitas pelo collections.js; aqui, só re-render da lista se necessário
    }
    // alterações locais => pendente de sync (se logado)
    if (window.Auth?.getUser?.()) {
      pendingSync = true;
      updateStatusBadge();
    }
  });

  // Deep link: volta/avança do navegador
  window.addEventListener("popstate", () => {
    restoreFromUrl(true);
    syncControlsToState();
    renderLista();
  });

  // Status topo: online/offline + sync
  window.addEventListener("online", updateStatusBadge);
  window.addEventListener("offline", updateStatusBadge);
  window.addEventListener("sync:status", (ev) => {
    lastSyncAt = Date.now();
    pendingSync = false;
    updateStatusBadge();
  });
  // Estado inicial do badge
  updateStatusBadge();
});

/* ================== Tema ================== */
function initTheme() {
  updateThemeUI();
  if (els.toggleTheme) {
    els.toggleTheme.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }
}
function setTheme(theme) {
  try { localStorage.setItem("theme", theme); } catch (e) { }
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeUI();
}
function updateThemeUI() {
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  const isDark = theme === "dark";
  if (els.toggleTheme) {
    const icon = els.toggleTheme.querySelector(".theme-icon");
    if (icon) icon.textContent = isDark ? "🌙" : "☀️";
    els.toggleTheme.setAttribute("aria-label", isDark ? "Usando tema escuro. Alternar para claro." : "Usando tema claro. Alternar para escuro.");
  }
  const meta = document.querySelector("#meta-theme-color");
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#000000";
    meta.setAttribute("content", bg);
  }
}

/* =========== Navegação ativa / Header height =========== */
function initActiveNav() {
  if (!("IntersectionObserver" in window)) return;
  const header = document.querySelector(".topbar");
  const offsetTop = (header?.offsetHeight || 56) + 12;
  const map = new Map();
  els.navLinks.forEach((a) => {
    const id = (a.getAttribute("href") || "").replace("#", "");
    if (id) map.set(id, a);
  });
  const targets = [
    ...Array.from(document.querySelectorAll("main section[id]")),
    document.querySelector("footer#sobre")
  ].filter(Boolean);
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute("id");
        const link = map.get(id);
        if (!link) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          setActiveLink(link, els.navLinks);
        }
      });
    },
    { root: null, rootMargin: `-${offsetTop}px 0px -50% 0px`, threshold: [0.5, 0.75] }
  );
  targets.forEach((t) => observer.observe(t));
}
function setActiveLink(activeLink, allLinks) {
  allLinks.forEach((a) => {
    const isActive = a === activeLink;
    a.classList.toggle("active", isActive);
    if (isActive) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
function updateHeaderHeight() {
  const header = document.querySelector(".topbar");
  const h = header?.offsetHeight || 56;
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}

/* ================== Override local ================== */
function readOverrideList() {
  try {
    const enabled = localStorage.getItem(OV_KEYS.enabled) === "1";
    if (!enabled) return null;
    const raw = localStorage.getItem(OV_KEYS.data);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.questoes)) return parsed.questoes;
    return null;
  } catch { return null; }
}

/* ================== Dados / Filtros + Paginação ================== */
async function carregarQuestoes() {
  const ov = readOverrideList();
  if (ov && Array.isArray(ov)) {
    state.questoes = ov;
    setMensagem(`Usando conjunto local (override) com ${state.questoes.length} exercício(s).`);
    popularFiltros(state.questoes);
    resetToFirstPage();
    renderLista();
    dispatchDatasetReady(); // evento para outros módulos (ex.: coleções)
    return;
  }

  setMensagem("Carregando exercícios do servidor...");
  try {
    const resp = await fetch("data/exercicios.json", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();
    state.questoes = Array.isArray(dados) ? dados : dados.questoes || [];
    setMensagem(`Carregados ${state.questoes.length} exercícios do servidor.`);
    popularFiltros(state.questoes);
    resetToFirstPage();
    renderLista();
    dispatchDatasetReady(); // evento para outros módulos (ex.: coleções)
  } catch (err) {
    console.error(err);
    els.lista.innerHTML = renderEmptyState(
      "Não foi possível carregar os exercícios",
      "Você pode usar o Editor para aplicar um override local e testar o site."
    );
    setMensagem("Falha ao carregar o arquivo JSON.");
    clearPagers();
    dispatchDatasetReady(true); // sinaliza erro
  }
}

function popularFiltros(questoes) {
  if (!Array.isArray(questoes) || !questoes.length) return;
  const categorias = unique(questoes.map((q) => q.categoria).filter(Boolean))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const dificuldades = unique(questoes.map((q) => q.dificuldade).filter(Boolean))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (els.fCategoria) {
    replaceOptions(els.fCategoria, ["all", ...categorias], (v) => v === "all" ? "Todas as categorias" : v);
    safeSetSelectValue(els.fCategoria, state.filtroCategoria);
  }
  if (els.fDificuldade) {
    replaceOptions(els.fDificuldade, ["all", ...dificuldades], (v) => v === "all" ? "Todas as dificuldades" : v);
    safeSetSelectValue(els.fDificuldade, state.filtroDificuldade);
  }
}

function renderLista() {
  const filtered = applyFilters(state.questoes);
  const total = filtered.length;

  if (!total) {
    els.lista.innerHTML = renderEmptyState(
      state.viewMode === "fav" ? "Nenhum favorito ainda" :
        state.viewMode === "err" ? "Nenhum erro registrado" :
          "Nenhum exercício encontrado",
      state.viewMode === "fav" ? "Marque ⭐ nos cards para salvar seus favoritos." :
        state.viewMode === "err" ? "Ao errar questões, elas aparecem aqui para revisão." :
          "Tente remover filtros, ajustar a busca ou revisar a categoria."
    );
    setMensagem("Nenhum exercício encontrado para o filtro aplicado.");
    clearPagers();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const start = (state.page - 1) * state.pageSize;
  const end = Math.min(start + state.pageSize, total);
  const pageItems = filtered.slice(start, end);
  viewItems = pageItems;

  setMensagem(`Encontrados ${total} exercício(s). Exibindo ${start + 1}–${end}. Página ${state.page} de ${totalPages}.`);

  const frag = document.createDocumentFragment();
  const tiposSuportados = new Set(["multipla_escolha", "lacuna", "verdadeiro_falso"]);
  const q = state.filtroTexto;

  pageItems.forEach((it, idx) => {
    const card = document.createElement("article");
    card.className = "card";

    // Botão favorito
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "fav-btn";
    favBtn.title = "Favoritar questão";
    favBtn.setAttribute("aria-label", "Favoritar questão");
    const favIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    favIcon.setAttribute("class", "icon");
    const favUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
    favUse.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#i-info");
    favIcon.appendChild(favUse);
    favBtn.appendChild(favIcon);
    const favTxt = document.createElement("span");
    favTxt.textContent = "⭐";
    favBtn.appendChild(favTxt);

    const on = window.Store?.isFavorite?.(it.id);
    if (on) favBtn.classList.add("is-on");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.Store?.toggleFavorite?.(it.id);
      const nowOn = window.Store?.isFavorite?.(it.id);
      favBtn.classList.toggle("is-on", !!nowOn);
      if (state.viewMode === "fav") renderLista();
    });
    card.appendChild(favBtn);

    const tags = document.createElement("div");
    tags.className = "tags";

    const tagCat = document.createElement("span");
    tagCat.className = "tag primary";
    tagCat.textContent = it.categoria || "Categoria";
    tags.appendChild(tagCat);

    const tagDif = document.createElement("span");
    tagDif.className = "tag warn";
    tagDif.textContent = (it.dificuldade || "médio").toLowerCase();
    tags.appendChild(tagDif);

    const tagTipo = document.createElement("span");
    tagTipo.className = "tag ok";
    tagTipo.textContent = tipoLabel(it.tipo);
    tags.appendChild(tagTipo);

    const h3 = document.createElement("h3");
    h3.textContent = `Questão ${it.id ?? (start + idx + 1)} — ${it.tema || "Português"}`;

    const p = document.createElement("p");
    p.innerHTML = highlightText(it.enunciado, q, 160);

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnStart = document.createElement("button");
    btnStart.className = "button primary";
    btnStart.textContent = "Responder";
    btnStart.setAttribute("aria-label", `Responder questão ${it.id} — ${it.tema || it.categoria || "Português"}`);
    const isSupported = tiposSuportados.has((it.tipo || "").toLowerCase());
    btnStart.disabled = !isSupported;
    btnStart.title = isSupported ? "Responder questão" : "Tipo ainda não suportado";
    if (isSupported) {
      btnStart.addEventListener("click", (ev) => {
        window.Player?.startSequence(viewItems, idx, ev.currentTarget, {
          filters: { q: state.filtroTexto, cat: state.filtroCategoria, dif: state.filtroDificuldade }
        });
      });
    }

    const btnCol = document.createElement("button");
    btnCol.className = "button";
    btnCol.title = "Adicionar à coleção";
    btnCol.innerHTML = `<svg class="icon"><use href="#i-list"/></svg> Coleções`;
    btnCol.addEventListener("click", (ev) => {
      ev.stopPropagation();
      window.Collections?.openPicker?.(it);
    });

    actions.appendChild(btnStart);
    actions.appendChild(btnCol);

    card.appendChild(tags);
    card.appendChild(h3);
    card.appendChild(p);
    card.appendChild(actions);

    frag.appendChild(card);
  });

  els.lista.innerHTML = "";
  els.lista.appendChild(frag);

  renderPager(els.pagerTop, { totalItems: total, page: state.page, pageSize: state.pageSize, includePageSize: true });
  renderPager(els.pagerBottom, { totalItems: total, page: state.page, pageSize: state.pageSize, includePageSize: false });
}

/* ================== Paginação ================== */
function clearPagers() {
  if (els.pagerTop) els.pagerTop.innerHTML = "";
  if (els.pagerBottom) els.pagerBottom.innerHTML = "";
}
function renderPager(root, { totalItems, page, pageSize, includePageSize }) {
  if (!root) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  root.innerHTML = "";

  const summary = document.createElement("div");
  summary.className = "pager__summary";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  summary.textContent = `Exibindo ${start}–${end} de ${totalItems}`;

  const nav = document.createElement("div");
  nav.className = "pager__nav";
  nav.setAttribute("role", "navigation");
  nav.setAttribute("aria-label", "Paginação");

  const makeBtn = (label, targetPage, disabled, active, title, aria) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pager__btn";
    if (active) b.classList.add("is-active");
    if (disabled) b.disabled = true;
    b.textContent = label;
    if (title) b.title = title;
    b.setAttribute("aria-label", aria || label);
    if (active) b.setAttribute("aria-current", "page");
    b.addEventListener("click", () => {
      if (disabled || targetPage === state.page) return;
      state.page = targetPage;
      persistPager();
      renderLista();
      updateUrl(true);
      document.querySelector(".lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return b;
  };

  nav.appendChild(makeBtn("«", 1, page <= 1, false, "Primeira página", "Primeira página"));
  nav.appendChild(makeBtn("‹", Math.max(1, page - 1), page <= 1, false, "Página anterior", "Página anterior"));

  pageList(page, totalPages).forEach((it) => {
    if (it === "...") {
      const span = document.createElement("span");
      span.className = "pager__ellipsis";
      span.textContent = "…";
      nav.appendChild(span);
    } else {
      nav.appendChild(makeBtn(String(it), it, false, it === page, `Página ${it}`, `Página ${it}`));
    }
  });

  nav.appendChild(makeBtn("›", Math.min(totalPages, page + 1), page >= totalPages, false, "Próxima página", "Próxima página"));
  nav.appendChild(makeBtn("»", totalPages, page >= totalPages, false, "Última página", "Última página"));

  if (includePageSize) {
    const sizeWrap = document.createElement("div");
    sizeWrap.className = "pager__size";
    const lab = document.createElement("label");
    lab.textContent = "Itens por página:";
    lab.setAttribute("for", "pager-size");
    const sel = document.createElement("select");
    sel.id = "pager-size";
    [8, 12, 16, 24, 32, 48].forEach((n) => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === state.pageSize) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      const n = parseInt(sel.value, 10) || 12;
      state.pageSize = Math.max(1, n);
      state.page = 1;
      persistPager();
      renderLista();
      updateUrl(true);
    });
    root.appendChild(summary);
    root.appendChild(nav);
    root.appendChild(sizeWrap);
    sizeWrap.appendChild(lab);
    sizeWrap.appendChild(sel);
  } else {
    root.appendChild(summary);
    root.appendChild(nav);
  }
}
function pageList(current, total) {
  const delta = 2;
  const range = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }
  const result = [];
  let prev = 0;
  for (const n of range) {
    if (prev) {
      if (n - prev === 2) result.push(prev + 1);
      else if (n - prev > 2) result.push("...");
    }
    result.push(n);
    prev = n;
  }
  return result;
}
function resetToFirstPage() { state.page = 1; persistPager(); }
function persistPager() {
  try {
    localStorage.setItem(PAGER.page, String(state.page));
    localStorage.setItem(PAGER.size, String(state.pageSize));
  } catch (e) { }
}
function restorePager() {
  try {
    const p = parseInt(localStorage.getItem(PAGER.page) || "1", 10);
    const s = parseInt(localStorage.getItem(PAGER.size) || "12", 10);
    state.page = isFinite(p) && p > 0 ? p : 1;
    state.pageSize = isFinite(s) && s > 0 ? s : 12;
  } catch (e) {
    state.page = 1;
    state.pageSize = 12;
  }
}

/* ================== Visão (Todos/Favoritos/Erros) ================== */
function setViewMode(mode) {
  state.viewMode = mode;
  try { localStorage.setItem(VIEW.mode, mode); } catch (e) { }
  activateViewChip(mode);
  resetToFirstPage();
  renderLista();
}
function restoreViewMode() {
  try { state.viewMode = localStorage.getItem(VIEW.mode) || "all"; } catch (e) { state.viewMode = "all"; }
  activateViewChip(state.viewMode);
}
function activateViewChip(mode) {
  els.viewAll?.classList.toggle("is-active", mode === "all");
  els.viewFav?.classList.toggle("is-active", mode === "fav");
  els.viewErr?.classList.toggle("is-active", mode === "err");
}

/* ================== Deep Link (URL <-> state) ================== */
function updateUrl(push = true) {
  const params = new URLSearchParams();
  if (state.filtroTexto) params.set("q", state.filtroTexto);
  if (state.filtroCategoria && state.filtroCategoria !== "all") params.set("cat", state.filtroCategoria);
  if (state.filtroDificuldade && state.filtroDificuldade !== "all") params.set("dif", state.filtroDificuldade);
  if (state.viewMode && state.viewMode !== "all") params.set("view", state.viewMode);
  if (state.page && state.page !== 1) params.set("p", String(state.page));
  if (state.pageSize && state.pageSize !== 12) params.set("ps", String(state.pageSize));

  const newUrl = `${location.pathname}${params.toString() ? "?" + params.toString() : ""}${location.hash || ""}`;
  const stObj = { ...state };
  try {
    if (push) history.pushState(stObj, "", newUrl);
    else history.replaceState(stObj, "", newUrl);
  } catch { }
}

function restoreFromUrl(applyOnly = false) {
  try {
    const sp = new URLSearchParams(location.search);
    const hasAny = ["q", "cat", "dif", "p", "ps", "view"].some(k => sp.has(k));
    if (!hasAny) return false;

    state.filtroTexto = sp.get("q") || "";
    state.filtroCategoria = sp.get("cat") || "all";
    state.filtroDificuldade = sp.get("dif") || "all";
    state.viewMode = sp.get("view") || "all";
    const p = parseInt(sp.get("p") || "1", 10); state.page = isFinite(p) && p > 0 ? p : 1;
    const ps = parseInt(sp.get("ps") || "12", 10); state.pageSize = isFinite(ps) && ps > 0 ? ps : 12;

    // persiste também em localStorage para consistência
    persist("q", state.filtroTexto);
    persist("cat", state.filtroCategoria);
    persist("dif", state.filtroDificuldade);
    try { localStorage.setItem(PAGER.page, String(state.page)); } catch { }
    try { localStorage.setItem(PAGER.size, String(state.pageSize)); } catch { }
    try { localStorage.setItem(VIEW.mode, state.viewMode); } catch { }

    if (!applyOnly) syncControlsToState();
    activateViewChip(state.viewMode);
    return true;
  } catch { return false; }
}

function syncControlsToState() {
  if (els.busca) els.busca.value = state.filtroTexto || "";
  if (els.fCategoria) safeSetSelectValue(els.fCategoria, state.filtroCategoria);
  if (els.fDificuldade) safeSetSelectValue(els.fDificuldade, state.filtroDificuldade);
}

/* ================== Filtros / Utils ================== */
function applyFilters(lista) {
  const q = normalizar(state.filtroTexto);
  const cat = state.filtroCategoria;
  const dif = state.filtroDificuldade;

  const favSet = new Set((window.Store?.getFavorites?.() || []).map(String));
  const perQ = (window.Store?.getStats?.() || {}).perQ || {};

  return lista.filter((it) => {
    if (q) {
      const alvo = normalizar([it.enunciado, it.tema, it.categoria, it.texto_base].filter(Boolean).join(" "));
      if (!alvo.includes(q)) return false;
    }
    if (cat && cat !== "all") {
      if (normalizar(it.categoria) !== normalizar(cat)) return false;
    }
    if (dif && dif !== "all") {
      if (normalizar(it.dificuldade) !== normalizar(dif)) return false;
    }
    if (state.viewMode === "fav") {
      if (!favSet.has(String(it.id))) return false;
    } else if (state.viewMode === "err") {
      const pq = perQ[String(it.id)];
      if (!pq || pq.lastCorrect !== false) return false;
    }
    return true;
  });
}
function setMensagem(txt) { if (els.msg) els.msg.textContent = txt || ""; }

function tipoLabel(tipo) {
  switch ((tipo || "").toLowerCase()) {
    case "multipla_escolha": return "Múltipla escolha";
    case "lacuna": return "Lacuna";
    case "verdadeiro_falso": return "Verdadeiro ou Falso";
    default: return "Exercício";
  }
}
function resumo(txt, n = 140) {
  if (!txt) return "";
  const s = String(txt);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* Destaque do termo buscado (acentos ignorados) */
function highlightText(original, q, maxLen = 160) {
  if (!original) return "";
  const text = String(original);
  if (!q) return escapeHTML(resumo(text, maxLen));

  const normText = stripAccents(text).toLowerCase();
  const normQ = stripAccents(String(q)).toLowerCase().trim();
  if (!normQ) return escapeHTML(resumo(text, maxLen));

  const idxs = [];
  let start = 0;
  while (true) {
    const i = normText.indexOf(normQ, start);
    if (i === -1) break;
    idxs.push(i);
    start = i + normQ.length;
    if (idxs.length > 10) break;
  }
  if (!idxs.length) return escapeHTML(resumo(text, maxLen));

  // Limita tamanho e preserva marcação dentro do recorte
  const snippet = text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
  const normSnippet = stripAccents(snippet).toLowerCase();

  // Recalcula indices dentro do snippet
  const offsets = [];
  let sPos = 0;
  while (true) {
    const i = normSnippet.indexOf(normQ, sPos);
    if (i === -1) break;
    offsets.push(i);
    sPos = i + normQ.length;
    if (offsets.length > 10) break;
  }

  if (!offsets.length) return escapeHTML(snippet);

  let out = "";
  let last = 0;
  offsets.forEach((pos) => {
    out += escapeHTML(snippet.slice(last, pos));
    out += "<mark>" + escapeHTML(snippet.slice(pos, pos + normQ.length)) + "</mark>";
    last = pos + normQ.length;
  });
  out += escapeHTML(snippet.slice(last));
  return out;
}

function stripAccents(s) { return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function escapeHTML(s) { return (s || "").toString().replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function normalizar(s) {
  return stripAccents((s || "").toString()).toLowerCase().trim();
}
function unique(arr) { return Array.from(new Set(arr)); }
function replaceOptions(selectEl, values, labelFn = (v) => v) {
  const frag = document.createDocumentFragment();
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = labelFn(v);
    frag.appendChild(opt);
  });
  selectEl.innerHTML = "";
  selectEl.appendChild(frag);
}
function safeSetSelectValue(selectEl, value, fallback = "all") {
  const exists = Array.from(selectEl.options).some((o) => o.value === value);
  selectEl.value = exists ? value : fallback;
  if (!exists && value !== fallback) {
    if (selectEl === els.fCategoria) state.filtroCategoria = fallback;
    if (selectEl === els.fDificuldade) state.filtroDificuldade = fallback;
  }
}
function persist(key, value) {
  try { localStorage.setItem(STORAGE[key], value); } catch (e) { }
}
function restoreFilters() {
  try {
    state.filtroTexto = localStorage.getItem(STORAGE.q) || "";
    state.filtroCategoria = localStorage.getItem(STORAGE.cat) || "all";
    state.filtroDificuldade = localStorage.getItem(STORAGE.dif) || "all";
  } catch (e) {
    state.filtroTexto = ""; state.filtroCategoria = "all"; state.filtroDificuldade = "all";
  }
}
function clearFilters() {
  state.filtroTexto = ""; state.filtroCategoria = "all"; state.filtroDificuldade = "all";
  if (els.busca) els.busca.value = ""; if (els.fCategoria) els.fCategoria.value = "all"; if (els.fDificuldade) els.fDificuldade.value = "all";
  persist("q", ""); persist("cat", "all"); persist("dif", "all");
}
function debounce(fn, t = 200) { let id; return (...args) => { clearTimeout(id); id = setTimeout(() => fn.apply(this, args), t); }; }

/* Empty state */
function renderEmptyState(title, text) {
  return `
    <div class="empty">
      <svg class="empty__art" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs><linearGradient id="e1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(106,166,255,.5)"/><stop offset="100%" stop-color="rgba(255,224,138,.4)"/></linearGradient></defs>
        <ellipse cx="100" cy="100" rx="70" ry="12" fill="rgba(0,0,0,.18)"/>
        <path d="M40 90c30-40 90-40 120 0-40 20-80 20-120 0z" fill="url(#e1)"/>
        <circle cx="80" cy="70" r="10" fill="url(#e1)"/><circle cx="120" cy="60" r="14" fill="url(#e1)"/>
      </svg>
      <div class="empty__title">${title}</div>
      <div class="empty__text">${text}</div>
    </div>
  `;
}

/* ===== Status badge (topbar) ===== */
function updateStatusBadge() {
  if (!els.statusWrap || !els.statusText) return;
  const isOnline = navigator.onLine;
  const user = window.Auth?.getUser?.();
  const classes = ["status-badge", "is-local"];

  let text = "Local";
  if (!isOnline) {
    classes.push("is-offline");
    text = "Offline";
  } else if (user) {
    if (pendingSync) {
      classes.push("is-sync");
      text = "Sync pendente";
    } else if (lastSyncAt) {
      classes.push("is-online");
      text = `Sincronizado • há ${timeAgo(lastSyncAt)}`;
    } else {
      classes.push("is-online");
      text = "Online";
    }
  } else {
    classes.push("is-local");
    text = "Local";
  }

  els.statusWrap.className = classes.join(" ");
  els.statusText.textContent = text;
}
function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

/* Dispara evento global quando o dataset estiver pronto */
function dispatchDatasetReady(isError = false) {
  try {
    window.dispatchEvent(new CustomEvent("app:data-ready", {
      detail: { total: state.questoes?.length || 0, error: !!isError }
    }));
  } catch { }
}

/* Expor itens filtrados e dataset completo (para Coleções/Simulado) */
window.App = {
  getFilteredItems: () => applyFilters(state.questoes),
  getAllItems: () => state.questoes.slice()
};