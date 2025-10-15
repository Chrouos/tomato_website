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

export const listEventsByUser = async ({
  userId,
  from,
  to,
  sessionKey,
  limit = 200,
  offset = 0,
}) => {
  const conditions = ['user_id = $1'];
  const values = [userId];
  let index = values.length;

  if (sessionKey) {
    index += 1;
    conditions.push(`session_key = $${index}`);
    values.push(sessionKey);
  }

  if (from) {
    index += 1;
    conditions.push(`occurred_at >= $${index}`);
    values.push(from);
  }

  if (to) {
    index += 1;
    conditions.push(`occurred_at <= $${index}`);
    values.push(to);
  }

  index += 1;
  const limitParam = index;
  values.push(limit);

  index += 1;
  const offsetParam = index;
  values.push(offset);

  const result = await query(
    `
      SELECT
        id,
        user_id,
        session_key,
        event_type,
        payload,
        occurred_at,
        created_at
      FROM session_events
      WHERE ${conditions.join(' AND ')}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `,
    values,
  );

  return result.rows.map(mapEvent);
};

export default {
  createEvent,
  listEventsByUser,
};
