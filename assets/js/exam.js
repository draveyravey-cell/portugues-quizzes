"use strict";

/* Simulado (core) — iniciar a partir da visão atual, timer e finalização */
(function () {
    const els = {
        qtd: null, dur: null, start: null,
        timerWrap: null, timerText: null
    };
    let running = false;
    let endAt = 0;
    let tId = null;

    function qs(sel) { return document.querySelector(sel); }

    function getFilteredItems() {
        if (window.App?.getFilteredItems) return window.App.getFilteredItems();
        console.warn("App.getFilteredItems não disponível — verifique app.js (Parte 2/3).");
        return [];
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function startTimer(ms) {
        stopTimer();
        endAt = Date.now() + ms;
        running = true;
        updateTimer();
        tId = setInterval(updateTimer, 1000);
        els.timerWrap?.classList.remove("hidden");
    }

    function stopTimer() {
        running = false;
        if (tId) clearInterval(tId);
        tId = null;
        endAt = 0;
        if (els.timerWrap) {
            els.timerWrap.classList.remove("exam-timer--warn", "exam-timer--danger");
            els.timerWrap.classList.add("hidden");
        }
    }

    function updateTimer() {
        if (!running) return;
        const ms = endAt - Date.now();
        if (ms <= 0) {
            els.timerText && (els.timerText.textContent = "00:00");
            // Tempo acabou: finaliza simulado
            try { window.Player?.finishSequence?.(); } catch (e) { console.warn(e); }
            stopTimer();
            return;
        }
        const s = Math.floor(ms / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        if (els.timerText) els.timerText.textContent = `${mm}:${ss}`;
        // classes de aviso
        if (ms <= 60000) {
            els.timerWrap?.classList.add("exam-timer--danger");
            els.timerWrap?.classList.remove("exam-timer--warn");
        } else if (ms <= 180000) {
            els.timerWrap?.classList.add("exam-timer--warn");
            els.timerWrap?.classList.remove("exam-timer--danger");
        } else {
            els.timerWrap?.classList.remove("exam-timer--warn", "exam-timer--danger");
        }
    }

    async function startExam() {
        const items = getFilteredItems();
        const qtd = parseInt(els.qtd?.value || "10", 10) || 10;
        const durMin = parseInt(els.dur?.value || "10", 10) || 10;

        if (!items || !items.length) {
            alert("Nenhum exercício disponível na visão atual.");
            return;
        }
        const list = shuffle(items).slice(0, Math.min(qtd, items.length));

        // Timer
        startTimer(durMin * 60000);

        // Inicia sequência no Player com exam mode
        const filters = {
            q: window.localStorage.getItem("f.q") || "",
            cat: window.localStorage.getItem("f.cat") || "all",
            dif: window.localStorage.getItem("f.dif") || "all"
        };
        window.Player?.startSequence(list, 0, els.start, { filters, exam: { active: true } });
    }

    function bind() {
        els.start?.addEventListener("click", startExam);

        // Quando o player fecha ou mostra o resumo, paramos o timer
        window.addEventListener("player:summary", () => stopTimer());
        window.addEventListener("player:closed", () => stopTimer());
    }

    function init() {
        els.qtd = qs("#sim-qtd");
        els.dur = qs("#sim-dur");
        els.start = qs("#sim-start");
        els.timerWrap = qs("#exam-timer");
        els.timerText = qs("#exam-timer-text");
        if (!els.start || !els.timerWrap || !els.timerText) return;
        bind();
    }

    document.addEventListener("DOMContentLoaded", init);
})();