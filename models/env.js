const env = {
    PORT: process.env.PORT || 4192,
    DATABASE_URL: process.env.INSTANCE_CONNECTION_NAME || 'postgres://bkkadxtv:mT81AA_ujC_Vdck4GtRzifEpHBTMkFur@pellefant.db.elephantsql.com:5432/bkkadxtv',
    DATABASE_NAME: process.env.DB_NAME || 'fountane',
    DATABASE_HOST: process.env.INSTANCE_CONNECTION_NAME || 'localhost',
    DATABASE_USERNAME: process.env.DB_USER || 'fountane',
    DATABASE_PASSWORD: process.env.DB_PASS || 'Co0kies!',
    READ_REPLICA1: process.env.READ_REPLICA1 || '',
    READ_REPLICA2: process.env.READ_REPLICA2 || '',
    MASTER: process.env.MASTER || '',
    READ_REPLICA1_USERNAME: process.env.READ_REPLICA1_USERNAME || '',
    READ_REPLICA2_USERNAME: process.env.READ_REPLICA2_USERNAME || '',
    READ_REPLICA1_PASSWORD: process.env.READ_REPLICA1_PASSWORD || '',
    READ_REPLICA2_PASSWORD: process.env.READ_REPLICA2_PASSWORD || '',
    MASTER_USERNAME: process.env.MASTER_USERNAME || '',
    MASTER_PASSWORD: process.env.MASTER_PASSWORD || '',
    DATABASE_PORT: process.env.DATABASE_PORT || 5432,
    DATABASE_DIALECT: process.env.DATABASE_DIALECT || 'postgres',
    DATABASE_SCHEMA: "public",
    NODE_ENV: process.env.NODE_ENV || 'development',
    CRICKAPI_KEY: 'rRiMzf8NXBNdece5fmhQ3oEiViC3'
  };
  
  module.exports = env;
  