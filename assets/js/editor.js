"use strict";

/* Editor/Preview de JSON (Parte 9) — override local + validação */
(function () {
  const LSK = {
    data: "pp.data.override",
    enabled: "pp.data.override.enabled"
  };

  function qs(sel, root = document) { return (root || document).querySelector(sel); }

  function isOverrideEnabled() {
    try { return localStorage.getItem(LSK.enabled) === "1"; } catch { return false; }
  }
  function setOverrideEnabled(on) {
    try { localStorage.setItem(LSK.enabled, on ? "1" : "0"); } catch {}
  }
  function setOverrideData(text) {
    try { localStorage.setItem(LSK.data, text); } catch {}
  }
  function getOverrideData() {
    try { return localStorage.getItem(LSK.data) || ""; } catch { return ""; }
  }
  function clearOverride() {
    try {
      localStorage.removeItem(LSK.data);
      localStorage.removeItem(LSK.enabled);
    } catch {}
  }

  function prettyJSON(text) {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj, null, 2);
    } catch {
      return text;
    }
  }

  function parseJSON(text) {
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch (e) {
      return { ok: false, error: "JSON inválido: " + e.message };
    }
  }

  const TIPOS = new Set(["multipla_escolha", "lacuna", "verdadeiro_falso"]);

  function validateData(data) {
    const errors = [];
    const ids = new Set();

    const list = Array.isArray(data) ? data : (data && Array.isArray(data.questoes) ? data.questoes : null);
    if (!list) {
      errors.push("Estrutura inválida: esperado um array ou objeto com propriedade 'questoes' (array).");
      return { ok: false, errors };
    }

    list.forEach((q, idx) => {
      const path = `item ${idx + 1}${q && q.id != null ? ` (id ${q.id})` : ""}`;

      if (q == null || typeof q !== "object") {
        errors.push(`${path}: não é um objeto.`);
        return;
      }

      // id
      if (q.id == null || (typeof q.id !== "number" && typeof q.id !== "string")) {
        errors.push(`${path}: campo 'id' ausente ou inválido.`);
      } else {
        const idStr = String(q.id);
        if (ids.has(idStr)) errors.push(`${path}: id duplicado (${idStr}).`);
        ids.add(idStr);
      }

      // tipo
      const tipo = (q.tipo || "").toLowerCase();
      if (!TIPOS.has(tipo)) {
        errors.push(`${path}: tipo inválido. Use 'multipla_escolha', 'lacuna' ou 'verdadeiro_falso'.`);
      }

      // enunciado
      if (!q.enunciado || typeof q.enunciado !== "string") {
        errors.push(`${path}: 'enunciado' ausente/invalid.`);
      }

      // Validações por tipo
      if (tipo === "multipla_escolha") {
        if (!Array.isArray(q.alternativas) || q.alternativas.length < 2) {
          errors.push(`${path}: 'alternativas' deve ser array com 2+ itens.`);
        }
        if (q.resposta == null || typeof q.resposta !== "number") {
          errors.push(`${path}: 'resposta' deve ser índice numérico da alternativa correta.`);
        } else if (Array.isArray(q.alternativas) && (q.resposta < 0 || q.resposta >= q.alternativas.length)) {
          errors.push(`${path}: 'resposta' fora do intervalo de alternativas.`);
        }
      } else if (tipo === "lacuna") {
        if (
          q.resposta == null ||
          !(
            typeof q.resposta === "string" ||
            (Array.isArray(q.resposta) && q.resposta.every(s => typeof s === "string"))
          )
        ) {
          errors.push(`${path}: 'resposta' deve ser string ou array de strings.`);
        }
      } else if (tipo === "verdadeiro_falso") {
        if (typeof q.resposta !== "boolean") {
          errors.push(`${path}: 'resposta' deve ser boolean (true/false).`);
        }
      }
    });

    return { ok: errors.length === 0, errors, list };
  }

  function setStatus(msg) {
    const el = qs("#ed-status");
    if (el) el.textContent = msg || "";
  }

  function showValidation(result) {
    const root = qs("#editor-validation");
    if (!root) return;
    if (!result) { root.innerHTML = ""; return; }

    if (result.ok) {
      root.innerHTML = `<div class="ok">✓ JSON válido.</div>`;
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "list";
    (result.errors || []).forEach((e) => {
      const li = document.createElement("li");
      li.textContent = e;
      ul.appendChild(li);
    });

    root.innerHTML = "";
    const title = document.createElement("div");
    title.className = "err";
    title.textContent = `Foram encontradas ${result.errors.length} inconsistência(s):`;
    root.appendChild(title);
    root.appendChild(ul);
  }

  async function loadServer() {
    setStatus("Carregando do servidor...");
    try {
      const resp = await fetch("data/exercicios.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const txt = await resp.text();
      const area = qs("#editor-json");
      if (area) {
        area.value = prettyJSON(txt);
      }
      setStatus("JSON carregado do servidor.");
      showValidation(validateData(parseJSON(area.value).data));
    } catch (e) {
      console.error(e);
      setStatus("Falha ao carregar do servidor.");
    }
  }

  function loadFile() {
    const input = qs("#editor-file");
    input?.click();
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => {
      const area = qs("#editor-json");
      if (area) {
        area.value = prettyJSON(txt);
        setStatus(`Arquivo carregado: ${file.name}`);
        showValidation(validateData(parseJSON(area.value).data));
      }
    }).catch(() => setStatus("Falha ao ler o arquivo."));
    e.target.value = "";
  }

  function validateAndFormat() {
    const area = qs("#editor-json");
    if (!area) return;
    const parsed = parseJSON(area.value);
    if (!parsed.ok) {
      showValidation({ ok: false, errors: [parsed.error] });
      setStatus("JSON inválido.");
      return;
    }
    const v = validateData(parsed.data);
    showValidation(v);
    area.value = JSON.stringify(Array.isArray(parsed.data) ? parsed.data : parsed.data.questoes || parsed.data, null, 2);
    setStatus(v.ok ? "JSON validado e formatado." : "JSON formatado; ver erros.");
  }

  function applyOverride() {
    const area = qs("#editor-json");
    if (!area) return;
    const parsed = parseJSON(area.value);
    if (!parsed.ok) {
      showValidation({ ok: false, errors: [parsed.error] });
      setStatus("Não aplicado: JSON inválido.");
      return;
    }
    const v = validateData(parsed.data);
    showValidation(v);
    if (!v.ok) {
      setStatus("Não aplicado: corrija os erros de validação.");
      return;
    }

    // Sempre salvamos como array de questões simples
    const list = Array.isArray(parsed.data) ? parsed.data : parsed.data.questoes || [];
    const payload = JSON.stringify(list, null, 2);
    setOverrideData(payload);
    setOverrideEnabled(true);
    setStatus(`Override aplicado (${list.length} exercício(s)). A listagem usará este conjunto.`);
    // Notifica o app para recarregar
    window.dispatchEvent(new CustomEvent("dataset:override-changed"));
  }

  function disableOverride() {
    setOverrideEnabled(false);
    setStatus("Override desativado. O site voltará a usar o JSON do servidor.");
    window.dispatchEvent(new CustomEvent("dataset:override-changed"));
  }

  function clearOverrideAction() {
    clearOverride();
    setStatus("Override limpo do navegador.");
    window.dispatchEvent(new CustomEvent("dataset:override-changed"));
  }

  function downloadJSON() {
    const area = qs("#editor-json");
    if (!area) return;
    const txt = area.value || "[]";
    const blob = new Blob([prettyJSON(txt)], { type: "application/json" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = URL.createObjectURL(blob);
    a.download = `exercicios-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    setStatus("Download iniciado.");
  }

  function updateStatusLine() {
    const enabled = isOverrideEnabled();
    const raw = getOverrideData();
    let count = 0;
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        count = Array.isArray(arr) ? arr.length : (Array.isArray(arr?.questoes) ? arr.questoes.length : 0);
      } catch {}
    }
    const msg = enabled
      ? `Override ATIVO (${count} exercício(s)).`
      : (raw ? `Override DESATIVADO (${count} exercício(s) salvos).` : "Sem override salvo.");
    setStatus(msg);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!qs("#editor")) return;

    qs("#ed-load-server")?.addEventListener("click", loadServer);
    qs("#ed-load-file")?.addEventListener("click", loadFile);
    qs("#editor-file")?.addEventListener("change", onFileChange);
    qs("#ed-validate")?.addEventListener("click", validateAndFormat);
    qs("#ed-apply")?.addEventListener("click", applyOverride);
    qs("#ed-disable")?.addEventListener("click", disableOverride);
    qs("#ed-clear")?.addEventListener("click", clearOverrideAction);
    qs("#ed-download")?.addEventListener("click", downloadJSON);

    // Prefill: se houver override salvo, mostra no editor
    const area = qs("#editor-json");
    const raw = getOverrideData();
    if (area) {
      area.value = raw ? prettyJSON(raw) : "";
    }
    updateStatusLine();
  });

  // Sempre que o override mudar por outra aba, atualiza status
  window.addEventListener("storage", (e) => {
    if (e.key === LSK.data || e.key === LSK.enabled) {
      updateStatusLine();
    }
  });
})();