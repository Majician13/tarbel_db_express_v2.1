const express = require('express');
const pg = require('pg');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const config = require('./config.json');
const db = require('./db'); // Import the db.js file for database operations

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
app.use(express.urlencoded({ extended: true })); // to parse form data
app.use(express.static('public')); // to serve static files
app.use(express.json()); // to parse JSON request bodies

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
        res.render('home', { user: req.session.user });
    }
});

// Register routes
app.get('/register', (req, res) => {
    console.log("Register route reached");
    res.render('register', { user: req.session.user });
});

app.post('/register', async (req, res) => {
    console.log("Register POST route reached");
    const { username, password } = req.body;
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
    res.render('login', { user: req.session.user });
});

app.post('/login', async (req, res) => {
    console.log("Login POST route reached");
    const { username, password } = req.body;
    try {
        const query = 'SELECT * FROM users WHERE username = $1';
        const result = await pool.query(query, [username]);
        console.log("Query Result:", result);
        console.log("Number of Rows:", result.rows.length);

        if (result.rows.length > 0) {
            const user = result.rows[0]; // Assign the first row to user by making sure it ends in [0]
            console.log("Fetched user:", user);
            console.log("Password:", password);
            console.log("Password Hash:", user.password_hash);

            // Access password_hash directly from user object
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

        // Fetch the user's lists
        const userId = req.session.user.user_id;
        const lists = await db.lists.findAll({
            where: { user_id: userId }
        });

        res.render('results', { results, subjects, req, user: req.session.user, lists, page: 'results' });
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
            where: { user_id: userId },
            attributes: ['card_id']
        });
        const favoriteCardIds = favorites.map(favorite => favorite.card_id);

        // Mark cards as favorite
        const updatedResults = results.map(result => ({
      ...result,
            isFavorite: favoriteCardIds.includes(result.id)
        }));

        let subjects = [...new Set(results.map((result) => result.subject))];

        // Fetch the user's lists
        const lists = await db.lists.findAll({
            where: { user_id: userId }
        });

        // Render the 'results.ejs' view to display all cards
        res.render('results', {
            results: updatedResults,
            sort,
            order,
            subjects,
            req,
            user: req.session.user,
            lists: lists, // Pass the lists to the view
            page: 'results'
        });
    } catch (error) {
        console.error('Error fetching all entries:', error);
        res.status(500).send('Error fetching all entries');
    }
});

app.get('/random', requireAuth, async (req, res) => {
    console.log("Random card route reached");
    try {
        const userId = req.session.user.user_id;

        // Fetch a random card from the database
        const randomCard = await db.tarbell.findOne({
            order: db.tarbell.sequelize.random(), // Correct way to call the random function
          });

        const favorites = await db.favorites.findAll({
            where: { user_id: userId },
            attributes: ['card_id']
        });
        const favoriteCardIds = favorites.map(favorite => favorite.card_id);

        // Mark cards as favorite
        const updatedCard = {
          ...randomCard.dataValues,
            isFavorite: favoriteCardIds.includes(randomCard.dataValues.id)
        }

        // Fetch the user's lists
        const lists = await db.lists.findAll({
            where: { user_id: userId }
        });

        res.render('random', {
            card: updatedCard,
            user: req.session.user,
            lists: lists,
            page: 'random'
        });
    } catch (error) {
        console.error('Error fetching random card:', error);
        res.status(500).send('Error fetching random card');
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
                where: { user_id: userId, card_id: cardId }
            });

            let isFavorite;

            if (deletedRowCount > 0) {
                console.log("Removing from favorites successful");
                isFavorite = false;

                // Emit a success event with the removed cardId using Socket.IO
                io.emit('favorite-removed', cardId); // Assuming you have Socket.IO set up

            } else {
                console.log("Adding to favorites");
                // If no record was deleted, create a new favorite
                await db.favorites.create({
                    user_id: userId,
                    card_id: cardId,
                });
                isFavorite = true;
            }

            console.log("Toggle favorite successful");
            res.json({ success: true, isFavorite });
        } catch (error) {
            console.error('Error toggling favorite:', error);
            res.status(500).json({ success: false, error: 'Failed to toggle favorite' });
        }
    } else {
        console.log("User not logged in or cardId is missing");
        // Handle case where userId or cardId is undefined
        res.status(401).json({ success: false, error: 'User not logged in or cardId is missing' });
    }
});

// Get favorites route
app.get('/favorites', requireAuth, async (req, res) => {
    console.log("Favorites route reached");
    try {
      const userId = req.session.user.user_id;
      const favorites = await db.favorites.findAll({
        where: { user_id: userId },
        attributes: ['card_id', 'lesson', 'subject', 'title', 'timestamp', 'volume', 'page', 'description', 'book_description', 'inventor'],
      });
  
      const cardIds = favorites.map((favorite) => favorite.card_id);
      console.log("Favorite CardIds: ", cardIds);
      const cards = await db.tarbell.findAll({
        where: { id: cardIds },
      });
  
      // Add isFavorite property to each card
      const updatedCards = cards.map(card => ({
      ...card.dataValues,
        isFavorite: true // Since these are favorites, set to true
      }));
  
      console.log("Cards: ", updatedCards);
  
      // Fetch the user's lists
      const lists = await db.lists.findAll({
        where: { user_id: userId }
      });
  
      res.render('favorites', {
        favorites: updatedCards,
        user: req.session.user,
        lists: lists, // Pass the lists to the template
        page: "favorites" 
      });
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).send('Error fetching favorites');
    }
  });

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).send('Error logging out');
        } else {
            res.redirect('/');
        }
    });
});

