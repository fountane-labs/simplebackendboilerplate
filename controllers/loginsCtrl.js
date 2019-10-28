var jwt = require("jsonwebtoken");
var crypto = require("crypto");
const speakeasy = require("speakeasy");

const env = require('../models/env');
var db = require("../models/db");
const DBCONSTANTS = require("../models/constants");
var config = require("../config/config");
var utilities = require("../utilities/utilities");
const sql = require('../helpers/sqlHelpers');
const keys = require("../config/keys");
const request = require("request");
const shortid = require("shortid");

shortid.characters('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890@$');


module.exports.getProfileDataFromToken = async function (req, res) {
  // This is getting the profile data from the jwt tokens

  try {
    var user_credentials = utilities.decryptJWTWithToken(req.get("X-AUTH-TOKEN"));
    var user_data = await db.profiles.findOne({
      include: [{
        model: db.logins,
        where: {
          id: user_credentials.id
        },
        plain:true,
        attributes: [
          "id",
          "role",
          "firebase_login",
          "email",
          "withdrawable_wallet_balance",
          "un_withdrawable_wallet_balance",
          "pan",
          "uid",
          "firebase_uid",
          "email_verified",
          "pan_verified",
          "bank_rejection_reason",
          "pan_rejection_reason",
          "bank_verified",
          'referrer_id',
          'spin_count',
          ['bonus_wallet_balance', 'bonus_money']
        ]
      }]
    });

    user_data = JSON.parse(JSON.stringify(user_data));
    console.log("user_data: ", user_data);
    user_data['bonus_money'] = user_data['login']['bonus_money'];
    console.log("user_data['bonus_money']: ", user_data['bonus_money'])
    console.log("user_data: ", JSON.stringify({user_data}));
    res.status(200).json({
      success: true,
      user: user_data
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: {
        message: "Internal Server Error"
      }
    });
    return;
  }
}

module.exports.create = function (req, res) {
  if (!req.body.email || !req.body.password) {
    res.status(500).json({
      success: false,
      error: {
        message: "All fields are required"
      }
    });
    return;
  }

  var salt = crypto.randomBytes(16).toString('hex');
  var password = crypto.pbkdf2Sync(req.body.password, salt, 1000, 512, "sha512").toString('hex');

  db.logins.findOne({ where: { email: req.body.email } })
    .then(result => {

      if (result) {
        res.status(500).json({
          success: false,
          error: {
            message: "User already exists"
          }
        });
        return;
      }

      var create_obj = {
        email: req.body.email,
        password: password,
        salt: salt,
        role: req.body.role || "user",
        hotp_secret: speakeasy.generateSecret({length:20}).base32
      };

      db.logins.create(create_obj)
        .then(user => {
          console.log(user.id);
          var resp = {
            id: user.id,
            email: user.email,
            role: user.role
          };

          var create_profiles_obj = {
            login_id: user.id,
          };

          db.profiles.create(create_profiles_obj)
            .then(profile => {
              var profile_resp = {
                login_id: profile.login_id,
              };
              res.status(200).json({ success: true, auth: resp, profile: profile_resp });

              var token = jwt.sign(resp, config.jwtKey);
              var link = config.api.host + "/api/v1/verify/email/?token=" + token;
              var message = "Welcome to the app.<br> Follow the link to verify your email<br>" + link;

              utilities.sendEmail({ email: user.email, name: "" }, "Welcome to the app.", message);
            })
            .catch(function (err) {
              console.log(err);
              res.status(500).json({
                success: false,
                error: {
                  message: "Internal Server Error"
                }
              });
            });
        })
        .catch(function (err) {
          console.log(err);
          res.status(500).json({
            success: false,
            error: {
              message: "Internal Server Error"
            }
          });
        });
    })
    .catch(function (err) {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    });
};

