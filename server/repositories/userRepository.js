import { query } from '../db.js';

const mapUser = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    provider: row.provider,
    providerId: row.provider_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const findByEmail = async (email) => {
  const result = await query(
    `
      SELECT id, email, name, password_hash, provider, provider_id, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );

  return mapUser(result.rows[0]);
};

export const createUser = async ({ email, name, passwordHash, provider, providerId }) => {
  const result = await query(
    `
      INSERT INTO users (email, name, password_hash, provider, provider_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, password_hash, provider, provider_id, created_at, updated_at
    `,
    [email, name, passwordHash ?? null, provider ?? 'local', providerId ?? null],
  );

  return mapUser(result.rows[0]);
};

export const updateUserProvider = async ({ userId, provider, providerId }) => {
  const result = await query(
    `
      UPDATE users
      SET provider = $2, provider_id = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, password_hash, provider, provider_id, created_at, updated_at
    `,
    [userId, provider, providerId],
  );

  return mapUser(result.rows[0]);
};

export const updatePassword = async ({ userId, passwordHash }) => {
  const result = await query(
    `
      UPDATE users
      SET password_hash = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, password_hash, provider, provider_id, created_at, updated_at
    `,
    [userId, passwordHash],
  );

  return mapUser(result.rows[0]);
};

export default {
  findByEmail,
  createUser,
  updateUserProvider,
  updatePassword,
};
