import { Router } from 'express';
import authenticate from '../middleware/authMiddleware.js';
import optionalAuthenticate from '../middleware/optionalAuthMiddleware.js';
import {
  ensureDefaultCategories,
  listCategories,
  createCategory,
  deleteCategory,
} from '../repositories/categoryRepository.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Categories
 *     description: 番茄鐘分類管理
 */

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: 取得預設與個人可用的分類
 *     tags:
 *       - Categories
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     responses:
 *       200:
 *         description: 成功取得分類列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *       401:
 *         description: token 無效
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/', optionalAuthenticate, async (req, res) => {
  try {
    await ensureDefaultCategories();
    const items = await listCategories({ userId: req.user?.id });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message ?? '取得分類失敗' });
  }
});

/**
 * @openapi
 * /categories:
 *   post:
 *     summary: 建立新的個人分類
 *     tags:
 *       - Categories
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewCategory'
 *     responses:
 *       201:
 *         description: 建立成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: 請求資料錯誤或分類名稱重複
 *       401:
 *         description: 未授權
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { label } = req.body ?? {};
    const category = await createCategory({
      userId: req.user.id,
      label,
    });
    res.status(201).json(category);
  } catch (error) {
    const isBadRequest =
      error.message === '類別名稱已存在' ||
      error.message === 'label 是必填欄位' ||
      error.message === '缺少 userId';

    res.status(isBadRequest ? 400 : 500).json({
      error: error.message ?? '新增分類失敗',
    });
  }
});

/**
 * @openapi
 * /categories/{id}:
 *   delete:
 *     summary: 刪除個人分類
 *     tags:
 *       - Categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 分類 ID
 *     responses:
 *       200:
 *         description: 已刪除
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到分類或分類不可刪除
 *       500:
 *         description: 伺服器錯誤
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const categoryId = req.params.id;
    const deleted = await deleteCategory({
      userId: req.user.id,
      categoryId,
    });

    if (!deleted) {
      return res.status(404).json({ error: '找不到分類或分類不可刪除' });
    }

    res.json(deleted);
  } catch (error) {
    res.status(500).json({ error: error.message ?? '刪除分類失敗' });
  }
});

export default router;
