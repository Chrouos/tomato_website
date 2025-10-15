import { query } from '../db.js';

const mapSession = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    durationSeconds: row.duration_seconds,
    categoryId: row.category_id,
    categoryLabel: row.category_label,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const createSession = async ({
  userId,
  durationSeconds,
  categoryId,
  categoryLabel,
  startedAt,
  completedAt,
}) => {
  const result = await query(
    `
      INSERT INTO sessions (
        user_id,
        duration_seconds,
        category_id,
        category_label,
        started_at,
        completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        user_id,
        duration_seconds,
        category_id,
        category_label,
        started_at,
        completed_at,
        created_at,
        updated_at
    `,
    [userId, durationSeconds, categoryId, categoryLabel, startedAt, completedAt],
  );

  return mapSession(result.rows[0]);
};

export const listSessionsByUser = async ({ userId, limit = 50, offset = 0 }) => {
  const result = await query(
    `
      SELECT
        id,
        user_id,
        duration_seconds,
        category_id,
        category_label,
        started_at,
        completed_at,
        created_at,
        updated_at
      FROM sessions
      WHERE user_id = $1
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset],
  );

  return result.rows.map(mapSession);
};

export default {
  createSession,
  listSessionsByUser,
};
