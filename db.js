const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config.json');

// Create a new Sequelize instance
const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    dialect: 'postgres'
});

const db = {};

// Assign the Sequelize instance to db.sequelize
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Define the favorites model
const favorites = sequelize.define('favorites', {
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
        type: DataTypes.TEXT,
        allowNull: true
    },
    subject: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    lesson: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    timestamp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    volume: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    page: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    book_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    inventor: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: false // Disable timestamps
});

// Define the Cards model (replace with your actual card details)
const Cards = sequelize.define('Cards', {
    //... your card fields...
});

// Define the tarbell model with freezeTableName option
const tarbell = sequelize.define('tarbell', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    lesson: {
        type: DataTypes.STRING,
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
    },
    timestamp: {
        type: DataTypes.STRING,
        allowNull: false
    },
    volume: {
        type: DataTypes.STRING,
        allowNull: false
    },
    page: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    book_description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    inventor: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    freezeTableName: true, // Prevent pluralization of the table name
    timestamps: false // Disable timestamps for tarbell model
});

// Define the lists model with freezeTableName option
const lists = sequelize.define('lists', {
    list_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    list_name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false // Disable timestamps
});

// Define the card_lists model
const card_lists = sequelize.define('card_lists', {
    card_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: tarbell, // Assuming 'tarbell' is your Cards model
            key: 'id'
        }
    },
    list_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: lists,
            key: 'list_id'
        }
    }
}, {
    timestamps: false // Disable timestamps if not needed
});

// Establish the database connection
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
        // Sync the models with the database
        await favorites.sync();
        await Cards.sync();
        await tarbell.sync(); 
        await lists.sync(); 
        await card_lists.sync(); // Sync the new card_lists table
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
})();

// Define the relationships between the models
tarbell.belongsToMany(favorites, { through: 'favorites', foreignKey: 'card_id', as: 'tarbellFavorites' });
favorites.belongsToMany(tarbell, { through: 'favorites', foreignKey: 'card_id', as: 'favoriteTarbells' });

// Export the models
module.exports = {
    favorites,
    Cards,
    tarbell,
    lists,
    card_lists // Export the card_lists model
};