const express = require('express');
const pg = require('pg');
const fs = require('fs'); // Import the file system module

const app = express();
const port = 3000;

// Configure PostgreSQL connection
const pool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tarbell',
  password: 'Sarcasm13!',
  port: 5433,
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Add this line to serve static files from the 'public' directory
app.use(express.static('public')); 

app.get('/', (req, res) => {
  res.render('index');
});

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

app.get('/search', async (req, res) => {
  try {
    const query = req.query.query; 
    const results = await searchDatabase(query);
    res.render('results', { results });
  } catch (error) {
    console.error('Error searching database:', error);
    res.status(500).send('Error searching database'); 
  }
});

app.get('/all', async (req, res) => {
  try {
    const sort = req.query.sort || 'ID'; 
    const order = req.query.order || 'ASC'; 
    const results = await getAllEntries(sort, order);
    res.render('results', { results, sort, order });
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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});