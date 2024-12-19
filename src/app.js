'use strict';
var debug = require('debug');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');

var routes = require('./routes/index');
require('./routes/bot/stats');
require('./routes/chatGPT/gpt');
var textsAPIRouter = require("./routes/dashboard/textsAPI");
var AIchecksAPIRouter = require("./routes/dashboard/AIchecksAPI");
var newsletterAPIRouter = require("./routes/dashboard/newsletterAPI");
var leaderboardAPIRouter = require("./routes/dashboard/leaderboardAPI");
var sourcestatsAPIRouter = require("./routes/dashboard/sourcestatsAPI");
var quizAPIRouter = require("./routes/dashboard/quizAPI");
var blacklistAPIRouter = require("./routes/dashboard/blacklistAPI");
var monitoringAPIRouter = require("./routes/dashboard/monitoringAPI");
var authAPIRouter = require("./routes/dashboard/authAPI");
var whatsappAPIRouter = require("./routes/whatsapp/bot");
var messengerAPIRouter = require("./routes/messenger/bot");
require('./routes/config/passport');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use("/newsletterAPI", newsletterAPIRouter);
app.use("/AIchecksAPI", AIchecksAPIRouter);
app.use("/leaderboardAPI", leaderboardAPIRouter);
app.use("/sourcestatsAPI", sourcestatsAPIRouter);
app.use("/textsAPI", textsAPIRouter);
app.use("/quizAPI", quizAPIRouter);
app.use("/blacklistAPI", blacklistAPIRouter);
app.use("/monitoringAPI", monitoringAPIRouter);
app.use("/authAPI", authAPIRouter);
app.use("/whatsappAPI", whatsappAPIRouter);
app.use("/messengerAPI", messengerAPIRouter);

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    return res.send('404');
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function () {
    debug('Express server listening on port ' + server.address().port);
    require('./routes/viber/bot');
});