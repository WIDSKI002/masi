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
app.get('/api/role', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM role ORDER BY id');
      res.json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Błąd serwera' });
  }
});
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
  try {
    const result = await pool.query(
      'SELECT DISTINCT u.id, u.imie, u.nazwisko FROM uzytkownicy u JOIN uzytkownik_role ur ON u.id = ur.uzytkownik_id JOIN role r ON ur.rola_id = r.id WHERE r.nazwa = $1',
      ['Trener']
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.post('/dodajSzkolenie', verifyToken, async (req, res) => {
  const { tytul, opis, limit_miejsc, cena, data_rozpoczecia, data_zakonczenia, status } = req.body;
  try {
    const allowedRoles = [1, 2, 3]; // admin, organizator, trener
    if (!allowedRoles.includes(req.user.rola)) {
      return res.status(403).json({ error: 'Brak uprawnień do dodawania szkoleń' });
    }

    const result = await pool.query(
      'INSERT INTO szkolenia (tytul, opis, trener_id, limit_miejsc, cena, data_rozpoczecia, data_zakonczenia, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, tytul, opis, limit_miejsc, cena, data_rozpoczecia, data_zakonczenia, status',
      [tytul, opis, req.user.userId, limit_miejsc, cena, data_rozpoczecia, data_zakonczenia, status || 'planowane']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
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
    const r = await pool.query('SELECT rola_id FROM uzytkownik_role WHERE uzytkownik_id = $1',[user.id]);
    const payload = {
      userId: user.id,
      email: login,
      rola: r.rows[0].rola_id
    };
    
    const secret = process.env.JWT_SECRET || "key";
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
    const userResult = await pool.query(
      'INSERT INTO uzytkownicy (imie, nazwisko, email, haslo) VALUES ($1, $2, $3, $4) RETURNING id',
      [imie, nazwisko, email, hashedPassword]
    ); 
    const roleResult = await pool.query(
      'INSERT INTO uzytkownik_role (uzytkownik_id, rola_id) VALUES ($1, $2)',
      [userResult.rows[0].id, rola]
    );
    res.json({ id: userResult.rows[0].id, message: 'Rejestracja pomyślna' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Brak tokena' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || "key";

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Nieprawidłowy token' });
  }
}

// ============== SZKOLENIA ==============
// Pobierz wszystkie szkolenia
app.get('/szkolenia', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT s.id, s.tytul, s.opis, s.limit_miejsc, s.cena, s.status, u.imie, u.nazwisko FROM szkolenia s LEFT JOIN uzytkownicy u ON s.trener_id = u.id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz szczegóły szkolenia
app.get('/szkolenia/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT s.id, s.tytul, s.opis, s.limit_miejsc, s.cena, s.status, s.data_rozpoczecia, s.data_zakonczenia, u.imie, u.nazwisko, u.id as trener_id FROM szkolenia s LEFT JOIN uzytkownicy u ON s.trener_id = u.id WHERE s.id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Szkolenie nie znalezione' });
    }
    
    // Pobierz program szkolenia
    const program = await pool.query(
      'SELECT * FROM program_szkolenia WHERE szkolenie_id = $1 ORDER BY kolejnosc',
      [id]
    );
    
    res.json({ ...result.rows[0], program: program.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Edytuj szkolenie (tylko trener lub admin)
app.put('/szkolenia/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tytul, opis, limit_miejsc, cena, status, data_rozpoczecia, data_zakonczenia } = req.body;
    
    // Sprawdzenie uprawnień
    const schResult = await pool.query('SELECT trener_id FROM szkolenia WHERE id = $1', [id]);
    if (schResult.rows.length === 0) {
      return res.status(404).json({ error: 'Szkolenie nie znalezione' });
    }
    
    if (req.user.rola !== 1 && req.user.userId !== schResult.rows[0].trener_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    const result = await pool.query(
      'UPDATE szkolenia SET tytul=$1, opis=$2, limit_miejsc=$3, cena=$4, status=$5, data_rozpoczecia=$6, data_zakonczenia=$7 WHERE id=$8 RETURNING *',
      [tytul, opis, limit_miejsc, cena, status, data_rozpoczecia, data_zakonczenia, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});


app.delete('/szkolenia/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const schResult = await pool.query('SELECT trener_id FROM szkolenia WHERE id = $1', [id]);
    if (schResult.rows.length === 0) {
      return res.status(404).json({ error: 'Szkolenie nie znalezione' });
    }
    
    if (req.user.rola !== 1 && req.user.userId !== schResult.rows[0].trener_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    await pool.query('DELETE FROM szkolenia WHERE id = $1', [id]);
    res.json({ message: 'Szkolenie usunięte' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.post('/zapisy', verifyToken, async (req, res) => {
  try {
    const { szkolenie_id } = req.body;
    const uzytkownik_id = req.user.userId;
    
    const schResult = await pool.query(
      'SELECT limit_miejsc FROM szkolenia WHERE id = $1',
      [szkolenie_id]
    );
    
    if (schResult.rows.length === 0) {
      return res.status(404).json({ error: 'Szkolenie nie znalezione' });
    }
    
    // Sprawdź liczbę zapisów
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM zapisy WHERE szkolenie_id = $1 AND status != $2',
      [szkolenie_id, 'anulowany']
    );
    
    if (parseInt(countResult.rows[0].count) >= schResult.rows[0].limit_miejsc) {
      return res.status(400).json({ error: 'Brak wolnych miejsc' });
    }
    
    const result = await pool.query(
      'INSERT INTO zapisy (uzytkownik_id, szkolenie_id, status) VALUES ($1, $2, $3) RETURNING *',
      [uzytkownik_id, szkolenie_id, 'aktywny']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz moje zapisy
app.get('/moje-zapisy', verifyToken, async (req, res) => {
  try {
    const uzytkownik_id = req.user.userId;
    const result = await pool.query(
      'SELECT z.id, z.status, z.data_zapisu, s.id as szkolenie_id, s.tytul, s.opis, s.data_rozpoczecia, s.data_zakonczenia, u.imie, u.nazwisko FROM zapisy z JOIN szkolenia s ON z.szkolenie_id = s.id LEFT JOIN uzytkownicy u ON s.trener_id = u.id WHERE z.uzytkownik_id = $1 ORDER BY z.data_zapisu DESC',
      [uzytkownik_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Anuluj zapis na szkolenie
app.post('/zapisy/:id/anuluj', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const uzytkownik_id = req.user.userId;
    
    // Sprawdź czy to twój zapis
    const zapis = await pool.query('SELECT * FROM zapisy WHERE id = $1', [id]);
    if (zapis.rows.length === 0 || zapis.rows[0].uzytkownik_id !== uzytkownik_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'UPDATE zapisy SET status = $1 WHERE id = $2 RETURNING *',
      ['anulowany', id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============== SESJE SZKOLENIA ==============
// Pobierz sesje szkolenia
app.get('/sesje/:szkolenie_id', async (req, res) => {
  try {
    const { szkolenie_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM sesje_szkolen WHERE szkolenie_id = $1 ORDER BY data_sesji',
      [szkolenie_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Dodaj sesję szkolenia (trener/admin)
app.post('/sesje', verifyToken, async (req, res) => {
  try {
    const { szkolenie_id, data_sesji, lokalizacja } = req.body;
    
    // Sprawdzenie uprawnień
    const schResult = await pool.query('SELECT trener_id FROM szkolenia WHERE id = $1', [szkolenie_id]);
    if (req.user.rola !== 1 && req.user.userId !== schResult.rows[0].trener_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'INSERT INTO sesje_szkolen (szkolenie_id, data_sesji, lokalizacja) VALUES ($1, $2, $3) RETURNING *',
      [szkolenie_id, data_sesji, lokalizacja]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============== OBECNOŚĆ ==============
// Zaznacz obecność (trener/admin)
app.post('/obecnosci', verifyToken, async (req, res) => {
  try {
    const { uzytkownik_id, sesja_id, obecny } = req.body;
    
    // Sprawdzenie uprawnień - sprawdzamy czy jest trener
    const sesjaResult = await pool.query('SELECT szkolenie_id FROM sesje_szkolen WHERE id = $1', [sesja_id]);
    const schResult = await pool.query('SELECT trener_id FROM szkolenia WHERE id = $1', [sesjaResult.rows[0].szkolenie_id]);
    
    if (req.user.rola !== 1 && req.user.userId !== schResult.rows[0].trener_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    // Sprawdź czy rekord istnieje
    const existResult = await pool.query(
      'SELECT id FROM obecnosci WHERE uzytkownik_id = $1 AND sesja_id = $2',
      [uzytkownik_id, sesja_id]
    );
    
    let result;
    if (existResult.rows.length > 0) {
      result = await pool.query(
        'UPDATE obecnosci SET obecny = $1 WHERE uzytkownik_id = $2 AND sesja_id = $3 RETURNING *',
        [obecny, uzytkownik_id, sesja_id]
      );
    } else {
      result = await pool.query(
        'INSERT INTO obecnosci (uzytkownik_id, sesja_id, obecny) VALUES ($1, $2, $3) RETURNING *',
        [uzytkownik_id, sesja_id, obecny]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz listę obecności dla sesji
app.get('/sesje/:sesja_id/obecnosci', verifyToken, async (req, res) => {
  try {
    const { sesja_id } = req.params;
    
    const result = await pool.query(
      'SELECT o.id, o.obecny, u.id as uzytkownik_id, u.imie, u.nazwisko, u.email FROM obecnosci o JOIN uzytkownicy u ON o.uzytkownik_id = u.id WHERE o.sesja_id = $1 ORDER BY u.nazwisko',
      [sesja_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============== CERTYFIKATY ==============
// Generuj certyfikat
app.post('/certyfikaty', verifyToken, async (req, res) => {
  try {
    const { uzytkownik_id, szkolenie_id } = req.body;
    
    // Sprawdzenie uprawnień - tylko admin/trener
    const schResult = await pool.query('SELECT trener_id FROM szkolenia WHERE id = $1', [szkolenie_id]);
    if (req.user.rola !== 1 && req.user.userId !== schResult.rows[0].trener_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'INSERT INTO certyfikaty (uzytkownik_id, szkolenie_id, data_wydania) VALUES ($1, $2, CURRENT_DATE) ON CONFLICT DO NOTHING RETURNING *',
      [uzytkownik_id, szkolenie_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Certyfikat już istnieje' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz moje certyfikaty
app.get('/moje-certyfikaty', verifyToken, async (req, res) => {
  try {
    const uzytkownik_id = req.user.userId;
    const result = await pool.query(
      'SELECT c.id, c.data_wydania, s.tytul, s.opis, u.imie, u.nazwisko FROM certyfikaty c JOIN szkolenia s ON c.szkolenie_id = s.id LEFT JOIN uzytkownicy u ON s.trener_id = u.id WHERE c.uzytkownik_id = $1 ORDER BY c.data_wydania DESC',
      [uzytkownik_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============== PŁATNOŚCI ==============
// Pobierz płatności dla zapisu
app.get('/platnosci/:zapis_id', verifyToken, async (req, res) => {
  try {
    const { zapis_id } = req.params;
    
    // Sprawdzenie uprawnień
    const zapis = await pool.query('SELECT uzytkownik_id FROM zapisy WHERE id = $1', [zapis_id]);
    if (zapis.rows.length === 0 || zapis.rows[0].uzytkownik_id !== req.user.userId) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'SELECT * FROM platnosci WHERE zapis_id = $1 ORDER BY data_platnosci DESC',
      [zapis_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Dodaj płatność
app.post('/platnosci', verifyToken, async (req, res) => {
  try {
    const { zapis_id, kwota } = req.body;
    
    // Sprawdzenie uprawnień
    const zapis = await pool.query('SELECT uzytkownik_id FROM zapisy WHERE id = $1', [zapis_id]);
    if (zapis.rows.length === 0 || zapis.rows[0].uzytkownik_id !== req.user.userId) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'INSERT INTO platnosci (zapis_id, kwota, status, data_platnosci) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
      [zapis_id, kwota, 'zaplacone']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============== POWIADOMIENIA ==============
// Pobierz moje powiadomienia
app.get('/powiadomienia', verifyToken, async (req, res) => {
  try {
    const uzytkownik_id = req.user.userId;
    const result = await pool.query(
      'SELECT * FROM powiadomienia WHERE uzytkownik_id = $1 ORDER BY data_wyslania DESC LIMIT 50',
      [uzytkownik_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Wyślij powiadomienie (admin/trener)
app.post('/powiadomienia', verifyToken, async (req, res) => {
  try {
    const { uzytkownik_id, tresc, typ } = req.body;
    
    // Tylko admin (rola 1) może wysyłać powiadomienia
    if (req.user.rola !== 1) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'INSERT INTO powiadomienia (uzytkownik_id, tresc, typ, data_wyslania) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
      [uzytkownik_id, tresc, typ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============== RAPORTOWANIE ==============
// Pobierz raport szkolenia (lista uczestników, obecność, certyfikaty)
app.get('/raporty/szkolenie/:szkolenie_id', verifyToken, async (req, res) => {
  try {
    const { szkolenie_id } = req.params;
    
    // Sprawdzenie uprawnień - sprawdzamy czy jest trener
    const schResult = await pool.query('SELECT trener_id FROM szkolenia WHERE id = $1', [szkolenie_id]);
    if (schResult.rows.length === 0) {
      return res.status(404).json({ error: 'Szkolenie nie znalezione' });
    }
    
    if (req.user.rola !== 1 && req.user.userId !== schResult.rows[0].trener_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    // Pobierz uczestników
    const uczestnicy = await pool.query(
      'SELECT u.id, u.imie, u.nazwisko, u.email, z.status, z.id as zapis_id FROM zapisy z JOIN uzytkownicy u ON z.uzytkownik_id = u.id WHERE z.szkolenie_id = $1',
      [szkolenie_id]
    );
    
    // Pobierz sesje i obecności
    const sesje = await pool.query(
      'SELECT ss.id, ss.data_sesji FROM sesje_szkolen ss WHERE ss.szkolenie_id = $1 ORDER BY ss.data_sesji',
      [szkolenie_id]
    );
    
    // Dla każdego uczestnika i sesji pobierz obecność
    const raport = [];
    for (const uczestnik of uczestnicy.rows) {
      const obecnosci = await pool.query(
        'SELECT ss.data_sesji, o.obecny FROM sesje_szkolen ss LEFT JOIN obecnosci o ON o.sesja_id = ss.id AND o.uzytkownik_id = $1 WHERE ss.szkolenie_id = $2 ORDER BY ss.data_sesji',
        [uczestnik.id, szkolenie_id]
      );
      
      const certyfikat = await pool.query(
        'SELECT id FROM certyfikaty WHERE uzytkownik_id = $1 AND szkolenie_id = $2',
        [uczestnik.id, szkolenie_id]
      );
      
      raport.push({
        ...uczestnik,
        obecnosci: obecnosci.rows,
        ma_certyfikat: certyfikat.rows.length > 0
      });
    }
    
    res.json({
      szkolenie_id,
      sesje: sesje.rows,
      uczestnicy: raport
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz statystyki (dla admina)
app.get('/statystyki', verifyToken, async (req, res) => {
  try {
    if (req.user.rola !== 1) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const liczbaUzytkownikow = await pool.query('SELECT COUNT(*) as count FROM uzytkownicy');
    const liczbaSzkolen = await pool.query('SELECT COUNT(*) as count FROM szkolenia');
    const liczbaZapisow = await pool.query('SELECT COUNT(*) as count FROM zapisy WHERE status = $1', ['aktywny']);
    const liczbaCertyfikatow = await pool.query('SELECT COUNT(*) as count FROM certyfikaty');
    
    res.json({
      uzytkownicy: parseInt(liczbaUzytkownikow.rows[0].count),
      szkolenia: parseInt(liczbaSzkolen.rows[0].count),
      aktywneZapisy: parseInt(liczbaZapisow.rows[0].count),
      certyfikaty: parseInt(liczbaCertyfikatow.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz listę użytkowników z rolami (dla admina)
app.get('/admin/uzytkownicy', verifyToken, async (req, res) => {
  try {
    if (req.user.rola !== 1) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'SELECT u.id, u.imie, u.nazwisko, u.email, u.data_utworzenia, ARRAY_AGG(r.nazwa) as role FROM uzytkownicy u LEFT JOIN uzytkownik_role ur ON u.id = ur.uzytkownik_id LEFT JOIN role r ON ur.rola_id = r.id GROUP BY u.id ORDER BY u.data_utworzenia DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Zmień rolę użytkownika (admin)
app.put('/admin/uzytkownicy/:id/rola', verifyToken, async (req, res) => {
  try {
    if (req.user.rola !== 1) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const { id } = req.params;
    const { rola_id } = req.body;
    
    // Usuń starą rolę
    await pool.query('DELETE FROM uzytkownik_role WHERE uzytkownik_id = $1', [id]);
    
    // Dodaj nową rolę
    const result = await pool.query(
      'INSERT INTO uzytkownik_role (uzytkownik_id, rola_id) VALUES ($1, $2) RETURNING *',
      [id, rola_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Dodaj program do szkolenia
app.post('/program-szkolenia', verifyToken, async (req, res) => {
  try {
    const { szkolenie_id, tytul, opis, kolejnosc } = req.body;
    
    // Sprawdzenie uprawnień
    const schResult = await pool.query('SELECT trener_id FROM szkolenia WHERE id = $1', [szkolenie_id]);
    if (req.user.rola !== 1 && req.user.userId !== schResult.rows[0].trener_id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    const result = await pool.query(
      'INSERT INTO program_szkolenia (szkolenie_id, tytul, opis, kolejnosc) VALUES ($1, $2, $3, $4) RETURNING *',
      [szkolenie_id, tytul, opis, kolejnosc]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz moje szkolenia (dla trenera)
app.get('/moje-szkolenia', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM szkolenia WHERE trener_id = $1 ORDER BY id DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});






const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('API działa 🚀');
});
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});