"use strict";

/* Player — com exam mode + resumo detalhado + revisar erros + export/print */
(function () {
  const st = {
    aberto: false,
    mode: "exercise",
    q: null,
    selecionada: null,
    corrigido: false,
    correta: false,
    lastTrigger: null,
    seq: null,          // { list, idx, results Map<qid,{selected,correct,tipo,at}>, sessionId }
    trap: null,
    exam: { active: false, startAt: 0, durationMin: 0 }
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
  function emit(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { } }

  function init() {
    els.overlay = qs("#player-overlay");
    els.modal = els.overlay ? qs(".modal", els.overlay) : null;
    els.title = qs("#player-title");
    els.close = qs("#player-close");
    els.content = qs("#player-content");
    els.verify = qs("#player-verify");
    els.feedback = qs("#player-feedback");
    els.prev = qs("#player-prev");
    els.next = qs("#player-next");
    els.finish = qs("#player-finish");

    if (!els.overlay || !els.verify) return;

    els.close?.addEventListener("click", closePlayer);
    els.overlay.addEventListener("mousedown", (e) => { if (e.target === els.overlay) closePlayer(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && st.aberto) { e.preventDefault(); closePlayer(); } });

    els.verify.addEventListener("click", () => {
      const mode = els.verify.dataset.mode || "verify";
      if (mode === "close") closePlayer();
      else if (mode === "next") goNext();
      else if (mode === "summary") openSummary();
      else verificar();
    });

    els.prev?.addEventListener("click", goPrev);
    els.next?.addEventListener("click", () => { if (!st.seq) return; if (isLast()) openSummary(); else goNext(); });
    els.finish?.addEventListener("click", openSummary);
  }

  function open(q, lastTrigger = null) {
    st.seq = null;
    st.exam = { active: false, startAt: 0, durationMin: 0 };
    openInternal(q, lastTrigger);
    updateNavUI();
  }

  function startSequence(list, startIndex = 0, lastTrigger = null, context = null) {
    const arr = Array.isArray(list) ? list.filter(Boolean) : [];
    const idx = clamp(startIndex, 0, Math.max(arr.length - 1, 0));
    const sessionId = window.Store?.newSession({ filters: context?.filters || null, questionIds: (arr || []).map(q => q.id) });

    st.seq = { list: arr, idx, results: new Map(), sessionId };
    st.exam.active = !!(context && context.exam && context.exam.active);
    st.exam.startAt = context?.exam?.startAt || 0;
    st.exam.durationMin = context?.exam?.durationMin || 0;
    openInternal(st.seq.list[st.seq.idx], lastTrigger);
    updateNavUI();
  }

  function finishSequence() { openSummary(); }

  function closePlayer() {
    st.aberto = false;
    st.mode = "exercise";
    st.q = null; st.selecionada = null; st.corrigido = false; st.correta = false;
    st.exam = { active: false, startAt: 0, durationMin: 0 };

    els.overlay?.classList.add("hidden");
    els.overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (els.content) els.content.innerHTML = `<p id="player-desc" class="sr-only">Selecione ou digite sua resposta e clique em Verificar.</p>`;
    if (els.feedback) { els.feedback.textContent = ""; els.feedback.className = "feedback"; }
    if (els.verify) { els.verify.disabled = true; els.verify.textContent = "Verificar"; els.verify.dataset.mode = "verify"; }

    if (st.lastTrigger?.focus) st.lastTrigger.focus();
    emit("player:closed", {});
  }

  function openInternal(q, lastTrigger = null) {
    st.aberto = true; st.mode = "exercise"; st.q = q;
    st.selecionada = null; st.corrigido = false; st.correta = false; st.lastTrigger = lastTrigger; st.mapAlt = null; st.correctIdxDisplay = null;

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

    if (st.seq?.list?.length) wrap.appendChild(renderProgressHeader());

    if (q.texto_base) {
      const block = document.createElement("blockquote");
      block.className = "texto-base";
      block.textContent = q.texto_base;
      wrap.appendChild(block);
    }

    const enun = document.createElement("div");
    enun.className = "enunciado";
    enun.id = `enun-${q.id}`;
    enun.textContent = q.enunciado || "";
    wrap.appendChild(enun);

    const tipo = (q.tipo || "").toLowerCase();

    if (tipo === "multipla_escolha") {
      const ul = document.createElement("ul");
      ul.className = "options";
      ul.setAttribute("role", "radiogroup");
      ul.setAttribute("aria-label", "Alternativas");
      ul.setAttribute("aria-describedby", enun.id);
      const name = `op-${q.id}`;

      const alts = (q.alternativas || []);
      const idxs = alts.map((_, i) => i);
      for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
      st.mapAlt = idxs.slice();
      st.correctIdxDisplay = idxs.indexOf(q.resposta);

      idxs.forEach((origIdx, displayIdx) => {
        const li = document.createElement("li"); li.className = "option";
        const label = document.createElement("label"); label.style.flex = "1";
        const input = document.createElement("input");
        input.type = "radio"; input.name = name; input.value = String(displayIdx);
        input.setAttribute("aria-label", `Alternativa ${displayIdx + 1}`);
        input.addEventListener("change", () => {
          st.selecionada = displayIdx; els.verify.disabled = false;
          ul.querySelectorAll(".option").forEach((opt) => opt.classList.remove("is-selected"));
          li.classList.add("is-selected");
        });
        const span = document.createElement("span"); span.textContent = alts[origIdx];
        label.appendChild(input); label.appendChild(span);
        li.appendChild(label); ul.appendChild(li);
      });
      window.A11y?.enhanceRadioGroup?.(ul);
      wrap.appendChild(ul);
    }
    else if (tipo === "lacuna") {
      const div = document.createElement("div"); div.className = "lacuna-wrap";
      const label = document.createElement("label"); label.className = "lacuna-label";
      label.textContent = "Resposta:"; label.setAttribute("for", `lacuna-${q.id}`);
      const input = document.createElement("input");
      input.type = "text"; input.className = "lacuna-input"; input.placeholder = "Digite sua resposta";
      input.autocomplete = "off"; input.autocapitalize = "none"; input.spellcheck = false; input.id = `lacuna-${q.id}`;
      input.setAttribute("aria-describedby", enun.id);
      input.addEventListener("input", () => {
        st.selecionada = input.value;
        els.verify.disabled = !(st.selecionada && String(st.selecionada).trim().length);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !els.verify.disabled && !st.corrigido) { e.preventDefault(); verificar(); }
      });
      div.appendChild(label); div.appendChild(input);

      // <<< INÍCIO DA MODIFICAÇÃO >>>
      // Verifica se a resposta sugere múltiplas partes para instruir o usuário
      const respostaExemplo = Array.isArray(q.resposta) ? q.resposta[0] : q.resposta;
      if (typeof respostaExemplo === 'string' && respostaExemplo.includes(" / ")) {
        const instrucao = document.createElement("p");
        instrucao.className = "lacuna-instruction";
        instrucao.textContent = "Dica: Para respostas múltiplas, separe-as com uma barra ( / ). Ex: o / à";
        div.appendChild(instrucao);
      }
      // <<< FIM DA MODIFICAÇÃO >>>

      wrap.appendChild(div);
    }
    else if (tipo === "verdadeiro_falso") {
      const ul = document.createElement("ul"); ul.className = "options";
      ul.setAttribute("role", "radiogroup");
      ul.setAttribute("aria-label", "Verdadeiro ou Falso");
      ul.setAttribute("aria-describedby", enun.id);

      const name = `vf-${q.id}`;
      [{ label: "Verdadeiro", val: "true" }, { label: "Falso", val: "false" }].forEach(({ label: text, val }) => {
        const li = document.createElement("li"); li.className = "option";
        const l = document.createElement("label"); l.style.flex = "1";
        const input = document.createElement("input");
        input.type = "radio"; input.name = name; input.value = val; input.setAttribute("aria-label", text);
        input.addEventListener("change", () => {
          st.selecionada = (val === "true"); els.verify.disabled = false;
          ul.querySelectorAll(".option").forEach((opt) => opt.classList.remove("is-selected"));
          li.classList.add("is-selected");
        });
        const span = document.createElement("span"); span.textContent = text;
        l.appendChild(input); l.appendChild(span); li.appendChild(l); ul.appendChild(li);
      });
      window.A11y?.enhanceRadioGroup?.(ul);
      wrap.appendChild(ul);
    }
    else {
      const p = document.createElement("p"); p.textContent = "Este tipo de exercício ainda não é suportado.";
      wrap.appendChild(p);
    }

    els.content.innerHTML = ""; els.content.appendChild(wrap);
  }

  function verificar() {
    const q = st.q; if (!q) return;
    const tipo = (q.tipo || "").toLowerCase();
    let ok = false;

    if (tipo === "multipla_escolha") {
      if (st.selecionada == null) return;
      const corretaIndex = Number.isFinite(st?.correctIdxDisplay) ? Number(st.correctIdxDisplay) : Number(q.resposta);
      ok = Number(st.selecionada) === Number(corretaIndex);

      if (!st.exam.active) {
        const ul = els.content?.querySelector(".options");
        if (ul) {
          ul.querySelectorAll("input[type=radio]").forEach((inp) => (inp.disabled = true));
          const items = Array.from(ul.querySelectorAll(".option"));
          if (items[corretaIndex]) items[corretaIndex].classList.add("is-correct");
          if (!ok && items[st.selecionada]) items[st.selecionada].classList.add("is-wrong");
        }
      }
    }
    else if (tipo === "lacuna") {
      const input = els.content?.querySelector(".lacuna-input");
      if (!input) return;
      const user = (st.selecionada || "").toString();
      const gabarito = Array.isArray(q.resposta) ? q.resposta : [q.resposta];
      ok = gabarito.some((ans) => eqText(user, ans));
      if (!st.exam.active) {
        input.disabled = true;
        input.classList.toggle("is-correct", ok);
        input.classList.toggle("is-wrong", !ok);
      }
    }
    else if (tipo === "verdadeiro_falso") {
      if (typeof st.selecionada !== "boolean") return;
      ok = st.selecionada === Boolean(q.resposta);
      if (!st.exam.active) {
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
    }

    st.corrigido = true; st.correta = ok;

    if (st.seq && st.q && st.q.id != null) {
      st.seq.results.set(String(st.q.id), { selected: st.selecionada, correct: ok, tipo: tipo, at: Date.now() });
    }

    window.Store?.recordAttempt({
      sessionId: st.seq?.sessionId || null,
      question: q,
      selected: st.selecionada,
      correct: ok
    });

    if (!st.exam.active) {
      if (els.feedback) {
        els.feedback.className = "feedback " + (ok ? "ok" : "err");
        const expl = q.explicacao ? ` ${q.explicacao}` : "";
        let complemento = "";
        if (!ok && (Array.isArray(q.resposta) || typeof q.resposta === "string")) {
          const exemplo = Array.isArray(q.resposta) ? q.resposta[0] : q.resposta;
          if (exemplo != null && typeof exemplo !== "boolean") complemento = ` Ex.: “${exemplo}”.`;
        }
        els.feedback.textContent = ok ? `Correto!${expl ? " " + expl : ""}` : `Incorreto.${expl ? " " + expl : ""}${complemento}`;
        els.feedback.focus?.();
      }
      if (els.verify) { els.verify.textContent = "Fechar"; els.verify.dataset.mode = "close"; els.verify.disabled = false; }
    } else {
      if (els.feedback) { els.feedback.textContent = ""; els.feedback.className = "feedback"; }
      if (els.verify) {
        if (isLast()) { els.verify.textContent = "Resumo"; els.verify.dataset.mode = "summary"; }
        else { els.verify.textContent = "Próxima"; els.verify.dataset.mode = "next"; }
        els.verify.disabled = false;
      }
    }
  }

  function goPrev() { if (!st.seq) return; if (st.seq.idx <= 0) return; st.seq.idx -= 1; openInternal(st.seq.list[st.seq.idx], null); }
  function goNext() { if (!st.seq) return; if (st.seq.idx >= st.seq.list.length - 1) return; st.seq.idx += 1; openInternal(st.seq.list[st.seq.idx], null); }
  function isLast() { return !!(st.seq && st.seq.idx >= st.seq.list.length - 1); }

  function updateNavUI() {
    const inSeq = !!(st.seq && st.seq.list && st.seq.list.length > 1);
    const inAnySeq = !!(st.seq && st.seq.list && st.seq.list.length >= 1);

    if (els.prev) els.prev.hidden = !inSeq;
    if (els.next) els.next.hidden = !inAnySeq;
    if (els.finish) els.finish.hidden = !inAnySeq;

    if (!inAnySeq) return;
    const atFirst = st.seq.idx <= 0; const atLast = st.seq.idx >= st.seq.list.length - 1;
    if (els.prev) { els.prev.disabled = atFirst; els.prev.title = atFirst ? "" : "Questão anterior"; }
    if (els.next) { els.next.textContent = atLast ? "Resumo" : "Próxima"; els.next.title = atLast ? "Ver resumo" : "Próxima questão"; els.next.disabled = false; }
    if (els.finish) { els.finish.disabled = false; els.finish.title = "Ver resumo"; }
  }

  function openSummary() {
    if (!st.seq) return;
    st.mode = "summary";
    st.q = null; st.selecionada = null; st.corrigido = false; st.correta = false;

    if (st.seq?.sessionId) {
      const resultsArray = Array.from(st.seq.results.entries()).map(([qid, r]) => ({
        id: qid, selected: r.selected, correct: r.correct, tipo: r.tipo, at: r.at
      }));
      window.Store?.finishSession(st.seq.sessionId, resultsArray);
    }

    const total = st.seq.list.length;
    const answered = st.seq.results.size;
    const correctCnt = Array.from(st.seq.results.values()).filter(r => r.correct).length;
    const perc = total ? Math.round((correctCnt / total) * 100) : 0;

    // Monta listas para revisão e detalhamento
    const wrongIds = new Set(Array.from(st.seq.results.entries()).filter(([id, r]) => !r.correct).map(([id]) => id));
    const wrongList = st.seq.list.filter(q => wrongIds.has(String(q.id)));
    const rightIds = new Set(Array.from(st.seq.results.entries()).filter(([id, r]) => r.correct).map(([id]) => id));

    const byCat = {};
    const byDif = {};
    st.seq.list.forEach((q) => {
      const r = st.seq.results.get(String(q.id));
      const cat = q.categoria || "—"; const dif = (q.dificuldade || "—").toLowerCase();
      if (!byCat[cat]) byCat[cat] = { total: 0, correct: 0 };
      if (!byDif[dif]) byDif[dif] = { total: 0, correct: 0 };
      byCat[cat].total++; byDif[dif].total++;
      if (r?.correct) { byCat[cat].correct++; byDif[dif].correct++; }
    });

    // Tempo (se exam mode com startAt)
    let elapsedMs = 0;
    if (st.exam.active && st.exam.startAt) {
      elapsedMs = Date.now() - st.exam.startAt;
    }

    if (els.title) els.title.textContent = `Resumo — ${total} questão(ões)`;

    const wrap = document.createElement("div");
    wrap.className = "player__summary";

    const prog = renderProgressHeader(total, total);
    wrap.appendChild(prog);

    const p = document.createElement("p");
    p.innerHTML = `Você respondeu <strong>${answered}</strong> de <strong>${total}</strong> e acertou <strong>${correctCnt}</strong> (${perc}%).` +
      (elapsedMs ? ` Tempo: <strong>${fmtDur(elapsedMs)}</strong>.` : "");
    wrap.appendChild(p);

    // Ações: Revisar erros / Exportar / Imprimir
    const actions = document.createElement("div");
    actions.className = "summary__actions";
    const btnReview = document.createElement("button");
    btnReview.className = "button";
    btnReview.textContent = "Revisar erros";
    btnReview.disabled = wrongList.length === 0;
    btnReview.title = wrongList.length ? "Refazer apenas as que você errou (com feedback)" : "Não há erros para revisar";
    btnReview.addEventListener("click", () => {
      if (!wrongList.length) return;
      // Revisão com feedback (exam desativado)
      startSequence(wrongList, 0, null, { filters: null, exam: { active: false } });
    });
    const btnExport = document.createElement("button");
    btnExport.className = "button";
    btnExport.textContent = "Exportar resultado";
    btnExport.title = "Baixar JSON com o resultado do simulado";
    btnExport.addEventListener("click", () => exportResultJSON(total, answered, correctCnt, perc, elapsedMs));
    const btnPrint = document.createElement("button");
    btnPrint.className = "button";
    btnPrint.textContent = "Imprimir";
    btnPrint.title = "Imprimir este resumo";
    btnPrint.addEventListener("click", () => window.print());
    actions.appendChild(btnReview); actions.appendChild(btnExport); actions.appendChild(btnPrint);
    wrap.appendChild(actions);

    // Listagem por questão (status)
    const ul = document.createElement("ul");
    ul.className = "options";
    st.seq.list.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = "option"; li.style.cursor = "default";
      const res = st.seq.results.get(String(it.id));
      const icon = document.createElement("span");
      icon.style.minWidth = "1.2rem"; icon.style.display = "inline-block";
      icon.textContent = res ? (res.correct ? "✅" : "❌") : "•";
      const text = document.createElement("span");
      text.textContent = `Q${it.id ?? (i + 1)} — ${it.tema || it.categoria || "Português"}`;
      const row = document.createElement("div");
      row.style.display = "flex"; row.style.gap = ".6rem"; row.style.alignItems = "center";
      row.appendChild(icon); row.appendChild(text);
      li.appendChild(row);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);

    // Detalhamento (categoria/dificuldade)
    const det = document.createElement("div");
    det.className = "summary__section";
    const grid = document.createElement("div");
    grid.className = "summary__grid";

    const cardC = document.createElement("div");
    cardC.className = "summary__card";
    const h4c = document.createElement("h4"); h4c.textContent = "Por categoria";
    cardC.appendChild(h4c);
    const tc = document.createElement("table"); tc.className = "summary__table";
    const thc = document.createElement("thead"); thc.innerHTML = "<tr><th>Categoria</th><th>Acertos</th><th>Total</th><th>%</th></tr>";
    const tbc = document.createElement("tbody");
    Object.keys(byCat).sort().forEach(k => {
      const r = byCat[k]; const acc = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${k}</td><td>${r.correct}</td><td>${r.total}</td><td>${acc}%</td>`;
      tbc.appendChild(tr);
    });
    tc.appendChild(thc); tc.appendChild(tbc); cardC.appendChild(tc);

    const cardD = document.createElement("div");
    cardD.className = "summary__card";
    const h4d = document.createElement("h4"); h4d.textContent = "Por dificuldade";
    cardD.appendChild(h4d);
    const td = document.createElement("table"); td.className = "summary__table";
    const thd = document.createElement("thead"); thd.innerHTML = "<tr><th>Dificuldade</th><th>Acertos</th><th>Total</th><th>%</th></tr>";
    const tbd = document.createElement("tbody");
    Object.keys(byDif).sort().forEach(k => {
      const r = byDif[k]; const acc = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${k}</td><td>${r.correct}</td><td>${r.total}</td><td>${acc}%</td>`;
      tbd.appendChild(tr);
    });
    td.appendChild(thd); td.appendChild(tbd); cardD.appendChild(td);

    grid.appendChild(cardC); grid.appendChild(cardD);
    det.appendChild(grid);
    wrap.appendChild(det);

    if (els.content) { els.content.innerHTML = ""; els.content.appendChild(wrap); }
    if (els.feedback) { els.feedback.textContent = ""; els.feedback.className = "feedback"; }
    if (els.verify) { els.verify.textContent = "Fechar"; els.verify.dataset.mode = "close"; els.verify.disabled = false; }

    if (els.prev) els.prev.hidden = true;
    if (els.next) els.next.hidden = true;
    if (els.finish) els.finish.hidden = true;

    emit("player:summary", { total, answered, correct: correctCnt, perc, byCat, byDif, elapsedMs });
  }

  function exportResultJSON(total, answered, correctCnt, perc, elapsedMs) {
    const payload = {
      when: new Date().toISOString(),
      exam: { active: st.exam.active || true, startAt: st.exam.startAt || null, durationMin: st.exam.durationMin || null, elapsedMs },
      total, answered, correct: correctCnt, perc,
      items: st.seq.list.map((q, i) => {
        const r = st.seq.results.get(String(q.id));
        return {
          id: q.id, categoria: q.categoria || null, dificuldade: q.dificuldade || null,
          tema: q.tema || null, tipo: q.tipo || null, correct: !!r?.correct
        };
      })
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = URL.createObjectURL(blob);
    a.download = `resultado-simulado-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  }

  function renderProgressHeader(totalOverride, currentOverride) {
    const total = totalOverride ?? (st.seq?.list?.length || 1);
    const step = currentOverride ?? ((st.seq?.idx ?? 0) + 1);

    const box = document.createElement("div"); box.className = "progress";
    const track = document.createElement("div"); track.className = "progress__track";
    track.setAttribute("role", "progressbar"); track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(total)); track.setAttribute("aria-valuenow", String(step));
    track.setAttribute("aria-label", "Progresso");
    const bar = document.createElement("div"); bar.className = "progress__bar";
    bar.style.width = `${Math.max(0, Math.min(100, (step / total) * 100))}%`;
    const label = document.createElement("div"); label.className = "progress__label";
    label.textContent = `Questão ${step} de ${total}`;
    track.appendChild(bar); box.appendChild(track); box.appendChild(label);
    return box;
  }

  function focusFirstInteractive() {
    const input = els.content?.querySelector(".lacuna-input");
    if (input) { input.focus(); return; }
    const firstRadio = els.content?.querySelector('input[type="radio"]');
    if (firstRadio) { firstRadio.focus(); return; }
    els.close?.focus();
  }

  function normText(s) { return String(s || "").toLowerCase().trim().replace(/\s+/g, " "); }
  function eqText(a, b) { return normText(a) === normText(b); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  window.Player = { init, open, close: closePlayer, startSequence, finishSequence };
})();