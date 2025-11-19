"use strict";

/*
  Range Viewer — Exibe itens por intervalo de ID
  - Valida entradas numéricas e corrige intervalos invertidos
  - Usa o dataset carregado pelo app; faz fetch como fallback
  - Renderiza de forma eficiente (DocumentFragment) e responsiva
*/
(function () {
  let dataset = [];
  let ready = false;

  const els = {
    start: null,
    end: null,
    btn: null,
    msg: null,
    out: null
  };

  // Obtém dataset do app ou faz fetch direto
  async function ensureData() {
    if (dataset && dataset.length) return dataset;
    try {
      const src = window.App?.getAllItems?.();
      if (Array.isArray(src) && src.length) { dataset = src.slice(); ready = true; return dataset; }
    } catch (_) { /* fallback abaixo */ }
    try {
      const resp = await fetch("data/exercicios.json", { cache: "no-store" });
      const data = await resp.json();
      dataset = Array.isArray(data) ? data : (data.questoes || []);
      ready = true; return dataset;
    } catch (e) {
      setMsg("Falha ao carregar o dataset.");
      return [];
    }
  }

  function setMsg(text, type = "info") {
    if (!els.msg) return;
    els.msg.textContent = text || "";
    els.msg.className = `msg ${type}`;
  }

  function parseIntSafe(v) {
    const n = parseInt(String(v || "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  // Validação dos campos e normalização do intervalo
  function validateInputs() {
    const s = parseIntSafe(els.start?.value);
    const e = parseIntSafe(els.end?.value);
    if (s === null || e === null) {
      setMsg("Preencha IDs numéricos válidos.", "error");
      return null;
    }
    if (s <= 0 || e <= 0) {
      setMsg("IDs devem ser números positivos.", "error");
      return null;
    }
    if (s === e) {
      setMsg("Intervalo de um único ID.", "info");
    }
    if (s > e) {
      // Corrige intervalo invertido
      setMsg("Intervalo invertido detectado. Corrigindo automaticamente.", "info");
      return { start: e, end: s };
    }
    return { start: s, end: e };
  }

  // Renderização eficiente dos itens selecionados
  function renderItems(items) {
    if (!els.out) return;
    const frag = document.createDocumentFragment();
    const count = document.createElement("p");
    count.className = "hint";
    count.textContent = `Exibindo ${items.length} item(ns).`;
    frag.appendChild(count);

    const ul = document.createElement("ul");
    ul.className = "options";
    items.forEach((q) => {
      const li = document.createElement("li");
      li.className = "option range-item";

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.gap = ".6rem";
      header.style.alignItems = "center";

      const id = document.createElement("span");
      id.style.minWidth = "4rem";
      id.textContent = `Q${q.id}`;

      const meta = document.createElement("span");
      meta.textContent = `${q.tema || q.categoria || "Português"} • ${q.tipo?.replace("_"," ") || "—"} • ${q.dificuldade || "—"}`;

      header.appendChild(id); header.appendChild(meta);
      li.appendChild(header);

      if (q.texto_base) {
        const block = document.createElement("blockquote");
        block.className = "texto-base";
        block.textContent = q.texto_base;
        li.appendChild(block);
      }

      const enun = document.createElement("div");
      enun.className = "enunciado";
      enun.textContent = q.enunciado || "";
      li.appendChild(enun);

      frag.appendChild(li);
    });
    ul.appendChild(frag);
    els.out.innerHTML = "";
    els.out.appendChild(ul);
  }

  async function onShowClick() {
    const range = validateInputs();
    if (!range) return;
    const data = await ensureData();
    if (!data.length) { setMsg("Nenhum dado disponível.", "error"); return; }

    // Filtra por id dentro do intervalo (O(n)) — eficiente para datasets médios
    const selected = data.filter((q) => {
      const id = (typeof q.id === "number") ? q.id : parseIntSafe(q.id);
      return Number.isFinite(id) && id >= range.start && id <= range.end;
    });
    if (!selected.length) {
      setMsg("Nenhum item encontrado no intervalo especificado.", "info");
      els.out.innerHTML = "";
      return;
    }
    setMsg(ready ? "Itens carregados do app." : "Itens carregados do servidor.", "success");
    renderItems(selected);
  }

  function bind() {
    els.start = document.querySelector("#range-start");
    els.end = document.querySelector("#range-end");
    els.btn = document.querySelector("#range-btn");
    els.msg = document.querySelector("#range-msg");
    els.out = document.querySelector("#range-output");
    if (!els.start || !els.end || !els.btn || !els.out) return;
    els.btn.addEventListener("click", onShowClick);
  }

  // Escuta o evento do app para saber quando o dataset estiver pronto
  window.addEventListener("app:data-ready", (ev) => {
    ready = !ev?.detail?.error;
    try { dataset = window.App?.getAllItems?.() || dataset; } catch (_) { }
  });

  document.addEventListener("DOMContentLoaded", bind);
})();