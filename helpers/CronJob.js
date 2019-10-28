var request = require("request");

var db = require("../models/db");
const dbConstants = require("../models/constants");
var config = require("../config/config");
var utilities = require("../utilities/utilities");
const env = require('../models/env');
const admin = require("firebase-admin");
const keys = require("../config/keys");
const serviceAccount = require("../config/firebase-service-account.json")
let app2 = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://appdomain.com"
}, 'app2');

let realtimeDB = app2.database();
let liveScoresRef = realtimeDB.ref('/liveScores');
let livePlayerScoresRef = realtimeDB.ref('/livePlayerScores');

module.exports.cancelUnmetNormalLeagues = async () => {
    console.log();
    console.log("executing the cancelUnmetNormalLeagues");
    try{
        let results = await db.sequelize.query(`SELECT leagues.id AS league_id, leagues.participants AS participant_threshold, leagues.amount_to_join AS amount_to_join, leagues.spots AS spots_left, leagues.match_id AS match_id, MAX(matches.match_date) AS match_date FROM leagues LEFT JOIN users_leagues on users_leagues.league_id=leagues.id INNER JOIN matches on matches.id = leagues.match_id WHERE leagues.status=true AND leagues.type='normal' AND matches.match_date <= NOW() GROUP BY leagues.id`, {
            type: db.sequelize.QueryTypes.SELECT
        })
        try{
            if(results){
                // console.log("results: ", JSON.stringify(results));
                for(let i=0; i<results.length; i++){
                    let result = results[i];
                    console.log("result: ", JSON.stringify(result));
                    try{
                        if(Number(result.spots_left) > 0){
                            console.log("Rejecting the league");
                            await utilities.rejectLeague(result.league_id, result.amount_to_join);
                        }else{
                            console.log("not rejecting the league");
                        }
                    }catch(error){
                        console.error("error rejecting the league: ", error);
                    }
                }
            }
        }catch(err){
            console.error("error inside the then of cancelUnmetNormalLeagues: ", err);
        }
        return true;
    }catch(error){
        console.error("error in cancelUnmetNormalLeagues CronJob: ", error);
        throw error;
    };
}

module.exports.getLiveScores = async () => {
    let startTime = new Date();
    try{
      console.log("cronjob starting at: ", startTime);
      let leagues_query = `SELECT players.id AS player_id, 
      players.pid AS player_pid, 
      players.name AS player_name,
      players.id as player_id,
      users_leagues.team_id, 
      users_leagues.league_id,
      users_leagues.login_id as users_leagues_login_id,
      users_leagues.transaction_id,
      matches.cricapi_id,
      matches.type as match_type,
      matches.id as match_id,
      team_one.id as team_one_id,
      team_two.id as team_two_id,
      team_one.name as team_one_name,
      team_two.name as team_two_name,
      player_team.name as team_name,
      team_players.role as team_player_role
      FROM players INNER JOIN team_players ON players.id=team_players.player_id 
      INNER JOIN users_leagues ON team_players.team_id=users_leagues.team_id 
      INNER JOIN leagues ON users_leagues.league_id=leagues.id 
      INNER JOIN matches ON matches.id=leagues.match_id
      INNER JOIN teams as team_one on team_one.id = matches.team_one
      INNER JOIN teams as team_two on team_two.id = matches.team_two
      INNER JOIN teams as player_team on player_team.id=users_leagues.team_id
      WHERE matches.match_over=false AND matches.match_date < NOW()
      ORDER BY matches.match_date DESC;`;
      let leagues = await db.sequelize.query(leagues_query, {
        type: db.sequelize.QueryTypes.SELECT
      });
    //   console.log("leagues", JSON.stringify(leagues));
      let groupedByMathces = leagues.reduce((acc, obj)=>{
        acc[obj['cricapi_id']] = acc[obj['cricapi_id']]? acc[obj['cricapi_id']] : [];
        acc[obj['cricapi_id']].push(obj);
        return acc;
      }, {});
    //   console.log("groupedByMatches: ", JSON.stringify(groupedByMathces));
      let ranked = {};
      let playerScores = {};
      for(key in groupedByMathces){
        try{
            let results = await utilities.getScoresForGivenMatches(groupedByMathces[key]);
            let teamRanks = results['leagueRanks'];
            playerScores[key] = results['playerScores'];
            console.log("CronJob started at: ", startTime, "results for match: ", key, "is: ", JSON.stringify(results));
            // console.log("teamRanks: ", JSON.stringify(teamRanks));
            ranked[key] = teamRanks;
        }catch(error){
            console.error("CronJob started at: ", startTime, error);
            throw error;
        }
      }
      console.log("CronJob started at: ", startTime, "playerScores Before query for Left Over Players: ", JSON.stringify(playerScores));
      let queryForLeftOverPlayers = `
        select players.id as player_id, 
        players.pid as player_pid, 
        players.name as player_name, 
        matches.cricapi_id, 
        matches.type as match_type, 
        matches.id as match_id, 
        team_one.id as team_one_id, 
        team_two.id as team_two_id, 
        team_one.name as team_one_name, 
        team_two.name as team_two_name 
        from players inner join squads on squads.player_id=players.id 
        inner join matches on matches.id=squads.match_id and matches.match_date<NOW() and matches.match_over=false 
        INNER JOIN teams as team_one on team_one.id = matches.team_one 
        INNER JOIN teams as team_two on team_two.id = matches.team_two
        where players.id not in (select players.id from players 
                                INNER JOIN team_players ON players.id=team_players.player_id                                                                          
                                INNER JOIN users_leagues ON team_players.team_id=users_leagues.team_id 
                                INNER JOIN leagues ON users_leagues.league_id=leagues.id 
                                INNER JOIN matches ON matches.id=leagues.match_id 
                                WHERE matches.match_date<NOW() and matches.match_over=false)
        ORDER BY matches.match_date DESC;
      `;
      let playerLeftOut = await db.sequelize.query(queryForLeftOverPlayers, {
        type: db.sequelize.QueryTypes.SELECT
      });
      let groupedPlayersByMatches = playerLeftOut.reduce((acc, obj)=>{
        acc[obj['cricapi_id']] = acc[obj['cricapi_id']]? acc[obj['cricapi_id']] : [];
        acc[obj['cricapi_id']].push(obj);
        return acc;
      }, {});

      console.log("CronJob started at: ", startTime, "groupedPlayersByMatch: ", JSON.stringify(groupedPlayersByMatches));

      for(key in groupedPlayersByMatches){
          try{
            let results = await utilities.getScores(groupedPlayersByMatches[key][0].cricapi_id, groupedPlayersByMatches[key][0].match_id, groupedPlayersByMatches[key][0].match_type, groupedPlayersByMatches[key]);
            console.log("CronJob started at: ", startTime, "results for match: ", key, "is: ", JSON.stringify(results));
            playerScores[key] = {...playerScores[key], ...results};
          }catch(error){
              console.error("CronJob started at: ", startTime, "error occured: ", error);
              throw error;
          }
      }

      console.log("CronJob started at: ", startTime, "playerScores after query for left over players: ", JSON.stringify(playerScores));

      console.log("CronJob started at: ", startTime, "ranked: ", JSON.stringify(ranked));
      liveScoresRef.set(ranked);
    console.log("CronJob started at: ", startTime, "data sending to firebase: ", JSON.stringify({playerScores}));
      livePlayerScoresRef.set(playerScores);
      console.log("CronJob started at: ", startTime, "Success");
      console.log("cron job that started at: ", startTime, "is now ending at: ", new Date());
      return true;
    }catch(error){
      console.error(error);
      console.error("CronJob started at: ", startTime, "Failed");
      throw error;
    }
}

