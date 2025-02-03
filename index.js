const express = require('express');
const pg = require('pg');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const config = require('./config.json');
const db = require('./db'); // Import the db.js file

const app = express();
const port = 3000;

// Create a PostgreSQL connection pool
const pool = new pg.Pool({
    user: config.db.user,
    host: config.db.host,
    database: config.db.database,
    password: config.db.password,
    port: config.db.port,
});

// Set up express to use EJS for templating
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true})); // to parse form data
app.use(express.static('public')); // to serve static files
app.use(express.json()); // to serve

// Configure session middleware with PostgreSQL store
app.use(
    session({
        store: new pgSession({
            pool: pool, // Use the PostgreSQL connection pool
            tableName: 'user_sessions', // Choose a table name for storing sessions
        }),
        secret: 'your-secret-key', // Replace with a strong secret key
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        },
    })
);

// Middleware to protect routes that require authentication
const requireAuth = (req, res, next) => {
    console.log("requireAuth middleware reached");
    if (req.session.user) {
        console.log("User is authenticated");
        next();
    } else {
        console.log("User is not authenticated");
        res.redirect('/login');
    }
};

// --- Routes ---

// Home route
app.get('/', (req, res) => {
    console.log("Home route reached");
    if (req.session.user) {
        // User is logged in, redirect to /all
        console.log("User ID:", req.session.user.user_id); // Log the user ID
        console.log("Username:", req.session.user.username); // Log the username
        res.redirect('/all');
    } else {
        // User is not logged in, render the home page
        res.render('home', {user: req.session.user});
    }
});

// Register routes
app.get('/register', (req, res) => {
    console.log("Register route reached");
    res.render('register', {user: req.session.user});
});

app.post('/register', async (req, res) => {
    console.log("Register POST route reached");
    const {username, password} = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, password_hash) VALUES ($1, $2)';
        await pool.query(query, [username, hashedPassword]);
        res.redirect('/login');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Error registering user');
    }
});

// Login routes
app.get('/login', (req, res) => {
    console.log("Login route reached");
    res.render('login', {user: req.session.user});
});

app.post('/login', async (req, res) => {
    console.log("Login POST route reached");
    const {username, password} = req.body;
    try {
        const query = 'SELECT * FROM users WHERE username = $1';
        const result = await pool.query(query, [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password_hash);
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

// Search route
app.get('/search', requireAuth, async (req, res) => {
    console.log("Search route reached");
    try {
        const query = req.query.query;
        const results = await searchDatabase(query);
        const subjects = [...new Set(results.map((result) => result.subject))];
        res.render('results', {results, subjects, req, user: req.session.user});
    } catch (error) {
        console.error('Error searching database:', error);
        res.status(500).send('Error searching database');
    }
});

// Get all entries route
app.get('/all', requireAuth, async (req, res) => {
    console.log("All route reached");
    try {
      const userId = req.session.user.user_id; // Get the user ID
      const sort = req.query.sort || 'ID';
      const order = req.query.order || 'ASC';
      const results = await getAllEntries(sort, order); // Fetch all entries
  
      // Fetch the user's favorite card IDs
      const favorites = await db.favorites.findAll({
        where: {user_id: userId},
        attributes: ['card_id']
      });
      const favoriteCardIds = favorites.map(favorite => favorite.card_id);
  
      // Mark cards as favorite
      const updatedResults = results.map(result => ({
      ...result,
        isFavorite: favoriteCardIds.includes(result.id)
      }));
  
      let subjects = [...new Set(results.map((result) => result.subject))];
  
      // Render the 'results.ejs' view to display all cards
      res.render('results', {
        results: updatedResults,
        sort,
        order,
        subjects,
        req,
        user: req.session.user
      });
    } catch (error) {
      console.error('Error fetching all entries:', error);
      res.status(500).send('Error fetching all entries');
    }
  });

// Toggle favorite route
app.post('/toggle-favorite', async (req, res) => {
    console.log("Toggle favorite route handler reached");
    const userId = req.session.user.user_id; // Get the user ID from the session
    const cardId = req.body.cardId; // Get the card ID from the request body
    console.log("REQ.BODY: ", req.body);
    console.log("INDEX.JS:User ID:", userId);
    console.log("INDEX.JS: Card ID:", cardId);

    // Check if userId and cardId are defined
    if (userId && cardId) {
        try {
            console.log("Attempting to toggle favorite");
        
            // Try to delete the record directly using user_id and card_id
            const deletedRowCount = await db.favorites.destroy({
                where: {user_id: userId, card_id: cardId}
            });
        
            if (deletedRowCount > 0) {
                console.log("Removing from favorites successful");
            } else {
                console.log("Adding to favorites");
                // If no record was deleted, create a new favorite
                await db.favorites.create({
                    user_id: userId,
                    card_id: cardId,
                });
            }
        
            console.log("Toggle favorite successful");
            res.json({success: true});
        } catch (error) {
            console.error('Error toggling favorite:', error);
            res.status(500).json({success: false, error: 'Failed to toggle favorite'});
        }
    } else {
        console.log("User not logged in or cardId is missing");
        // Handle case where userId or cardId is undefined
        res.status(401).json({success: false, error: 'User not logged in or cardId is missing'});
    }
});

// Get favorites route
app.get('/favorites', requireAuth, async (req, res) => { // Apply requireAuth middleware
    console.log("Favorites route reached");
    try {
        const userId = req.session.user.user_id;
        const favorites = await db.favorites.findAll({
            where: {user_id: userId},
            attributes: ['card_id', 'lesson','subject','title','timestamp','volume','page','description','book_description','inventor'], 
        });
        const cardIds = favorites.map((favorite) => favorite.card_id);
        console.log("Favorite CardIds: ", cardIds);
        const cards = await db.tarbell.findAll({
            where: {id: cardIds},
        });
        console.log("Cards: ", cards);
        res.render('favorites', {favorites: cards, user: req.session.user});
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).send('Error fetching favorites');
    }
});

// --- Helper functions ---

// Function to get all entries from the database
async function getAllEntries(sort, order) {
    console.log("getAllEntries function reached");
    const client = await pool.connect();
    try {
      // Use template literals to construct the SQL query
      const sql = `SELECT * FROM tarbell ORDER BY ${sort} ${order}`;
      const result = await client.query(sql); // No need to pass sort and order as parameters
      console.log("Raw data from database:", result.rows);
      return result.rows;
    } catch (error) {
      console.error('Error executing SQL query:', error);
      throw error;
    } finally {
      client.release();
    }
  }

// Function to search the database
async function searchDatabase(query) {
    console.log("searchDatabase function reached");
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

// Route to serve the styles.css file
app.get('/styles.css', (req, res) => {
    console.log("styles.css route reached");
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

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});