const express = require('express');
const pg = require('pg');

const app = express();
const port = 3000;

// Configure PostgreSQL connection
const pool = new pg.Pool({
  user: 'postgres', // Replace with your actual username
  host: 'localhost',
  database: 'tarbell', // Replace with your actual database name
  password: 'Sarcasm13!', // Replace with your actual password
  port: 5433, // Default PostgreSQL port
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/search', async (req, res) => {
  const query = req.query.query;
  try {
    const results = await searchDatabase(query);

    // Log the results to the console
    console.log('Search results:', results);

    res.render('results', { results });
  } catch (error) {
    console.error('Error searching database:', error);
    res.status(500).render('error', { error: error.message });
  }
});

app.get('/all', async (req, res) => {
  try {
    const sort = req.query.sort || 'ID'; // Default sorting by ID
    const order = req.query.order || 'ASC'; // Default order is ascending
    const results = await getAllEntries(sort, order);
    res.render('results', { results, sort, order });
  } catch (error) {
    console.error('Error fetching all entries:', error);
    res.status(500).render('error', { error: error.message });
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
    // Convert the query to lowercase for case-insensitive search
    const lowercaseQuery = query.toLowerCase();

    // Construct the SQL query dynamically based on the search term
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

    // Log the generated SQL query for debugging
    console.log('Generated SQL query:', sql);

    const result = await client.query(sql);
    return result.rows;
  } catch (error) {
    // Log more specific error messages
    console.error('Error executing SQL query:', error);
    throw error; // Re-throw the error to be caught by the try-catch block in /search route
  } finally {
    client.release();
  }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});