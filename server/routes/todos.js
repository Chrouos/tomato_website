import { Router } from 'express';
import authenticate from '../middleware/authMiddleware.js';
import {
  listTodos,
  createTodo,
  updateTodo,
  setTodoCompletion,
  archiveTodo,
} from '../repositories/todoRepository.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Todos
 *     description: 一般待辦事項管理
 */

router.use(authenticate);

/**
 * @openapi
 * /todos:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: 取得使用者的待辦事項
 *     tags:
 *       - Todos
 *     responses:
 *       200:
 *         description: 成功取得待辦事項
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Todo'
 *       401:
 *         description: 未授權
 */
router.get('/', async (req, res) => {
  const items = await listTodos({
    userId: req.user.id,
  });
  res.json({ items });
});

/**
 * @openapi
 * /todos:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: 新增待辦事項
 *     tags:
 *       - Todos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewTodo'
 *     responses:
 *       201:
 *         description: 建立成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       400:
 *         description: 請求資料錯誤
 *       401:
 *         description: 未授權
 */
router.post('/', async (req, res) => {
  const { title, categoryId } = req.body ?? {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title 為必填欄位' });
  }

  const todo = await createTodo({
    userId: req.user.id,
    title,
    categoryId: categoryId || null,
  });

  res.status(201).json(todo);
});

/**
 * @openapi
 * /todos/{id}:
 *   patch:
 *     security:
 *       - bearerAuth: []
 *     summary: 更新待辦事項
 *     tags:
 *       - Todos
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
 *             $ref: '#/components/schemas/UpdateTodo'
 *     responses:
 *       200:
 *         description: 已更新
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到待辦事項
 */
router.patch('/:id', async (req, res) => {
  const { title, categoryId } = req.body ?? {};

  const todo = await updateTodo({
    userId: req.user.id,
    todoId: req.params.id,
    title,
    categoryId,
  });

  if (!todo) {
    return res.status(404).json({ error: '找不到待辦事項' });
  }

  res.json(todo);
});

/**
 * @openapi
 * /todos/{id}/complete:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: 標記待辦事項為已完成
 *     tags:
 *       - Todos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 狀態已更新
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到待辦事項
 */
router.post('/:id/complete', async (req, res) => {
  const todo = await setTodoCompletion({
    userId: req.user.id,
    todoId: req.params.id,
    completed: true,
  });

  if (!todo) {
    return res.status(404).json({ error: '找不到待辦事項' });
  }

  res.json(todo);
});

/**
 * @openapi
 * /todos/{id}/complete:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: 取消待辦事項的完成狀態
 *     tags:
 *       - Todos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 狀態已更新
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到待辦事項
 */
router.delete('/:id/complete', async (req, res) => {
  const todo = await setTodoCompletion({
    userId: req.user.id,
    todoId: req.params.id,
    completed: false,
  });

  if (!todo) {
    return res.status(404).json({ error: '找不到待辦事項' });
  }

  res.json(todo);
});

/**
 * @openapi
 * /todos/{id}:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: 封存待辦事項
 *     tags:
 *       - Todos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 待辦事項已封存
 *       401:
 *         description: 未授權
 *       404:
 *         description: 找不到待辦事項
 */
router.delete('/:id', async (req, res) => {
  const todo = await archiveTodo({
    userId: req.user.id,
    todoId: req.params.id,
  });

  if (!todo) {
    return res.status(404).json({ error: '找不到待辦事項' });
  }

  res.json(todo);
});

export default router;
