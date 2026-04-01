const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Render używa zmiennej środowiskowej DATABASE_URL
const { Pool } = require('pg');

const pool = new Pool({
  user: 'baza_s0r0_user',           // Twój login do bazy
  host: 'dpg-d73f6gvdiees73eronl0-a.frankfurt-postgres.render.com',    // np. db.postgres.render.com
  database: 'baza_s0r0',
  password: '8agqccLgW2HYWy4qfcvwM1sx25bDvNRR',     // uwaga, jawne hasło
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;

// 📌 Endpoint - wszyscy użytkownicy
app.get('/uzytkownicy', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, imie, nazwisko, email, rola, data_utworzenia FROM uzytkownicy'
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// 📌 Endpoint testowy
app.get('/', (req, res) => {
  res.send('API działa 🚀');
});

// 🔥 PORT z Rendera
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});