module.exports.verifyEmail = function (req, res) {
  // The route is going to be something like this. /api/v1/verify/?token=<the token of the user comes here>
  var token = req.query.token;
  var user_data = utilities.decryptJWTWithToken(token);
  if (!user_data) {
    res.status(500).json({
      success: false,
      error: {
        message: "Invalid Verification Token"
      }
    });
    return;
  }

  db.logins.findOne({ where: { id: user_data.id } })
    .then(user => {
      var update_data = {
        email_verified: 1,
      };

      db.logins.update(
        update_data,
        {
          where: { id: user.id },
          returning: true,
          plain: true
        })
        .then(() => {
          res.status(200).json({ success: true });
        })
        .catch(err => {
          console.log(err);
          res.status(500).json({
            success: false,
            error: {
              message: "Internal Server Error"
            }
          });
        })
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
}

module.exports.login = function (req, res) {
  if (!req.body.email || !req.body.password) {
    console.log(req.body);
    res.status(500).json({
      success: false,
      error: {
        message: "All fields are required"
      }
    });
    return;
  }

  db.logins.findOne({
    where: { email: req.body.email },
  })
    .then(user => {
      if (user) {
        console.log(user.id);
        var password = crypto.pbkdf2Sync(req.body.password, user.salt, 1000, 512, "sha512").toString('hex');

        if (user.password === password) {
          db.profiles.findOne({ where: { login_id: user.id } })
            .then(profile => {
              var resp_data = {
                id: user.id,
                email: user.email,
                full_name: profile.full_name,
                phone: profile.phone,
                dob: profile.dob,
                state: profile.state,
                pincode: profile.pincode,
                score: profile.score,
                role: user.role,
                hotp_secret: user.hotp_secret,
                counter: user.counter,
                paytm_auth_token: user.paytm_auth_token,
                withdrawable_wallet_balance: user.withdrawable_wallet_balance,
                un_withdrawable_wallet_balance: user.un_withdrawable_wallet_balance,
                team_name: profile.team_name
              };

              var token = jwt.sign(resp_data, config.jwtKey);
              resp_data.token = token;

              res.status(200).json({ success: true, auth: resp_data });
            })
            .catch(err => {
              console.log(err);
              res.status(500).json({
                success: false,
                error: {
                  message: "Internal Server Error"
                }
              });
            })
        } else {
          res.status(500).json({
            success: false,
            error: {
              message: "Incorrect Password. Please try again."
            }
          });
        }
      }
      else {
        res.status(500).json({
          success: false,
          error: {
            message: "We could not find your account."
          }
        });
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
};

module.exports.delete = function (req, res) {
  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return;
  }

  var delete_obj = {
    id: user_credentials.id,
  };

  db.logins.destroy({
    where: delete_obj
  })
    .then(resp => {
      console.log(resp);
      res.status(200).json({ success: true });
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
};

module.exports.changePassword = function (req, res) {
  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return;
  }
  var user_id = user_credentials.id;

  db.logins.findOne({ where: { id: user_id } })
    .then(user => {
      if (user_credentials.role == "admin") {
        var salt = crypto.randomBytes(16).toString('hex');
        var new_password = crypto.pbkdf2Sync(req.body.new_password, salt, 1000, 512, "sha512").toString('hex');
        var update_data = {
          password: new_password,
          salt: salt
        };

        db.logins.update(
          update_data,
          {
            where: { id: user_id },
            returning: true,
            plain: true
          })
          .then(() => {
            res.status(200).json({ success: true });
          })
          .catch(err => {
            console.log(err);
            res.status(500).json({
              success: false,
              error: {
                message: "Internal Server Error"
              }
            });
          })
      } else {
        var password = crypto.pbkdf2Sync(req.body.old_password, user.salt, 1000, 512, "sha512").toString('hex');
        if (user.password == password) {
          var salt = crypto.randomBytes(16).toString('hex');
          var new_password = crypto.pbkdf2Sync(req.body.new_password, salt, 1000, 512, "sha512").toString('hex');
          var update_data = {
            password: new_password,
            salt: salt
          };

          db.logins.update(
            update_data,
            {
              where: { id: user_id },
              returning: true,
              plain: true
            })
            .then(() => {
              res.status(200).json({ success: true });
            })
            .catch(err => {
              console.log(err);
              res.status(500).json({
                success: false,
                error: {
                  message: "Internal Server Error"
                }
              });
            })
        } else {
          res.status(500).json({
            success: false,
            error: {
              message: "old password didnt match our records"
            }
          });
        }
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
};

module.exports.resetPassword = function (req, res) {
  var email = req.body.email;
  db.logins.findOne({ where: { email: email } })
    .then(user => {
      if (!user) {
        res.status(500).json({
          success: false,
          error: {
            message: "The user does not exist"
          }
        });
        return;
      }
      var rand = Math.random().toString(36).substring(7);
      var update_data = {
        password_reset: rand,
      };

      db.logins.update(
        update_data,
        {
          where: { id: user.id },
          returning: true,
          plain: true
        })
        .then(updated_user => {
          updated_user = updated_user[1];
          var gen_token = {
            id: updated_user.id,
            email: updated_user.email,
            password_reset: updated_user.password_reset
          }
          var token = jwt.sign(gen_token, config.jwtKey);
          var link = config.client.host + "/reset/" + token;
          var message = "Welcome to the app. To reset your password, please <a href=" + link + ">click</a> on the link";

          utilities.sendEmail({ email: updated_user.email, name: updated_user.name }, "Welcome to the app.", message);
          res.status(200).json({ success: true });
        })
        .catch(err => {
          console.log(err);
          res.status(500).json({
            success: false,
            error: {
              message: "Internal Server Error"
            }
          });
        })
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
};

module.exports.confirmResetPassword = function (req, res) {
  var token = req.body.token;
  var user_data = utilities.decryptJWTWithToken(token);

  db.logins.findOne({ where: { id: user_data.id } })
    .then(user => {
      if (!user) {
        res.status(500).json({
          success: false,
          error: {
            message: "The user does not exist"
          }
        });
        return;
      }

      var salt = crypto.randomBytes(16).toString('hex');
      var new_password = crypto.pbkdf2Sync(req.body.new_password, salt, 1000, 512, "sha512").toString('hex');

      var update_data = {
        password: new_password,
        salt: salt
      };

      db.logins.update(
        update_data,
        {
          where: { id: user.id },
          returning: true,
          plain: true
        })
        .then(() => {
          res.status(200).json({ success: true });
        })
        .catch(err => {
          console.log(err);
          res.status(500).json({
            success: false,
            error: {
              message: "Internal Server Error"
            }
          });
        })
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
};


module.exports.updateProfile = function (req, res) {
  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }
  var user_id = user_credentials.id;

  db.profiles.findOne({ where: { login_id: user_id } })
    .then(user => {
      var update_data = req.body;
      console.log("user: ", JSON.stringify({user}));
      if(user){
        db.profiles.update(
          update_data,
          {
            where: { id: user.id },
            returning: true,
            plain: true
          })
          .then(() => {
            res.status(200).json({ success: true, profile: update_data });
          })
          .catch(err => {
            console.log(err);
            res.status(500).json({
              success: false,
              error: {
                message: err.message
              }
            });
          })
      }else{
        res.status(500).json({
          success: false,
          error: "User Not found"
        });
        return;
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: err.message
        }
      });
    })
};

module.exports.getAllProfiles = function (req, res) {
  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }

  var page = req.query.page, per_page = req.query.per_page;
  page = parseInt(page);
  per_page = parseInt(per_page);
  if (!page) {
    page = 0;
  }
  if (!per_page) {
    per_page = 10;
  }

  // db.profiles.findAll({
  //   attributes: ['id', 'full_name', 'phone'],
  //   include: [
  //     { model: db.logins, attributes: ['id', 'email', 'pan']},
  //     { model: db.banks, attributes: ['id', 'account_number', 'ifsc', 'bank_name', 'bank_branch']},
  //   ],
  //   limit: per_page,
  //   offset: page*per_page
  // })
  var offset = page * per_page

  var replacements = {
    per_page: per_page,
    offset: offset
  };

  var query = `
    SELECT
      logins.*,
      profiles.full_name, profiles.phone
    from ${env.DATABASE_SCHEMA}.logins as logins
    INNER JOIN ${env.DATABASE_SCHEMA}.profiles as profiles on profiles.login_id = logins.id
    ORDER BY logins.id DESC
    LIMIT :per_page OFFSET :offset
  `;

  db.sequelize.query(query, {
    replacements: replacements,
    type: db.sequelize.QueryTypes.SELECT
  })
    .then(users => {
      var query = `
      SELECT
        logins.id, logins.email, logins.pan,
        profiles.full_name, profiles.phone
      from ${env.DATABASE_SCHEMA}.logins as logins
      INNER JOIN ${env.DATABASE_SCHEMA}.profiles as profiles on profiles.login_id = logins.id
    `;
      db.sequelize.query(query, {
        type: db.sequelize.QueryTypes.SELECT
      })
        .then(count_length => {
          var count = count_length.length;
          res.status(200).json({ success: true, users: users, total_count: count, page: page, per_page: per_page });
        })
        .catch(err => {
          console.log(err);
          res.status(500).json({
            success: false,
            error: {
              message: "Internal Server Error"
            }
          });
        })
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
};

const createRespData = (user, profile) => {
  var resp_data = {
    id: user.id,
    email: user.email,
    full_name: profile.full_name,
    phone: profile.phone,
    dob: profile.dob,
    state: profile.state,
    pincode: profile.pincode,
    score: profile.score,
    role: user.role,
    hotp_secret: user.hotp_secret,
    counter: user.counter,
    paytm_auth_token: user.paytm_auth_token,
    withdrawable_wallet_balance: user.withdrawable_wallet_balance,
    un_withdrawable_wallet_balance: user.un_withdrawable_wallet_balance,
    firebase_uid: user.firebase_uid,
    team_name: profile.team_name
  };

  var token = jwt.sign(resp_data, config.jwtKey);
  resp_data.token = token;
  return resp_data;
}
// PAN Card Verification 
module.exports.verifyPANCard = async (req, res) => {


  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }


  if (!req.body.pan) {
    res.status(422).json({
      status: false,
      error: {
        message: "PAN Card Number Missing"
      }
    });
    return;
  }
  try {
    var pan_obj = {
      number: req.body.pan,
      response: null,
      pan_verified: 4
    };

    let is_pan_exists = await db.logins.findOne({
      where: {
        'pan.number': pan_obj.number,
        id: {
          [db.Sequelize.Op.ne]: user_credentials.id,
        }
      }
    });

    if(is_pan_exists){
      res.status(200).json({
        success: false,
        error: {
          message: "The pan number already exists in the db"
        }
      });
      return;
    }

    // let response = await utilities.verifyPANCard(req.body.pan);
    // pan_obj.response = response.response;
    // if (response.status == true) {
    //   // Write to db here
    //   pan_obj.pan_verified = 1;
    //   // return;
    // } else {
    //   // Still write to db here
    //   res.status(400).json({
    //     status: false,
    //     message: "PAN Verification Failed",
    //     response: {
    //       responseStatus: response.response,
    //       transactionStatus: response.transactionStatus
    //     }
    //   });
    //   return;
    //   // return;
    // }
    // Time to update the db
    var db_updated = await db.logins.update({
      pan: pan_obj,
      pan_verified: pan_obj.pan_verified
    }, {
      where: {
        id: user_credentials.id
      }
    });

    res.status(200).json({
      status: true,
      message: "PAN sent to admin panel for verification"
    });


  } catch (err) {
    console.error("error caught: ", err);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: err.message
    });
    return;
  }
}

// Bank Account Verifications

module.exports.bankVerification = async (req, res) => {

  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }

  var bank_update_obj = {
    account: req.body.account,
    ifsc: req.body.ifsc,
    name: req.body.name,
    branch: req.body.branch,
    bank_verified: 4
  };

  if (!req.body.account || !req.body.ifsc) {
      res.status(422).json({ status: false, message: "Missing Parameters" }); 
      return;
  }
  // let response = undefined;
  // try {
  //     response = await utilities.requestPromise({
  //       method: 'POST',
  //       body: {
  //           'Account': req.body.account,
  //           'IFSC': req.body.ifsc
  //       },
  //       headers: {
  //           'Content-Type': 'application/json',
  //           'qt_agency_id': keys.aadhaarapi.qt_agency_id,
  //           'qt_api_key': keys.aadhaarapi.qt_api_key
  //       },
  //       json: true,
  //       url: 'https://preprod.aadhaarapi.com/verify-bank'
  //   });
  //     console.log("response: ", JSON.stringify(response));
  // } catch (error) {
  //     console.error("error sending request: ", error);
  //     res.status(500).json({ status: false, message: "Error Sending Request", error: error.message });
  //     return;
  // }
  // bank_update_obj.response = response.data;
  try {
      // if (response.transaction_status == 1) {
      //   bank_update_obj.bank_verified = 1;
      //     // return;
      // } else {
      //     res.status(400).json({
      //         status: false,
      //         message: 'Verification Failed',
      //         response: response
      //     });
      //     // return;
      // }

      // Time to update the db with this data
      var is_db_updated = await db.logins.update({
        bank: bank_update_obj,
        bank_verified: bank_update_obj.bank_verified
      }, {
        where: {
          id: user_credentials.id
        }
      });
      res.status(200).json({
        status: true
      });
      return;
  } catch (error) {
      console.error("Error in taking data from response: ", error);
      res.status(500).json({ status: false, message: "Error taking data from response", error: error.message });
      return;
  }
}

module.exports.generateOTP = async (req, res) => {
  var user_credentials = utilities.decryptJWTWithToken(req.get("X-AUTH-TOKEN"));
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }
  let phoneNumber = req.query.phoneNumber;

  let is_phone_number_exists = await db.profiles.findOne({
    where: {
      phone: phoneNumber,
      phone_verified: true
    }
  });

  if(is_phone_number_exists){
    res.status(200).json({
      success: false,
      error: {
        message: "The phone number already exists"
      }
    });
    return;
  }
  let options = { 
    method: 'GET',
    url: `http://2factor.in/API/V1/${keys['2factor'].api_key}/SMS/${phoneNumber}/AUTOGEN`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    form: {} 
  };
  request(options, function (error, response, body) {
    if (error) {
      console.error("error occured in sending request to 2factor for otp: ", error);
      res.status(500).json({
        status: false,
        error: error.message
      });
      return;
    }else{
      try{
        body = JSON.parse(body);
        let promises = [];
        promises.push(db.logins.update({
          otp_2factor_session_id: body.Details
        }, {
          where: {
            id: user_credentials.id
          }
        }));
        promises.push(db.profiles.update({
          phone: phoneNumber,
          phone_verified: false
        }, {
          where: {
            login_id: user_credentials.id
          }
        }));
        Promise.all(promises)
        .then(result=>{
          if(result[0]){
            res.status(200).json({
              status: true
            });
            return;
          }else{
            res.status(500).json({
              status: false,
              error: "Failed to update the database"
            });
            return;
          }
        }).catch(error=>{
          console.error("Error occured in updting the otp session ID in db: ", error);
          res.status(500).json({
            status: false,
            error: error.message
          });
          return;
        })
      }catch(error){
        console.error("error when parsing body as JSON: ", error);
        res.status(500).json({
          status: false,
          error: error.message
        });
        return;
      }
    }
  });
}

module.exports.verifyOTP = async (req, res) => {
  var user_credentials = utilities.decryptJWTWithToken(req.get("X-AUTH-TOKEN"));
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }
  let otp = req.query.otp;
  let user = await db.logins.findOne({
    where: {
      id: user_credentials.id
    }
  });
  var options = { 
    method: 'GET',
    url: `http://2factor.in/API/V1/${keys['2factor'].api_key}/SMS/VERIFY/${user.otp_2factor_session_id}/${otp}`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    form: {} 
  };

  request(options, async (error, response, body) => {
    if (error) {
      console.error("Error occured in sending request to 2 factor for otp verification: ", error);
      res.status(500).json({
        status: false,
        error: error.message
      });
      return;
    }else{
      try{
        console.log("body: ", body);
        console.log("typeof body: ", typeof body);
        body = JSON.parse(body);
        if(body.Status == "Success" && body.Details == "OTP Matched"){
          let transaction;
          try{
            transaction = await db.sequelize.transaction();
            let result = await db.profiles.update({
              phone_verified: true
            }, {
              where: {
                login_id: user_credentials.id
              },
              transaction
            });
            if(!(result && result[0])){
              console.error("Phone verified couldnt be updated: ", JSON.stringify({result}));
              throw new Error("Phone verified couldnt be updated")
            }
            console.log("Phone verified successfully updated to true");
            let spinIncResult = await db.logins.update({
              spin_count: db.sequelize.literal('spin_count + 1')
            }, {
              where: {
                id: user_credentials.id
              },
              transaction
            });
            if(!(spinIncResult && spinIncResult[0])){
              console.error("Spin couldnt be increased for the user who has verified: ", JSON.stringify({spinIncResult}));
              throw new Error("Spin couldnt be increased for the user who has verified");
            }
            console.log("Spin count increased for the user who verified his account");
            // Now its time to increment the spin count. 
            var user_profile = await db.logins.findOne({
              where: {
                id: user_credentials.id
              },
              transaction
            });

            if(user_profile.referrer_id){
              // Then time to increment the count of the referrer
              var referrer_incremented = await db.logins.update({
                spin_count: db.sequelize.literal('spin_count + 1')
              }, {
                where: {
                  uid: user_profile.referrer_id
                },
                transaction
              });
              if(!(referrer_incremented && referrer_incremented[0])){
                console.error("couldn't increment the spin count of the referrer: ", JSON.stringify({referrer_incremented}));
                throw new Error("couldn't increment the spin count of the referrer");
              }
              // The count has been incremented.
            }
            await transaction.commit();
            res.status(200).json({
              status: true,
              message: "OTP Matched"
            });
            return;
          }catch(error){
            await transaction.rollback();
            console.error("error occured: ", error);
            res.status(500).json({
              success:false,
              error: error.message
            });
            return;
          }
        }else{
          res.status(401).json({
            status: false,
            message: "OTP Mismatched"
          });
          return;
        }
      }catch(error){
        console.error("error occured in parsing the body from the response: ", error);
        res.status(500).json({
          status: false,
          error: error.message
        });
        return;
      }
    }
  });
}

module.exports.verificationRequests = (req, res)=>{
  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials && user_credentials.role != 'admin') {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }

  var page = req.query.page, per_page = req.query.per_page;
  page = parseInt(page);
  per_page = parseInt(per_page);
  if (!page) {
    page = 0;
  }
  if (!per_page) {
    per_page = 10;
  }

  // db.profiles.findAll({
  //   attributes: ['id', 'full_name', 'phone'],
  //   include: [
  //     { model: db.logins, attributes: ['id', 'email', 'pan']},
  //     { model: db.banks, attributes: ['id', 'account_number', 'ifsc', 'bank_name', 'bank_branch']},
  //   ],
  //   limit: per_page,
  //   offset: page*per_page
  // })
  var offset = page * per_page

  var replacements = {
    per_page: per_page,
    offset: offset
  };

  var query = `
    SELECT
      logins.*,
      profiles.full_name, profiles.phone
    from ${env.DATABASE_SCHEMA}.logins as logins
    INNER JOIN ${env.DATABASE_SCHEMA}.profiles as profiles on profiles.login_id = logins.id
    WHERE pan_verified=1 OR bank_verified=1 OR pan_verified=4 OR bank_verified=4
    ORDER BY logins.id DESC
    LIMIT :per_page OFFSET :offset
  `;

  db.sequelize.query(query, {
    replacements: replacements,
    type: db.sequelize.QueryTypes.SELECT
  })
    .then(users => {
      var query = `
      SELECT
        logins.id, logins.email, logins.pan, logins.bank_verified,
        profiles.full_name, profiles.phone
      from ${env.DATABASE_SCHEMA}.logins as logins
      INNER JOIN ${env.DATABASE_SCHEMA}.profiles as profiles on profiles.login_id = logins.id
      WHERE pan_verified=1 OR bank_verified=1 OR pan_verified=4 OR bank_verified=4
    `;
      db.sequelize.query(query, {
        type: db.sequelize.QueryTypes.SELECT
      })
        .then(count_length => {
          var count = count_length.length;
          res.status(200).json({ success: true, users: users, total_count: count, page: page, per_page: per_page });
        })
        .catch(err => {
          console.log(err);
          res.status(500).json({
            success: false,
            error: {
              message: "Internal Server Error"
            }
          });
        })
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal Server Error"
        }
      });
    })
}

