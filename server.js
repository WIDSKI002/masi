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


app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const result = await pool.query(
    'SELECT * FROM uzytkownicy WHERE login = $1 AND password = $2',
    [login, password]
  );
  res.json(result.rows);
});



app.get('/', (req, res) => {
  res.send('API działa 🚀');
});

// 🔥 PORT z Rendera
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});