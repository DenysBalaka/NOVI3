const { buildRunTest, shuffleArray } = require("../testLogic");

function parseTestPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (typeof payload === "object") return payload;
  return null;
}

function validateTestShape(test) {
  if (!test || typeof test !== "object") return { ok: false, reason: "empty" };
  if (!Array.isArray(test.questions)) return { ok: false, reason: "questions_not_array" };
  if (test.questions.length === 0) return { ok: false, reason: "questions_empty" };
  return { ok: true };
}

function isTextQuestionTypeName(qType) {
  const t = String(qType || "").toLowerCase().trim();
  return t === "text" || t === "textarea" || t === "open";
}

function isKnownQuestionType(q) {
  const t = String(q?.type || "").toLowerCase().trim();
  return t === "radio" || t === "check" || isTextQuestionTypeName(t) || t === "matching";
}

function skipNonInteractiveIfNeeded(session) {
  const { test } = session;
  while (session.qi < test.questions.length) {
    const q = test.questions[session.qi];
    const t = String(q?.type || "").toLowerCase().trim();

    if (t === "radio" && (q.options || []).length === 0) {
      session.answers[session.qi] = null;
      session.qi++;
      session.match = null;
      continue;
    }
    if (t === "check" && (q.options || []).length === 0) {
      session.answers[session.qi] = [];
      session.qi++;
      session.match = null;
      continue;
    }
    if (t === "matching" && (q.pairs || []).length === 0) {
      session.answers[session.qi] = [];
      session.qi++;
      session.match = null;
      continue;
    }
    if (!isKnownQuestionType(q)) {
      session.answers[session.qi] = null;
      session.qi++;
      session.match = null;
      continue;
    }
    break;
  }
}

function createSessionFromAccessRow(row, telegramUserId, telegramChatId) {
  const originalTest = parseTestPayload(row.payload_json);
  const shape = validateTestShape(originalTest);
  if (!originalTest || !shape.ok) {
    return { error: "invalid_test" };
  }
  if (!originalTest.id) originalTest.id = row.external_id;
  if (!originalTest.title) originalTest.title = row.title;

  let built;
  try {
    built = buildRunTest(originalTest);
  } catch {
    return { error: "build_failed" };
  }

  const session = {
    step: "question",
    qi: 0,
    answers: {},
    originalTest,
    test: built.test,
    questionMap: built.questionMap,
    optionMaps: built.optionMaps,
    telegramUserId,
    telegramChatId,
    studentRowId: row.student_id,
    studentName: row.full_name,
    teacherId: row.teacher_id,
    cloudTestId: row.id,
    match: null,
  };
  skipNonInteractiveIfNeeded(session);
  return { session };
}

function buildQuestionView(session) {
  const { test } = session;
  const total = test.questions.length;
  if (session.qi >= total) {
    return { phase: "done", qi: session.qi, total };
  }

  const qi = session.qi;
  const q = test.questions[qi];
  const t = String(q.type || "").toLowerCase().trim();
  const base = {
    phase: "question",
    qi,
    total,
    type: t,
    text: q.text != null ? String(q.text) : "",
    image: q.image != null ? q.image : null,
  };

  if (t === "radio" || t === "check") {
    const opts = (q.options || []).map((o) => ({ text: o && o.text != null ? String(o.text) : "—" }));
    return { ...base, options: opts };
  }

  if (isTextQuestionTypeName(t)) {
    return { ...base, type: "text" };
  }

  if (t === "matching") {
    const pairs = q.pairs || [];
    if (!session.match || session.match.qi !== qi) {
      session.match = {
        qi,
        rightsShuffled: shuffleArray(pairs.map((p) => p.right)),
      };
    }
    const m = session.match;
    return {
      ...base,
      type: "matching",
      pairTotal: pairs.length,
      matchingLeft: pairs.map((p, pi) => ({
        pi,
        text: p && p.left != null ? String(p.left) : "",
      })),
      matchingRight: m.rightsShuffled.map((text, ri) => ({
        ri,
        text: text != null ? String(text) : "",
      })),
    };
  }

  return { ...base, type: "unknown" };
}

function advanceWithAnswer(session, answer) {
  const { test } = session;
  const total = test.questions.length;
  if (session.qi >= total) return { ok: false, error: "already_done" };

  const qi = session.qi;
  const q = test.questions[qi];
  const t = String(q.type || "").toLowerCase().trim();

  if (t === "radio") {
    const idx = answer?.index;
    const n = typeof idx === "number" ? idx : parseInt(String(idx), 10);
    const opts = q.options || [];
    if (!Number.isFinite(n) || n < 0 || n >= opts.length) return { ok: false, error: "bad_radio" };
    session.answers[qi] = n;
    session.qi++;
    session.match = null;
    skipNonInteractiveIfNeeded(session);
    return { ok: true };
  }

  if (t === "check") {
    const indices = Array.isArray(answer?.indices) ? answer.indices : [];
    const opts = q.options || [];
    const set = new Set();
    for (const x of indices) {
      const n = typeof x === "number" ? x : parseInt(String(x), 10);
      if (!Number.isFinite(n) || n < 0 || n >= opts.length) return { ok: false, error: "bad_check" };
      set.add(n);
    }
    session.answers[qi] = [...set];
    session.qi++;
    session.match = null;
    skipNonInteractiveIfNeeded(session);
    return { ok: true };
  }

  if (isTextQuestionTypeName(t)) {
    const text = answer?.text != null ? String(answer.text) : "";
    if (!text.trim()) return { ok: false, error: "empty_text" };
    session.answers[qi] = text.trim();
    session.qi++;
    session.match = null;
    skipNonInteractiveIfNeeded(session);
    return { ok: true };
  }

  if (t === "matching") {
    const pairs = q.pairs || [];
    const m = session.match;
    if (!m || m.qi !== qi) return { ok: false, error: "matching_state" };

    const picksRi = answer?.matchPicks;
    if (!Array.isArray(picksRi)) return { ok: false, error: "bad_match" };
    if (picksRi.length !== pairs.length) return { ok: false, error: "bad_match" };

    const n = m.rightsShuffled.length;
    if (pairs.length !== n) return { ok: false, error: "bad_match" };

    const used = new Set();
    const resolved = [];
    for (let pi = 0; pi < pairs.length; pi++) {
      const raw = picksRi[pi];
      const ri = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      if (!Number.isFinite(ri) || ri < 0 || ri >= n) return { ok: false, error: "bad_match" };
      if (used.has(ri)) return { ok: false, error: "bad_match" };
      used.add(ri);
      resolved.push(m.rightsShuffled[ri]);
    }

    session.answers[qi] = resolved;
    session.match = null;
    session.qi++;
    skipNonInteractiveIfNeeded(session);
    return { ok: true };
  }

  return { ok: false, error: "unsupported" };
}

module.exports = {
  createSessionFromAccessRow,
  buildQuestionView,
  advanceWithAnswer,
  parseTestPayload,
  validateTestShape,
};
