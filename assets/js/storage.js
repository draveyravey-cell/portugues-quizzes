"use strict";

/* Store v2.3 — LocalStorage + merge/sync + favoritos + coleções
   window.Store:
   - init, newSession, finishSession, recordAttempt
   - getStats, exportJSON, importJSON, clear
   - mergeAttempts(remote[]), getAllAttempts(), rebuildPerQ()
   - getSyncMeta(userId), setSyncMeta(userId, patch)
   - favoritos: getFavorites(), isFavorite(qid), setFavorite(qid, on), toggleFavorite(qid)
   - coleções:
     getCollections(), getCollectionById(id),
     createCollection(name), renameCollection(id, name), deleteCollection(id),
     addToCollection(id, qid), removeFromCollection(id, qid),
     isInCollection(id, qid), getCollectionsByQuestion(qid)
*/
(function () {
  const KEY = "pp.v1";
  let db = null;

  function init() {
    db = loadOrCreate();
    return db;
  }

  function baseDb() {
    return {
      version: 2,
      createdAt: Date.now(),
      sessions: [],
      attempts: [],
      perQ: {},
      favorites: [],
      collections: [] // {id, name, qids:[]}
    };
  }

  function loadOrCreate() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const fresh = baseDb();
        localStorage.setItem(KEY, JSON.stringify(fresh));
        return fresh;
      }
      const parsed = JSON.parse(raw);
      parsed.version = 2;
      parsed.createdAt = parsed.createdAt || Date.now();
      parsed.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      parsed.attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
      parsed.perQ = typeof parsed.perQ === "object" && parsed.perQ !== null ? parsed.perQ : {};
      parsed.favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      parsed.collections = Array.isArray(parsed.collections) ? parsed.collections : [];
      return parsed;
    } catch (e) {
      console.warn("Store: reset após erro de parse.", e);
      const fresh = baseDb();
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  function save(notify = true, type = "save") {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      if (notify) dispatchChanged(type);
    } catch (e) {
      console.error("Store: erro ao salvar", e);
    }
  }

  function dispatchChanged(type) {
    window.dispatchEvent(new CustomEvent("store:changed", { detail: { type } }));
  }

  /* ========= Sessões ========= */

  function newSession(meta = {}) {
    const id = genId("s");
    const session = {
      id, startedAt: Date.now(), finishedAt: null,
      filters: sanitizeFilters(meta.filters),
      questionIds: (meta.questionIds || []).map(String),
      results: [] // { qid, selected, correct, tipo, at? }
    };
    db.sessions.push(session);
    save(true, "sessions");
    return id;
  }

  function finishSession(sessionId, results) {
    const s = db.sessions.find((x) => x.id === sessionId);
    if (!s) return false;
    if (s.finishedAt == null) s.finishedAt = Date.now();

    if (Array.isArray(results)) {
      s.results = results.map((r) => ({
        qid: String(r.id ?? r.qid),
        selected: r.selected ?? r.value ?? null,
        correct: !!r.correct,
        tipo: r.tipo || null,
        at: r.at || Date.now()
      }));
    }
    save(true, "sessions");
    return true;
  }

  /* ========= Tentativas ========= */

  function recordAttempt({ sessionId = null, question, selected, correct, at = Date.now() } = {}) {
    if (!question || question.id == null) return null;
    const a = {
      id: genId("a"),
      sessionId: sessionId || null,
      qid: String(question.id),
      tipo: String(question.tipo || ""),
      categoria: question.categoria || null,
      dificuldade: question.dificuldade || null,
      value: normalizeValue(selected),
      correct: !!correct,
      at
    };
    db.attempts.push(a);
    updatePerQWithAttempt(a);

    if (sessionId) {
      const s = db.sessions.find((x) => x.id === sessionId);
      if (s) {
        const key = a.qid;
        const idx = s.results.findIndex((r) => String(r.qid || r.id) === key);
        const resObj = { qid: key, selected: a.value, correct: a.correct, tipo: a.tipo, at: a.at };
        if (idx >= 0) s.results[idx] = resObj;
        else s.results.push(resObj);
      }
    }

    save(true, "attempts");
    return a;
  }

  /* ========= Estatísticas ========= */

  function getStats() {
    const attempts = db.attempts.slice().sort((a, b) => b.at - a.at);
    const total = attempts.length;
    const correct = attempts.filter((x) => x.correct).length;
    const uniqueQ = new Set(attempts.map((x) => x.qid)).size;
    const lastAt = attempts[0]?.at || null;

    const byCategory = {};
    const byDifficulty = {};
    attempts.forEach((a) => {
      if (a.categoria) {
        const c = byCategory[a.categoria] || { attempts: 0, correct: 0 };
        c.attempts++;
        if (a.correct) c.correct++;
        byCategory[a.categoria] = c;
      }
      if (a.dificuldade) {
        const d = byDifficulty[a.dificuldade] || { attempts: 0, correct: 0 };
        d.attempts++;
        if (a.correct) d.correct++;
        byDifficulty[a.dificuldade] = d;
      }
    });

    const sessions = db.sessions.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    return {
      totals: { attempts: total, correct, accuracy: total ? correct / total : 0, uniqueQ, lastAt },
      lastAttempts: attempts.slice(0, 20),
      sessions,
      perQ: db.perQ,
      byCategory,
      byDifficulty
    };
  }

  /* ========= Export/Import ========= */

  function exportJSON() {
    return JSON.stringify(db, null, 2);
  }

  function importJSON(text, { replace = false } = {}) {
    let incoming;
    try { incoming = JSON.parse(text); } catch { throw new Error("JSON inválido"); }
    if (typeof incoming !== "object" || incoming == null) throw new Error("Formato não suportado");

    incoming.version = 2;
    incoming.sessions = Array.isArray(incoming.sessions) ? incoming.sessions : [];
    incoming.attempts = Array.isArray(incoming.attempts) ? incoming.attempts : [];
    incoming.perQ = typeof incoming.perQ === "object" && incoming.perQ != null ? incoming.perQ : {};
    incoming.favorites = Array.isArray(incoming.favorites) ? incoming.favorites : [];
    incoming.collections = Array.isArray(incoming.collections) ? incoming.collections : [];

    if (replace) {
      db = incoming;
    } else {
      db.sessions = dedupById(db.sessions.concat(incoming.sessions));
      db.attempts = dedupById(db.attempts.concat(incoming.attempts));
      db.favorites = Array.from(new Set([...(db.favorites || []), ...(incoming.favorites || [])]));
      db.collections = mergeCollections(db.collections || [], incoming.collections || []);
      db.perQ = {};
      rebuildPerQ();
    }
    save(true, "import");
    return true;
  }

  function clear() {
    db = baseDb();
    save(true, "clear");
  }

  /* ========= Merge remoto (sync) ========= */

  function mergeAttempts(remoteAttempts = []) {
    if (!Array.isArray(remoteAttempts) || !remoteAttempts.length) return { added: 0, updated: 0, kept: 0 };
    const byId = new Map(db.attempts.map(a => [a.id, a]));
    let added = 0, updated = 0, kept = 0;

    remoteAttempts.forEach(r => {
      if (!r || !r.id) return;
      const local = byId.get(r.id);
      if (!local) {
        db.attempts.push({
          id: String(r.id),
          sessionId: r.sessionId || null,
          qid: String(r.qid),
          tipo: r.tipo || "",
          categoria: r.categoria || null,
          dificuldade: r.dificuldade || null,
          value: r.value ?? null,
          correct: !!r.correct,
          at: r.at ? new Date(r.at).getTime?.() || r.at : Date.now()
        });
        added++;
      } else {
        const rAt = r.at ? new Date(r.at).getTime?.() || r.at : 0;
        const lAt = local.at || 0;
        if (rAt > lAt) {
          local.sessionId = r.sessionId || local.sessionId || null;
          local.qid = String(r.qid);
          local.tipo = r.tipo || "";
          local.categoria = r.categoria || null;
          local.dificuldade = r.dificuldade || null;
          local.value = r.value ?? null;
          local.correct = !!r.correct;
          local.at = rAt;
          updated++;
        } else {
          kept++;
        }
      }
    });

    db.perQ = {};
    rebuildPerQ();
    save(true, "attempts");
    return { added, updated, kept };
  }

  function getAllAttempts() {
    return db.attempts.slice();
  }

  function rebuildPerQ() {
    db.perQ = {};
    db.attempts.slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach(updatePerQWithAttempt);
    save(false);
  }

  /* ========= Favoritos ========= */

  function getFavorites() {
    return Array.from(new Set(db.favorites || [])).map(String);
  }
  function isFavorite(qid) {
    if (qid == null) return false;
    const id = String(qid);
    return (db.favorites || []).some(f => String(f) === id);
  }
  function setFavorite(qid, on) {
    if (qid == null) return;
    const id = String(qid);
    const set = new Set(db.favorites || []);
    if (on) set.add(id); else set.delete(id);
    db.favorites = Array.from(set);
    save(true, "favorites");
  }
  function toggleFavorite(qid) { setFavorite(qid, !isFavorite(qid)); }

  /* ========= Coleções ========= */

  function getCollections() { return (db.collections || []).slice(); }
  function getCollectionById(id) { return (db.collections || []).find(c => c.id === id) || null; }

  function createCollection(name) {
    const id = genId("c");
    const c = { id, name: String(name || "Nova coleção"), qids: [] };
    db.collections.push(c);
    save(true, "collections");
    return id;
  }
  function renameCollection(id, name) {
    const c = getCollectionById(id); if (!c) return false;
    c.name = String(name || c.name);
    save(true, "collections");
    return true;
  }
  function deleteCollection(id) {
    db.collections = (db.collections || []).filter(c => c.id !== id);
    save(true, "collections");
  }
  function addToCollection(id, qid) {
    const c = getCollectionById(id); if (!c) return false;
    const q = String(qid);
    const set = new Set((c.qids || []).map(String));
    set.add(q); c.qids = Array.from(set);
    save(true, "collections");
    return true;
  }
  function removeFromCollection(id, qid) {
    const c = getCollectionById(id); if (!c) return false;
    const q = String(qid);
    c.qids = (c.qids || []).filter(x => String(x) !== q);
    save(true, "collections");
    return true;
  }
  function isInCollection(id, qid) {
    const c = getCollectionById(id); if (!c) return false;
    const q = String(qid);
    return (c.qids || []).some(x => String(x) === q);
  }
  function getCollectionsByQuestion(qid) {
    const q = String(qid);
    return (db.collections || []).filter(c => (c.qids || []).some(x => String(x) === q));
  }
  function mergeCollections(a, b) {
    const map = new Map();
    [...a, ...b].forEach(c => {
      if (!c || !c.id) return;
      const prev = map.get(c.id);
      if (!prev) map.set(c.id, { id: c.id, name: c.name || "Coleção", qids: Array.from(new Set((c.qids || []).map(String))) });
      else {
        prev.name = prev.name || c.name || "Coleção";
        prev.qids = Array.from(new Set([...(prev.qids || []), ...((c.qids || []).map(String))]));
        map.set(c.id, prev);
      }
    });
    return Array.from(map.values());
  }

  /* ========= Utils ========= */

  function updatePerQWithAttempt(a) {
    const key = String(a.qid);
    const pq = db.perQ[key] || { count: 0, correct: 0, lastAt: 0, lastCorrect: false, streak: 0, bestStreak: 0 };
    pq.count += 1;
    if (a.correct) { pq.correct += 1; pq.streak = pq.lastCorrect ? pq.streak + 1 : 1; pq.bestStreak = Math.max(pq.bestStreak, pq.streak); }
    else { pq.streak = 0; }
    pq.lastAt = a.at || Date.now();
    pq.lastCorrect = !!a.correct;
    db.perQ[key] = pq;
  }

  function genId(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
  function normalizeValue(v) { return v; }
  function sanitizeFilters(f) { if (!f) return null; return { q: f.q || "", cat: f.cat || "all", dif: f.dif || "all" }; }
  function dedupById(arr) { const map = new Map(); arr.forEach((it) => { if (it && it.id) map.set(it.id, it); }); return Array.from(map.values()); }

  window.Store = {
    init, newSession, finishSession, recordAttempt,
    getStats, exportJSON, importJSON, clear,
    mergeAttempts, getAllAttempts, rebuildPerQ,
    getSyncMeta, setSyncMeta,
    getFavorites, isFavorite, setFavorite, toggleFavorite,
    getCollections, getCollectionById, createCollection, renameCollection, deleteCollection,
    addToCollection, removeFromCollection, isInCollection, getCollectionsByQuestion
  };

  try { init(); } catch (e) { console.warn("Store: init falhou", e); }
})();