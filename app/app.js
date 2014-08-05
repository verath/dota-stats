if (process.env.NODETIME_ACCOUNT_KEY) {
    require('nodetime').profile({
        accountKey: process.env.NODETIME_ACCOUNT_KEY,
        appName: 'dota-stats' // optional
    });
}

// Built-in Node modules
var http = require('http');
var path = require('path');
var querystring = require('querystring');
var url = require('url');

// Library modules
var openid = require('openid');
var express = require('express');
var redis = require('redis');
var Q = require('q');
var compression = require('compression');

// App modules
var SteamApi = require('./steam_api');

// Config
var config = {};
try {
    config = require('./config/config');
} catch (e) {
}

// Redis
var redisClient;
if (process.env.REDISCLOUD_URL) {
    var redisURL = url.parse(process.env.REDISCLOUD_URL);
    redisClient = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
    redisClient.auth(redisURL.auth.split(":")[1]);
} else {
    redisClient = redis.createClient(config.REDIS_PORT, config.REDIS_HOST, config.REDIS_OPTIONS);
}
redisClient.on("error", function (err) {
    console.log("Redis Error: " + err);
});

// OpenId Steam Sign-in
var siteUrl = config.SITE_URL || process.env.SITE_URL;
var relyingParty = new openid.RelyingParty(
    url.resolve(siteUrl, '/verify'),// Verify URL
    siteUrl,                        // Realm
    true,                           // Stateless verification
    false,                          // Strict mode
    []);                            // Extensions to enable and include


var steamApi = new SteamApi(redisClient);
var app = module.exports = express();

// use gzip
app.use(compression());

var oneDay = 86400000;
// Serve public site as static files
app.use('/', express.static(path.join(__dirname, '../public'), {maxAge: oneDay}));

// Api methods
app.get('/api/:interfaceName/:methodName/:versionNumber', function (req, res, next) {
    var interfaceName = req.params['interfaceName'];
    var methodName = req.params['methodName'];
    var versionNumber = req.params['versionNumber'];
    var queryParams = req.query;

    steamApi.doApiCall(interfaceName, methodName, versionNumber, queryParams)
        .done(function (result) {
            res.send(result);
        }, function (err) {
            if (err instanceof Error) {
                next(err)
            } else {
                next(new Error(err));
            }
        });
});

// OpenId authenticate
app.get('/authenticate', function (req, res, next) {
    relyingParty.authenticate('http://steamcommunity.com/openid', false, function (error, authUrl) {
        if (error) {
            res.writeHead(200);
            res.end('Authentication failed: ' + error.message);
        } else if (!authUrl) {
            res.writeHead(200);
            res.end('Authentication failed');
        } else {
            res.writeHead(302, { Location: authUrl });
            res.end();
        }
    });
});

// OpenId Verify
app.get('/verify', function (req, res, next) {
    relyingParty.verifyAssertion(req, function (error, result) {
        try {
            var resultJson = JSON.stringify({error: error, result: result});
        } catch (err) {
            next(err);
            return
        }
        res.send(
                "<html><head><script>" +
                "window.opener.handleVerifyOpenId('" + resultJson + "');window.close();" +
                "</script></head></html>"
        );

    });
});

// This route deals enables HTML5Mode by forwarding missing files to the index.html
app.all('/*', function (req, res) {
    res.sendfile(path.join(__dirname, '../public/index.html'));
});


/// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handler
app.use(function (err, req, res, next) {
    if (!err.status || err.status >= 500) {
        // An error on our end, log the stack
        console.error(err.stack);
    }
    res.status(err.status || 500);
    res.send({
        message: err.message,
        error: {}
    });
});

app.set('port', process.env.PORT || 3000);

// Validate steam key and fetch the api methods
(function () {
    steamApi.setApiKey(config.STEAM_API_KEY || process.env.STEAM_API_KEY)
        .then(steamApi.loadApiMethods)
        .then(function () {
            var runningDefer = Q.defer();
            var server = app.listen(app.get('port'), function () {
                console.log("Server running on port " + server.address().port + "...");
            }).on('error', function (err) {
                server.close();
                runningDefer.reject(err);
            });
            return runningDefer.promise;
        })
        .fail(function (err) {
            if (err) {
                console.error(err.stack);
            }
        })
        .done();
})();