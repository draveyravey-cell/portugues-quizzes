"use strict";

/*
  Range Viewer — Exibe itens por intervalo de ID
  - Valida entradas numéricas e corrige intervalos invertidos
  - Usa o dataset carregado pelo app; faz fetch como fallback
  - Renderiza de forma eficiente (DocumentFragment) e responsiva
*/
(function () {
  let ready = false;

  const els = {
    start: null,
    end: null,
    btn: null,
    msg: null,
    out: null
  };

  // Garante que há dados carregados (App ou servidor)
  async function ensureReady() {
    try {
      const arr = window.App?.getAllItems?.() || [];
      if (Array.isArray(arr) && arr.length) { ready = true; return true; }
    } catch (_) { }
    try {
      const resp = await fetch("data/exercicios.json", { cache: "no-store" });
      const data = await resp.json();
      const arr = Array.isArray(data) ? data : (data.questoes || []);
      if (arr.length) ready = true;
      return ready;
    } catch (_) { setMsg("Falha ao carregar o dataset.", "error"); return false; }
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

  // Mostra contador para feedback rápido
  function renderCount(n) {
    if (!els.out) return;
    els.out.textContent = `Exibindo ${n} item(ns) no bloco principal.`;
  }

  async function onShowClick() {
    const range = validateInputs();
    if (!range) return;
    const ok = await ensureReady();
    if (!ok) return;
    window.App?.setIdRange?.(range.start, range.end);
    const items = window.App?.getFilteredItems?.() || [];
    if (!items.length) { setMsg("Nenhum item encontrado no intervalo especificado.", "info"); renderCount(0); return; }
    setMsg("Intervalo aplicado.", "success");
    renderCount(items.length);
  }

  function bind() {
    els.start = document.querySelector("#range-start");
    els.end = document.querySelector("#range-end");
    els.btn = document.querySelector("#range-btn");
    els.msg = document.querySelector("#range-msg");
    els.out = document.querySelector("#range-output");
    if (!els.start || !els.end || !els.btn) return;
    els.btn.addEventListener("click", onShowClick);
  }

  // Escuta o evento do app para saber quando o dataset estiver pronto
  window.addEventListener("app:data-ready", (ev) => {
    ready = !ev?.detail?.error;
  });

  document.addEventListener("DOMContentLoaded", bind);
})();