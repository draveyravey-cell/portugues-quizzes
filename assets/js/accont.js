"use strict";

/* Aba Conta — status, auto-sync e tempo online */
(function () {
    const els = {};
    let sessionStart = Date.now();
    let visibleSince = (document.visibilityState === "visible") ? Date.now() : null;
    let tickTimer = null;

    const LS_KEYS = {
        autoSync: "pp.autoSync.enabled",
        autoInt: "pp.autoSync.interval",
        timeTotal: (uid) => `pp.time.total.${uid || "guest"}`
    };

    function qs(sel) { return document.querySelector(sel); }
    function getUser() { try { return window.Auth?.getUser?.() || null; } catch { return null; } }
    function getClient() { try { return window.Auth?.getClient?.() || null; } catch { return null; } }
    function setText(el, txt) { if (el) el.textContent = txt == null ? "—" : String(txt); }
    function fmtDate(ts) { if (!ts) return "—"; try { return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; } }
    function fmtDur(ms) { ms = Math.max(0, ms | 0); const s = (ms / 1000) | 0; const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, ss = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`; }

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
        try { return parseInt(localStorage.getItem(LS_KEYS.timeTotal(uid)) || "0", 10) || 0; } catch { return 0; }
    }
    function setTotalMs(uid, ms) {
        try { localStorage.setItem(LS_KEYS.timeTotal(uid), String(Math.max(0, ms | 0))); } catch { }
    }

    function computeVisibleMs() {
        if (visibleSince == null) return 0;
        return Date.now() - visibleSince;
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
        const u = getUser();
        const uid = u?.id || "guest";
        const baseTotal = getTotalMs(uid);
        setText(els.timeSession, fmtDur(computeVisibleMs()));
        setText(els.timeTotal, fmtDur(baseTotal + computeVisibleMs()));
    }

    function persistTime() {
        const u = getUser();
        const uid = u?.id || "guest";
        const base = getTotalMs(uid);
        const add = computeVisibleMs();
        setTotalMs(uid, base + add);
        visibleSince = (document.visibilityState === "visible") ? Date.now() : null;
    }

    function onVisibilityChange() {
        if (document.visibilityState === "hidden") persistTime();
        else visibleSince = Date.now();
    }

    function applyAutoSyncUI() {
        const prefs = loadAutoSyncPrefs();
        if (els.autoSync) els.autoSync.checked = !!prefs.enabled;
        if (els.interval) els.interval.value = String(prefs.interval);
    }
    function applyAutoSyncRuntime() {
        const u = getUser();
        const prefs = loadAutoSyncPrefs();
        if (u && prefs.enabled) window.Sync?.startAuto?.(parseInt(prefs.interval, 10) || 60000);
        else window.Sync?.stopAuto?.();
    }

    function bind() {
        els.modalBtn?.addEventListener("click", () => {
            const modal = qs("#auth-overlay");
            if (!modal) return;
            modal.classList.remove("hidden");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");
            (qs("#auth-email") || qs("#auth-close"))?.focus?.();
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
            } catch { setText(els.syncMsg, "Falha na sincronização."); }
        });
        els.autoSync?.addEventListener("change", () => {
            const enabled = !!els.autoSync.checked;
            const interval = parseInt(els.interval?.value || "60000", 10) || 60000;
            saveAutoSyncPrefs(enabled, interval); applyAutoSyncRuntime();
        });
        els.interval?.addEventListener("change", () => {
            const enabled = !!els.autoSync.checked;
            const interval = parseInt(els.interval.value || "60000", 10) || 60000;
            saveAutoSyncPrefs(enabled, interval); applyAutoSyncRuntime();
        });
        els.timeReset?.addEventListener("click", () => {
            const uid = getUser()?.id || "guest";
            setTotalMs(uid, 0);
            visibleSince = (document.visibilityState === "visible") ? Date.now() : null;
            renderTime();
        });

        window.addEventListener("online", renderStatus);
        window.addEventListener("offline", renderStatus);
        window.addEventListener("sync:status", renderStatus);
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Ouve mudanças de auth (caso auth.js já tenha client pronto)
        const sb = getClient();
        sb?.auth?.onAuthStateChange?.((_evt, _sess) => {
            // Revela estado atual
            renderStatus();
            applyAutoSyncRuntime();
            // Reinicia contadores de tempo de sessão
            persistTime();
            sessionStart = Date.now();
            visibleSince = (document.visibilityState === "visible") ? Date.now() : null;
            renderTime();
        });
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
    }

    function startTick() {
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(renderTime, 1000);
    }

    function init() {
        if (!qs("#conta")) return; // só se a aba existir
        cacheEls();
        bind();
        applyAutoSyncUI();
        applyAutoSyncRuntime();
        // Primeira render
        renderStatus();
        renderTime();
        startTick();
    }

    document.addEventListener("DOMContentLoaded", init);
})();