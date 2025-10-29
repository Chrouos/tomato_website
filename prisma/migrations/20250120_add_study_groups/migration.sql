-- Create study_groups table
CREATE TABLE IF NOT EXISTS "study_groups" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL UNIQUE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "study_groups_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "study_groups_owner_id_idx"
  ON "study_groups" ("owner_id");

-- Trigger to maintain updated_at (optional if DB already has generic trigger)
CREATE TRIGGER "set_study_groups_updated_at"
BEFORE UPDATE ON "study_groups"
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Create study_group_members table
CREATE TABLE IF NOT EXISTS "study_group_members" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "last_seen_at" TIMESTAMPTZ,
    "display_name" TEXT,
    CONSTRAINT "study_group_members_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "study_groups"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "study_group_members_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "study_group_members_group_user_idx"
  ON "study_group_members" ("group_id", "user_id");

CREATE INDEX IF NOT EXISTS "study_group_members_user_id_idx"
  ON "study_group_members" ("user_id");

CREATE TRIGGER "set_study_group_members_updated_at"
BEFORE UPDATE ON "study_group_members"
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
