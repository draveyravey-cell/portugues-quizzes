"use strict";

/* UI geral: tooltips, ajuda automática, topbar/menu e tema */
(function () {
    // ---------------------------
    // Tooltips e ajuda automática
    // ---------------------------
    let tipEl = null, tipTimer = null;
    const titleCache = new WeakMap();

    function showTip(target, text) {
        if (!text) return;
        hideTip();
        tipEl = document.createElement("div");
        tipEl.className = "tooltip";
        tipEl.textContent = text;
        document.body.appendChild(tipEl);

        const r = target.getBoundingClientRect();
        const x = r.left + r.width / 2 + window.scrollX;
        const y = r.top + window.scrollY;
        tipEl.style.left = x + "px";
        tipEl.style.top = (y - 8) + "px";
    }

    function hideTip() {
        clearTimeout(tipTimer);
        if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
        tipEl = null;
    }

    function bindTooltips() {
        document.addEventListener("mouseover", (e) => {
            const t = e.target.closest("[data-tip], [title], [aria-label]");
            if (!t) return;
            const title = t.getAttribute("title");
            if (title) {
                // Evita tooltip nativo enquanto nosso tooltip está ativo
                titleCache.set(t, title);
                t.removeAttribute("title");
            }
            const text = t.getAttribute("data-tip") || title || t.getAttribute("aria-label");
            if (!text) return;
            clearTimeout(tipTimer);
            tipTimer = setTimeout(() => showTip(t, text), 300);
        });

        document.addEventListener("mouseout", (e) => {
            const t = e.target.closest("[data-tip], [aria-label]");
            if (!t) return;
            // Restaura title original (se havia)
            if (titleCache.has(t) && !t.hasAttribute("title")) {
                const val = titleCache.get(t);
                if (val) t.setAttribute("title", val);
                titleCache.delete(t);
            }
            hideTip();
        });

        document.addEventListener("focusin", (e) => {
            const t = e.target.closest("[data-tip], [title], [aria-label]");
            if (!t) return;
            const title = t.getAttribute("title");
            if (title) {
                titleCache.set(t, title);
                t.removeAttribute("title");
            }
            const text = t.getAttribute("data-tip") || title || t.getAttribute("aria-label");
            if (text) showTip(t, text);
        });

        document.addEventListener("focusout", (e) => {
            const t = e.target.closest("[data-tip], [aria-label]");
            if (t && titleCache.has(t) && !t.hasAttribute("title")) {
                const val = titleCache.get(t);
                if (val) t.setAttribute("title", val);
                titleCache.delete(t);
            }
            hideTip();
        });

        window.addEventListener("scroll", hideTip, { passive: true });
        window.addEventListener("resize", hideTip, { passive: true });
    }

    function openHelpFirstTime(id) {
        try {
            const key = `pp.help.${id}.seen`;
            if (localStorage.getItem(key) === "1") return;
            const det = document.getElementById(id);
            if (det && det.tagName.toLowerCase() === "details") {
                det.open = true;
                localStorage.setItem(key, "1");
            }
        } catch { /* noop */ }
    }

    // ---------------------------
    // Topbar: menu, estado e nav ativo
    // ---------------------------
    function bindTopbar() {
        const topbar = document.querySelector(".topbar");
        const mainNav = document.getElementById("main-nav");
        const menuBtn = document.getElementById("menu-toggle");
        const backdrop = document.getElementById("nav-backdrop");

        // Sombra/estado ao rolar
        const onScroll = () => {
            if (!topbar) return;
            if (window.scrollY > 4) topbar.classList.add("topbar--scrolled");
            else topbar.classList.remove("topbar--scrolled");
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        // Abre/fecha menu mobile
        const setMenu = (open) => {
            if (!mainNav || !menuBtn) return;
            mainNav.classList.toggle("is-open", open);
            menuBtn.setAttribute("aria-expanded", String(open));
            document.body.classList.toggle("menu-open", open);
            if (backdrop) backdrop.hidden = !open;
            if (open) {
                const first = mainNav.querySelector("a");
                if (first) first.focus({ preventScroll: true });
            } else {
                menuBtn.focus({ preventScroll: true });
            }
        };

        menuBtn?.addEventListener("click", () => setMenu(!mainNav?.classList.contains("is-open")));
        backdrop?.addEventListener("click", () => setMenu(false));
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

        // Fecha o menu ao clicar em um link (mobile)
        mainNav?.addEventListener("click", (e) => {
            const a = e.target.closest("a");
            if (!a) return;
            setMenu(false);
        });

        // Link ativo por hash
        const setActiveByHash = () => {
            if (!mainNav) return;
            const hash = location.hash || "#inicio";
            mainNav.querySelectorAll("a").forEach(a => {
                a.classList.toggle("is-active", a.getAttribute("href") === hash);
            });
        };
        window.addEventListener("hashchange", setActiveByHash);

        // Link ativo por rolagem (IntersectionObserver)
        const hrefs = Array.from(mainNav?.querySelectorAll("a") || [])
            .map(a => a.getAttribute("href"))
            .filter(h => h && h.startsWith("#"));
        const sections = hrefs.map(id => document.querySelector(id)).filter(Boolean);

        if ("IntersectionObserver" in window && sections.length) {
            const obs = new IntersectionObserver((entries) => {
                const visible = entries
                    .filter(e => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
                if (visible.length) {
                    const id = "#" + visible[0].target.id;
                    mainNav.querySelectorAll("a").forEach(a => {
                        a.classList.toggle("is-active", a.getAttribute("href") === id);
                    });
                }
            }, { rootMargin: "-40% 0px -55% 0px", threshold: [0.01, 0.25, 0.6] });
            sections.forEach(sec => obs.observe(sec));
        } else {
            setActiveByHash();
        }
    }

    // ---------------------------
    // Tema: alternância light/dark
    // ---------------------------
    function bindThemeToggle() {
        const btn = document.getElementById("theme-toggle");
        if (!btn) return;
        const icon = btn.querySelector(".theme-icon");
        const root = document.documentElement;

        const getTheme = () => root.getAttribute("data-theme") || "light";
        const setIcon = (theme) => {
            if (icon) icon.textContent = theme === "dark" ? "🌙" : "☀️";
        };

        setIcon(getTheme());

        btn.addEventListener("click", () => {
            try {
                const current = getTheme();
                const next = current === "dark" ? "light" : "dark";
                root.setAttribute("data-theme", next);
                localStorage.setItem("theme", next);
                setIcon(next);
            } catch { /* noop */ }
        });
    }

    // ---------------------------
    // Status: pequeno ajuste visual com online/offline (opcional e não intrusivo)
    // ---------------------------
    function bindStatusConnectivity() {
        const badge = document.getElementById("status-badge");
        const dot = badge?.querySelector(".dot");
        if (!badge || !dot) return;

        const update = () => {
            const online = navigator.onLine;
            // Apenas varia a opacidade do ponto para indicar offline sem mexer no texto
            dot.style.opacity = online ? "1" : ".45";
            dot.style.filter = online ? "none" : "grayscale(1)";
            badge.title = online ? "Status" : "Sem conexão";
        };

        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        update();
    }

    // ---------------------------
    // Boot
    // ---------------------------
    document.addEventListener("DOMContentLoaded", () => {
        bindTooltips();

        // Abre “Como usar?” na primeira visita
        ["help-exercicios", "help-historico", "help-editor", "help-conta"].forEach(openHelpFirstTime);

        // Dicas básicas (fallback, caso faltem no HTML)
        const busca = document.getElementById("busca");
        if (busca && !busca.getAttribute("data-tip")) busca.setAttribute("data-tip", "Digite termos como 'crase', 'à tarde'...");
        const cat = document.getElementById("f-categoria");
        if (cat && !cat.getAttribute("data-tip")) cat.setAttribute("data-tip", "Filtre por categoria (ex.: Crase, Ortografia...)");
        const dif = document.getElementById("f-dificuldade");
        if (dif && !dif.getAttribute("data-tip")) dif.setAttribute("data-tip", "Filtre por dificuldade (fácil, médio, difícil)");

        // Topbar/menu, tema e status
        bindTopbar();
        bindThemeToggle();
        bindStatusConnectivity();
    });
})();