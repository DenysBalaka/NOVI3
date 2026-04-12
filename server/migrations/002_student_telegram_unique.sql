-- Один Telegram-акаунт — одна прив’язка до учня в системі
CREATE UNIQUE INDEX idx_students_one_telegram ON students(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
