import { Router } from 'express';
import authenticate from '../middleware/authMiddleware.js';
import {
  listDailyTasks,
  createDailyTask,
  updateDailyTask,
  archiveDailyTask,
  markDailyTaskCompleted,
  resetDailyTaskCompletion,
} from '../repositories/dailyTaskRepository.js';

const router = Router();

const toIsoDate = (value) => {
  if (!value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

/**
 * @openapi
 * tags:
 *   - name: DailyTasks
 *     description: 每日任務管理
 */

router.use(authenticate);

/**
 * @openapi
 * /daily-tasks:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: 取得每日任務列表與今日完成狀態
 *     tags:
 *       - DailyTasks
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 指定要檢查的日期（預設為今天，依伺服器時區）
 *     responses:
 *       200:
 *         description: 成功取得每日任務
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DailyTaskWithStatus'
 *       401:
 *         description: 未授權
 */
router.get('/', async (req, res) => {
  const isoDate = toIsoDate(req.query.date);
  if (!isoDate) {
    return res.status(400).json({ error: 'date 不是有效日期' });
  }

  const items = await listDailyTasks({
    userId: req.user.id,
    date: isoDate,
  });

  res.json({ items, date: isoDate });
});

/**
 * @openapi
 * /daily-tasks:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: 建立每日任務
 *     tags:
 *       - DailyTasks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewDailyTask'
 *     responses:
 *       201:
 *         description: 建立成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyTask'
 *       400:
 *         description: 請求格式錯誤
 *       401:
 *         description: 未授權
 */
router.post('/', async (req, res) => {
  const { title, categoryId } = req.body ?? {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title 為必填欄位' });
  }

  const task = await createDailyTask({
    userId: req.user.id,
    title,
    categoryId: categoryId || null,
  });

  res.status(201).json(task);
});

/**
 * @openapi
 * /daily-tasks/{id}:
 *   patch:
 *     security:
 *       - bearerAuth: []
 *     summary: 更新每日任務
 *     tags:
 *       - DailyTasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDailyTask'
 *     responses:
 *       200:
 *         description: 已更新
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyTask'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到每日任務
 */
router.patch('/:id', async (req, res) => {
  const { title, categoryId } = req.body ?? {};

  const task = await updateDailyTask({
    userId: req.user.id,
    taskId: req.params.id,
    title,
    categoryId,
  });

  if (!task) {
    return res.status(404).json({ error: '找不到每日任務' });
  }

  res.json(task);
});

/**
 * @openapi
 * /daily-tasks/{id}:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: 將每日任務標記為封存
 *     tags:
 *       - DailyTasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 已封存
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyTask'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到每日任務
 */
router.delete('/:id', async (req, res) => {
  const task = await archiveDailyTask({
    userId: req.user.id,
    taskId: req.params.id,
  });

  if (!task) {
    return res.status(404).json({ error: '找不到每日任務' });
  }

  res.json(task);
});

/**
 * @openapi
 * /daily-tasks/{id}/complete:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: 標記每日任務為已完成
 *     tags:
 *       - DailyTasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: 指定完成日期，預設為今天
 *     responses:
 *       201:
 *         description: 已標記為完成
 *       400:
 *         description: 日期格式錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到每日任務
 */
router.post('/:id/complete', async (req, res) => {
  const isoDate = toIsoDate(req.body?.date);
  if (!isoDate) {
    return res.status(400).json({ error: 'date 不是有效日期' });
  }

  const completion = await markDailyTaskCompleted({
    userId: req.user.id,
    taskId: req.params.id,
    date: isoDate,
  });

  if (!completion) {
    return res.status(404).json({ error: '找不到每日任務' });
  }

  res.status(201).json({
    taskId: completion.daily_task_id,
    completedOn: completion.completed_on,
  });
});

/**
 * @openapi
 * /daily-tasks/{id}/complete:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: 取消每日任務當日完成狀態
 *     tags:
 *       - DailyTasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 指定取消的日期，預設為今天
 *     responses:
 *       200:
 *         description: 已清除當日完成狀態
 *       400:
 *         description: 日期格式錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到每日任務或尚未完成
 */
router.delete('/:id/complete', async (req, res) => {
  const isoDate = toIsoDate(req.query.date ?? req.body?.date);
  if (!isoDate) {
    return res.status(400).json({ error: 'date 不是有效日期' });
  }

  const completion = await resetDailyTaskCompletion({
    userId: req.user.id,
    taskId: req.params.id,
    date: isoDate,
  });

  if (!completion) {
    return res.status(404).json({ error: '找不到每日任務或當日尚未完成' });
  }

  res.json({
    taskId: completion.daily_task_id,
    completedOn: completion.completed_on,
  });
});

export default router;
