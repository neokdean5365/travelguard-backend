import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';

export const placesRouter = Router();

placesRouter.get('/meta/countries', async (_req, res) => {
  const { rows } = await pool.query('SELECT DISTINCT country FROM places WHERE country IS NOT NULL ORDER BY country');
  res.json(rows.map((r: any) => r.country));
});

placesRouter.get('/meta/categories', (_req, res) => {
  res.json(['식당', '카페', '기념품점', '시장', '길거리음식', '패스트푸드', '관광지', '전자제품', '기타']);
});

placesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { lat, lng, radius = '50', country, category, minRisk } = req.query;
  let query = 'SELECT * FROM places WHERE 1=1';
  const params: any[] = [];
  let i = 1;

  if (lat && lng) {
    const R = 6371;
    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    const radNum = parseFloat(radius as string);
    const latDelta = radNum / R * (180 / Math.PI);
    const lngDelta = radNum / R * (180 / Math.PI) / Math.cos(latNum * Math.PI / 180);
    query += ` AND lat BETWEEN $${i++} AND $${i++} AND lng BETWEEN $${i++} AND $${i++}`;
    params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
  }
  if (country) { query += ` AND (LOWER(country) LIKE $${i} OR LOWER(city) LIKE $${i})`; params.push(`%${(country as string).toLowerCase()}%`); i++; }
  if (category) { query += ` AND category = $${i++}`; params.push(category); }
  if (minRisk) { query += ` AND overall_risk >= $${i++}`; params.push(parseFloat(minRisk as string)); }
  query += ' ORDER BY overall_risk DESC LIMIT 200';

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

placesRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM places WHERE id=$1', [req.params.id]);
  if (!rows[0]) { res.status(404).json({ error: '장소를 찾을 수 없습니다.' }); return; }
  res.json(rows[0]);
});

placesRouter.post('/from-google', requireAuth, async (req: AuthRequest, res: Response) => {
  const { google_place_id, name, address, country, city, lat, lng, category } = req.body;
  if (!name || !lat || !lng) { res.status(400).json({ error: '필수 정보가 없습니다.' }); return; }

  let { rows } = await pool.query('SELECT * FROM places WHERE google_place_id=$1', [google_place_id]);
  if (rows.length === 0) {
    const result = await pool.query(`
      INSERT INTO places (google_place_id, name, address, country, city, lat, lng, category)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [google_place_id || null, name, address, country, city, lat, lng, category || '식당']);
    rows = result.rows;
  }
  res.json(rows[0]);
});
