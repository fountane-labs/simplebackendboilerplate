'use strict'

const Sequelize = require('sequelize');
const Op = Sequelize.Op
const env = require('./env');
const sequelize = new Sequelize(env.DATABASE_NAME, env.DATABASE_USERNAME, env.DATABASE_PASSWORD, {
  operatorsAliases: {
    $and: Op.and,
    $or: Op.or,
    $eq: Op.eq,
    $gt: Op.gt,
    $lt: Op.lt,
    $lte: Op.lte,
    $like: Op.like,
    $in: Op.in
  },
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  dialect: env.DATABASE_DIALECT,
  schema: env.SCHEMA,
  define: {
    underscored: true
  },
  //logging: false
});

sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
});

// Connect all the models/tables in the database to a db object,
//so everything is accessible via one object
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;
db.Op = Sequelize.Op;

//Models/tables
db.logins = require('./logins.js')(sequelize, Sequelize);
db.profiles = require('./profiles.js')(sequelize, Sequelize);


// Example for logins and profiles.
db.profiles.belongsTo(db.logins, {onDelete: "CASCADE"});

module.exports = db;