module.exports.rewardReferrer = async (req, res)=>{
  try{
    var user_credentials = utilities.decryptJWT(req);
    if (!user_credentials) {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not logged in"
        }
      });
      return
    }

    let uid  = req.body.uid;
    if(!uid){
      throw new Error("uid not found in the body");
    }
    db.logins.update({
      spin_count: db.sequelize.literal("spin_count + 1")
    },{
      where:{
        uid
      }
    }).then(result =>{
      console.log("result obtained: ", JSON.stringify({result}));
      if(result[0] == 1){
        res.status(200).json({
          success: true,
          message: "user credited successfully"
        });
        return;
      }else{
        res.status(500).json({
          success: false,
          error: "user couldnt be credited successfully, check if user exists"
        });
        return;
      }
    }).catch(err=>{
      console.error("error occured fetching user with firebase uid", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
      return;
    });
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success:false,
      error: error.message
    });
    return;
  }
}

module.exports.matchHistory = (req, res) => {
  var user_credentials = utilities.decryptJWT(req);
  if (!user_credentials) {
    res.status(401).json({
      success: false,
      error: {
        message: "User Not logged in"
      }
    });
    return
  }
  let query = `SELECT matches.name AS match_name, matches.series_name as series_name, matches.match_date as match_date,
              team_one.name as team_one_name, team_two.name as team_two_name,
              users_leagues.rank as rank
              from users_leagues
              inner join leagues on leagues.id=users_leagues.league_id AND leagues.status=true
              inner join matches on matches.id=leagues.match_id
              inner join teams as team_one on team_one.id=matches.team_one
              inner join teams as team_two on team_two.id=matches.team_two
              where users_leagues.login_id=:login_id`;
  db.sequelize.query(query, {
    replacements:{
      login_id: user_credentials.id
    },
    type: db.sequelize.QueryTypes.SELECT
  }).then(results=>{
    if(results && results.length){
      res.status(200).json({
        success: true,
        results
      });
      return;
    }else{
      res.status(204).json({
        success:true, 
        results
      });
      return;
    }
  }).catch(err=>{
    console.error("error has occured while retrieving the data: ", err);
    res.status(500).json({
      success:false,
      error: err.message
    });
    return;
  });
}

