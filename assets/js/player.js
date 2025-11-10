"use strict";

/* Player isolado (global: window.Player) */
(function () {
  const st = {
    aberto: false,
    q: null,
    selecionada: null,  // índice (MC), boolean (V/F) ou string (lacuna)
    corrigido: false,
    correta: false,
    lastTrigger: null
  };

  const els = {
    overlay: null,
    modal: null,
    title: null,
    close: null,
    content: null,
    verify: null,
    feedback: null
  };

  function qs(sel, root = document) { return root.querySelector(sel); }

  function init() {
    els.overlay = qs("#player-overlay");
    els.modal = els.overlay ? qs(".modal", els.overlay) : null;
    els.title = qs("#player-title");
    els.close = qs("#player-close");
    els.content = qs("#player-content");
    els.verify = qs("#player-verify");
    els.feedback = qs("#player-feedback");

    if (!els.overlay || !els.verify) return;

    // Fechar
    els.close?.addEventListener("click", close);
    els.overlay.addEventListener("mousedown", (e) => { if (e.target === els.overlay) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && st.aberto) { e.preventDefault(); close(); }
    });

    // Verificar/Fechar
    els.verify.addEventListener("click", () => {
      const mode = els.verify.dataset.mode || "verify";
      if (mode === "close") close();
      else verificar();
    });
  }

  function open(q, lastTrigger = null) {
    st.aberto = true;
    st.q = q;
    st.selecionada = null;
    st.corrigido = false;
    st.correta = false;
    st.lastTrigger = lastTrigger;

    if (els.title) els.title.textContent = `Questão ${q.id} — ${q.tema || q.categoria || "Português"}`;

    // Reset UI
    if (els.feedback) {
      els.feedback.textContent = "";
      els.feedback.className = "feedback";
    }
    if (els.verify) {
      els.verify.disabled = true;
      els.verify.textContent = "Verificar";
      els.verify.dataset.mode = "verify";
    }

    renderContent(q);

    els.overlay?.classList.remove("hidden");
    els.overlay?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    // Foco inicial
    focusFirstInteractive();
  }

  function close() {
    st.aberto = false;
    st.q = null;
    st.selecionada = null;
    st.corrigido = false;
    st.correta = false;

    els.overlay?.classList.add("hidden");
    els.overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (els.content) {
      els.content.innerHTML = `<p id="player-desc" class="sr-only">Selecione ou digite sua resposta e clique em Verificar.</p>`;
    }
    if (els.feedback) {
      els.feedback.textContent = "";
      els.feedback.className = "feedback";
    }
    if (els.verify) {
      els.verify.disabled = true;
      els.verify.textContent = "Verificar";
      els.verify.dataset.mode = "verify";
    }

    // Devolve foco para o botão que abriu
    if (st.lastTrigger && typeof st.lastTrigger.focus === "function") {
      st.lastTrigger.focus();
      st.lastTrigger = null;
    }
  }

  function renderContent(q) {
    if (!els.content) return;

    const wrap = document.createElement("div");
    wrap.className = "player__inner";

    if (q.texto_base) {
      const block = document.createElement("blockquote");
      block.className = "texto-base";
      block.textContent = q.texto_base;
      wrap.appendChild(block);
    }

    const enun = document.createElement("div");
    enun.className = "enunciado";
    enun.textContent = q.enunciado || "";
    wrap.appendChild(enun);

    const tipo = (q.tipo || "").toLowerCase();

    if (tipo === "multipla_escolha") {
      const ul = document.createElement("ul");
      ul.className = "options";
      const name = `op-${q.id}`;

      (q.alternativas || []).forEach((alt, i) => {
        const li = document.createElement("li");
        li.className = "option";
        li.dataset.index = String(i);

        const label = document.createElement("label");
        label.style.flex = "1";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.value = String(i);
        input.setAttribute("aria-label", `Alternativa ${i + 1}`);

        input.addEventListener("change", () => {
          st.selecionada = i;
          els.verify.disabled = false;
          ul.querySelectorAll(".option").forEach((opt) => opt.classList.remove("is-selected"));
          li.classList.add("is-selected");
        });

        const span = document.createElement("span");
        span.textContent = alt;

        label.appendChild(input);
        label.appendChild(span);
        li.appendChild(label);
        ul.appendChild(li);
      });

      wrap.appendChild(ul);
    }
    else if (tipo === "lacuna") {
      const div = document.createElement("div");
      div.className = "lacuna-wrap";

      const label = document.createElement("label");
      label.className = "lacuna-label";
      label.textContent = "Resposta:";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "lacuna-input";
      input.placeholder = "Digite sua resposta";
      input.autocomplete = "off";
      input.autocapitalize = "none";
      input.spellcheck = false;

      input.addEventListener("input", () => {
        st.selecionada = input.value;
        els.verify.disabled = !(st.selecionada && st.selecionada.trim().length);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !els.verify.disabled && !st.corrigido) {
          e.preventDefault();
          verificar();
        }
      });

      label.setAttribute("for", `lacuna-${q.id}`);
      input.id = `lacuna-${q.id}`;

      div.appendChild(label);
      div.appendChild(input);
      wrap.appendChild(div);
    }
    else if (tipo === "verdadeiro_falso") {
      const ul = document.createElement("ul");
      ul.className = "options";
      const name = `vf-${q.id}`;

      [
        { label: "Verdadeiro", val: "true" },
        { label: "Falso", val: "false" }
      ].forEach(({ label, val }) => {
        const li = document.createElement("li");
        li.className = "option";
        li.dataset.val = val;

        const l = document.createElement("label");
        l.style.flex = "1";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.value = val;
        input.setAttribute("aria-label", label);

        input.addEventListener("change", () => {
          st.selecionada = (val === "true");
          els.verify.disabled = false;
          ul.querySelectorAll(".option").forEach((opt) => opt.classList.remove("is-selected"));
          li.classList.add("is-selected");
        });

        const span = document.createElement("span");
        span.textContent = label;

        l.appendChild(input);
        l.appendChild(span);
        li.appendChild(l);
        ul.appendChild(li);
      });

      wrap.appendChild(ul);
    }
    else {
      const p = document.createElement("p");
      p.textContent = "Este tipo de exercício ainda não é suportado.";
      wrap.appendChild(p);
    }

    els.content.innerHTML = "";
    els.content.appendChild(wrap);
  }

  function verificar() {
    const q = st.q;
    if (!q) return;

    const tipo = (q.tipo || "").toLowerCase();
    let ok = false;

    if (tipo === "multipla_escolha") {
      if (st.selecionada == null) return;
      const corretaIndex = q.resposta;
      ok = Number(st.selecionada) === Number(corretaIndex);

      const ul = els.content?.querySelector(".options");
      if (ul) {
        ul.querySelectorAll("input[type=radio]").forEach((inp) => (inp.disabled = true));
        const items = Array.from(ul.querySelectorAll(".option"));
        if (items[corretaIndex]) items[corretaIndex].classList.add("is-correct");
        if (!ok && items[st.selecionada]) items[st.selecionada].classList.add("is-wrong");
      }
    }
    else if (tipo === "lacuna") {
      const input = els.content?.querySelector(".lacuna-input");
      if (!input) return;
      const user = (st.selecionada || "").toString();
      const gabarito = Array.isArray(q.resposta) ? q.resposta : [q.resposta];

      ok = gabarito.some((ans) => eqText(user, ans));
      input.disabled = true;
      input.classList.toggle("is-correct", ok);
      input.classList.toggle("is-wrong", !ok);
    }
    else if (tipo === "verdadeiro_falso") {
      if (typeof st.selecionada !== "boolean") return;
      ok = st.selecionada === Boolean(q.resposta);

      const ul = els.content?.querySelector(".options");
      if (ul) {
        ul.querySelectorAll("input[type=radio]").forEach((inp) => (inp.disabled = true));
        const items = Array.from(ul.querySelectorAll(".option"));
        const correctIdx = Boolean(q.resposta) ? 0 : 1; // 0 = Verdadeiro, 1 = Falso
        const selectedIdx = st.selecionada ? 0 : 1;
        if (items[correctIdx]) items[correctIdx].classList.add("is-correct");
        if (!ok && items[selectedIdx]) items[selectedIdx].classList.add("is-wrong");
      }
    }

    st.corrigido = true;
    st.correta = ok;

    // Feedback
    if (els.feedback) {
      els.feedback.className = "feedback " + (ok ? "ok" : "err");
      const expl = q.explicacao ? ` ${q.explicacao}` : "";
      // Para lacuna, opcionalmente mostra um exemplo de gabarito quando incorreto
      let complemento = "";
      if (!ok && (Array.isArray(q.resposta) || typeof q.resposta === "string")) {
        const exemplo = Array.isArray(q.resposta) ? q.resposta[0] : q.resposta;
        if (exemplo != null && typeof exemplo !== "boolean") {
          complemento = ` Ex.: “${exemplo}”.`;
        }
      }
      els.feedback.textContent = ok
        ? `Correto!${expl ? " " + expl : ""}`
        : `Incorreto.${expl ? " " + expl : ""}${complemento}`;
      els.feedback.focus?.();
    }

    // Botão => Fechar
    if (els.verify) {
      els.verify.textContent = "Fechar";
      els.verify.dataset.mode = "close";
      els.verify.disabled = false;
    }
  }

  function focusFirstInteractive() {
    // tenta focar um input (lacuna) ou o primeiro radio; senão, o botão fechar
    const input = els.content?.querySelector(".lacuna-input");
    if (input) { input.focus(); return; }
    const firstRadio = els.content?.querySelector('input[type="radio"]');
    if (firstRadio) { firstRadio.focus(); return; }
    els.close?.focus();
  }

  // Comparação de texto para lacuna:
  // - case-insensitive
  // - trim
  // - colapsa múltiplos espaços
  // - mantém acentos (não remove diacríticos) para diferenciar "tem" de "têm"
  function normText(s) {
    return String(s || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }
  function eqText(a, b) {
    return normText(a) === normText(b);
  }

  window.Player = { init, open, close };
})();