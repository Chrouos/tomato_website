CREATE TABLE IF NOT EXISTS encouragement_balances (
    user_id UUID PRIMARY KEY,
    credits INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT encouragement_balances_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TRIGGER set_encouragement_balances_updated_at
BEFORE UPDATE ON encouragement_balances
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS encouragement_credit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT encouragement_credit_events_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS encouragement_credit_events_user_id_idx
    ON encouragement_credit_events(user_id);

CREATE INDEX IF NOT EXISTS encouragement_credit_events_reason_idx
    ON encouragement_credit_events(reason);

CREATE UNIQUE INDEX IF NOT EXISTS encouragement_credit_events_reason_reference_idx
    ON encouragement_credit_events(reason, reference_id);

CREATE TABLE IF NOT EXISTS encouragement_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    sender_message TEXT NOT NULL,
    reply_message TEXT,
    sender_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recipient_replied_at TIMESTAMPTZ,
    recipient_read_at TIMESTAMPTZ,
    sender_reply_read_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'delivered',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT encouragement_letters_sender_id_fkey
        FOREIGN KEY (sender_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT encouragement_letters_recipient_id_fkey
        FOREIGN KEY (recipient_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS encouragement_letters_sender_id_idx
    ON encouragement_letters(sender_id);

CREATE INDEX IF NOT EXISTS encouragement_letters_recipient_id_idx
    ON encouragement_letters(recipient_id);

CREATE TRIGGER set_encouragement_letters_updated_at
BEFORE UPDATE ON encouragement_letters
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
