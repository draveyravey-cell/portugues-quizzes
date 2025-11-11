"use strict";

/* UI: tooltips e ajuda automática */
(function () {
    let tipEl = null, tipTimer = null;

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
            const t = e.target.closest("[data-tip], [title]");
            if (!t) return;
            const text = t.getAttribute("data-tip") || t.getAttribute("title");
            if (!text) return;
            tipTimer = setTimeout(() => showTip(t, text), 300);
        });
        document.addEventListener("mouseout", (e) => {
            const t = e.target.closest("[data-tip], [title]");
            if (!t) return;
            hideTip();
        });
        document.addEventListener("focusin", (e) => {
            const t = e.target.closest("[data-tip], [title]");
            if (!t) return;
            const text = t.getAttribute("data-tip") || t.getAttribute("title");
            if (text) showTip(t, text);
        });
        document.addEventListener("focusout", hideTip);
        window.addEventListener("scroll", hideTip, { passive: true });
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
        } catch { }
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindTooltips();
        // Abre “Como usar?” na primeira visita
        ["help-exercicios", "help-historico", "help-editor", "help-conta"].forEach(openHelpFirstTime);

        // Dicas: adicione data-tip em alguns elementos básicos, se desejar:
        const busca = document.getElementById("busca");
        if (busca && !busca.getAttribute("data-tip")) busca.setAttribute("data-tip", "Digite termos como 'crase', 'à tarde'...");
        const cat = document.getElementById("f-categoria");
        if (cat && !cat.getAttribute("data-tip")) cat.setAttribute("data-tip", "Filtre por categoria (ex.: Crase, Ortografia...)");
        const dif = document.getElementById("f-dificuldade");
        if (dif && !dif.getAttribute("data-tip")) dif.setAttribute("data-tip", "Filtre por dificuldade (fácil, médio, difícil)");
    });
})();