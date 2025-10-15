import { query } from '../db.js';

const mapVerification = (row) => {
  if (!row) return null;

  return {
    email: row.email,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const upsertVerificationCode = async ({ email, codeHash, expiresAt }) => {
  const result = await query(
    `
      INSERT INTO email_verification_codes (email, code_hash, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE
        SET code_hash = $2,
            expires_at = $3,
            updated_at = NOW()
      RETURNING email, code_hash, expires_at, created_at, updated_at
    `,
    [email, codeHash, expiresAt],
  );

  return mapVerification(result.rows[0]);
};

export const findVerificationByEmail = async (email) => {
  const result = await query(
    `
      SELECT email, code_hash, expires_at, created_at, updated_at
      FROM email_verification_codes
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );

  return mapVerification(result.rows[0]);
};

export const deleteVerificationByEmail = async (email) => {
  await query(
    `
      DELETE FROM email_verification_codes
      WHERE email = $1
    `,
    [email],
  );
};

export default {
  upsertVerificationCode,
  findVerificationByEmail,
  deleteVerificationByEmail,
};
