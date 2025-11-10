"use strict";

/* Sync v2 — bidirecional (pull + push) com Supabase
   window.Sync:
   - syncAll(): puxa da nuvem, mescla no local, empurra faltantes
   - startAuto(), stopAuto()
*/
(function () {
    let timer = null;

    function sb() { return window.Auth?.getClient?.(); }
    function user() { return window.Auth?.getUser?.(); }

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

    function mapRemoteToLocal(remoteRows) {
        return (remoteRows || []).map(r => ({
            id: String(r.id),
            sessionId: null, // não sincronizamos sessão ainda
            qid: String(r.qid),
            tipo: r.tipo || "",
            categoria: r.categoria || null,
            dificuldade: r.dificuldade || null,
            value: r.value ?? null,
            correct: !!r.correct,
            at: r.at ? new Date(r.at).getTime?.() || r.at : Date.now()
        }));
    }

    async function syncAll() {
        const u = user();
        const client = sb();
        if (!u || !client) return { ok: false, message: "Não autenticado." };

        // PULL: baixa tudo do usuário e mescla
        const remote = await fetchAllAttempts(u.id);
        const remoteLocalFmt = mapRemoteToLocal(remote);
        const mergeRes = window.Store?.mergeAttempts?.(remoteLocalFmt) || { added: 0, updated: 0, kept: 0 };
        window.Store?.setSyncMeta?.(u.id, { lastPullAt: Date.now(), lastPullCount: remote.length });

        // PUSH: envia o que está apenas local (por id)
        const remoteIds = new Set(remote.map(r => r.id));
        const localAll = window.Store?.getAllAttempts?.() || [];
        const toPushLocal = localAll.filter(a => !remoteIds.has(a.id));
        let pushed = 0;
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
            pushed = res.count || 0;
        }
        window.Store?.setSyncMeta?.(u.id, { lastPushAt: Date.now(), lastPushCount: pushed });

        // Notifica UI
        window.dispatchEvent(new CustomEvent("sync:status", {
            detail: {
                ok: true,
                pull: { remote: remote.length, merged: mergeRes },
                push: { pushed }
            }
        }));

        return { ok: true, message: `Pull ${remote.length} / Merge +${mergeRes.added}/${mergeRes.updated}; Push ${pushed}` };
    }

    function startAuto(intervalMs = 60000) {
        stopAuto();
        timer = setInterval(() => { syncAll().catch(console.warn); }, intervalMs);
    }

    function stopAuto() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    // Opcional: sincroniza após mudanças locais (debounce)
    let debounceId;
    window.addEventListener("store:changed", () => {
        if (!user() || !sb()) return;
        clearTimeout(debounceId);
        debounceId = setTimeout(() => { syncAll().catch(console.warn); }, 5000);
    });

    window.Sync = { syncAll, startAuto, stopAuto };
})();