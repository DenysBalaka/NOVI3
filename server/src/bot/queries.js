const { pool } = require("../db");

async function getStudentByTelegram(telegramUserId) {
  const r = await pool.query(
    `SELECT s.id, s.full_name, s.class_id, s.telegram_user_id, c.teacher_id, c.name AS class_name
     FROM students s
     JOIN classes c ON c.id = s.class_id
     WHERE s.telegram_user_id = $1`,
    [telegramUserId]
  );
  return r.rows[0] || null;
}

async function getAvailableTests(telegramUserId) {
  const r = await pool.query(
    `SELECT DISTINCT t.id, t.external_id, t.title, t.payload_json, t.teacher_id
     FROM tests t
     INNER JOIN assignments a ON a.test_id = t.id AND a.teacher_id = t.teacher_id AND a.active = true
     INNER JOIN students s ON s.telegram_user_id = $1
     WHERE t.published_telegram = true
     AND (
       (a.target_type = 'user' AND a.student_id = s.id)
       OR (a.target_type = 'class' AND a.class_id = s.class_id)
     )`,
    [telegramUserId]
  );
  return r.rows;
}

async function validateTestAccess(telegramUserId, testUuid) {
  const r = await pool.query(
    `SELECT t.id, t.external_id, t.title, t.payload_json, t.teacher_id, s.id AS student_id, s.full_name
     FROM tests t
     INNER JOIN assignments a ON a.test_id = t.id AND a.teacher_id = t.teacher_id AND a.active = true
     INNER JOIN students s ON s.telegram_user_id = $1
     WHERE t.id = $2::uuid AND t.published_telegram = true
     AND (
       (a.target_type = 'user' AND a.student_id = s.id)
       OR (a.target_type = 'class' AND a.class_id = s.class_id)
     )`,
    [telegramUserId, testUuid]
  );
  return r.rows[0] || null;
}

async function getInviteByCode(code) {
  const r = await pool.query(
    `SELECT i.*, c.name AS class_name FROM invites i
     LEFT JOIN classes c ON c.id = i.class_id
     WHERE i.code = $1`,
    [code]
  );
  return r.rows[0] || null;
}

async function bindStudentTelegram(studentId, telegramUserId, telegramUsername) {
  const r = await pool.query(
    `UPDATE students SET telegram_user_id = $1, telegram_username = $2
     WHERE id = $3::uuid AND (telegram_user_id IS NULL OR telegram_user_id = $1)
     RETURNING id`,
    [telegramUserId, telegramUsername || null, studentId]
  );
  return r.rowCount > 0;
}

async function findStudentInClassByName(classId, nameLine) {
  const needle = nameLine.trim().toLowerCase();
  const r = await pool.query(
    `SELECT id, full_name FROM students WHERE class_id = $1::uuid AND telegram_user_id IS NULL`,
    [classId]
  );
  const matches = r.rows.filter((row) => row.full_name.trim().toLowerCase() === needle);
  return matches;
}

async function insertAttempt({ teacherId, testId, studentId, telegramUserId, telegramChatId, studentName, payload }) {
  await pool.query(
    `INSERT INTO attempts (teacher_id, test_id, student_id, telegram_user_id, telegram_chat_id, student_name, payload_json)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::jsonb)`,
    [teacherId, testId, studentId, telegramUserId, telegramChatId, studentName, JSON.stringify(payload)]
  );
}

module.exports = {
  getStudentByTelegram,
  getAvailableTests,
  validateTestAccess,
  getInviteByCode,
  bindStudentTelegram,
  findStudentInClassByName,
  insertAttempt,
};
