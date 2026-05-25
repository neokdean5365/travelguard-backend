import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';

export const reviewsRouter = Router();

reviewsRouter.get('/place/:placeId', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(`
    SELECT r.*, u.username,
      CASE WHEN rh.user_id IS NOT NULL THEN 1 ELSE 0 END as is_helpful
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN review_helpful rh ON rh.review_id = r.id AND rh.user_id = $1
    WHERE r.place_id = $2
    ORDER BY r.helpful_count DESC, r.created_at DESC
  `, [req.userId || 0, req.params.placeId]);
  res.json(rows);
});

reviewsRouter.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(`
    SELECT r.*, p.name as place_name, p.city, p.country
    FROM reviews r JOIN places p ON r.place_id = p.id
    WHERE r.user_id = $1 ORDER BY r.created_at DESC
  `, [req.userId]);
  res.json(rows);
});

reviewsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { place_id, price_gouging_score, hygiene_score, discrimination_score, content, visit_date } = req.body;
  if (!place_id || !content?.trim()) { res.status(400).json({ error: '장소와 내용은 필수입니다.' }); return; }

  const pg = Math.min(10, Math.max(0, parseInt(price_gouging_score) || 0));
  const hy = Math.min(10, Math.max(0, parseInt(hygiene_score) || 0));
  const di = Math.min(10, Math.max(0, parseInt(discrimination_score) || 0));

  const existing = await pool.query('SELECT id FROM reviews WHERE user_id=$1 AND place_id=$2', [req.userId, place_id]);
  if (existing.rows.length > 0) { res.status(409).json({ error: '이미 이 장소에 리뷰를 작성하셨습니다.' }); return; }

  const { rows: placeRows } = await pool.query('SELECT * FROM places WHERE id=$1', [place_id]);
  const place = placeRows[0];
  if (!place) { res.status(404).json({ error: '장소를 찾을 수 없습니다.' }); return; }

  await pool.query(`
    INSERT INTO reviews (user_id, place_id, price_gouging_score, hygiene_score, discrimination_score, content, visit_date)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [req.userId, place_id, pg, hy, di, content.trim(), visit_date || null]);

  const newCount = place.review_count + 1;
  const newPG = Math.round(((place.price_gouging_avg * place.review_count) + pg) / newCount * 10) / 10;
  const newHY = Math.round(((place.hygiene_avg * place.review_count) + hy) / newCount * 10) / 10;
  const newDI = Math.round(((place.discrimination_avg * place.review_count) + di) / newCount * 10) / 10;
  const newOverall = Math.round((newPG + newHY + newDI) / 3 * 10) / 10;

  await pool.query(`
    UPDATE places SET price_gouging_avg=$1, hygiene_avg=$2, discrimination_avg=$3,
      overall_risk=$4, review_count=$5 WHERE id=$6
  `, [newPG, newHY, newDI, newOverall, newCount, place_id]);

  res.status(201).json({ message: '리뷰가 등록되었습니다.' });
});

reviewsRouter.post('/:id/helpful', requireAuth, async (req: AuthRequest, res: Response) => {
  const existing = await pool.query(
    'SELECT 1 FROM review_helpful WHERE user_id=$1 AND review_id=$2', [req.userId, req.params.id]
  );
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM review_helpful WHERE user_id=$1 AND review_id=$2', [req.userId, req.params.id]);
    await pool.query('UPDATE reviews SET helpful_count = helpful_count - 1 WHERE id=$1', [req.params.id]);
    res.json({ helpful: false });
  } else {
    await pool.query('INSERT INTO review_helpful (user_id, review_id) VALUES ($1,$2)', [req.userId, req.params.id]);
    await pool.query('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id=$1', [req.params.id]);
    res.json({ helpful: true });
  }
});
