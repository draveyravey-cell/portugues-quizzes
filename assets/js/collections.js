"use strict";

/* Coleções — picker + painel (seção #colecoes) */
(function () {
    const els = {
        // Picker
        overlay: null, close: null, title: null, list: null, msg: null, done: null, new2: null, createAdd: null,
        // Seção
        newName: null, newCreate: null, exportAll: null, importBtn: null, file: null, grid: null
    };

    let currentQuestion = null; // { id, tema, categoria }

    function qs(sel) { return document.querySelector(sel); }

    /* ===== Picker ===== */

    function openPicker(q) {
        currentQuestion = q;
        if (!els.overlay) cacheEls();
        renderPickerList();
        if (els.title) els.title.textContent = `Adicionar à coleção — Q${q?.id}`;
        if (els.msg) els.msg.textContent = "";
        els.overlay?.classList.remove("hidden");
        els.overlay?.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        els.new2?.focus?.();
    }
    function closePicker() {
        currentQuestion = null;
        els.overlay?.classList.add("hidden");
        els.overlay?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }
    function renderPickerList() {
        if (!els.list) return;
        const colls = window.Store?.getCollections?.() || [];
        els.list.innerHTML = "";
        const frag = document.createDocumentFragment();
        if (!colls.length) {
            const li = document.createElement("li");
            li.className = "option";
            li.textContent = "Nenhuma coleção criada ainda.";
            frag.appendChild(li);
        } else {
            colls.forEach(c => {
                const li = document.createElement("li");
                li.className = "option";
                const label = document.createElement("label"); label.style.display = "flex"; label.style.gap = ".5rem"; label.style.alignItems = "center";
                const ck = document.createElement("input"); ck.type = "checkbox"; ck.checked = window.Store?.isInCollection?.(c.id, currentQuestion?.id);
                ck.addEventListener("change", () => {
                    if (ck.checked) window.Store?.addToCollection?.(c.id, currentQuestion?.id);
                    else window.Store?.removeFromCollection?.(c.id, currentQuestion?.id);
                });
                const span = document.createElement("span");
                span.textContent = c.name;
                label.appendChild(ck); label.appendChild(span);
                li.appendChild(label);
                frag.appendChild(li);
            });
        }
        els.list.appendChild(frag);
    }

    async function createAndAdd() {
        const name = (els.new2?.value || "").trim();
        if (!name) { setPickerMsg("Informe um nome.", "err"); return; }

        try {
            const created = await toPromise(window.Store?.createCollection?.(name));
            const id = getCreatedId(created, name) || findCollectionIdByName(name);
            if (!id) {
                console.warn("Store.createCollection não retornou id; tentando re-render e localizar depois.");
                setTimeout(() => { renderPickerList(); renderCollectionsGrid(); }, 0);
                setPickerMsg("Coleção criada. Adicione novamente se necessário.", "ok");
                return;
            }

            if (currentQuestion?.id != null) {
                window.Store?.addToCollection?.(id, currentQuestion.id);
            }
            els.new2.value = "";
            renderPickerList();
            renderCollectionsGrid();
            setPickerMsg("Coleção criada e questão adicionada.", "ok");
        } catch (e) {
            console.error(e);
            setPickerMsg("Falha ao criar a coleção.", "err");
        }
    }

    function setPickerMsg(t, type = "") {
        if (els.msg) { els.msg.textContent = t || ""; els.msg.className = "msg " + (type || ""); }
    }

    /* ===== Seção Coleções ===== */

    async function createCollectionFromPanel() {
        const name = (els.newName?.value || "").trim();
        if (!name) { els.newName?.focus?.(); return; }
        try {
            const created = await toPromise(window.Store?.createCollection?.(name));
            // Tenta identificar o id criado; se não vier, localiza por nome após pequeno atraso
            const id = getCreatedId(created, name) || findCollectionIdByName(name);
            els.newName.value = "";
            // Re-render imediato e no próximo tick para cobrir Store assíncrona
            renderCollectionsGrid();
            setTimeout(renderCollectionsGrid, 0);
            if (!id) console.warn("Coleção criada mas id não retornado pela Store.");
        } catch (e) {
            console.error(e);
            alert("Falha ao criar coleção.");
        }
    }

    function exportAllCollections() {
        try {
            const db = JSON.parse(window.Store?.exportJSON?.() || "{}");
            const cols = Array.isArray(db.collections) ? db.collections : [];
            const data = JSON.stringify({ collections: cols }, null, 2);
            downloadBlob(data, "colecoes.json", "application/json");
        } catch (e) {
            console.error(e);
            alert("Falha ao exportar coleções.");
        }
    }

    // Import robusto com normalização da entrada e garantia de IDs
    async function importCollectionsFile(ev) {
        const file = ev.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const obj = JSON.parse(text);
            const incomingRaw = normalizeImportedCollections(obj);
            const incoming = ensureCollectionIds(incomingRaw);

            const dbCur = JSON.parse(window.Store?.exportJSON?.() || "{}");
            dbCur.collections = mergeCollections(dbCur.collections || [], incoming);

            window.Store?.importJSON?.(JSON.stringify(dbCur), { replace: true });
            renderCollectionsGrid();
            setTimeout(renderCollectionsGrid, 0);
            alert(`Coleções importadas (${incoming.length}).`);
        } catch (e) {
            console.error(e);
            alert("Arquivo inválido.");
        } finally {
            ev.target.value = "";
        }
    }

    function renderCollectionsGrid() {
        const grid = els.grid;
        if (!grid) return;
        const colls = window.Store?.getCollections?.() || [];
        if (!colls.length) {
            grid.innerHTML = `
        <div class="empty">
          <svg class="empty__art" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs><linearGradient id="e1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="rgba(106,166,255,.5)"/><stop offset="100%" stop-color="rgba(255,224,138,.4)"/>
            </linearGradient></defs>
            <ellipse cx="100" cy="100" rx="70" ry="12" fill="rgba(0,0,0,.18)"/>
            <path d="M40 90c30-40 90-40 120 0-40 20-80 20-120 0z" fill="url(#e1)"/>
            <circle cx="80" cy="70" r="10" fill="url(#e1)"/><circle cx="120" cy="60" r="14" fill="url(#e1)"/>
          </svg>
          <div class="empty__title">Nenhuma coleção ainda</div>
          <div class="empty__text">Crie uma nova coleção para começar.</div>
        </div>
      `;
            return;
        }

        // Dataset corrente (para contadores)
        const all = window.App?.getAllItems?.() || [];

        const frag = document.createDocumentFragment();
        colls.forEach(c => {
            const card = document.createElement("article");
            card.className = "col-card";
            const h3 = document.createElement("h3");
            h3.textContent = c.name || "Coleção";
            const total = (c.qids || []).length;
            const present = (c.qids || []).filter(id => all.some(q => String(q.id) === String(id))).length;
            const meta = document.createElement("div");
            meta.className = "col-meta";
            meta.textContent = `Questões: ${present}/${total}`;

            const actions = document.createElement("div");
            actions.className = "col-actions";

            const bStart = document.createElement("button");
            bStart.className = "button primary";
            bStart.title = "Iniciar estudo desta coleção";
            bStart.innerHTML = `<svg class="icon"><use href="#i-play"/></svg> Iniciar`;
            // Buscar dataset no momento do clique (não fechar sobre "all" do render)
            bStart.addEventListener("click", () => {
                const allNow = window.App?.getAllItems?.() || [];
                const list = (c.qids || [])
                    .map(id => allNow.find(q => String(q.id) === String(id)))
                    .filter(Boolean);

                if (!list.length) {
                    alert("Esta coleção não possui questões válidas no dataset atual.");
                    return;
                }
                window.Player?.startSequence(list, 0, bStart, { filters: { q: "", cat: "all", dif: "all" }, exam: { active: false } });
            });

            const bExport = document.createElement("button");
            bExport.className = "button";
            bExport.title = "Exportar esta coleção (JSON)";
            bExport.innerHTML = `<svg class="icon"><use href="#i-download"/></svg> Exportar`;
            bExport.addEventListener("click", () => {
                const data = JSON.stringify({ id: c.id, name: c.name, qids: c.qids || [] }, null, 2);
                downloadBlob(data, `colecao-${(c.name || "sem-nome")}.json`, "application/json");
            });

            const bRename = document.createElement("button");
            bRename.className = "button";
            bRename.title = "Renomear coleção";
            bRename.innerHTML = `<svg class="icon"><use href="#i-edit"/></svg> Renomear`;
            bRename.addEventListener("click", () => {
                const nm = prompt("Novo nome da coleção:", c.name || "Coleção");
                if (nm == null) return;
                window.Store?.renameCollection?.(c.id, nm);
                renderCollectionsGrid();
                setTimeout(renderCollectionsGrid, 0);
            });

            const bDel = document.createElement("button");
            bDel.className = "button";
            bDel.title = "Excluir coleção";
            bDel.innerHTML = `<svg class="icon"><use href="#i-trash"/></svg> Excluir`;
            bDel.addEventListener("click", () => {
                if (!confirm(`Excluir a coleção "${c.name}"?`)) return;
                window.Store?.deleteCollection?.(c.id);
                renderCollectionsGrid();
                setTimeout(renderCollectionsGrid, 0);
            });

            actions.appendChild(bStart);
            actions.appendChild(bExport);
            actions.appendChild(bRename);
            actions.appendChild(bDel);

            card.appendChild(h3);
            card.appendChild(meta);
            card.appendChild(actions);
            frag.appendChild(card);
        });

        grid.innerHTML = "";
        grid.appendChild(frag);
    }

    /* ===== Helpers ===== */

    function toPromise(v) { return v && typeof v.then === "function" ? v : Promise.resolve(v); }

    // Extrai um id de retorno da Store (pode vir como string, número ou objeto)
    function getCreatedId(ret, name) {
        if (ret == null) return null;
        if (typeof ret === "string" || typeof ret === "number") return String(ret);
        if (typeof ret === "object" && ret.id != null) return String(ret.id);
        // Alguns stores podem retornar o objeto completo com name, qids, etc.
        if (typeof ret === "object" && ret.name && !ret.id) {
            const maybe = findCollectionIdByName(ret.name);
            if (maybe) return maybe;
        }
        // Por nome, última tentativa
        return findCollectionIdByName(name);
    }
    function findCollectionIdByName(name) {
        const colls = window.Store?.getCollections?.() || [];
        const target = String(name || "").toLowerCase().trim();
        const found = colls.find(c => String(c.name || "").toLowerCase().trim() === target);
        return found?.id ? String(found.id) : null;
    }

    function downloadBlob(text, filename, mime = "application/octet-stream") {
        const blob = new Blob([text], { type: mime });
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url; a.download = filename || "file";
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }

    // Normaliza diferentes formatos de import para um array de coleções
    function normalizeImportedCollections(data) {
        if (!data) return [];
        // Se vier { collections: [...] }
        if (Array.isArray(data.collections)) return data.collections;
        // Se vier um array direto
        if (Array.isArray(data)) return data;
        // Se vier um único objeto de coleção { id?, name, qids }
        if (typeof data === "object" && (data.id != null || data.name || data.qids)) return [data];
        return [];
    }

    // Garante IDs para coleções importadas sem id (usa slug do nome com fallback único)
    function ensureCollectionIds(list) {
        const used = new Set();
        return (list || []).map((c) => {
            if (!c) return null;
            let id = c.id != null && String(c.id).trim() !== "" ? String(c.id) : slugify(c.name || "");
            if (!id) id = `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
            while (used.has(id)) {
                id = `${id}-${Math.floor(Math.random() * 1000)}`;
            }
            used.add(id);
            return { id, name: c.name || "Coleção", qids: Array.isArray(c.qids) ? c.qids : [] };
        }).filter(Boolean);
    }

    function slugify(s) {
        return String(s || "")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function mergeCollections(a, b) {
        const map = new Map();
        [...a, ...b].forEach(c => {
            if (!c || !c.id) return;
            const prev = map.get(c.id);
            if (!prev) {
                map.set(c.id, { id: c.id, name: c.name || "Coleção", qids: Array.from(new Set((c.qids || []).map(String))) });
            } else {
                prev.name = prev.name || c.name || "Coleção";
                prev.qids = Array.from(new Set([...(prev.qids || []), ...((c.qids || []).map(String))]));
                map.set(c.id, prev);
            }
        });
        return Array.from(map.values());
    }

    function bind() {
        // Picker
        els.close?.addEventListener("click", closePicker);
        els.done?.addEventListener("click", closePicker);
        els.overlay?.addEventListener("mousedown", (e) => { if (e.target === els.overlay) closePicker(); });
        els.createAdd?.addEventListener("click", createAndAdd);
        els.new2?.addEventListener?.("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); createAndAdd(); } });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !els.overlay?.classList.contains("hidden")) {
                closePicker();
            }
        });

        // Seção
        els.newCreate?.addEventListener("click", createCollectionFromPanel);
        els.newName?.addEventListener?.("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); createCollectionFromPanel(); } });
        els.exportAll?.addEventListener("click", exportAllCollections);
        els.importBtn?.addEventListener("click", () => els.file?.click());
        els.file?.addEventListener("change", importCollectionsFile);

        // Re-render on changes (store e dataset)
        window.addEventListener("store:changed", (ev) => {
            const t = ev?.detail?.type || "";
            // Reage sempre que não houver type ou quando contiver "collection"
            if (!t || /collection/i.test(t)) {
                renderCollectionsGrid();
                if (currentQuestion) renderPickerList();
            }
        });
        window.addEventListener("app:data-ready", renderCollectionsGrid);
    }

    function cacheEls() {
        // Picker
        els.overlay = qs("#col-overlay");
        els.close = qs("#col-close");
        els.title = qs("#col-title");
        els.list = qs("#col-list");
        els.msg = qs("#col-msg");
        els.done = qs("#col-done");
        els.new2 = qs("#col-new2");
        els.createAdd = qs("#col-create-add");
        // Seção
        els.newName = qs("#col-new-name");
        els.newCreate = qs("#col-new-create");
        els.exportAll = qs("#col-export-all");
        els.importBtn = qs("#col-import");
        els.file = qs("#col-file");
        els.grid = qs("#collections-list");
    }

    function init() {
        cacheEls();
        bind();
        renderCollectionsGrid();
        // Segundo render após o ciclo atual (cobre Store.init do app.js)
        requestAnimationFrame(renderCollectionsGrid);
    }

    // Expor API do picker para os cards
    window.Collections = { openPicker };

    document.addEventListener("DOMContentLoaded", init);
})();