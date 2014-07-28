var http = require('http');
var path = require('path');

var express = require('express');
var Q = require('q');
var config = require('./config/config');
var steamApi = require('./steam_api');

var app = module.exports = express();

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/:interfaceName/:methodName/:versionNumber', function (req, res, next) {
    var interfaceName = req.params['interfaceName'];
    var methodName = req.params['methodName'];
    var versionNumber = req.params['versionNumber'];
    var queryParams = req.query;

    steamApi.doApiCall(interfaceName, methodName, versionNumber, queryParams)
        .done(function (result) {
            res.send(result);
        }, function (err) {
            if(err instanceof Error) {
                next(err)
            } else {
                next(new Error(err));
            }
        });
});


/// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handler
app.use(function (err, req, res, next) {
    console.error(err);
    res.status(err.status || 500);
    res.send({
        message: err.message,
        error: {}
    });
});

app.set('port', process.env.PORT || 3000);

// Validate steam key and fetch the api methods
(function () {

    steamApi.setApiKey(config.STEAM_API_KEY)
        .then(steamApi.loadApiMethods)
        .then(function () {
            var runningDefer = Q.defer();
            var server = app.listen(app.get('port'), function () {
                console.log("Server running on port " + server.address().port + "...");
            }).on('error', function(err){
                server.close();
                runningDefer.reject(err);
            });
            return runningDefer.promise;
        })
        .fail(function (err) {
            if(err) {
                console.error(err.stack);
            }
        })
        .done();
})();