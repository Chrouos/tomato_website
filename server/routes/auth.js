import { Router } from 'express';
import {
  requestEmailVerification,
  register,
  login,
  loginWithGoogle,
} from '../services/authService.js';

const router = Router();

const handleRequest = (handler, successStatus = 200) => async (req, res) => {
  try {
    const result = await handler(req, res);
    res.status(successStatus).json(result);
  } catch (error) {
    const message = error.message ?? '未知錯誤';
    res.status(400).json({ error: message });
  }
};

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: 使用者註冊與登入
 */

/**
 * @openapi
 * /auth/request-email-code:
 *   post:
 *     summary: 取得 Email 註冊驗證碼
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 註冊用的 Email，系統會寄送驗證碼
 *     responses:
 *       200:
 *         description: 驗證碼已產生
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                 verificationCode:
 *                   type: string
 *                   description: 僅在開發模式下回傳供測試用
 *       400:
 *         description: 請求錯誤
 */
router.post(
  '/request-email-code',
  handleRequest(async (req) => requestEmailVerification(req.body)),
);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: 使用 Email 註冊
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - verificationCode
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               verificationCode:
 *                 type: string
 *                 description: 透過 /auth/request-email-code 取得的 6 位數驗證碼
 *     responses:
 *       201:
 *         description: 註冊成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         description: 請求錯誤
 */
router.post(
  '/register',
  handleRequest(async (req) => register(req.body), 201),
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: 使用 Email 登入
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         description: 請求錯誤
 */
router.post(
  '/login',
  handleRequest(async (req) => login(req.body)),
);

/**
 * @openapi
 * /auth/google:
 *   post:
 *     summary: 使用 Google 登入
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: 從 Google OAuth 取得的 ID Token
 *     responses:
 *       200:
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         description: 請求錯誤
 */
router.post(
  '/google',
  handleRequest(async (req) => loginWithGoogle(req.body)),
);

export default router;
