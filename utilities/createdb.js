var db = require("../models/db");

var force = false;

let syncFunc = async () => {
    try{
        await db.sequelize.sync({
            force: force
        });
        console.log("\n\n\n Created the tables.");
        return "Created the tables.";
    }catch(err){
        console.error("\n\n\n Error creating the database");
        console.error(err);
        throw err;
    }
}

let syncFuncForce = async () => {
    try{
        await db.sequelize.sync({
            force: true
        });
        console.log("\n\n\n Created the tables.");
        return "Created the tables.";
    }catch(err){
        console.error("\n\n\n Error creating the database");
        console.error(err);
        throw err;
    }
}

module.exports.syncFunc = syncFunc;
module.exports.syncFuncForce = syncFuncForce;

if(require.main == module){
    syncFunc();
}