module.exports.markMatchesAsOver = async () => {
    try{
        let query = `SELECT matches.id, matches.cricapi_id, matches.match_date, (SELECT COUNT(users_leagues.*) FROM users_leagues where users_leagues.league_id=leagues.id) 
                    from matches 
                    LEFT JOIN leagues on leagues.match_id=matches.id
                    where matches.match_over=false AND matches.match_date<NOW()`;
        let results = await db.sequelize.query(query, {
            type: db.sequelize.QueryTypes.SELECT
        });
        console.log("results: ", JSON.stringify({results}));
        let matches = await utilities.requestPromise({
            method: 'GET',
            url: `https://cricapi.com/api/matches`,
            qs: {
              apikey: keys.cricapi.apikey||'FQSm5UoGdzbI4Hj78ipgCFTp4XD2'
            },
            json: true
        });
        matches = matches.matches;
        matches = matches.reduce((acc, obj)=>{
            acc[obj['unique_id']] = acc[obj['unique_id']] ? acc[obj['unique_id']] : obj;
            return acc;
        }, {});
        console.log("matches: ", JSON.stringify({matches}));
        for(let i=0; i < results.length; i++){
            if(matches[results[i].cricapi_id] && matches[results[i].cricapi_id]['winner_team']){
                let updated = await db.matches.update({
                    match_over: true
                }, {
                    where: {
                        cricapi_id: results[i].cricapi_id
                    }
                });
                console.log("updated: ", JSON.stringify({updated}));
                if(updated && updated[0]){
                    console.log("update successful");
                }else{
                    console.error("update failed");
                }
            }
        }
        return true;
    }catch(error){
        console.error("error occured in the cron job: ", error);
        throw error;
    }
}

module.exports.cancelUnmetNormalLeaguesHTTPWrapper = async (req, res) => {
    try{
        let result = await module.exports.cancelUnmetNormalLeagues();
        if(result){
            res.status(200).json({
                success:true
            });
            return;
        }else{
            throw new Error("result is not true");
        }
    }catch(error){
        res.status(500).json({
            success: false,
            error: error.message
        });
        return;
    }
}