module.exports.markPanAsVerified = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    console.log("user creds: ", JSON.stringify({user_credentials}));
    if (!user_credentials || user_credentials.role != 'admin') {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return;
    }
    let login_id = req.body.login_id;
    let updated = await db.logins.update({
      pan_verified: 2
    }, {
      where: {
        id: login_id,
        pan_verified: {
          [db.Sequelize.Op.ne]: 3
        }
      }
    });
    if(!(updated && updated[0])){
      console.error("updation failed, hered the result of updation: ", JSON.stringify({updated}));
      throw new Error("Couldnt update the profile");
    }
    res.status(200).json({
      success: true,
      message: "Successfully verified the pan details"
    });
    return;
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
    return;
  }
}

module.exports.rejectPanVerification = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    console.log("user creds: ", JSON.stringify({user_credentials}));
    if (!user_credentials || user_credentials.role != 'admin') {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return;
    }
    let login_id = req.body.login_id;
    if(!req.body.login_id || !req.body.reason){
      console.error("missing paramters; req.body: ", JSON.stringify(req.body));
      throw new Error("Missing parameters in request body");
    }
    let updated = await db.logins.update({
      pan_verified: 3,
      pan_rejection_reason: req.body.reason
    }, {
      where: {
        id: login_id
      }
    });
    if(!(updated && updated[0])){
      console.error("updation failed, here's the result of updation: ", JSON.stringify({updated}));
      throw new Error("Couldnt update the profile");
    }
    res.status(200).json({
      success: true,
      message: "Successfully rejected the pan details"
    });
    return;
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
    return;
  }
}

