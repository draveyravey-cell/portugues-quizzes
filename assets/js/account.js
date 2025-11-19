"use strict";

/* Aba Conta — status, auto-sync e tempo online */
(function () {
    const els = {};
    let currentUserId = "guest";
    let sessionStart = Date.now();
    let visibleSince = (document.visibilityState === "visible") ? Date.now() : null;
    let tickTimer = null;

    const LS_KEYS = {
        autoSync: "pp.autoSync.enabled",
        autoInt: "pp.autoSync.interval",
        timeTotal: (uid) => `pp.time.total.${uid || "guest"}`
    };

    function qs(sel) { return document.querySelector(sel); }
    function fmtDate(ts) {
        if (!ts) return "—";
        try { return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
        catch { return "—"; }
    }
    function fmtDur(ms) {
        ms = Math.max(0, Math.floor(ms || 0));
        const s = Math.floor(ms / 1000);
        const hh = String(Math.floor(s / 3600)).padStart(2, "0");
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }
    function getUser() {
        try { return window.Auth?.getUser?.() || null; } catch { return null; }
    }
    function getClient() {
        try { return window.Auth?.getClient?.() || null; } catch { return null; }
    }
    function setText(el, txt) { if (el) el.textContent = txt == null ? "—" : String(txt); }

    function loadAutoSyncPrefs() {
        let enabled = true, interval = 60000;
        try {
            const e = localStorage.getItem(LS_KEYS.autoSync);
            const i = localStorage.getItem(LS_KEYS.autoInt);
            enabled = (e == null) ? true : (e === "1");
            interval = i ? parseInt(i, 10) : 60000;
            if (!isFinite(interval) || interval <= 0) interval = 60000;
        } catch { }
        return { enabled, interval };
    }
    function saveAutoSyncPrefs(enabled, interval) {
        try {
            localStorage.setItem(LS_KEYS.autoSync, enabled ? "1" : "0");
            localStorage.setItem(LS_KEYS.autoInt, String(interval));
        } catch { }
    }

    function getTotalMs(uid) {
        try { return parseInt(localStorage.getItem(LS_KEYS.timeTotal(uid)) || "0", 10) || 0; }
        catch { return 0; }
    }
    function setTotalMs(uid, ms) {
        try { localStorage.setItem(LS_KEYS.timeTotal(uid), String(Math.max(0, Math.floor(ms || 0)))); } catch { }
    }

    function computeSessionMs() {
        const now = Date.now();
        let acc = 0;
        // conta tempo visível
        if (visibleSince != null) acc += (now - visibleSince);
        return acc;
    }

    function renderStatus() {
        const u = getUser();
        const online = navigator.onLine;
        setText(els.status, u ? "Conectado" : "Visitante");
        setText(els.email, u?.email || "—");
        setText(els.uid, u?.id || "—");
        setText(els.online, online ? "Online" : "Offline");

        // Tentativas locais
        try {
            const stats = window.Store?.getStats?.();
            setText(els.localAttempts, stats?.totals?.attempts ?? 0);
        } catch { setText(els.localAttempts, 0); }

        // Últimos metadados de sync
        const uid = u?.id || "guest";
        const meta = window.Store?.getSyncMeta?.(uid) || {};
        setText(els.remoteAttempts, meta?.lastPullCount ?? 0);
        setText(els.lastPull, meta?.lastPullAt ? fmtDate(meta.lastPullAt) : "—");
        setText(els.lastPush, meta?.lastPushAt ? fmtDate(meta.lastPushAt) : "—");
    }

    function renderTime() {
        // Atualiza sessão e total do usuário atual
        const u = getUser();
        const uid = u?.id || "guest";
        const baseTotal = getTotalMs(uid);
        const sessionMs = (Date.now() - sessionStart) - (visibleSince ? 0 : 0); // base p/ exibir
        const visibleMs = computeSessionMs();
        setText(els.timeSession, fmtDur(visibleMs));
        setText(els.timeTotal, fmtDur(baseTotal + visibleMs));
    }

    function persistTime() {
        // acumula o tempo visível ao total
        const u = getUser();
        const uid = u?.id || "guest";
        const base = getTotalMs(uid);
        const visibleMs = computeSessionMs();
        setTotalMs(uid, base + visibleMs);
        // reinicia o marcador de visibilidade
        if (document.visibilityState === "visible") visibleSince = Date.now();
        else visibleSince = null;
    }

    function onVisibilityChange() {
        if (document.visibilityState === "hidden") {
            persistTime();
        } else {
            visibleSince = Date.now();
        }
    }

    function onAuthChanged() {
        // Ao trocar de usuário, persistir tempo do anterior e resetar contadores de sessão
        persistTime();
        sessionStart = Date.now();
        visibleSince = (document.visibilityState === "visible") ? Date.now() : null;
        currentUserId = getUser()?.id || "guest";
        renderStatus();
        renderTime();
    }

    function applyAutoSyncUI() {
        const prefs = loadAutoSyncPrefs();
        if (els.autoSync) els.autoSync.checked = !!prefs.enabled;
        if (els.interval) els.interval.value = String(prefs.interval);
    }

    function applyAutoSyncRuntime() {
        const u = getUser();
        const prefs = loadAutoSyncPrefs();
        if (u && prefs.enabled) window.Sync?.startAuto?.(prefs.interval);
        else window.Sync?.stopAuto?.();
    }

    function bind() {
        // Botões/Ações
        els.modalBtn?.addEventListener("click", () => {
            // abre modal de auth já existente
            const modal = qs("#auth-overlay");
            if (!modal) return;
            modal.classList.remove("hidden");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");
            const email = qs("#auth-email");
            (email || qs("#auth-close"))?.focus?.();
        });

        els.logout?.addEventListener("click", async () => {
            try { await getClient()?.auth?.signOut(); } catch { }
        });

        els.syncNow?.addEventListener("click", async () => {
            setText(els.syncMsg, "Sincronizando...");
            try {
                const res = await window.Sync?.syncAll?.();
                setText(els.syncMsg, res?.message || "Sincronização concluída.");
                renderStatus();
            } catch (e) {
                console.error(e);
                setText(els.syncMsg, "Falha na sincronização.");
            }
        });

        els.autoSync?.addEventListener("change", () => {
            const enabled = !!els.autoSync.checked;
            const interval = parseInt(els.interval?.value || "60000", 10) || 60000;
            saveAutoSyncPrefs(enabled, interval);
            applyAutoSyncRuntime();
        });

        els.interval?.addEventListener("change", () => {
            const enabled = !!els.autoSync.checked;
            const interval = parseInt(els.interval.value || "60000", 10) || 60000;
            saveAutoSyncPrefs(enabled, interval);
            applyAutoSyncRuntime();
        });

        els.timeReset?.addEventListener("click", () => {
            const u = getUser();
            const uid = u?.id || "guest";
            setTotalMs(uid, 0);
            visibleSince = (document.visibilityState === "visible") ? Date.now() : null;
            renderTime();
        });

        els.leaderboardReload?.addEventListener("click", async () => {
            await renderLeaderboard();
        });

        // Eventos globais
        window.addEventListener("online", () => renderStatus());
        window.addEventListener("offline", () => renderStatus());
        window.addEventListener("sync:status", () => { renderStatus(); });
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Escuta mudanças de auth diretamente do cliente
        const sb = getClient();
        if (sb?.auth) {
            sb.auth.onAuthStateChange((_evt, _sess) => onAuthChanged());
        }
    }

    function cacheEls() {
        els.status = qs("#acc-status");
        els.email = qs("#acc-email");
        els.uid = qs("#acc-uid");
        els.online = qs("#acc-online");

        els.localAttempts = qs("#acc-local-attempts");
        els.remoteAttempts = qs("#acc-remote-attempts");
        els.lastPull = qs("#acc-last-pull");
        els.lastPush = qs("#acc-last-push");

        els.syncNow = qs("#acc-sync-now");
        els.syncMsg = qs("#acc-sync-msg");

        els.autoSync = qs("#acc-auto-sync");
        els.interval = qs("#acc-interval");

        els.timeSession = qs("#acc-time-session");
        els.timeTotal = qs("#acc-time-total");
        els.timeReset = qs("#acc-time-reset");

        els.logout = qs("#acc-logout");
        els.modalBtn = qs("#acc-open-modal");

        els.leaderboardList = qs("#acc-leaderboard-list");
        els.leaderboardMsg = qs("#acc-leaderboard-msg");
        els.leaderboardReload = qs("#acc-leaderboard-reload");
    }

    function startTick() {
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(() => {
            renderTime();
        }, 1000);
    }

    function init() {
        // só inicializa se a seção existir
        if (!qs("#conta")) return;
        cacheEls();
        bind();
        applyAutoSyncUI();
        applyAutoSyncRuntime();

        currentUserId = getUser()?.id || "guest";
        sessionStart = Date.now();
        if (document.visibilityState === "visible") visibleSince = Date.now();

        renderStatus();
        renderTime();
        startTick();
        renderLeaderboard();
    }

    document.addEventListener("DOMContentLoaded", init);
    async function renderLeaderboard() {
        const listEl = els.leaderboardList;
        const msgEl = els.leaderboardMsg;
        if (!listEl || !msgEl) return;
        listEl.innerHTML = "";
        msgEl.textContent = "Carregando...";
        const client = getClient();
        let rows = [];
        try {
            if (client) {
                const { data, error } = await client
                    .from("leaderboard")
                    .select("user_id, score, accuracy, speed, streak_days, updated_at")
                    .order("score", { ascending: false })
                    .limit(10);
                if (error) throw error;
                rows = Array.isArray(data) ? data : [];
            }
        } catch (e) {
            rows = [];
        }
        if (!rows.length) {
            const local = computeLocalEntry();
            rows = local ? [local] : [];
            msgEl.textContent = rows.length ? "Leaderboard local (configure Supabase para global)." : "Sem dados.";
        } else {
            msgEl.textContent = "";
        }
        const ul = document.createElement("ul");
        ul.className = "options";
        rows.forEach((r, idx) => {
            const li = document.createElement("li");
            li.className = "option";
            const rank = String(idx + 1).padStart(2, "0");
            const uid = String(r.user_id || "");
            const acc = typeof r.accuracy === "number" ? Math.round(r.accuracy * 100) : r.accuracy;
            const spd = typeof r.speed === "number" ? r.speed.toFixed(2) : r.speed;
            const stk = r.streak_days || 0;
            li.innerHTML = `<div style="display:flex; gap:.6rem; align-items:center; width:100%"><strong>${rank}</strong><span style="flex:1">${uid}</span><span>Acc ${acc}%</span><span>Vel ${spd}</span><span>Seq ${stk}d</span></div>`;
            ul.appendChild(li);
        });
        listEl.innerHTML = "";
        listEl.appendChild(ul);
    }
    function computeLocalEntry() {
        try {
            const attempts = window.Store?.getAllAttempts?.() || [];
            if (!attempts.length) return null;
            const acc = computeAccuracy(attempts);
            const speed = computeSpeed(attempts);
            const streak = computeStreakDays(attempts);
            const score = computeScore(acc, speed, streak);
            const u = getUser();
            return { user_id: u?.id || "local", score, accuracy: acc, speed, streak_days: streak, updated_at: new Date().toISOString() };
        } catch {
            return null;
        }
    }
    function computeAccuracy(attempts) {
        const total = attempts.length;
        const correct = attempts.filter(a => !!a.correct).length;
        return total ? (correct / total) : 0;
    }
    function computeSpeed(attempts) {
        const times = attempts.map(a => {
            const v = a.value;
            if (v && typeof v === "object" && v.t != null) return Math.max(1, Number(v.t) || 0);
            return null;
        }).filter(x => x != null);
        if (!times.length) return 0;
        times.sort((a, b) => a - b);
        const n = Math.min(30, times.length);
        const recent = times.slice(-n);
        recent.sort((a, b) => a - b);
        const med = recent[Math.floor(recent.length / 2)];
        return med ? (60000 / med) : 0;
    }
    function computeStreakDays(attempts) {
        const days = new Set(attempts.map(a => new Date(a.at || Date.now()).toISOString().slice(0, 10)));
        const today = new Date();
        let streak = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date(today.getTime() - i * 86400000);
            const key = d.toISOString().slice(0, 10);
            if (days.has(key)) streak += 1; else break;
        }
        return streak;
    }
    function computeScore(acc, speed, streak) {
        const accW = 0.5, spdW = 0.3, stkW = 0.2;
        const accS = Math.max(0, Math.min(1, acc));
        const spdS = Math.max(0, Math.min(1, speed / 5));
        const stkS = Math.max(0, Math.min(1, streak / 30));
        return +(accS * accW + spdS * spdW + stkS * stkW).toFixed(4);
    }
})();