module.exports.markMatchesAsOverHTTPWrapper = async (req, res)=>{
    try{
        let result = await module.exports.markMatchesAsOver();
        if(result){
            res.status(200).json({
                success:true
            });
            return;
        }else{
            throw new Error("result is not true");
        }
    }catch(error){
        res.status(500).json({
            success: false,
            error: error.message
        });
        return;
    }
}

module.exports.getLiveScoresHTTPWrapper = async (req, res)=>{
    try{
        let result = await module.exports.getLiveScores();
        if(result){
            res.status(200).json({
                success:true
            });
            return;
        }else{
            throw new Error("result is not true");
        }
    }catch(error){
        res.status(500).json({
            success: false,
            error: error.message
        });
        return;
    }
}

module.exports.testLiveScores = async (req, res) => {
    try{
        let leagues_query = `SELECT players.id AS player_id, 
        players.pid AS player_pid, 
        players.name AS player_name,
        players.id as player_id,
        users_leagues.team_id, 
        users_leagues.league_id,
        users_leagues.login_id as users_leagues_login_id,
        users_leagues.transaction_id,
        matches.cricapi_id,
        matches.type as match_type,
        matches.id as match_id,
        team_one.id as team_one_id,
        team_two.id as team_two_id,
        team_one.name as team_one_name,
        team_two.name as team_two_name,
        player_team.name as team_name,
        team_players.role as team_player_role
        FROM players INNER JOIN team_players ON players.id=team_players.player_id 
        INNER JOIN users_leagues ON team_players.team_id=users_leagues.team_id 
        INNER JOIN leagues ON users_leagues.league_id=leagues.id 
        INNER JOIN matches ON matches.id=leagues.match_id
        INNER JOIN teams as team_one on team_one.id = matches.team_one
        INNER JOIN teams as team_two on team_two.id = matches.team_two
        INNER JOIN teams as player_team on player_team.id=users_leagues.team_id
        WHERE matches.id=12`;
        let leagues = await db.sequelize.query(leagues_query, {
          type: db.sequelize.QueryTypes.SELECT
        });
      //   console.log("leagues", JSON.stringify(leagues));
        let groupedByMathces = leagues.reduce((acc, obj)=>{
          acc[obj['cricapi_id']] = acc[obj['cricapi_id']]? acc[obj['cricapi_id']] : [];
          acc[obj['cricapi_id']].push(obj);
          return acc;
        }, {});
      //   console.log("groupedByMatches: ", JSON.stringify(groupedByMathces));
        let ranked = {};
        let playerScores = {};
        for(key in groupedByMathces){
          try{
              let results = await utilities.getScoresForGivenMatches(groupedByMathces[key]);
              let teamRanks = results['leagueRanks'];
              playerScores[key] = results['playerScores'];
              // console.log("teamRanks: ", JSON.stringify(teamRanks));
              ranked[key] = teamRanks;
          }catch(error){
              console.error(error);
          }
        }
        let queryForLeftOverPlayers = `
          select players.id as player_id, 
          players.pid as player_pid, 
          players.name as player_name, 
          matches.cricapi_id, 
          matches.type as match_type, 
          matches.id as match_id, 
          team_one.id as team_one_id, 
          team_two.id as team_two_id, 
          team_one.name as team_one_name, 
          team_two.name as team_two_name 
          from players inner join squads on squads.player_id=players.id 
          inner join matches on matches.id=squads.match_id and matches.match_date<NOW() and matches.match_over=false 
          INNER JOIN teams as team_one on team_one.id = matches.team_one 
          INNER JOIN teams as team_two on team_two.id = matches.team_two
          where players.id not in (select players.id from players 
                                  INNER JOIN team_players ON players.id=team_players.player_id                                                                          
                                  INNER JOIN users_leagues ON team_players.team_id=users_leagues.team_id 
                                  INNER JOIN leagues ON users_leagues.league_id=leagues.id 
                                  INNER JOIN matches ON matches.id=leagues.match_id 
                                  WHERE matches.match_date<NOW() and matches.match_over=false)
          ORDER BY matches.match_date DESC;
        `;
        let playerLeftOut = await db.sequelize.query(queryForLeftOverPlayers, {
          type: db.sequelize.QueryTypes.SELECT
        });
        let groupedPlayersByMatches = playerLeftOut.reduce((acc, obj)=>{
          acc[obj['cricapi_id']] = acc[obj['cricapi_id']]? acc[obj['cricapi_id']] : [];
          acc[obj['cricapi_id']].push(obj);
          return acc;
        }, {});
  
        for(key in groupedPlayersByMatches){
            try{
              let results = await utilities.getScores(groupedPlayersByMatches[key][0].cricapi_id, groupedPlayersByMatches[key][0].match_id, groupedPlayersByMatches[key][0].match_type, groupedPlayersByMatches[key]);
              playerScores[key] = {...playerScores[key], ...results};
            }catch(error){
                console.error("error occured: ", error);
            }
        }
        res.status(200);
        return true;
      }catch(error){
        console.error(error);
        console.error("failed");
        res.status(500);
      }
}

if(require.main == module){
    module.exports.getLiveScores();
}