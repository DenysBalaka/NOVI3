-- TeacherJournal cloud: Neon Postgres schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name TEXT,
  school TEXT,
  api_key_hash TEXT NOT NULL UNIQUE
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (teacher_id, name)
);

CREATE INDEX idx_classes_teacher ON classes(teacher_id);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  telegram_user_id BIGINT,
  telegram_username TEXT,
  UNIQUE (class_id, full_name)
);

CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_telegram ON students(telegram_user_id);

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_code ON invites(code);

CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  published_telegram BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, external_id)
);

CREATE INDEX idx_tests_teacher ON tests(teacher_id);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('class', 'user')),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (target_type = 'class' AND class_id IS NOT NULL AND student_id IS NULL)
    OR (target_type = 'user' AND student_id IS NOT NULL AND class_id IS NULL)
  )
);

CREATE INDEX idx_assignments_test ON assignments(test_id);
CREATE INDEX idx_assignments_teacher ON assignments(teacher_id);

CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT,
  student_name TEXT,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempts_teacher ON attempts(teacher_id);
CREATE INDEX idx_attempts_test ON attempts(test_id);
CREATE INDEX idx_attempts_created ON attempts(created_at);
