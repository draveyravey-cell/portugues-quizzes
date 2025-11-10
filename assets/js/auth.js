"use strict";

/* Auth (Supabase) + integração de Sync (auto) */
(function () {
    const els = {
        btn: null, overlay: null, modal: null, close: null,
        email: null, pass: null, login: null, signup: null, msg: null,
        logout: null, sync: null
    };

    let sb = null; // supabase client
    let user = null;

    function hasSupabaseConfig() {
        const c = window.APP_CONFIG || {};
        return c.authProvider === "supabase" && c.supabaseUrl && c.supabaseAnonKey && window.supabase;
    }

    function initSupabase() {
        if (!hasSupabaseConfig()) return null;
        const { supabaseUrl, supabaseAnonKey } = window.APP_CONFIG;
        return window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
    }

    function qs(sel) { return document.querySelector(sel); }
    function setMsg(t, type = "") { if (els.msg) { els.msg.textContent = t || ""; els.msg.className = "msg " + (type || ""); } }
    function open() { if (!els.overlay) return; els.overlay.classList.remove("hidden"); els.overlay.setAttribute("aria-hidden", "false"); document.body.classList.add("modal-open"); (els.email || els.close).focus(); renderFooter(); }
    function close() { if (!els.overlay) return; els.overlay.classList.add("hidden"); els.overlay.setAttribute("aria-hidden", "true"); document.body.classList.remove("modal-open"); setMsg(""); }
    function renderFooter() {
        const logged = !!user;
        if (els.logout) els.logout.hidden = !logged;
        if (els.sync) els.sync.hidden = !logged;
        if (els.login) els.login.hidden = logged;
        if (els.signup) els.signup.hidden = logged;
        if (els.email) els.email.disabled = logged;
        if (els.pass) els.pass.disabled = logged;
        const title = qs("#auth-title");
        if (title) title.textContent = logged ? (user?.email || "Minha conta") : "Entrar";
    }

    async function handleLogin() {
        if (!sb) { setMsg("Auth não configurado.", "err"); return; }
        const email = (els.email.value || "").trim();
        const pass = els.pass.value || "";
        if (!email || !pass) { setMsg("Informe e-mail e senha.", "err"); return; }
        setMsg("Entrando...");
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) { setMsg("Falha ao entrar: " + error.message, "err"); return; }
        user = data?.user || null;
        setMsg("Login realizado.", "ok");
        renderFooter();
        // Sync imediato pós-login
        try { await window.Sync?.syncAll?.(); } catch (e) { console.warn(e); }
        window.Sync?.startAuto?.(60000);
    }

    async function handleSignup() {
        if (!sb) { setMsg("Auth não configurado.", "err"); return; }
        const email = (els.email.value || "").trim();
        const pass = els.pass.value || "";
        if (!email || !pass) { setMsg("Informe e-mail e senha.", "err"); return; }
        setMsg("Criando conta...");
        const { data, error } = await sb.auth.signUp({ email, password: pass });
        if (error) { setMsg("Falha ao criar conta: " + error.message, "err"); return; }
        user = data?.user || null;
        setMsg("Conta criada. Verifique seu e-mail (se exigido).", "ok");
        renderFooter();
        // Opcionalmente, já tentar sync (vai puxar vazio)
        try { await window.Sync?.syncAll?.(); } catch (e) { console.warn(e); }
        window.Sync?.startAuto?.(60000);
    }

    async function handleLogout() {
        if (!sb) return;
        await sb.auth.signOut();
        user = null;
        setMsg("Você saiu.", "ok");
        renderFooter();
        window.Sync?.stopAuto?.();
    }

    async function handleSyncNow() {
        if (!user) { setMsg("Entre para sincronizar.", "err"); return; }
        setMsg("Sincronizando...");
        try {
            const res = await window.Sync?.syncAll?.();
            setMsg(res?.message || "Sincronização concluída.", "ok");
        } catch (e) {
            console.error(e);
            setMsg("Falha na sincronização.", "err");
        }
    }

    function updateAccountBtn() {
        const b = els.btn;
        if (!b) return;
        if (user?.email) {
            const name = user.email.split("@")[0] || "Conta";
            b.textContent = "👤 " + name;
            b.title = user.email;
        } else {
            b.textContent = "👤";
            b.title = "Conta";
        }
    }

    async function init() {
        els.btn = qs("#account-btn");
        els.overlay = qs("#auth-overlay");
        els.modal = els.overlay?.querySelector(".modal") || null;
        els.close = qs("#auth-close");
        els.email = qs("#auth-email");
        els.pass = qs("#auth-pass");
        els.login = qs("#auth-login");
        els.signup = qs("#auth-signup");
        els.msg = qs("#auth-msg");
        els.logout = qs("#auth-logout");
        els.sync = qs("#auth-sync");

        if (hasSupabaseConfig()) {
            sb = initSupabase();
            const { data: { user: u } } = await sb.auth.getUser();
            user = u || null;
            updateAccountBtn();
            renderFooter();

            // Ao carregar a página logado: sincroniza e inicia auto-sync
            if (user) {
                try { await window.Sync?.syncAll?.(); } catch (e) { console.warn(e); }
                window.Sync?.startAuto?.(60000);
            }

            sb.auth.onAuthStateChange(async (_evt, sess) => {
                user = sess?.user || null;
                updateAccountBtn();
                renderFooter();
                if (user) {
                    try { await window.Sync?.syncAll?.(); } catch (e) { console.warn(e); }
                    window.Sync?.startAuto?.(60000);
                } else {
                    window.Sync?.stopAuto?.();
                }
            });
        }

        els.btn?.addEventListener("click", open);
        els.close?.addEventListener("click", close);
        els.overlay?.addEventListener("mousedown", (e) => { if (e.target === els.overlay) close(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !els.overlay?.classList.contains("hidden")) close(); });

        els.login?.addEventListener("click", handleLogin);
        els.signup?.addEventListener("click", handleSignup);
        els.logout?.addEventListener("click", handleLogout);
        els.sync?.addEventListener("click", handleSyncNow);

        // Exibe status de sync no modal (opcional)
        window.addEventListener("sync:status", (ev) => {
            const d = ev.detail;
            if (d?.ok) {
                setMsg(`Sync: pull ${d.pull?.remote || 0} / push ${d.push?.pushed || 0}`, "ok");
            }
        });

        // Exponibiliza
        window.Auth = {
            getUser: () => user,
            getClient: () => sb
        };
    }

    document.addEventListener("DOMContentLoaded", init);
})();