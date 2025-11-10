"use strict";

/* Estado simples para esta fase */
const state = {
  questoes: [],
  filtroTexto: ""
};

const els = {
  busca: null,
  lista: null,
  msg: null,
  toggleTheme: null,
  navLinks: []
};

document.addEventListener("DOMContentLoaded", () => {
  els.busca = document.querySelector("#busca");
  els.lista = document.querySelector("#lista-questoes");
  els.msg = document.querySelector("#msg");
  els.toggleTheme = document.querySelector("#theme-toggle");
  els.navLinks = Array.from(document.querySelectorAll('.nav a'));

  if (els.busca) {
    els.busca.addEventListener("input", (e) => {
      state.filtroTexto = e.target.value || "";
      renderLista();
    });
  }

  // Tema: sincroniza UI e meta theme-color
  initTheme();

  // Navegação: ativa link conforme seção visível
  initActiveNav();

  // Ajusta variável CSS com a altura do header (para scroll-margin-top)
  updateHeaderHeight();
  window.addEventListener("resize", debounce(updateHeaderHeight, 150));

  carregarQuestoes();
});

/* ---------------- Tema ---------------- */

function initTheme() {
  updateThemeUI(); // reflete o estado inicial salvo pelo inline script

  if (els.toggleTheme) {
    els.toggleTheme.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }

  // Se quiser reativar "auto" (sistema), basta salvar "auto" no localStorage
  // e ouvir mudanças do sistema:
  // const m = window.matchMedia("(prefers-color-scheme: dark)");
  // m.addEventListener("change", () => { if (localStorage.getItem("theme")==="auto") syncAutoTheme(); });
}

function setTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {}
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeUI();
}

function updateThemeUI() {
  // Atualiza ícone/label do botão
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
  // Atualiza meta theme-color
  const meta = document.querySelector('#meta-theme-color');
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || "#000000";
    meta.setAttribute("content", bg);
  }
}

/* --------------- Navegação ativa --------------- */

function initActiveNav() {
  if (!('IntersectionObserver' in window)) return; // fallback simples

  const header = document.querySelector(".topbar");
  const offsetTop = (header?.offsetHeight || 56) + 12;

  const map = new Map(); // id -> link
  els.navLinks.forEach(a => {
    const id = (a.getAttribute('href') || "").replace('#', '');
    if (id) map.set(id, a);
  });

  const targets = [
    ...Array.from(document.querySelectorAll("main section[id]")),
    document.querySelector("footer#sobre")
  ].filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const link = map.get(id);
      if (!link) return;

      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        setActiveLink(link, els.navLinks);
      }
    });
  }, {
    root: null,
    rootMargin: `-${offsetTop}px 0px -50% 0px`,
    threshold: [0.5, 0.75]
  });

  targets.forEach(t => observer.observe(t));
}

function setActiveLink(activeLink, allLinks) {
  allLinks.forEach(a => {
    const isActive = a === activeLink;
    a.classList.toggle('active', isActive);
    if (isActive) {
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });
}

/* --------------- Header height -> scroll margin --------------- */

function updateHeaderHeight() {
  const header = document.querySelector(".topbar");
  const h = (header?.offsetHeight || 56);
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}

/* --------------- Carregar e renderizar exercícios --------------- */

async function carregarQuestoes() {
  setMensagem("Carregando exercícios...");
  try {
    const resp = await fetch("data/exercicios.json", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();
    state.questoes = Array.isArray(dados) ? dados : (dados.questoes || []);
    setMensagem(`Carregados ${state.questoes.length} exercícios.`);
    renderLista();
  } catch (err) {
    console.error(err);
    setMensagem(
      "Não foi possível carregar o arquivo JSON. Dica: abra com um servidor local (ex.: Live Server do VS Code) ou use seu deploy no Vercel."
    );
    els.lista.innerHTML = "";
  }
}

function setMensagem(txt) {
  if (els.msg) els.msg.textContent = txt || "";
}

/* Renderiza a lista de cartões das questões */
function renderLista() {
  const q = normalizar(state.filtroTexto);
  const items = state.questoes.filter((it) => {
    if (!q) return true;
    const alvo = normalizar(
      [it.enunciado, it.tema, it.categoria].filter(Boolean).join(" ")
    );
    return alvo.includes(q);
  });

  if (!items.length) {
    els.lista.innerHTML = "";
    setMensagem("Nenhum exercício encontrado para o filtro aplicado.");
    return;
  } else {
    setMensagem(`${items.length} exercício(s) encontrado(s).`);
  }

  const frag = document.createDocumentFragment();

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
    btn.title = "Será habilitado em partes futuras";
    btn.disabled = true;
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

/* Util: debounce */
function debounce(fn, t = 200) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn.apply(this, args), t);
  };
}