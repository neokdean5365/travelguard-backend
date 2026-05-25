import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';

export const communityRouter = Router();

communityRouter.get('/posts', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { country, category, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  let query = `
    SELECT cp.*, u.username,
      CASE WHEN pl.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked
    FROM community_posts cp
    JOIN users u ON cp.user_id = u.id
    LEFT JOIN post_likes pl ON pl.post_id = cp.id AND pl.user_id = $1
    WHERE 1=1
  `;
  const params: any[] = [req.userId || 0];
  let i = 2;

  if (country) { query += ` AND LOWER(cp.country) LIKE $${i++}`; params.push(`%${(country as string).toLowerCase()}%`); }
  if (category && category !== 'all') { query += ` AND cp.category = $${i++}`; params.push(category); }
  query += ` ORDER BY cp.created_at DESC LIMIT $${i++} OFFSET $${i++}`;
  params.push(parseInt(limit as string), offset);

  const { rows } = await pool.query(query, params);
  const { rows: countRows } = await pool.query('SELECT COUNT(*) as cnt FROM community_posts');
  res.json({ posts: rows, total: parseInt(countRows[0].cnt), page: parseInt(page as string) });
});

communityRouter.get('/posts/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { rows: postRows } = await pool.query(`
    SELECT cp.*, u.username,
      CASE WHEN pl.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked
    FROM community_posts cp
    JOIN users u ON cp.user_id = u.id
    LEFT JOIN post_likes pl ON pl.post_id = cp.id AND pl.user_id = $1
    WHERE cp.id = $2
  `, [req.userId || 0, req.params.id]);

  if (!postRows[0]) { res.status(404).json({ error: '게시글을 찾을 수 없습니다.' }); return; }

  const { rows: comments } = await pool.query(`
    SELECT c.*, u.username FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = $1 ORDER BY c.created_at ASC
  `, [req.params.id]);

  res.json({ post: postRows[0], comments });
});

communityRouter.post('/posts', requireAuth, async (req: AuthRequest, res: Response) => {
  const { title, content, country, city, category } = req.body;
  if (!title?.trim() || !content?.trim()) { res.status(400).json({ error: '제목과 내용은 필수입니다.' }); return; }
  const validCategories = ['warning', 'tip', 'question', 'general'];
  const cat = validCategories.includes(category) ? category : 'general';
  const { rows } = await pool.query(`
    INSERT INTO community_posts (user_id, title, content, country, city, category)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [req.userId, title.trim(), content.trim(), country || null, city || null, cat]);
  res.status(201).json({ id: rows[0].id });
});

communityRouter.post('/posts/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  const existing = await pool.query(
    'SELECT 1 FROM post_likes WHERE user_id=$1 AND post_id=$2', [req.userId, req.params.id]
  );
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM post_likes WHERE user_id=$1 AND post_id=$2', [req.userId, req.params.id]);
    await pool.query('UPDATE community_posts SET like_count = like_count - 1 WHERE id=$1', [req.params.id]);
    res.json({ liked: false });
  } else {
    await pool.query('INSERT INTO post_likes (user_id, post_id) VALUES ($1,$2)', [req.userId, req.params.id]);
    await pool.query('UPDATE community_posts SET like_count = like_count + 1 WHERE id=$1', [req.params.id]);
    res.json({ liked: true });
  }
});

communityRouter.post('/posts/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: '댓글 내용을 입력해주세요.' }); return; }
  const post = await pool.query('SELECT id FROM community_posts WHERE id=$1', [req.params.id]);
  if (!post.rows[0]) { res.status(404).json({ error: '게시글을 찾을 수 없습니다.' }); return; }
  const { rows } = await pool.query(
    'INSERT INTO comments (user_id, post_id, content) VALUES ($1,$2,$3) RETURNING id',
    [req.userId, req.params.id, content.trim()]
  );
  await pool.query('UPDATE community_posts SET comment_count = comment_count + 1 WHERE id=$1', [req.params.id]);
  const { rows: comment } = await pool.query(`
    SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id=$1
  `, [rows[0].id]);
  res.status(201).json(comment[0]);
});
