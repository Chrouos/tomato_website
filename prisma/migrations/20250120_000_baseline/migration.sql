-- CreateSchema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS "public";

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" TEXT NOT NULL,
    "user_id" UUID,
    "label" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_task_completions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "daily_task_id" UUID NOT NULL,
    "completed_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_verification_codes" (
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "public"."session_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "session_key" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "category_id" TEXT,
    "category_label" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."study_group_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6),
    "display_name" TEXT,

    CONSTRAINT "study_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."study_groups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."todos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6),

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "provider_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_user_id_idx" ON "public"."categories"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_task_completions_daily_task_id_completed_on_key" ON "public"."daily_task_completions"("daily_task_id" ASC, "completed_on" ASC);

-- CreateIndex
CREATE INDEX "daily_tasks_user_id_idx" ON "public"."daily_tasks"("user_id" ASC);


-- CreateIndex
CREATE INDEX "session_events_session_key_idx" ON "public"."session_events"("session_key" ASC);

-- CreateIndex
CREATE INDEX "session_events_user_id_idx" ON "public"."session_events"("user_id" ASC);

-- CreateIndex
CREATE INDEX "sessions_completed_at_idx" ON "public"."sessions"("completed_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "public"."sessions"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "study_group_members_group_user_idx" ON "public"."study_group_members"("group_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "study_group_members_group_user_unique" ON "public"."study_group_members"("group_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "study_group_members_user_id_idx" ON "public"."study_group_members"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "study_groups_invite_code_key" ON "public"."study_groups"("invite_code" ASC);

-- CreateIndex
CREATE INDEX "study_groups_owner_id_idx" ON "public"."study_groups"("owner_id" ASC);

-- CreateIndex
CREATE INDEX "todos_user_id_idx" ON "public"."todos"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_id_idx" ON "public"."users"("provider" ASC, "provider_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."daily_task_completions" ADD CONSTRAINT "daily_task_completions_daily_task_id_fkey" FOREIGN KEY ("daily_task_id") REFERENCES "public"."daily_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."daily_tasks" ADD CONSTRAINT "daily_tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."daily_tasks" ADD CONSTRAINT "daily_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."session_events" ADD CONSTRAINT "session_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."study_group_members" ADD CONSTRAINT "study_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."study_group_members" ADD CONSTRAINT "study_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."study_groups" ADD CONSTRAINT "study_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."todos" ADD CONSTRAINT "todos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."todos" ADD CONSTRAINT "todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