module.exports.markBankAsVerified = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    console.log("user creds: ", JSON.stringify({user_credentials}));
    if (!user_credentials || user_credentials.role != 'admin') {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return;
    }
    let login_id = req.body.login_id;
    let updated = await db.logins.update({
      bank_verified: 2
    }, {
      where: {
        id: login_id,
        bank_verified: {
          [db.Sequelize.Op.ne]: 3
        }
      }
    });
    if(!(updated && updated[0])){
      console.error("updation failed, hered the result of updation: ", JSON.stringify({updated}));
      throw new Error("Couldnt update the profile");
    }
    res.status(200).json({
      success: true,
      message: "Successfully verified the bank details"
    });
    return;
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
    return;
  }
}

module.exports.rejectBankVerification = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    console.log("user creds: ", JSON.stringify({user_credentials}));
    if (!user_credentials || user_credentials.role != 'admin') {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return;
    }
    let login_id = req.body.login_id;
    if(!req.body.login_id || !req.body.reason){
      console.error("missing paramters; req.body: ", JSON.stringify(req.body));
      throw new Error("Missing parameters in request body");
    }
    let updated = await db.logins.update({
      bank_verified: 3,
      bank_rejection_reason: req.body.reason
    }, {
      where: {
        id: login_id
      }
    });
    if(!(updated && updated[0])){
      console.error("updation failed, hered the result of updation: ", JSON.stringify({updated}));
      throw new Error("Couldnt update the profile");
    }
    res.status(200).json({
      success: true,
      message: "Successfully rejected the bank details"
    });
    return;
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
    return;
  }
}

