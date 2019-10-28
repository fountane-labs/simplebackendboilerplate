var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var nunjucks = require("nunjucks");
var fileUpload = require('express-fileupload');
const cron = require("node-cron");

var router = require('./routes/index').router;
const CronJob = require("./helpers/CronJob");
const dbSync = require("./utilities/createdb").syncFunc;
const dbsyncForce = require("./utilities/createdb").syncFuncForce;


var app = express();
// view engine setup
app.set('views', path.join(__dirname, 'views'));
nunjucks.configure('views', {
    autoescape: true,
    express: app,
    watch: true,
    operatorsAliases: false
});
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept"); // cors header
    if(req.method == "OPTIONS"){
            // In very simple terms, this is how you handle OPTIONS request in nodejs
            res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, HEAD, PATCH");
            res.header('Access-Control-Max-Age', '1728000');
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header("Access-Control-Allow-Headers", "Origin,Content-Type,Accept,Authorization, X-AUTH-TOKEN");
            res.header("Content-Type",  "text/plain; charset=UTF-8");
            res.header("Content-Length", "0");
            res.sendStatus(208);
    }
    else{
        next();
    }

//    next();
});

app.get('/api/v1/dbsync', async (req, res)=>{
  try{
    let results = await dbSync();
    res.status(200).json({
      success:true,
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
});

app.get('/api/v1/dbsyncForce', async (req, res)=>{
  try{
    let results = await dbsyncForce();
    res.status(200).json({
      success:true,
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
});

app.get('/_ah/warmup', (req, res)=>{
  let db = require("./models/db");
  res.status(200).json({
    success:true
  });
  return;
});

app.use('/api/v1', router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);

  if(err.status != 404){
    console.log(err);
  }
  res.json({success: false, error: err})
});

// cron.schedule('00 30 * * * *', ()=>{
//   CronJob.cancelUnmetNormalLeagues();
// });

// cron.schedule('00 35 * * * *', ()=>{
//   CronJob.markMatchesAsOver();
// });

// cron.schedule('30 * * * * *', ()=>{
//   CronJob.getLiveScores();
// });

module.exports.app = app;
