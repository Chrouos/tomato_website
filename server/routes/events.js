import { Router } from 'express';
import authenticate from '../middleware/authMiddleware.js';
import ensureUserExists from '../middleware/ensureUserExists.js';
import { createEvent, listEventsByUser } from '../repositories/eventRepository.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Events
 *     description: 番茄鐘操作事件紀錄
 */

/**
 * @openapi
 * /events:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: 取得使用者的番茄鐘操作事件
 *     tags:
 *       - Events
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 起始時間（含）
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 結束時間（含）
 *       - in: query
 *         name: sessionKey
 *         schema:
 *           type: string
 *         description: 只取特定 session key 的事件
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 200
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: 成功取得事件列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *       401:
 *         description: 未授權
 */
router.get('/', authenticate, ensureUserExists, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const from = req.query.from ? new Date(req.query.from) : undefined;
  const to = req.query.to ? new Date(req.query.to) : undefined;
  const sessionKey = req.query.sessionKey?.trim();

  if (from && Number.isNaN(from.getTime())) {
    return res.status(400).json({ error: 'from 不是有效日期' });
  }

  if (to && Number.isNaN(to.getTime())) {
    return res.status(400).json({ error: 'to 不是有效日期' });
  }

  const items = await listEventsByUser({
    userId: req.user.id,
    from: from ? from.toISOString() : undefined,
    to: to ? to.toISOString() : undefined,
    sessionKey: sessionKey || undefined,
    limit,
    offset,
  });

  res.json({ items });
});

/**
 * @openapi
 * /events:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: 記錄使用者的番茄鐘操作事件
 *     tags:
 *       - Events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewEvent'
 *     responses:
 *       201:
 *         description: 事件已紀錄
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       400:
 *         description: 請求資料錯誤
 *       401:
 *         description: 未授權
 */
router.post('/', authenticate, ensureUserExists, async (req, res) => {
  try {
    const { eventType, sessionKey, payload, occurredAt } = req.body ?? {};

    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({ error: '缺少 eventType' });
    }

    const event = await createEvent({
      userId: req.user.id,
      sessionKey: sessionKey ?? null,
      eventType,
      payload: payload ?? null,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ error: error.message ?? '紀錄事件失敗' });
  }
});

export default router;
