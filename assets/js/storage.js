"use strict";

/* Store v1 — Persistência em localStorage
   window.Store: init, newSession, finishSession, recordAttempt, getStats, exportJSON, importJSON, clear
*/
(function () {
  const KEY = "pp.v1";
  let db = null;

  function init() {
    db = loadOrCreate();
    return db;
  }

  function loadOrCreate() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const fresh = { version: 1, createdAt: Date.now(), sessions: [], attempts: [], perQ: {} };
        localStorage.setItem(KEY, JSON.stringify(fresh));
        return fresh;
      }
      const parsed = JSON.parse(raw);
      parsed.version = 1;
      parsed.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      parsed.attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
      parsed.perQ = typeof parsed.perQ === "object" && parsed.perQ !== null ? parsed.perQ : {};
      return parsed;
    } catch (e) {
      console.warn("Store: reset após erro de parse.", e);
      const fresh = { version: 1, createdAt: Date.now(), sessions: [], attempts: [], perQ: {} };
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  function save(notify = true) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      if (notify) dispatchChanged("save");
    } catch (e) {
      console.error("Store: erro ao salvar", e);
    }
  }

  function dispatchChanged(type) {
    window.dispatchEvent(new CustomEvent("store:changed", { detail: { type } }));
  }

  function newSession(meta = {}) {
    const id = genId("s");
    const session = {
      id,
      startedAt: Date.now(),
      finishedAt: null,
      filters: sanitizeFilters(meta.filters),
      questionIds: (meta.questionIds || []).map(String),
      results: [] // { qid, selected, correct, tipo, at? }
    };
    db.sessions.push(session);
    save();
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
    save();
    return true;
  }

  function recordAttempt({ sessionId = null, question, selected, correct, at = Date.now() } = {}) {
    if (!question || question.id == null) return null;

    const a = {
      id: genId("a"),
      sessionId,
      qid: String(question.id),
      tipo: String(question.tipo || ""),
      categoria: question.categoria || null,
      dificuldade: question.dificuldade || null,
      value: normalizeValue(selected),
      correct: !!correct,
      at
    };
    db.attempts.push(a);

    // per-questão
    const key = a.qid;
    const pq = db.perQ[key] || { count: 0, correct: 0, lastAt: 0, lastCorrect: false, streak: 0, bestStreak: 0 };
    pq.count += 1;
    if (a.correct) {
      pq.correct += 1;
      pq.streak = pq.lastCorrect ? pq.streak + 1 : 1;
      pq.bestStreak = Math.max(pq.bestStreak, pq.streak);
    } else {
      pq.streak = 0;
    }
    pq.lastAt = at;
    pq.lastCorrect = a.correct;
    db.perQ[key] = pq;

    // espelha no resultado da sessão
    if (sessionId) {
      const s = db.sessions.find((x) => x.id === sessionId);
      if (s) {
        const idx = s.results.findIndex((r) => String(r.qid || r.id) === key);
        const resObj = { qid: key, selected: a.value, correct: a.correct, tipo: a.tipo, at };
        if (idx >= 0) s.results[idx] = resObj;
        else s.results.push(resObj);
      }
    }

    save();
    return a;
  }

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

  function exportJSON() {
    return JSON.stringify(db, null, 2);
  }

  function importJSON(text, { replace = false } = {}) {
    let incoming;
    try {
      incoming = JSON.parse(text);
    } catch {
      throw new Error("JSON inválido");
    }
    if (typeof incoming !== "object" || incoming == null) throw new Error("Formato não suportado");

    incoming.version = 1;
    incoming.sessions = Array.isArray(incoming.sessions) ? incoming.sessions : [];
    incoming.attempts = Array.isArray(incoming.attempts) ? incoming.attempts : [];
    incoming.perQ = typeof incoming.perQ === "object" && incoming.perQ != null ? incoming.perQ : {};

    if (replace) {
      db = incoming;
    } else {
      db.sessions = dedupById(db.sessions.concat(incoming.sessions));
      db.attempts = dedupById(db.attempts.concat(incoming.attempts));
      db.perQ = mergePerQ(db.perQ, incoming.perQ);
    }
    save();
    return true;
  }

  function clear() {
    db = { version: 1, createdAt: Date.now(), sessions: [], attempts: [], perQ: {} };
    save();
  }

  // Utils
  function genId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function normalizeValue(v) { return v; }
  function sanitizeFilters(f) {
    if (!f) return null;
    return { q: f.q || "", cat: f.cat || "all", dif: f.dif || "all" };
  }
  function dedupById(arr) {
    const map = new Map();
    arr.forEach((it) => { if (it && it.id) map.set(it.id, it); });
    return Array.from(map.values());
  }
  function mergePerQ(a, b) {
    const out = { ...a };
    for (const k in b) {
      const x = a[k] || { count: 0, correct: 0, lastAt: 0, lastCorrect: false, streak: 0, bestStreak: 0 };
      const y = b[k];
      out[k] = {
        count: (x.count || 0) + (y.count || 0),
        correct: (x.correct || 0) + (y.correct || 0),
        lastAt: Math.max(x.lastAt || 0, y.lastAt || 0),
        lastCorrect: (y.lastAt || 0) >= (x.lastAt || 0) ? !!y.lastCorrect : !!x.lastCorrect,
        streak: Math.max(x.streak || 0, y.streak || 0),
        bestStreak: Math.max(x.bestStreak || 0, y.bestStreak || 0)
      };
    }
    return out;
  }

  window.Store = { init, newSession, finishSession, recordAttempt, getStats, exportJSON, importJSON, clear };
})();