import { findById } from '../repositories/userRepository.js';

const ensureUserExists = async (req, res, next) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: '缺少使用者資訊' });
  }

  try {
    const user = await findById(userId);

    if (!user) {
      return res.status(401).json({ error: '找不到使用者帳號' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
    req.userRecord = user;

    return next();
  } catch (error) {
    console.error('Failed to verify user existence', { userId, error });
    return res.status(500).json({ error: '驗證使用者失敗' });
  }
};

export default ensureUserExists;
