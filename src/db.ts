import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS places (
      id SERIAL PRIMARY KEY,
      google_place_id TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      country TEXT,
      city TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      category TEXT DEFAULT '식당',
      price_gouging_avg REAL DEFAULT 0,
      hygiene_avg REAL DEFAULT 0,
      discrimination_avg REAL DEFAULT 0,
      overall_risk REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      price_gouging_score INTEGER DEFAULT 0,
      hygiene_score INTEGER DEFAULT 0,
      discrimination_score INTEGER DEFAULT 0,
      content TEXT NOT NULL,
      visit_date TEXT,
      helpful_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_helpful (
      user_id INTEGER NOT NULL,
      review_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, review_id)
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      country TEXT,
      city TEXT,
      category TEXT DEFAULT 'general',
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) as cnt FROM places');
  if (parseInt(rows[0].cnt) === 0) await seedData();
}

async function seedData() {
  const places: [string, string, string, string, string, number, number, string, number, number, number, number, number][] = [
    ['gp_florence_1', 'Trattoria del Turista', 'Ponte Vecchio, Firenze, Italia', 'Italy', 'Florence', 43.7687, 11.2530, '식당', 9.2, 3.5, 1.0, 7.2, 87],
    ['gp_rome_1', 'Colosseo Quick Bites', 'Via Sacra, Roma, Italia', 'Italy', 'Rome', 41.8902, 12.4924, '길거리음식', 8.8, 7.2, 0.5, 7.5, 134],
    ['gp_paris_1', 'Café de la Tour Eiffel', 'Champ de Mars, Paris, France', 'France', 'Paris', 48.8566, 2.2945, '카페', 8.5, 2.8, 2.5, 6.4, 203],
    ['gp_barcelona_1', 'La Rambla Seafood', 'Las Ramblas 42, Barcelona, España', 'Spain', 'Barcelona', 41.3851, 2.1734, '식당', 9.0, 5.5, 3.5, 7.8, 156],
    ['gp_bangkok_1', 'Khao San Road BBQ', 'Khao San Rd, Bangkok, Thailand', 'Thailand', 'Bangkok', 13.7563, 100.5018, '식당', 7.5, 6.8, 1.5, 6.2, 92],
    ['gp_tokyo_1', 'Asakusa Souvenir Palace', 'Nakamise, Asakusa, Tokyo, Japan', 'Japan', 'Tokyo', 35.7148, 139.7967, '기념품점', 6.5, 1.5, 5.5, 4.5, 67],
    ['gp_ny_1', 'Times Square Deli', 'Broadway & 44th St, New York, USA', 'USA', 'New York', 40.7580, -73.9855, '식당', 8.0, 4.5, 2.0, 5.5, 178],
    ['gp_london_1', 'Big Ben Burger Shack', 'Westminster Bridge Rd, London, UK', 'UK', 'London', 51.5007, -0.1246, '패스트푸드', 7.8, 3.2, 1.5, 5.2, 145],
    ['gp_prague_1', 'Old Town Tourist Grill', 'Staroměstské náměstí, Prague, Czechia', 'Czechia', 'Prague', 50.0875, 14.4213, '식당', 9.5, 4.0, 0.5, 7.0, 112],
    ['gp_amsterdam_1', 'Canal Side Cheese Shop', 'Prinsengracht, Amsterdam, Netherlands', 'Netherlands', 'Amsterdam', 52.3676, 4.9041, '기념품점', 7.0, 2.0, 1.0, 4.0, 55],
    ['gp_istanbul_1', 'Grand Bazaar Special Price', 'Kapalıçarşı, İstanbul, Turkey', 'Turkey', 'Istanbul', 41.0107, 28.9680, '시장', 8.5, 3.0, 4.5, 6.5, 98],
    ['gp_bali_1', 'Kuta Beach Warung', 'Kuta Beach, Bali, Indonesia', 'Indonesia', 'Bali', -8.7180, 115.1686, '식당', 7.2, 6.5, 1.5, 5.8, 76],
    ['gp_santorini_1', 'Oia Sunset Restaurant', 'Oia, Santorini, Greece', 'Greece', 'Santorini', 36.4618, 25.3753, '식당', 9.8, 2.0, 1.5, 7.0, 234],
    ['gp_dubrovnik_1', 'Old City Wall Cafe', 'Stari Grad, Dubrovnik, Croatia', 'Croatia', 'Dubrovnik', 42.6507, 18.0944, '카페', 9.2, 2.5, 1.0, 6.8, 89],
    ['gp_marrakech_1', 'Medina Spice Market', 'Djemaa el-Fna, Marrakech, Morocco', 'Morocco', 'Marrakech', 31.6258, -7.9892, '시장', 8.0, 5.5, 3.0, 6.2, 143],
  ];

  for (const p of places) {
    await pool.query(`
      INSERT INTO places (google_place_id, name, address, country, city, lat, lng, category,
        price_gouging_avg, hygiene_avg, discrimination_avg, overall_risk, review_count)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (google_place_id) DO NOTHING
    `, p);
  }

  // 시드 유저 및 커뮤니티 게시글
  const { rows: userRows } = await pool.query(`
    INSERT INTO users (username, email, password_hash)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `, ['admin_seed', 'seed@travelguard.app', '$2b$10$placeholder']);

  let userId: number;
  if (userRows.length > 0) {
    userId = userRows[0].id;
  } else {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', ['seed@travelguard.app']);
    userId = rows[0].id;
  }

  const posts = [
    ['이탈리아 로마 관광지 주변 바가지 주의!', '콜로세움 주변 레스토랑들은 메뉴판 없이 주문하게 한 뒤 나중에 엄청난 금액을 청구합니다. 반드시 메뉴판과 가격을 먼저 확인하세요. 특히 브레드 서비스가 자동으로 포함되어 청구되는 경우가 많습니다.', 'Italy', 'Rome', 'warning', 45, 12],
    ['바르셀로나 라 람블라 소매치기 주의', '라 람블라 거리에서 음식이나 물건을 억지로 건네주며 돈을 요구하는 사람들이 있습니다. 특히 꽃 파는 척하면서 접근하는 경우가 많으니 주의하세요.', 'Spain', 'Barcelona', 'warning', 67, 23],
    ['방콕 카오산 로드 음식점 후기', '카오산 로드 주변 식당 중 영어 메뉴판 가격이 현지인 가격의 3-4배인 곳들이 있습니다. 조금만 골목으로 들어가면 훨씬 저렴하고 맛있는 로컬 식당들이 많습니다.', 'Thailand', 'Bangkok', 'tip', 89, 34],
    ['산토리니 레스토랑 바가지 최악', '오이아 석양 뷰 레스토랑들... 파스타 한 접시에 35유로. 절벽 바로 옆 자리는 추가 요금까지 받더라고요.', 'Greece', 'Santorini', 'warning', 112, 45],
  ];

  for (const p of posts) {
    await pool.query(`
      INSERT INTO community_posts (user_id, title, content, country, city, category, like_count, comment_count)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [userId, ...p]);
  }
}

export default pool;
