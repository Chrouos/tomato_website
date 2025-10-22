import { query } from '../db.js';

export const ensureTodoSchema = async () => {
  await query(`
    ALTER TABLE IF EXISTS todos
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
  `);
};

const mapTodo = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    categoryId: row.category_id,
    completed: row.completed,
    completedAt: row.completed_at,
    dueAt: row.due_at,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const listTodos = async ({ userId }) => {
  const result = await query(
    `
      SELECT
        id,
        user_id,
        title,
        category_id,
        completed,
        completed_at,
        due_at,
        archived,
        created_at,
        updated_at
      FROM todos
      WHERE user_id = $1 AND archived = FALSE
      ORDER BY completed ASC, due_at IS NULL, due_at ASC, updated_at DESC
    `,
    [userId],
  );

  return result.rows.map(mapTodo);
};

export const createTodo = async ({ userId, title, categoryId, dueAt }) => {
  const result = await query(
    `
      INSERT INTO todos (
        user_id,
        title,
        category_id,
        due_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        user_id,
        title,
        category_id,
        completed,
        completed_at,
        due_at,
        archived,
        created_at,
        updated_at
    `,
    [userId, title.trim(), categoryId || null, dueAt ?? null],
  );

  return mapTodo(result.rows[0]);
};

export const updateTodo = async ({ userId, todoId, title, categoryId, dueAt }) => {
  const fields = [];
  const values = [userId, todoId];
  let index = values.length;

  if (typeof title === 'string') {
    index += 1;
    fields.push(`title = $${index}`);
    values.push(title.trim());
  }

  if (categoryId !== undefined) {
    index += 1;
    fields.push(`category_id = $${index}`);
    values.push(categoryId || null);
  }

  if (dueAt !== undefined) {
    index += 1;
    fields.push(`due_at = $${index}`);
    values.push(dueAt ?? null);
  }

  if (!fields.length) {
    const current = await query(
      `
        SELECT
          id,
          user_id,
          title,
          category_id,
          completed,
          completed_at,
          due_at,
          archived,
          created_at,
          updated_at
        FROM todos
        WHERE user_id = $1 AND id = $2 AND archived = FALSE
      `,
      [userId, todoId],
    );
    return mapTodo(current.rows[0]);
  }

  const result = await query(
    `
      UPDATE todos
         SET ${fields.join(', ')},
             updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND archived = FALSE
    RETURNING
      id,
      user_id,
      title,
      category_id,
      completed,
      completed_at,
      due_at,
      archived,
      created_at,
      updated_at
    `,
    values,
  );

  return mapTodo(result.rows[0]);
};

export const setTodoCompletion = async ({ userId, todoId, completed }) => {
  const result = await query(
    `
      UPDATE todos
         SET completed = $3,
             completed_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
             updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND archived = FALSE
    RETURNING
      id,
      user_id,
      title,
      category_id,
      completed,
      completed_at,
      due_at,
      archived,
      created_at,
      updated_at
    `,
    [userId, todoId, completed],
  );

  return mapTodo(result.rows[0]);
};

export const archiveTodo = async ({ userId, todoId }) => {
  const result = await query(
    `
      UPDATE todos
         SET archived = TRUE,
             updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND archived = FALSE
    RETURNING
      id,
      user_id,
      title,
      category_id,
      completed,
      completed_at,
      due_at,
      archived,
      created_at,
      updated_at
    `,
    [userId, todoId],
  );

  return mapTodo(result.rows[0]);
};

export default {
  ensureTodoSchema,
  listTodos,
  createTodo,
  updateTodo,
  setTodoCompletion,
  archiveTodo,
};
