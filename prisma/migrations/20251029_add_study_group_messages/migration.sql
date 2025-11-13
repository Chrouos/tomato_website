CREATE TABLE IF NOT EXISTS "public"."study_group_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "group_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_group_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "study_group_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "study_group_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "study_group_messages_group_id_created_at_idx"
  ON "public"."study_group_messages" ("group_id", "created_at");
