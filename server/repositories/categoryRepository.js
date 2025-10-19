import { randomUUID } from 'crypto';
import { query } from '../db.js';

export const DEFAULT_CATEGORY_SEEDS = [
  // { id: 'deep-work', label: '深度工作' },
  // { id: 'learning', label: '學習' },
  // { id: 'meeting', label: '會議/討論' },
  // { id: 'break', label: '安排休息' },
];

const mapCategory = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const ensureDefaultCategories = async () => {
  const existing = await query(
    `
      SELECT id
      FROM categories
      WHERE id = ANY($1::text[])
    `,
    [DEFAULT_CATEGORY_SEEDS.map((seed) => seed.id)],
  );

  const existingIds = new Set(existing.rows.map((row) => row.id));
  const missing = DEFAULT_CATEGORY_SEEDS.filter((seed) => !existingIds.has(seed.id));

  if (!missing.length) {
    return;
  }

  const values = [];
  const placeholders = missing
    .map((seed, index) => {
      const i = index * 2;
      values.push(seed.id, seed.label);
      return `($${i + 1}, $${i + 2}, TRUE)`;
    })
    .join(', ');

  await query(
    `
      INSERT INTO categories (id, label, is_default)
      VALUES ${placeholders}
      ON CONFLICT (id) DO NOTHING
    `,
    values,
  );
};

export const listCategories = async ({ userId } = {}) => {
  if (userId) {
    const result = await query(
      `
        SELECT
          id,
          user_id,
          label,
          is_default,
          created_at,
          updated_at
        FROM categories
        WHERE is_default = TRUE OR user_id = $1
        ORDER BY
          CASE WHEN is_default THEN 0 ELSE 1 END,
          created_at ASC,
          label ASC
      `,
      [userId],
    );

    return result.rows.map(mapCategory);
  }

  const result = await query(
    `
      SELECT
        id,
        user_id,
        label,
        is_default,
        created_at,
        updated_at
      FROM categories
      WHERE is_default = TRUE
      ORDER BY created_at ASC, label ASC
    `,
    [],
  );

  return result.rows.map(mapCategory);
};

export const createCategory = async ({ userId, label }) => {
  if (!userId) {
    throw new Error('缺少 userId');
  }

  const trimmed = (label ?? '').trim();

  if (!trimmed) {
    throw new Error('label 是必填欄位');
  }

  const duplicate = await query(
    `
      SELECT id
      FROM categories
      WHERE (user_id = $1 OR is_default = TRUE)
        AND LOWER(label) = LOWER($2)
      LIMIT 1
    `,
    [userId, trimmed],
  );

  if (duplicate.rowCount > 0) {
    throw new Error('類別名稱已存在');
  }

  const id = randomUUID();
  const result = await query(
    `
      INSERT INTO categories (
        id,
        user_id,
        label,
        is_default
      )
      VALUES ($1, $2, $3, FALSE)
      RETURNING
        id,
        user_id,
        label,
        is_default,
        created_at,
        updated_at
    `,
    [id, userId, trimmed],
  );

  return mapCategory(result.rows[0]);
};

export const deleteCategory = async ({ userId, categoryId }) => {
  if (!userId) {
    throw new Error('缺少 userId');
  }

  const result = await query(
    `
      DELETE FROM categories
      WHERE id = $1 AND user_id = $2 AND is_default = FALSE
      RETURNING
        id,
        user_id,
        label,
        is_default,
        created_at,
        updated_at
    `,
    [categoryId, userId],
  );

  return mapCategory(result.rows[0]);
};

export default {
  ensureDefaultCategories,
  listCategories,
  createCategory,
  deleteCategory,
};
