"use strict";

/* ================== Estado ================== */
const state = {
  questoes: [],
  filtroTexto: "",
  filtroCategoria: "all",
  filtroDificuldade: "all"
};

const els = {
  busca: null,
  lista: null,
  msg: null,
  toggleTheme: null,
  navLinks: [],
  fCategoria: null,
  fDificuldade: null,
  fClear: null
};

const STORAGE = {
  q: "f.q",
  cat: "f.cat",
  dif: "f.dif"
};

// Lista corrente (após filtros) — usada para sequência
let viewItems = [];

/* ================== Init ================== */
document.addEventListener("DOMContentLoaded", () => {
  // Base
  els.busca = document.querySelector("#busca");
  els.lista = document.querySelector("#lista-questoes");
  els.msg = document.querySelector("#msg");
  els.toggleTheme = document.querySelector("#theme-toggle");
  els.navLinks = Array.from(document.querySelectorAll(".nav a"));
  els.fCategoria = document.querySelector("#f-categoria");
  els.fDificuldade = document.querySelector("#f-dificuldade");
  els.fClear = document.querySelector("#f-clear");

  // Store
  window.Store?.init();

  /* Restaura filtros e busca */
  restoreFilters();

  // Busca
  if (els.busca) {
    els.busca.value = state.filtroTexto;
    els.busca.addEventListener("input", (e) => {
      state.filtroTexto = e.target.value || "";
      persist("q", state.filtroTexto);
      renderLista();
    });
    els.busca.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        state.filtroTexto = "";
        els.busca.value = "";
        persist("q", "");
        renderLista();
      }
    });
  }

  // Filtros
  if (els.fCategoria) {
    els.fCategoria.addEventListener("change", () => {
      state.filtroCategoria = els.fCategoria.value || "all";
      persist("cat", state.filtroCategoria);
      renderLista();
    });
  }
  if (els.fDificuldade) {
    els.fDificuldade.addEventListener("change", () => {
      state.filtroDificuldade = els.fDificuldade.value || "all";
      persist("dif", state.filtroDificuldade);
      renderLista();
    });
  }
  if (els.fClear) {
    els.fClear.addEventListener("click", () => {
      clearFilters();
      renderLista();
    });
  }

  // Tema
  initTheme();

  // Navegação ativa
  initActiveNav();

  // Altura do header -> scroll-margin-top
  updateHeaderHeight();
  window.addEventListener("resize", debounce(updateHeaderHeight, 150));

  // Player
  window.Player?.init();

  // Dados
  carregarQuestoes();
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
  try { localStorage.setItem("theme", theme); } catch (e) {}
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeUI();
}
function updateThemeUI() {
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  const isDark = theme === "dark";
  if (els.toggleTheme) {
    const icon = els.toggleTheme.querySelector(".theme-icon");
    if (icon) icon.textContent = isDark ? "🌙" : "☀️";
    els.toggleTheme.setAttribute(
      "aria-label",
      isDark ? "Usando tema escuro. Alternar para claro." : "Usando tema claro. Alternar para escuro."
    );
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

  const map = new Map(); // id -> link
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

/* ================== Dados / Filtros ================== */
async function carregarQuestoes() {
  setMensagem("Carregando exercícios...");
  try {
    const resp = await fetch("data/exercicios.json", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();
    state.questoes = Array.isArray(dados) ? dados : dados.questoes || [];
    setMensagem(`Carregados ${state.questoes.length} exercícios.`);
    popularFiltros(state.questoes);
    renderLista();
  } catch (err) {
    console.error(err);
    setMensagem("Não foi possível carregar o arquivo JSON. Dica: abra localmente (Live Server) ou use seu deploy no Vercel.");
    els.lista.innerHTML = "";
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
  const items = applyFilters(state.questoes);
  viewItems = items;

  if (!items.length) {
    els.lista.innerHTML = "";
    setMensagem("Nenhum exercício encontrado para o filtro aplicado.");
    return;
  } else {
    setMensagem(`${items.length} exercício(s) encontrado(s).`);
  }

  const frag = document.createDocumentFragment();
  const tiposSuportados = new Set(["multipla_escolha", "lacuna", "verdadeiro_falso"]);

  items.forEach((it, idx) => {
    const card = document.createElement("article");
    card.className = "card";

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
    h3.textContent = `Questão ${it.id ?? idx + 1} — ${it.tema || "Português"}`;

    const p = document.createElement("p");
    p.textContent = resumo(it.enunciado, 160);

    const actions = document.createElement("div");
    actions.className = "actions";
    const btn = document.createElement("button");
    btn.className = "button primary";
    btn.textContent = "Responder";
    btn.setAttribute("aria-label", `Responder questão ${it.id} — ${it.tema || it.categoria || "Português"}`);

    const isSupported = tiposSuportados.has((it.tipo || "").toLowerCase());
    btn.disabled = !isSupported;
    btn.title = isSupported ? "Responder questão" : "Tipo ainda não suportado";
    if (isSupported) {
      btn.addEventListener("click", (ev) => {
        window.Player?.startSequence(viewItems, idx, ev.currentTarget, {
          filters: { q: state.filtroTexto, cat: state.filtroCategoria, dif: state.filtroDificuldade }
        });
      });
    }
    actions.appendChild(btn);

    card.appendChild(tags);
    card.appendChild(h3);
    card.appendChild(p);
    card.appendChild(actions);

    frag.appendChild(card);
  });

  els.lista.innerHTML = "";
  els.lista.appendChild(frag);
}
function applyFilters(lista) {
  const q = normalizar(state.filtroTexto);
  const cat = state.filtroCategoria;
  const dif = state.filtroDificuldade;

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
    return true;
  });
}
function setMensagem(txt) { if (els.msg) els.msg.textContent = txt || ""; }

/* ================== Utils ================== */
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
function normalizar(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function unique(arr) { return Array.from(new Set(arr)); }
function replaceOptions(selectEl, values, labelFn = (v) => v) {
  const frag = document.createDocumentFragment();
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = labelFn(v);
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
  try { localStorage.setItem(STORAGE[key], value); } catch (e) {}
}
function restoreFilters() {
  try {
    state.filtroTexto = localStorage.getItem(STORAGE.q) || "";
    state.filtroCategoria = localStorage.getItem(STORAGE.cat) || "all";
    state.filtroDificuldade = localStorage.getItem(STORAGE.dif) || "all";
  } catch (e) {
    state.filtroTexto = "";
    state.filtroCategoria = "all";
    state.filtroDificuldade = "all";
  }
}
function clearFilters() {
  state.filtroTexto = "";
  state.filtroCategoria = "all";
  state.filtroDificuldade = "all";

  if (els.busca) els.busca.value = "";
  if (els.fCategoria) els.fCategoria.value = "all";
  if (els.fDificuldade) els.fDificuldade.value = "all";

  persist("q", "");
  persist("cat", "all");
  persist("dif", "all");
}
function debounce(fn, t = 200) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn.apply(this, args), t);
  };
}