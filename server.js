const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');


const bcrypt = require('bcrypt');
const saltRounds = 10;

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
      'SELECT id, imie, nazwisko, email,  data_utworzenia FROM uzytkownicy'
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
    'SELECT * FROM uzytkownicy WHERE email = $1',
    [login]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
  }
  const isMatch = await bcrypt.compare(password, user.haslo);
  if (isMatch) {
    const payload = {
      userId: result.rows[0].id,
      email: login
    };
    
    const secret = "key";
    
    const token = jwt.sign(payload, secret, {
      expiresIn: "1h"
    });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
  }
});

app.post('/rejestracja', async (req, res) => {
  const { imie, nazwisko, email, password, rola } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO uzytkownicy (imie, nazwisko, email, haslo) VALUES ($1, $2, $3, $4) RETURNING id',
      [imie, nazwisko, email, hashedPassword]
    ); 
    const res = await pool.query(
      'INSERT INTO uzytkownik_role (uzytkownik_id, rola_id) VALUES ($1, $2)',
      [result.rows[0].id,rola]
    );
    console.log(result.rows[0]+res.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});
app.get('/api/role', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM role ORDER BY id');
      res.json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Błąd serwera' });
  }
});
app.get('/', (req, res) => {
  res.send('API działa 🚀');
});

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Brak tokena' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Nieprawidłowy token' });
  }
}
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});