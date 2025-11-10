"use strict";

// Sync: envia tentativas locais (Store) ao Supabase
(function () {
    async function syncAll() {
        const sb = window.Auth?.getClient?.();
        const user = window.Auth?.getUser?.();
        if (!sb || !user) return { ok: false, message: "Não autenticado." };

        // Coleta tentativas locais
        const exportDb = JSON.parse(window.Store?.exportJSON?.() || "{}");
        const attempts = Array.isArray(exportDb.attempts) ? exportDb.attempts : [];

        if (!attempts.length) return { ok: true, message: "Nada para sincronizar." };

        // Upsert por id (evita duplicar na nuvem)
        const rows = attempts.map(a => ({
            id: a.id,
            user_id: user.id,
            qid: String(a.qid),
            tipo: a.tipo || null,
            categoria: a.categoria || null,
            dificuldade: a.dificuldade || null,
            value: a.value ?? null,
            correct: !!a.correct,
            at: a.at ? new Date(a.at).toISOString() : new Date().toISOString()
        }));

        const { error } = await sb.from("attempts").upsert(rows, { onConflict: "id" });
        if (error) throw error;

        return { ok: true, message: `Sincronizadas ${rows.length} tentativa(s).` };
    }

    window.Sync = { syncAll };
})();