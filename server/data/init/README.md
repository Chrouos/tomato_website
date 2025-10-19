# 本地資料庫初始化

此資料夾用於放置 **不會被版控追蹤** 的 SQL 腳本，可在本機初始化 PostgreSQL。

建議建立類似 `001_create_users.sql` 的檔案，自行調整欄位。請先建立通用觸發函式，再建立資料表與觸發器：

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  provider TEXT NOT NULL DEFAULT 'local',
  provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_provider_id_idx ON users(provider, provider_id);

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS email_verification_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_email_verification_codes_updated_at
BEFORE UPDATE ON email_verification_codes
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  category_id TEXT,
  category_label TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_completed_at_idx ON sessions(completed_at DESC NULLS LAST);

CREATE TRIGGER set_sessions_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_key TEXT,
  event_type TEXT NOT NULL,
  payload JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_events_user_id_idx ON session_events(user_id);
CREATE INDEX IF NOT EXISTS session_events_session_key_idx ON session_events(session_key);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);

CREATE TRIGGER set_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_tasks_user_id_idx ON daily_tasks(user_id);

CREATE TABLE IF NOT EXISTS daily_task_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_task_id UUID NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  completed_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (daily_task_id, completed_on)
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);

CREATE TRIGGER set_daily_tasks_updated_at
BEFORE UPDATE ON daily_tasks
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_daily_task_completions_updated_at
BEFORE UPDATE ON daily_task_completions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_todos_updated_at
BEFORE UPDATE ON todos
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
```

資料表關聯說明：

- `users`：儲存註冊與社群登入的使用者。
- `email_verification_codes`：儲存 1 小時內有效的 Email 註冊驗證碼，每個 Email 僅保留最新一筆。
- `sessions`：儲存番茄鐘完成記錄，關聯對應的使用者與分類資訊。
- `session_events`：紀錄每一次操作（開始、暫停、重置等），可透過 `session_key` 對應同一輪番茄鐘。
- `categories`：儲存預設與使用者自訂的番茄鐘分類，預設分類 `user_id` 為 `NULL` 並由程式啟動時自動建立。
- `daily_tasks`：儲存使用者的每日任務項目。
- `daily_task_completions`：紀錄每日任務在特定日期的完成狀態，每個任務每天僅一筆。
- `todos`：一般待辦事項，包含完成狀態與完成時間。

> 請根據實際需求調整，並確保這些 SQL 檔案保留在本機不要上傳。

```
docker compose down && docker compose up -d postgres
```
