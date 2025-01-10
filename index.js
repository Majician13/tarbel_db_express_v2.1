const express = require('express');
const pg = require('pg');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const config = require('./config.json');

const app = express();
const port = 3000;

const pool = new pg.Pool({
  user: config.db.user,
  host: config.db.host,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.get('/', (req, res) => {
    res.render('home');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const {username, password} = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, password) VALUES ($1, $2)';
        await pool.query(query, [username, hashedPassword]);
        res.redirect('/login');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Error registering user');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    try {
        const query = 'SELECT * FROM users WHERE username = $1';
        const result = await pool.query(query, [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.user = user;
                res.redirect('/all');
            } else {
                res.send('Incorrect password');
            }
        } else {
            res.send('User not found');
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Error logging in');
    }
});

app.get('/search', requireAuth, async (req, res) => {
    try {
        const query = req.query.query;
        const results = await searchDatabase(query);

        // Get distinct subjects from the results
        const subjects = [...new Set(results.map(result => result.subject))];

        res.render('results', {results, subjects, req}); // Pass req object to the template
    } catch (error) {
        console.error('Error searching database:', error);
        res.status(500).send('Error searching database');
    }
});

app.get('/all', requireAuth, async (req, res) => {
    try {
        console.log('Reached /all route');
        const sort = req.query.sort || 'ID';
        const order = req.query.order || 'ASC';
        let results = await getAllEntries(sort, order);

        // Get distinct subjects from the results
        let subjects = [...new Set(results.map(result => result.subject))];

        // Apply subject filtering if requested
        const filterSubjects = Array.isArray(req.query.subject) ? req.query.subject : [req.query.subject]; // Handle single or multiple selections

        if (filterSubjects && filterSubjects.length > 0 && filterSubjects[0] !== undefined) {
            results = results.filter(result => filterSubjects.includes(result.subject));
        }

        res.render('results', {results, sort, order, subjects, req}); // Pass req object to the template
    } catch (error) {
        console.error('Error fetching all entries:', error);
        res.status(500).send('Error fetching all entries');
    }
});

async function getAllEntries(sort, order) {
    const client = await pool.connect();
    try {
        const sql = `SELECT * FROM tarbell ORDER BY ${sort} ${order}`;
        const result = await client.query(sql);
        return result.rows;
    } catch (error) {
        console.error('Error executing SQL query:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function searchDatabase(query) {
    const client = await pool.connect();
    try {
        const lowercaseQuery = query?.toLowerCase();

        const sql = `
      SELECT *
      FROM tarbell
      WHERE
        LOWER(CAST(ID AS TEXT)) LIKE '%${lowercaseQuery}%' OR
        LOWER(LESSON) LIKE '%${lowercaseQuery}%' OR
        LOWER(SUBJECT) LIKE '%${lowercaseQuery}%' OR
        LOWER(TITLE) LIKE '%${lowercaseQuery}%' OR
        LOWER(TIMESTAMP) LIKE '%${lowercaseQuery}%' OR
        LOWER(VOLUME) LIKE '%${lowercaseQuery}%' OR
        LOWER(CAST(PAGE AS TEXT)) LIKE '%${lowercaseQuery}%' OR
        LOWER(DESCRIPTION) LIKE '%${lowercaseQuery}%' OR
        LOWER(BOOK_DESCRIPTION) LIKE '%${lowercaseQuery}%' OR
        LOWER(INVENTOR) LIKE '%${lowercaseQuery}%'
    `;

        const result = await client.query(sql);
        return result.rows;
    } catch (error) {
        console.error('Error executing SQL query:', error);
        throw error;
    } finally {
        client.release();
    }
}

app.get('/styles.css', (req, res) => {
    fs.readFile('public/styles.css', (err, data) => {
        if (err) {
            console.error('Error reading styles.css:', err);
            res.status(500).send('Error loading stylesheet');
            return;
        }
        res.setHeader('Content-Type', 'text/css');
        res.send(data);
    });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});