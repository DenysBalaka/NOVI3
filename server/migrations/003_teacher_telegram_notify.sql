-- Сповіщення вчителя в Telegram, якщо учень не зміг самоприв’язатися
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS telegram_notify_chat_id BIGINT;
