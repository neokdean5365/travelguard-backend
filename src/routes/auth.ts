import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) { res.status(400).json({ error: '모든 필드를 입력해주세요.' }); return; }
  if (password.length < 6) { res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' }); return; }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (existing.rows.length > 0) { res.status(409).json({ error: '이미 사용 중인 이메일 또는 사용자명입니다.' }); return; }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id',
      [username, email, hash]
    );
    const token = jwt.sign({ userId: rows[0].id, username }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: rows[0].id, username, email } });
  } catch { res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' }); return; }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }); return;
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch { res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query('SELECT id, username, email, created_at FROM users WHERE id=$1', [req.userId]);
  if (!rows[0]) { res.status(404).json({ error: '사용자를 찾을 수 없습니다.' }); return; }
  res.json(rows[0]);
});