// get lists route
app.get('/lists', requireAuth, async (req, res) => {
    const userId = req.session.user.user_id;
    try {
        const userLists = await db.lists.findAll({
            where: { user_id: userId }
        });
        res.render('lists', {
            lists: userLists,
            user: req.session.user,
            page: 'lists' // Add this line to pass the 'page' variable
        });
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).send('Error fetching lists');
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

// Add cards to list route
app.post('/add-cards-to-list', requireAuth, async (req, res) => {
    console.log("add-cards-to-list route reached"); // Log for debugging
    const { cardIds, listId } = req.body;
    console.log("cardIds:", cardIds); // Log cardIds for debugging
    console.log("listId:", listId); // Log listId for debugging
    try {
        const userId = req.session.user.user_id;
        // Check if the list belongs to the user
        const list = await db.lists.findOne({
            where: { list_id: listId, user_id: userId }
        });
        if (!list) {
            return res.status(404).json({ success: false, error: 'List not found' });
        }
        // Insert the cards into the card_lists table
        const insertPromises = cardIds.map(cardId => {
            return db.card_lists.create({
                card_id: cardId,
                list_id: listId
            });
        });
        await Promise.all(insertPromises);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding cards to list:', error);
        res.status(500).json({ success: false, error: 'Failed to add cards to list' });
    }
});

app.get('/list/:id', requireAuth, async (req, res) => {
    const listId = req.params.id;
    try {
        const list = await db.lists.findOne({
            where: { list_id: listId, user_id: req.session.user.user_id }
        });
        if (!list) {
            return res.status(404).send('List not found');
        }
        // Fetch the cards associated with this list
        const cardIds = await db.card_lists.findAll({
            where: { list_id: listId },
            attributes: ['card_id']
        });
        const cards = await db.tarbell.findAll({
            where: { id: cardIds.map(c => c.card_id) }
        });

        // Fetch the user's lists
        const lists = await db.lists.findAll({
            where: { user_id: req.session.user.user_id }
        });

        res.render('list', { list, cards, user: req.session.user, lists, page: 'list' });
    } catch (error) {
        console.error('Error fetching list:', error);
        res.status(500).send('Error fetching list');
    }
});

app.post('/remove-cards-from-list', requireAuth, async (req, res) => {
    const { cardIds, listId } = req.body;
    try {
        // Delete the entries from the card_lists table
        const deletePromises = cardIds.map(cardId => {
            return db.card_lists.destroy({
                where: {
                    card_id: cardId,
                    list_id: listId
                }
            });
        });
        await Promise.all(deletePromises);
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing cards from list:', error);
        res.status(500).json({ success: false, error: 'Failed to remove cards from list' });
    }
});

// Create a new list
app.post('/create-list', requireAuth, async (req, res) => {
    console.log("create-list route reached"); // Log for debugging
    const userId = req.session.user.user_id;
    const listName = req.body.listName; // Make sure this matches the form field name
    console.log("listName:", listName); // Log list name for debugging
    try {
        const newList = await db.lists.create({
            user_id: userId,
            list_name: listName
        });
        // Optionally, you can redirect to the /lists page or send a JSON response
        res.redirect('/lists'); // Redirect to the lists page
        // Or, send a JSON response
        // res.json({ success: true, listId: newList.list_id });
    } catch (error) {
        console.error('Error creating list:', error);
        res.status(500).json({ success: false, error: 'Failed to create list' });
    }
});

// Edit an existing list
app.post('/edit-list', requireAuth, async (req, res) => {
    console.log("edit-list route reached"); // Log for debugging
    const userId = req.session.user.user_id;
    const { listId, newListName } = req.body;
    console.log("listId:", listId); // Log list ID for debugging
    console.log("newListName:", newListName); // Log new list name for debugging
    try {
        const updatedList = await db.lists.update(
            { list_name: newListName },
            { where: { list_id: listId, user_id: userId } }
        );
        if (updatedList === 1) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'List not found' });
        }
    } catch (error) {
        console.error('Error editing list:', error);
        res.status(500).json({ success: false, error: 'Failed to edit list' });
    }
});

// Delete a list
app.post('/delete-list', requireAuth, async (req, res) => {
    console.log("delete-list route reached"); // Log for debugging
    const userId = req.session.user.user_id;
    const listId = req.body.listId;
    console.log("listId:", listId); // Log list ID for debugging
    try {
        const deletedList = await db.lists.destroy({
            where: { list_id: listId, user_id: userId }
        });
        if (deletedList === 1) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'List not found' });
        }
    } catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ success: false, error: 'Failed to delete list' });
    }
});

// Start the server
const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Socket.IO setup
const { Server } = require("socket.io");
const io = new Server(server);

io.on("connection", (socket) => {
    console.log("User connected");
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

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