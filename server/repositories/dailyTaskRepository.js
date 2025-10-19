import { query } from '../db.js';

const mapDailyTask = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    categoryId: row.category_id,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedToday: row.completed_today,
    completionId: row.completion_id,
    completedOn: row.completed_on,
  };
};

export const listDailyTasks = async ({ userId, date }) => {
  const result = await query(
    `
      SELECT
        dt.id,
        dt.user_id,
        dt.title,
        dt.category_id,
        dt.archived,
        dt.created_at,
        dt.updated_at,
        (c.id IS NOT NULL) AS completed_today,
        c.id AS completion_id,
        c.completed_on
      FROM daily_tasks dt
      LEFT JOIN daily_task_completions c
        ON c.daily_task_id = dt.id
       AND c.completed_on = $2
      WHERE dt.user_id = $1
        AND dt.archived = FALSE
      ORDER BY dt.created_at ASC, dt.id ASC
    `,
    [userId, date],
  );

  return result.rows.map(mapDailyTask);
};

export const createDailyTask = async ({ userId, title, categoryId }) => {
  const result = await query(
    `
      INSERT INTO daily_tasks (
        user_id,
        title,
        category_id
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        user_id,
        title,
        category_id,
        archived,
        created_at,
        updated_at
    `,
    [userId, title.trim(), categoryId || null],
  );

  return mapDailyTask(result.rows[0]);
};

export const updateDailyTask = async ({ userId, taskId, title, categoryId }) => {
  const fields = [];
  const values = [userId, taskId];
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

  if (!fields.length) {
    const current = await query(
      `
        SELECT
          id,
          user_id,
          title,
          category_id,
          archived,
          created_at,
          updated_at
        FROM daily_tasks
        WHERE user_id = $1 AND id = $2 AND archived = FALSE
      `,
      [userId, taskId],
    );
    return mapDailyTask(current.rows[0]);
  }

  const result = await query(
    `
      UPDATE daily_tasks
         SET ${fields.join(', ')},
             updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND archived = FALSE
    RETURNING
      id,
      user_id,
      title,
      category_id,
      archived,
      created_at,
      updated_at
    `,
    values,
  );

  return mapDailyTask(result.rows[0]);
};

export const archiveDailyTask = async ({ userId, taskId }) => {
  const result = await query(
    `
      UPDATE daily_tasks
         SET archived = TRUE,
             updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND archived = FALSE
    RETURNING
      id,
      user_id,
      title,
      category_id,
      archived,
      created_at,
      updated_at
    `,
    [userId, taskId],
  );

  return mapDailyTask(result.rows[0]);
};

export const markDailyTaskCompleted = async ({ userId, taskId, date }) => {
  const result = await query(
    `
      INSERT INTO daily_task_completions (
        daily_task_id,
        completed_on
      )
      SELECT id, $3
        FROM daily_tasks
       WHERE id = $2 AND user_id = $1 AND archived = FALSE
      ON CONFLICT (daily_task_id, completed_on)
      DO UPDATE SET updated_at = NOW()
      RETURNING id, daily_task_id, completed_on, created_at, updated_at
    `,
    [userId, taskId, date],
  );

  return result.rows[0];
};

export const resetDailyTaskCompletion = async ({ userId, taskId, date }) => {
  const result = await query(
    `
      DELETE FROM daily_task_completions
       WHERE daily_task_id = $2
         AND completed_on = $3
         AND EXISTS (
           SELECT 1 FROM daily_tasks
            WHERE id = $2 AND user_id = $1 AND archived = FALSE
         )
      RETURNING id, daily_task_id, completed_on, created_at, updated_at
    `,
    [userId, taskId, date],
  );

  return result.rows[0];
};

export default {
  listDailyTasks,
  createDailyTask,
  updateDailyTask,
  archiveDailyTask,
  markDailyTaskCompleted,
  resetDailyTaskCompletion,
};
