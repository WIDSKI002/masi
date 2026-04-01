const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Render używa zmiennej środowiskowej DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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