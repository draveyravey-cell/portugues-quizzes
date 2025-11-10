"use strict";

/* Player (sequência, navegação, resumo) + integração Store — global: window.Player */
(function () {
  const st = {
    aberto: false,
    mode: "exercise", // 'exercise' | 'summary'
    q: null,
    selecionada: null,  // índice (MC), boolean (V/F) ou string (lacuna)
    corrigido: false,
    correta: false,
    lastTrigger: null,
    seq: null // { list: [], idx: 0, results: Map<id, {selected, correct, tipo}>, sessionId? }
  };

  const els = {
    overlay: null,
    modal: null,
    title: null,
    close: null,
    content: null,
    verify: null,
    feedback: null,
    prev: null,
    next: null,
    finish: null
  };

  function qs(sel, root = document) { return root.querySelector(sel); }

  function init() {
    els.overlay  = qs("#player-overlay");
    els.modal    = els.overlay ? qs(".modal", els.overlay) : null;
    els.title    = qs("#player-title");
    els.close    = qs("#player-close");
    els.content  = qs("#player-content");
    els.verify   = qs("#player-verify");
    els.feedback = qs("#player-feedback");
    els.prev     = qs("#player-prev");
    els.next     = qs("#player-next");
    els.finish   = qs("#player-finish");

    if (!els.overlay || !els.verify) return;

    // Fechar
    els.close?.addEventListener("click", close);
    els.overlay.addEventListener("mousedown", (e) => { if (e.target === els.overlay) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && st.aberto) { e.preventDefault(); close(); } });

    // Verificar / Fechar
    els.verify.addEventListener("click", () => {
      const mode = els.verify.dataset.mode || "verify";
      if (mode === "close") close();
      else verificar();
    });

    // Navegação
    els.prev?.addEventListener("click", goPrev);
    els.next?.addEventListener("click", () => {
      if (!st.seq) return;
      if (isLast()) openSummary();
      else goNext();
    });
    els.finish?.addEventListener("click", openSummary);
  }

  /* ========= APIs ========= */

  // Abre exercício único (sem sequência)
  function open(q, lastTrigger = null) {
    st.seq = null;
    openInternal(q, lastTrigger);
    updateNavUI(); // esconde botões de navegação
  }

  // Inicia sequência (lista atual filtrada) no índice informado
  function startSequence(list, startIndex = 0, lastTrigger = null, context = null) {
    const arr = Array.isArray(list) ? list.filter(Boolean) : [];
    const idx = clamp(startIndex, 0, Math.max(arr.length - 1, 0));

    // Cria sessão na Store
    const sessionId = window.Store?.newSession({
      filters: context?.filters || null,
      questionIds: (arr || []).map(q => q.id)
    });

    st.seq = { list: arr, idx, results: new Map(), sessionId };
    openInternal(st.seq.list[st.seq.idx], lastTrigger);
    updateNavUI();
  }

  function close() {
    st.aberto = false;
    st.mode = "exercise";
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

  /* ========= Internals ========= */

  function openInternal(q, lastTrigger = null) {
    st.aberto = true;
    st.mode = "exercise";
    st.q = q;
    st.selecionada = null;
    st.corrigido = false;
    st.correta = false;
    st.lastTrigger = lastTrigger;

    if (els.title) els.title.textContent = `Questão ${q.id} — ${q.tema || q.categoria || "Português"}`;

    if (els.feedback) { els.feedback.textContent = ""; els.feedback.className = "feedback"; }
    if (els.verify) { els.verify.disabled = true; els.verify.textContent = "Verificar"; els.verify.dataset.mode = "verify"; }

    renderContent(q);
    updateNavUI();

    els.overlay?.classList.remove("hidden");
    els.overlay?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    focusFirstInteractive();
  }

  function renderContent(q) {
    if (!els.content) return;

    const wrap = document.createElement("div");
    wrap.className = "player__inner";

    // Progresso (se houver sequência)
    if (st.seq && st.seq.list && st.seq.list.length) {
      wrap.appendChild(renderProgressHeader());
    }

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

      label.setAttribute("for", `lacuna-${q.id}`);
      input.id = `lacuna-${q.id}`;

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
        const correctIdx = Boolean(q.resposta) ? 0 : 1;
        const selectedIdx = st.selecionada ? 0 : 1;
        if (items[correctIdx]) items[correctIdx].classList.add("is-correct");
        if (!ok && items[selectedIdx]) items[selectedIdx].classList.add("is-wrong");
      }
    }

    st.corrigido = true;
    st.correta = ok;

    // Salva resultado na sequência
    if (st.seq && st.q && st.q.id != null) {
      st.seq.results.set(String(st.q.id), {
        selected: st.selecionada,
        correct: ok,
        tipo: tipo
      });
    }

    // Store: registra tentativa
    window.Store?.recordAttempt({
      sessionId: st.seq?.sessionId || null,
      question: q,
      selected: st.selecionada,
      correct: ok
    });

    // Feedback
    if (els.feedback) {
      els.feedback.className = "feedback " + (ok ? "ok" : "err");
      const expl = q.explicacao ? ` ${q.explicacao}` : "";
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

    if (els.verify) {
      els.verify.textContent = "Fechar";
      els.verify.dataset.mode = "close";
      els.verify.disabled = false;
    }
  }

  /* ========= Navegação / Resumo ========= */

  function goPrev() {
    if (!st.seq) return;
    if (st.seq.idx <= 0) return;
    st.seq.idx -= 1;
    openInternal(st.seq.list[st.seq.idx], null);
  }

  function goNext() {
    if (!st.seq) return;
    if (st.seq.idx >= st.seq.list.length - 1) return;
    st.seq.idx += 1;
    openInternal(st.seq.list[st.seq.idx], null);
  }

  function isLast() {
    return !!(st.seq && st.seq.idx >= st.seq.list.length - 1);
  }

  function updateNavUI() {
    const inSeq = !!(st.seq && st.seq.list && st.seq.list.length > 1);
    const inAnySeq = !!(st.seq && st.seq.list && st.seq.list.length >= 1);

    if (els.prev)   els.prev.hidden   = !inSeq;
    if (els.next)   els.next.hidden   = !inAnySeq;
    if (els.finish) els.finish.hidden = !inAnySeq;

    if (!inAnySeq) return;

    const atFirst = st.seq.idx <= 0;
    const atLast  = st.seq.idx >= st.seq.list.length - 1;

    if (els.prev) {
      els.prev.disabled = atFirst;
      els.prev.title = atFirst ? "" : "Questão anterior";
    }
    if (els.next) {
      els.next.textContent = atLast ? "Resumo" : "Próxima";
      els.next.title = atLast ? "Ver resumo" : "Próxima questão";
      els.next.disabled = false;
    }
    if (els.finish) {
      els.finish.disabled = false;
      els.finish.title = "Ver resumo";
    }
  }

  function openSummary() {
    if (!st.seq) return;

    st.mode = "summary";
    st.q = null;
    st.selecionada = null;
    st.corrigido = false;
    st.correta = false;

    // Finaliza sessão na Store com snapshot dos resultados
    if (st.seq?.sessionId) {
      const resultsArray = Array.from(st.seq.results.entries()).map(([qid, r]) => ({
        id: qid, selected: r.selected, correct: r.correct, tipo: r.tipo
      }));
      window.Store?.finishSession(st.seq.sessionId, resultsArray);
    }

    if (els.title) {
      els.title.textContent = `Resumo — ${st.seq.list.length} questão(ões)`;
    }

    const total = st.seq.list.length;
    const answered = st.seq.results.size;
    const correct = Array.from(st.seq.results.values()).filter(r => r.correct).length;
    const perc = total ? Math.round((correct / total) * 100) : 0;

    const wrap = document.createElement("div");
    wrap.className = "player__summary";

    // Progresso total (barra cheia)
    const prog = renderProgressHeader(total, total);
    wrap.appendChild(prog);

    const p = document.createElement("p");
    p.innerHTML = `Você respondeu <strong>${answered}</strong> de <strong>${total}</strong> e acertou <strong>${correct}</strong> (${perc}%).`;
    wrap.appendChild(p);

    const ul = document.createElement("ul");
    ul.className = "options";
    st.seq.list.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = "option";
      li.style.cursor = "default";

      const res = st.seq.results.get(String(it.id));
      const icon = document.createElement("span");
      icon.style.minWidth = "1.2rem";
      icon.style.display = "inline-block";
      icon.textContent = res ? (res.correct ? "✅" : "❌") : "•";

      const text = document.createElement("span");
      text.textContent = `Q${it.id ?? (i + 1)} — ${it.tema || it.categoria || "Português"}`;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = ".6rem";
      row.style.alignItems = "center";

      row.appendChild(icon);
      row.appendChild(text);
      li.appendChild(row);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);

    if (els.content) {
      els.content.innerHTML = "";
      els.content.appendChild(wrap);
    }

    if (els.feedback) {
      els.feedback.textContent = "";
      els.feedback.className = "feedback";
    }
    if (els.verify) {
      els.verify.textContent = "Fechar";
      els.verify.dataset.mode = "close";
      els.verify.disabled = false;
    }

    if (els.prev)   els.prev.hidden = true;
    if (els.next)   els.next.hidden = true;
    if (els.finish) els.finish.hidden = true;
  }

  /* ========= UI helpers ========= */

  function renderProgressHeader(totalOverride, currentOverride) {
    const total = totalOverride ?? (st.seq?.list?.length || 1);
    const step  = currentOverride ?? ((st.seq?.idx ?? 0) + 1);

    const box = document.createElement("div");
    box.className = "progress";

    const track = document.createElement("div");
    track.className = "progress__track";

    const bar = document.createElement("div");
    bar.className = "progress__bar";
    bar.style.width = `${Math.max(0, Math.min(100, (step / total) * 100))}%`;

    const label = document.createElement("div");
    label.className = "progress__label";
    label.textContent = `Questão ${step} de ${total}`;

    track.appendChild(bar);
    box.appendChild(track);
    box.appendChild(label);
    return box;
  }

  function focusFirstInteractive() {
    const input = els.content?.querySelector(".lacuna-input");
    if (input) { input.focus(); return; }
    const firstRadio = els.content?.querySelector('input[type="radio"]');
    if (firstRadio) { firstRadio.focus(); return; }
    els.close?.focus();
  }

  // Comparação para lacuna (case-insensitive, trim, colapsa espaços; mantém acentos)
  function normText(s) {
    return String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
  }
  function eqText(a, b) { return normText(a) === normText(b); }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  window.Player = { init, open, close, startSequence };
})();