module.exports.getEligibleCampaigns = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    console.log("user creds: ", JSON.stringify({user_credentials}));
    if (!user_credentials) {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return;
    }

    let query = `select campaigns.* from campaigns 
                left join transactions on coalesce(transactions.campaign_id,0)=campaigns.id and transactions.login_id=:login_id and transactions.status='PAID' and transactions.type='credit_to_wallet'
                where coalesce(transactions.campaign_id,0)!=campaigns.id 
                order by campaigns.deposit limit 2`;
    let result = await db.sequelize.query(query, {
      replacements:{
        login_id: user_credentials.id
      },
      type: db.sequelize.QueryTypes.SELECT
    });
    res.status(200).json({
      success: true,
      results:result
    });
    return;
  }catch(error){
    console.log("error occured: ", error);
    res.status(500).json({
      success:false,
      error: error.message
    });
    return;
  }
}

module.exports.getStatisticsOfUsersJoining = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    if (!user_credentials || user_credentials.role != 'admin') {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return
    }
    if(!req.query.type){
      console.error("query type is missing");
      throw new Error("query type is missing");
    }
    let query;
    if(req.query.type==1){
      query = `select sub.key, sum(sum(sub.count)) over (order by sub.key asc) as count from (select count(logins.id), TO_DATE(TO_CHAR(logins.created_at, 'YYYY_MM_DD'), 'YYYY_MM_DD') as key
      from logins 
      group by TO_CHAR(logins.created_at, 'YYYY_MM_DD') order by TO_CHAR(logins.created_at, 'YYYY_MM_DD') DESC LIMIT 6) as sub group by sub.key order by sub.key asc;`;
    }else if(req.query.type==2){
      query = `select sub.key, sum(sum(sub.count)) over (order by sub.key asc) as count from (select count(logins.id), TO_DATE(TO_CHAR(logins.created_at, 'YYYY_WW'), 'YYYY_WW') as key 
      from logins 
      group by TO_CHAR(logins.created_at, 'YYYY_WW')
      order by TO_CHAR(logins.created_at, 'YYYY_WW') DESC LIMIT 6) as sub group by sub.key order by sub.key asc;`;
    }else if(req.query.type==3){
      query = `select sub.key, sum(sum(sub.count)) over (order by sub.key asc) as count from (select count(logins.id), TO_DATE(TO_CHAR(logins.created_at, 'YYYY_MM'), 'YYYY_MM') as key                
      from logins                                   
      group by TO_CHAR(logins.created_at, 'YYYY_MM')
      order by TO_CHAR(logins.created_at, 'YYYY_MM') DESC LIMIT 6) as sub group by sub.key order by sub.key asc;`;
    }
    let results = await db.sequelize.query(query, {
      type: db.sequelize.QueryTypes.SELECT
    });
    if(!(results && results.length)){
      console.error("results obtained is null or empty");
      console.error("results obtained are: ", JSON.stringify({results}));
      throw new Error("resuls obtained is null or empty");
    }
    let dateFrom = results[0]['key'];
    let countBefore = await db.logins.count({
                              where:{
                                created_at:{
                                  [db.Sequelize.Op.lt]: dateFrom
                                }
                              }
                            });
    for(result of results){
      result.count = Number(result.count) + countBefore
    }
    res.status(200).json({ 
      success: true,
      results
    });
    return;
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
    return;
  }
}

