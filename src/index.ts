import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { placesRouter } from './routes/places';
import { reviewsRouter } from './routes/reviews';
import { communityRouter } from './routes/community';
import { initDb } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/places', placesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/community', communityRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 TravelGuard 서버 실행 중: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('DB 초기화 실패:', err);
    process.exit(1);
  });
