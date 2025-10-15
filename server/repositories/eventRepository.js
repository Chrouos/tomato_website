import { query } from '../db.js';

const mapEvent = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    sessionKey: row.session_key,
    eventType: row.event_type,
    payload: row.payload,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
};

export const createEvent = async ({ userId, sessionKey, eventType, payload, occurredAt }) => {
  const result = await query(
    `
      INSERT INTO session_events (
        user_id,
        session_key,
        event_type,
        payload,
        occurred_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        user_id,
        session_key,
        event_type,
        payload,
        occurred_at,
        created_at
    `,
    [userId, sessionKey ?? null, eventType, payload ?? null, occurredAt ?? new Date()],
  );

  return mapEvent(result.rows[0]);
};

export default {
  createEvent,
};