module.exports.resetTaxDue = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    if (!user_credentials || user_credentials.role != 'admin') {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return
    }
    let resetted = await db.logins.update({
      tax_due: 0
    }, {
      where:{
        id: req.query.login_id
      }
    });
    if(resetted && resetted[0]){
      res.status(200).json({
        success:true,
        message: "Successfully reset the users tax amount"
      });
      return;
    }else{
      throw new Error("Failed to reset the tax due");
    }
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success:false,
      error: error.message
    });
    return;
  }
}

module.exports.doesReferralExist = async (req, res) => {
  try{
    var user_credentials = utilities.decryptJWT(req);
    if (!user_credentials) {
      res.status(401).json({
        success: false,
        error: {
          message: "User Not authorized to perform this action"
        }
      });
      return
    }
    if(!req.query.uid){
      throw new Error("query parameter uid not found");
    }
    let userCount = await db.logins.count({
      where:{
        uid: req.query.uid
      }
    });
    if(userCount>0){
      res.status(200).json({
        success:true,
        referrerExists: true
      });
      return;
    }else{
      res.status(200).json({
        success:true,
        referrerExists: false
      });
      return;
    }
  }catch(error){
    console.error("error occured: ", error);
    res.status(500).json({
      success:false,
      error: error.message
    });
    return;
  }
}

// 

if(require.main == module){
}
