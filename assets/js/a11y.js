"use strict";

/* A11y utils — focus trap e navegação de rádio por setas (global: window.A11y) */
(function () {
  function getFocusable(root) {
    const selectors = [
      'a[href]',
      'area[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      'summary'
    ];
    return Array.from(root.querySelectorAll(selectors.join(',')))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function trapFocus(container) {
    let onKeydown, onFocusin;
    function activate() {
      onKeydown = (e) => {
        if (e.key !== "Tab") return;
        const focusables = getFocusable(container);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      onFocusin = (e) => {
        if (!container.contains(e.target)) {
          const focusables = getFocusable(container);
          focusables[0]?.focus();
        }
      };
      document.addEventListener("keydown", onKeydown, true);
      document.addEventListener("focusin", onFocusin, true);
    }
    function release() {
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("focusin", onFocusin, true);
    }
    return { activate, release };
  }

  // Setas para navegar entre rádios do mesmo grupo
  function enhanceRadioGroup(container) {
    if (!container) return;
    container.addEventListener("keydown", (e) => {
      const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
      if (!keys.includes(e.key)) return;
      const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
      if (!radios.length) return;

      const dir = (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : -1;
      const active = document.activeElement;
      let idx = radios.indexOf(active);
      if (idx === -1) {
        idx = 0;
      } else {
        idx = (idx + dir + radios.length) % radios.length;
      }
      e.preventDefault();
      const target = radios[idx];
      target.focus();
      target.click(); // dispara change e mantém semântica nativa
    });
  }

  window.A11y = { trapFocus, enhanceRadioGroup, getFocusable };
})();