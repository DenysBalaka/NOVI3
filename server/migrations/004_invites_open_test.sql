-- Відкрите посилання на тест (без прив’язки до учня в журналі)
ALTER TABLE invites ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES tests(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_invites_test_id ON invites(test_id);
