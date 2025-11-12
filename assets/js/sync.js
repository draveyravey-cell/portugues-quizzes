"use strict";

/* Sync v2 — bidirecional (pull + push) com Supabase
   window.Sync:
   - syncAll(): empurra deletes, puxa da nuvem, mescla no local, empurra faltantes/alterados
   - startAuto(), stopAuto()
*/
(function () {
    let timer = null;

    function sb() { return window.Auth?.getClient?.(); }
    function user() { return window.Auth?.getUser?.(); }

    /* ===== Attempts ===== */

    async function fetchAllAttempts(userId) {
        const client = sb();
        if (!client || !userId) return [];
        const pageSize = 1000;
        let from = 0;
        const out = [];
        while (true) {
            const { data, error } = await client
                .from("attempts")
                .select("*")
                .eq("user_id", userId)
                .order("at", { ascending: true })
                .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            out.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
        }
        return out;
    }

    async function upsertAttempts(rows) {
        if (!rows || !rows.length) return { count: 0 };
        const client = sb();
        const { error } = await client.from("attempts").upsert(rows, { onConflict: "id" });
        if (error) throw error;
        return { count: rows.length };
    }

    function mapRemoteAttemptsToLocal(remoteRows) {
        return (remoteRows || []).map(r => ({
            id: String(r.id),
            sessionId: null, // sessões não sincronizadas
            qid: String(r.qid),
            tipo: r.tipo || "",
            categoria: r.categoria || null,
            dificuldade: r.dificuldade || null,
            value: r.value ?? null,
            correct: !!r.correct,
            at: r.at ? new Date(r.at).getTime?.() || r.at : Date.now()
        }));
    }

    /* ===== Collections ===== */

    async function fetchAllCollections(userId) {
        const client = sb();
        if (!client || !userId) return [];
        const { data, error } = await client
            .from("collections")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async function upsertCollections(rows) {
        if (!rows || !rows.length) return { count: 0 };
        const client = sb();
        const { error } = await client.from("collections").upsert(rows, { onConflict: "id" });
        if (error) throw error;
        return { count: rows.length };
    }

    // Deleta coleções por IDs no Supabase
    async function deleteCollectionsByIds(ids, userId) {
        if (!ids || !ids.length) return { deleted: 0 };
        const client = sb();
        // .select() retorna as linhas deletadas; se não quiser dados, pode omitir
        const { error } = await client
            .from("collections")
            .delete()
            .eq("user_id", userId)
            .in("id", ids);
        if (error) throw error;
        return { deleted: ids.length };
    }

    function mapRemoteCollections(rows) {
        return (rows || []).map(r => ({
            id: String(r.id),
            name: r.name || "Coleção",
            qids: Array.isArray(r.qids) ? r.qids.map(String) : []
        }));
    }

    function normalizeLocalCollections(list) {
        return (list || []).map(c => ({
            id: String(c.id),
            name: c.name || "Coleção",
            qids: Array.from(new Set((c.qids || []).map(String)))
        }));
    }

    function sameCollection(a, b) {
        if (!a || !b) return false;
        if ((a.name || "") !== (b.name || "")) return false;
        const A = Array.from(new Set((a.qids || []).map(String))).sort();
        const B = Array.from(new Set((b.qids || []).map(String))).sort();
        if (A.length !== B.length) return false;
        for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
        return true;
    }

    /* ===== Orquestrador ===== */

    async function syncAll() {
        const u = user();
        const client = sb();
        if (!u || !client) return { ok: false, message: "Não autenticado." };

        // 0) PUSH deletes de coleções (tombstones) antes de qualquer pull
        let deletedCols = 0;
        try {
            const tombs = window.Store?.getDeletedCollections?.() || [];
            const ids = tombs.map(t => String(t.id));
            if (ids.length) {
                const res = await deleteCollectionsByIds(ids, u.id);
                deletedCols = res.deleted || ids.length;
                // Se deletou (ou não existia mais), limpamos os tombstones
                window.Store?.clearDeletedCollections?.(ids);
                window.Store?.setSyncMeta?.(u.id, { lastCollectionsDeleteCount: deletedCols });
            }
        } catch (e) {
            console.warn("collections delete push failed:", e);
            // Mantém tombstones para tentar de novo no próximo sync
        }

        // 1) Attempts
        let remoteAttempts = [];
        let mergeRes = { added: 0, updated: 0, kept: 0 };
        let pushedAttempts = 0;

        try {
            remoteAttempts = await fetchAllAttempts(u.id);
            const remoteLocalFmt = mapRemoteAttemptsToLocal(remoteAttempts);
            mergeRes = window.Store?.mergeAttempts?.(remoteLocalFmt) || { added: 0, updated: 0, kept: 0 };
            window.Store?.setSyncMeta?.(u.id, { lastPullAt: Date.now(), lastPullCount: remoteAttempts.length });

            const remoteIds = new Set(remoteAttempts.map(r => r.id));
            const localAll = window.Store?.getAllAttempts?.() || [];
            const toPushLocal = localAll.filter(a => !remoteIds.has(a.id));
            if (toPushLocal.length) {
                const rows = toPushLocal.map(a => ({
                    id: a.id,
                    user_id: u.id,
                    qid: a.qid,
                    tipo: a.tipo || null,
                    categoria: a.categoria || null,
                    dificuldade: a.dificuldade || null,
                    value: a.value ?? null,
                    correct: !!a.correct,
                    at: a.at ? new Date(a.at).toISOString() : new Date().toISOString()
                }));
                const res = await upsertAttempts(rows);
                pushedAttempts = res.count || 0;
            }
            window.Store?.setSyncMeta?.(u.id, { lastPushAt: Date.now(), lastPushCount: pushedAttempts });
        } catch (e) {
            console.warn("attempts sync failed:", e);
        }

        // 2) Collections (pull -> merge -> push upserts)
        let remoteCollections = [];
        let pushedCols = 0;

        try {
            const remoteCollRows = await fetchAllCollections(u.id);
            remoteCollections = mapRemoteCollections(remoteCollRows);

            // Mescla remoto -> local (usa importJSON que já mescla coleções por id)
            try {
                window.Store?.importJSON?.(JSON.stringify({ collections: remoteCollections }), { replace: false });
            } catch (e) {
                console.warn("merge collections (importJSON) falhou:", e);
            }

            // Push local -> remoto (novas ou alteradas)
            const localCollections = normalizeLocalCollections(window.Store?.getCollections?.() || []);
            const remoteById = new Map(remoteCollections.map(c => [c.id, c]));
            const toPushCols = localCollections.filter(c => {
                const r = remoteById.get(c.id);
                if (!r) return true;          // não existe no remoto
                return !sameCollection(c, r); // existe, mas diferente
            });

            if (toPushCols.length) {
                const rows = toPushCols.map(c => ({
                    id: c.id,
                    user_id: u.id,
                    name: c.name,
                    qids: c.qids
                }));
                const resCols = await upsertCollections(rows);
                pushedCols = resCols.count || toPushCols.length;
            }

            window.Store?.setSyncMeta?.(u.id, {
                lastCollectionsPullCount: remoteCollections.length,
                lastCollectionsPushCount: pushedCols
            });
        } catch (e) {
            console.warn("collections sync failed:", e);
        }

        // Notifica UI
        window.dispatchEvent(new CustomEvent("sync:status", {
            detail: {
                ok: true,
                pull: { remote: remoteAttempts.length, merged: mergeRes },
                push: { pushed: pushedAttempts },
                collections: { pulled: remoteCollections.length, pushed: pushedCols, deleted: deletedCols }
            }
        }));

        return {
            ok: true,
            message: `Del C:${deletedCols} • Pull A:${remoteAttempts.length} (+${mergeRes.added}/${mergeRes.updated}) • Push A:${pushedAttempts} • Pull C:${remoteCollections.length} • Push C:${pushedCols}`
        };
    }

    function startAuto(intervalMs = 60000) {
        stopAuto();
        timer = setInterval(() => { syncAll().catch(console.warn); }, intervalMs);
    }

    function stopAuto() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    // Dispara sync com debounce após mudanças locais (tentativas, coleções, etc)
    let debounceId;
    window.addEventListener("store:changed", () => {
        if (!user() || !sb()) return;
        clearTimeout(debounceId);
        debounceId = setTimeout(() => { syncAll().catch(console.warn); }, 5000);
    });

    window.Sync = { syncAll, startAuto, stopAuto };
})();