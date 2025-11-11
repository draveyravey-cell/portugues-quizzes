"use strict";

/* Simulado (core + refinos): iniciar, timer, pausar/retomar */
(function () {
    const els = {
        qtd: null, dur: null, start: null,
        timerWrap: null, timerText: null, toggleBtn: null
    };
    let running = false;
    let paused = false;
    let endAt = 0;
    let remainingMs = 0;
    let tId = null;
    let startAt = 0;
    let durationMin = 0;

    function qs(sel) { return document.querySelector(sel); }
    function getFilteredItems() {
        if (window.App?.getFilteredItems) return window.App.getFilteredItems();
        console.warn("App.getFilteredItems não disponível — verifique app.js.");
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
        startAt = Date.now();
        durationMin = Math.round(ms / 60000);
        endAt = Date.now() + ms;
        remainingMs = ms;
        running = true;
        paused = false;
        updateTimer();
        tId = setInterval(updateTimer, 1000);
        els.timerWrap?.classList.remove("hidden");
        if (els.toggleBtn) els.toggleBtn.textContent = "Pausar";
    }
    function stopTimer() {
        running = false; paused = false;
        if (tId) clearInterval(tId);
        tId = null; endAt = 0; remainingMs = 0;
        if (els.timerWrap) {
            els.timerWrap.classList.remove("exam-timer--warn", "exam-timer--danger");
            els.timerWrap.classList.add("hidden");
        }
    }
    function pauseTimer() {
        if (!running || paused) return;
        paused = true;
        remainingMs = Math.max(0, endAt - Date.now());
        if (tId) clearInterval(tId);
        tId = null;
        if (els.toggleBtn) els.toggleBtn.textContent = "Retomar";
    }
    function resumeTimer() {
        if (!running || !paused) return;
        paused = false;
        endAt = Date.now() + remainingMs;
        updateTimer();
        tId = setInterval(updateTimer, 1000);
        if (els.toggleBtn) els.toggleBtn.textContent = "Pausar";
    }
    function updateTimer() {
        if (!running) return;
        if (paused) return;
        const ms = endAt - Date.now();
        if (ms <= 0) {
            if (els.timerText) els.timerText.textContent = "00:00";
            try { window.Player?.finishSequence?.(); } catch (e) { console.warn(e); }
            stopTimer();
            return;
        }
        remainingMs = ms;
        const s = Math.floor(ms / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        if (els.timerText) els.timerText.textContent = `${mm}:${ss}`;
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
        startTimer(durMin * 60000);

        const filters = {
            q: window.localStorage.getItem("f.q") || "",
            cat: window.localStorage.getItem("f.cat") || "all",
            dif: window.localStorage.getItem("f.dif") || "all"
        };
        window.Player?.startSequence(list, 0, els.start, { filters, exam: { active: true, startAt, durationMin: durMin } });
    }

    function bind() {
        els.start?.addEventListener("click", startExam);
        els.toggleBtn?.addEventListener("click", () => {
            if (!running) return;
            if (paused) resumeTimer(); else pauseTimer();
        });

        window.addEventListener("player:summary", () => stopTimer());
        window.addEventListener("player:closed", () => stopTimer());
    }

    function init() {
        els.qtd = qs("#sim-qtd");
        els.dur = qs("#sim-dur");
        els.start = qs("#sim-start");
        els.timerWrap = qs("#exam-timer");
        els.timerText = qs("#exam-timer-text");
        els.toggleBtn = qs("#exam-timer-toggle");
        if (!els.start || !els.timerWrap || !els.timerText || !els.toggleBtn) return;
        bind();
    }

    document.addEventListener("DOMContentLoaded", init);
})();