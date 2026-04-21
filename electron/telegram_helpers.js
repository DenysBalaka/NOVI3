// Спільна логіка з module_tests.js: shuffle та підрахунок балів для бота в main process.

function isTextQuestion(q) {
  const t = String(q && q.type != null ? q.type : "")
    .toLowerCase()
    .trim();
  return t === "text" || t === "textarea" || t === "open";
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Повертає таку ж структуру, як renderRunTest у module_tests.js (перемішані питання/варіанти).
 */
function buildRunTest(originalTest) {
  const test = JSON.parse(JSON.stringify(originalTest));
  let questionMap = test.questions.map((_, i) => i);
  const optionMaps = {};

  if (test.shuffle) {
    questionMap = shuffleArray(questionMap);
    const shuffledQuestions = questionMap.map((i) => {
      const q = JSON.parse(JSON.stringify(test.questions[i]));
      if (q.type === "radio" || q.type === "check") {
        const optMap = shuffleArray(q.options.map((_, oi) => oi));
        optionMaps[i] = optMap;
        q.options = optMap.map((oi) => test.questions[i].options[oi]);
      }
      return q;
    });
    test.questions = shuffledQuestions;
  }

  return { test, questionMap, optionMaps };
}

function calcScore(test, answers) {
  let correctCount = 0;
  let totalQuestions = 0;
  let earnedPoints = 0;
  let maxPoints = 0;
  let hasTextQuestions = false;
  let pendingTextCount = 0;

  test.questions.forEach((q, qi) => {
    totalQuestions++;
    const points = q.points || 1;
    maxPoints += points;
    let isCorrect = false;

    if (isTextQuestion(q)) {
      hasTextQuestions = true;
      pendingTextCount++;
    } else if (q.type === "matching") {
      const pairs = q.pairs || [];
      const givenArr = answers[qi] || [];
      isCorrect = pairs.length > 0 && pairs.every((pair, pi) => givenArr[pi] === pair.right);
    } else {
      const right = new Set(
        (q.options || []).map((o, i) => (o.correct ? i : null)).filter((x) => x !== null)
      );
      const given = new Set(
        Array.isArray(answers[qi]) ? answers[qi] : answers[qi] != null ? [answers[qi]] : []
      );
      if (right.size === given.size && [...right].every((i) => given.has(i))) isCorrect = true;
    }

    if (isCorrect) {
      correctCount++;
      earnedPoints += points;
    }
  });

  return { correctCount, totalQuestions, earnedPoints, maxPoints, hasTextQuestions, pendingTextCount };
}

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

module.exports = {
  shuffleArray,
  buildRunTest,
  calcScore,
  dataUrlToBuffer,
};
