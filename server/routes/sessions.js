import { Router } from 'express';
import authenticate from '../middleware/authMiddleware.js';
import ensureUserExists from '../middleware/ensureUserExists.js';
import { createSession, listSessionsByUser } from '../repositories/sessionRepository.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Sessions
 *     description: 番茄鐘完成紀錄
 */

/**
 * @openapi
 * /sessions:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: 取得使用者的番茄鐘紀錄
 *     tags:
 *       - Sessions
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: 成功取得紀錄
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *       401:
 *         description: 未授權
 */
router.get('/', authenticate, ensureUserExists, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const items = await listSessionsByUser({
    userId: req.user.id,
    limit,
    offset,
  });

  res.json({ items });
});

/**
 * @openapi
 * /sessions:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: 新增番茄鐘完成紀錄
 *     tags:
 *       - Sessions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewSession'
 *     responses:
 *       201:
 *         description: 建立成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       400:
 *         description: 請求格式錯誤
 *       401:
 *         description: 未授權
 */
router.post('/', authenticate, ensureUserExists, async (req, res) => {
  try {
    const { durationSeconds, categoryId, categoryLabel, startedAt, completedAt } = req.body;

    if (!durationSeconds || Number.isNaN(Number(durationSeconds)) || durationSeconds <= 0) {
      return res.status(400).json({ error: 'durationSeconds 必須為正整數' });
    }

    const session = await createSession({
      userId: req.user.id,
      durationSeconds: Math.round(Number(durationSeconds)),
      categoryId: categoryId ?? null,
      categoryLabel: categoryLabel ?? null,
      startedAt: startedAt ? new Date(startedAt) : null,
      completedAt: completedAt ? new Date(completedAt) : null,
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error.message ?? '建立紀錄失敗' });
  }
});

export default router;
