const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config.json');

// Create a new Sequelize instance
const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    dialect: 'postgres'
});

// Define the Favorites model
const Favorites = sequelize.define('Favorites', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    card_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    title: {
        type: DataTypes.TEXT
    },
    subject: {
        type: DataTypes.TEXT
    }
});

// Define the Cards model (replace with your actual card details)
const Cards = sequelize.define('Cards', {
    // ... your card fields ...
});

// Establish the database connection
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
        // Sync the models with the database
        await Favorites.sync();
        await Cards.sync();
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
})();

// Export the models
module.exports = {
    Favorites,
    Cards
};