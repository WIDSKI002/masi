const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'neondb_owner',
  host: 'ep-divine-wind-amtd9qol-pooler.c-5.us-east-1.aws.neon.tech',
  database: 'neondb',
  password: 'npg_wvg3HFRxT6bQ',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;

const path = require('path');
app.use(express.static(path.join(__dirname)));

// Initialize DB: create tables if not exist and ensure a default rate
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rates (
        id SERIAL PRIMARY KEY,
        effective_date DATE NOT NULL,
        whole_day NUMERIC NOT NULL,
        fuel NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_entries (
        id SERIAL PRIMARY KEY,
        entry_date DATE UNIQUE NOT NULL,
        option TEXT NOT NULL,
        not_full_hours NUMERIC,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    // Ensure at least one default rate exists (from epoch)
    const r = await pool.query('SELECT COUNT(*) FROM rates');
    if (parseInt(r.rows[0].count, 10) === 0) {
      await pool.query("INSERT INTO rates (effective_date, whole_day, fuel) VALUES ($1, $2, $3)", ['1970-01-01', 250, 50]);
    }
    console.log('DB initialized');
  } catch (err) {
    console.error('DB init error', err);
    process.exit(1);
  }
}

// Helper: get rate for a specific date
async function getRateForDate(date) {
  const res = await pool.query(
    `SELECT * FROM rates WHERE effective_date <= $1 ORDER BY effective_date DESC LIMIT 1`,
    [date]
  );
  return res.rows[0];
}

// API: get rates
app.get('/api/rates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rates ORDER BY effective_date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// API: add new rate (effective_date, whole_day, fuel)
app.post('/api/rates', async (req, res) => {
  try {
    const { effective_date, whole_day, fuel } = req.body;
    if (!effective_date || whole_day == null || fuel == null) return res.status(400).json({ error: 'Brak wymaganych pól' });
    const result = await pool.query('INSERT INTO rates (effective_date, whole_day, fuel) VALUES ($1,$2,$3) RETURNING *', [effective_date, whole_day, fuel]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// API: get calendar entries between dates
app.get('/api/calendar', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Brak zakresu dat' });
    const entries = await pool.query('SELECT * FROM calendar_entries WHERE entry_date BETWEEN $1 AND $2 ORDER BY entry_date', [from, to]);

    // compute price per entry based on applicable rate
    const enriched = await Promise.all(entries.rows.map(async (e) => {
      const rate = await getRateForDate(e.entry_date);
      let price = 0;
      if (e.option === 'caly') price = Number(rate.whole_day);
      else if (e.option === 'paliwo') price = Number(rate.fuel);
      else if (e.option === 'nie_caly') price = Number(rate.whole_day) * Number(e.not_full_hours || 0) / 8; // assume 8h day
      return { ...e, price, rate: { effective_date: rate.effective_date, whole_day: Number(rate.whole_day), fuel: Number(rate.fuel) } };
    }));

    // totals
    const total = enriched.reduce((s, e) => s + e.price, 0);
    const totalFuel = enriched.filter(e => e.option === 'paliwo').reduce((s, e) => s + e.price, 0);

    res.json({ entries: enriched, total, totalFuel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// API: upsert calendar entry
app.post('/api/calendar', async (req, res) => {
  try {
    const { entry_date, option, not_full_hours } = req.body;
    if (!entry_date || !option) return res.status(400).json({ error: 'Brak wymaganych pól' });
    await pool.query(`INSERT INTO calendar_entries (entry_date, option, not_full_hours) VALUES ($1,$2,$3)
      ON CONFLICT (entry_date) DO UPDATE SET option = EXCLUDED.option, not_full_hours = EXCLUDED.not_full_hours`, [entry_date, option, not_full_hours]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.get('/', (req, res) => {
  res.send('API działa 🚀');
});

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
  });
});
