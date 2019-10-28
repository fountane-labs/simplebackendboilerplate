var jwt = require("jsonwebtoken");
var config = require("../config/config");
var request = require("request");
var _ = require('lodash');
const keys = require("../config/keys");
const db = require('../models/db');
const nodeCacheMain = require("node-cache");
const dbConstants = require("../models/constants");
const nodeCache = new nodeCacheMain();
const admin = require("firebase-admin");
const serviceAccount = require("../config/firebase-service-account.json")
let app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://appdomain.com"
}, 'app3');

module.exports.decryptJWT = function(req){
    if(!req.get("X-AUTH-TOKEN")){
        return false;
    }

    var user_credentials = jwt.verify(req.get("X-AUTH-TOKEN"), config.jwtKey);
    return user_credentials;
}

module.exports.decryptJWTWithToken = function(token){
    if(!token){
        return false;
    }

    var user_credentials = jwt.verify(token, config.jwtKey);
    return user_credentials;
}


module.exports.sendEmail = function(to, subject, message, callback){
  console.log("Sending an email to ");
  console.log(to);
  var options = {
    method: 'POST',
    url: 'https://api.sendgrid.com/v3/mail/send',
    headers:
     {
       authorization: 'Bearer ' + config.apiKeys.sendGrid,
       'content-type': 'application/json' },
    body:
     { personalizatiotypens:
        [ { to: [ { email: to.email, name: to.name } ],
            subject: subject }
        ],
       from: { email: "appmail@appdomain.com", name: 'The App' },
       reply_to: { email: 'appmail@appdomain.com', name: 'The App' },
       subject: subject,
       content:
        [ { type: 'text/html',
            value: message } ]
    },
    json: true
  };

    request(options, function (error, response, body) {
      if (error) {
        console.log(error);
        if(callback){
          callback(err, null);
        }
        return;
      }
      console.log("Sending email is a success");
      console.log(body);

      if(callback){
        callback(null, body);
      }

    });
};

const requestPromise = (options)=>{
  return new Promise((resolve, reject)=>{
    request(options, (err, res, body)=>{
      if(err){
        reject(err);
      }else{
        resolve(body);
      }
    });
  });
}

const groupBy = (array, fn) => array.reduce((result, item)=>{
  const key = fn(item);
  if(!result[key]) result[key] = [];
  result[key].push(item);
  return result;
}, {});

const verifyPANCard = async (pan)=>{
  if(!pan){
    throw new Error("Invalid PAN Card Number");
  }
  const responseCodes = {
    1: 'Success',
    3: 'Authentication Failiure',
    7: 'Number of PANs Exceeds the limit(5)',
    11: 'Connection Open Error',
    12: 'Wrong Client ID',
    13: 'Wrong Username or Password'
  };
  const transactionStatuses = {
    0: 'All PAN Cards are Invalid',
    1: 'Success',
    2: 'Partial Success'
  }
  let response = await requestPromise({
    method: 'POST',
    body: {
      pan
    },
    headers:{
      'Content-Type': 'application/json',
      'qt_agency_id': keys.aadhaarapi.qt_agency_id,
      'qt_api_key': keys.aadhaarapi.qt_api_key
    },
    json: true,
    url: 'https://prod.aadhaarapi.com/pan'
  });
  console.log("response: ", JSON.stringify(response));
  if(response.response_code==1 && response.transaction_status==1){
    console.log("PAN Details: ", response.data[0]);
    return {
      status: true,
      response: response.data[0]
    }
  }else{
    return {
      status: false,
      response: responseCodes[response.response_code],
      transactionStatus: transactionStatuses[response.transaction_status]
    }
  }
}

const promisifiedNodeCacheGet = (key) => {
  return new Promise((resolve, reject)=>{
    nodeCache.get(key, (err, value)=>{
      if(err){
        reject(err);
      }else{
        resolve(value);
      }
    });
  });
}

const promisifiedNodeCachePut = (key, value, ttl) => {
  return new Promise((resolve, reject)=>{
    nodeCache.set(key, value, ttl, (err, success)=>{
      if(err){
        reject(err);
      }else{
        resolve(success);
      }
    });
  });
}

module.exports.groupBy = groupBy;
module.exports.requestPromise = requestPromise;
module.exports.verifyPANCard = verifyPANCard;
module.exports.promisifiedNodeCachePut = promisifiedNodeCachePut;
module.exports.promisifiedNodeCacheGet = promisifiedNodeCacheGet;

if(require.main == module){
  
}