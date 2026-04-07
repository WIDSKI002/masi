const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());



const pool = new Pool({
  user: 'baza_s0r0_user',          
  host: 'dpg-d73f6gvdiees73eronl0-a.frankfurt-postgres.render.com',   
  database: 'baza_s0r0',
  password: '8agqccLgW2HYWy4qfcvwM1sx25bDvNRR',    
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;

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
app.get('/trenera', async (req, res) => {
  const result = await pool.query(
    'SELECT id, imie, nazwisko FROM uzytkownicy WHERE rola = $1',
    ['trener']
  );
  res.json(result.rows);
});
app.post('/dodajSzkolenie', async (req, res) => {
  const { tytul, opis, trener } = req.body;
  const result = await pool.query(
    'INSERT INTO szkolenia (tytul, opis, trener) VALUES ($1, $2, $3)',
    [tytul, opis, trener]
  );
  res.json(result.rows);
});

app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const result = await pool.query(
    'SELECT * FROM uzytkownicy WHERE email = $1 AND haslo = $2',
    [login, password]
  );
  if (result.rows.length > 0) {
    res.json(result.rows[0]);
  } else {
    res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
  }
});

app.post('/rejestracja', async (req, res) => {
  const { imie, nazwisko, email, password, rola } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO uzytkownicy (imie, nazwisko, email, haslo, rola, data_utworzenia) VALUES ($1, $2, $3, $4, $5, $6)',
      [imie, nazwisko, email, password, rola]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.get('/', (req, res) => {
  res.send('API działa 🚀');
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});