import { Router } from 'express';
import authenticate from '../middleware/authMiddleware.js';
import { createEvent } from '../repositories/eventRepository.js';

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
router.post('/', authenticate, async (req, res) => {
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
