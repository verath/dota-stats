var util = require('util');
var http = require('http');
var querystring = require('querystring');
var crypto = require('crypto');
var Q = require('q');
var q_http = require("q-io/http");

// The base url of the steam API.
var STEAM_API_BASE_URL = 'http://api.steampowered.com';

// Test url for validating steam key
var VALIDATE_KEY_METHOD = '/IDOTA2Match_570/GetMatchDetails/v1/';

// URL listing the api methods
var SUPPORTED_API_LIST_METHOD = '/ISteamWebAPIUtil/GetSupportedAPIList/v0001/';


// Error thrown to indicate that an error occurred on Steam's end.
function SteamApiError (message, status) {
    this.name = 'SteamApiError';
    this.message = message;
    this.status = status || 500;
    this.stack = (new Error()).stack;
}

// Error to be returned when the Steam API is busy.
function SteamApiBusyError() {
    this.name = 'SteamApiBusyError';
    this.message = 'The Steam API is busy and was unable to handle the request.';
    this.status = 503;
}
SteamApiBusyError.prototype = Object.create(SteamApiError.prototype);


function SteamApi(redisClient) {
    var SECONDS_MINUTE = 60;
    var SECONDS_HOUR = 60 * SECONDS_MINUTE;
    var SECONDS_DAY = 24 * SECONDS_HOUR;
    var SECONDS_WEEK = 7 * SECONDS_DAY;
    var SECONDS_MONTH = 30 * SECONDS_DAY;

    var METHOD_CACHE_EXPIRE_TIME = {
        '/IEconDOTA2_570/GetHeroes/v1': SECONDS_DAY,
        '/IDOTA2Match_570/GetMatchDetails/v1': SECONDS_MONTH,
        '/ISteamUser/GetPlayerSummaries/v2': SECONDS_DAY,
        '/IDOTA2Match_570/GetMatchHistory/v1': 5 * SECONDS_MINUTE
    };

    // Delay in milliseconds that must pass between each call to the api.
    var STEAM_API_REQUEST_DELAY = 1000;

    // Delay in milliseconds that must pass between an API call getting a
    // 503 return and the next API call.
    var STEAM_API_BUSY_REQUEST_DELAY = 30 * 1000;

    // The Steam API key used for requests.
    var apiKey = '';

    // Map of interfaces and their methods
    var apiInterfaces = {
//        'interfaceName': {
//            'methodName': {
//                'versionNumber': {
//                    'parameterName': {
//                        'optional': true
//                    }
//                }
//            }
//        }
    };

    // Timestamp indicating when/if the Steam API was busy (got a 503 http response), we must
    // not do any API calls until STEAM_API_BUSY_REQUEST_DELAY ms has passed.
    var steamApiBusyTimestamp = 0;

    // A defer for chaining requests with delay between each.
    var ApiRequestAwaitDefer = Q.resolve();


    // Tests if interfaceName, methodName, versionNumber entry exist in the
    // map of Steam API methods.
    var apiMethodExists = function (interfaceName, methodName, versionNumber) {
        return (
            apiInterfaces.hasOwnProperty(interfaceName) &&
            apiInterfaces[interfaceName].hasOwnProperty(methodName) &&
            apiInterfaces[interfaceName][methodName].hasOwnProperty(versionNumber)
            );
    };

    // Queues an API request to perform as soon as the STEAM_API_REQUEST_DELAY allows.
    var queueApiRequest = function (url) {
        if ((new Date().getTime() - steamApiBusyTimestamp) < STEAM_API_BUSY_REQUEST_DELAY) {
            return Q.reject(new SteamApiBusyError());
        }

        var requestDefer = Q.defer();
        ApiRequestAwaitDefer = ApiRequestAwaitDefer.then(function () {
            q_http.request(url).then(function (response) {
                if (response.status === 503) {
                    // If you get a 503 Error: the matchmaking server is busy or you exceeded limits.
                    // Please wait 30 seconds and try again.
                    steamApiBusyTimestamp = new Date().getTime();
                    requestDefer.reject(new SteamApiBusyError());
                } else {
                    requestDefer.resolve(response);
                }
            }, function (err) {
                requestDefer.reject(err);
            });

            return Q.delay(STEAM_API_REQUEST_DELAY)
        });
        return requestDefer.promise;
    };

    // Wrapper around q_http.request for storing/querying redis for a cached response
    // before actually doing the request
    var cachedHttpGet = function (path, queryParams, expireTime) {
        var url = STEAM_API_BASE_URL + path + "?" + querystring.stringify(queryParams);

        // Let's not store the api key in the redis database.
        var paramsNoKey = queryParams;
        delete paramsNoKey['key'];
        var md5sum = crypto.createHash('md5');
        var redisKey = md5sum.update(path + "?" + querystring.stringify(paramsNoKey)).digest('hex');

        return Q.ninvoke(redisClient, "get", redisKey).then(function (data) {
            if (data) {
                return Q.resolve({status: 200, body: data, cache: true});
            } else {
                return Q.reject('No cache entry for that key');
            }
        }).catch(function () {
            var status;
            // No stored data in redis cache, do new request
            return queueApiRequest(url).then(function (response) {
                status = response.status;
                return response.body.read();
            }).then(function (bodyBuffer) {
                var body = bodyBuffer.toString();
                if (status === 200) {
                    redisClient.set(redisKey, body);
                    redisClient.expire(redisKey, expireTime);
                }
                return {status: status, body: body};
            });
        });
    };

    /**
     * Sets the Steam API key used for any future requests. The key
     * is validated against an API method to make sure it is valid.
     * Returns a promise that is resolved on success.
     * @param key The Steam API key to use.
     * @returns A Q promise resolved on success.
     */
    this.setApiKey = function (key) {
        return cachedHttpGet(VALIDATE_KEY_METHOD, {match_id: -1, key: key}, 60 * 60 * 24)
            .then(function (response) {
                if (response.status === 200) {
                    apiKey = key;
                    return Q.resolve();
                } else if (response.status === 401) {
                    return Q.reject(new SteamApiError('Invalid API Key.', 401));
                } else {
                    return Q.reject(new Error(
                            'Unexpected HTTP response code "' + response.status +
                            '" (' + http.STATUS_CODES[response.status] + ').'));
                }
            });
    };

    /**
     * loadApiMethods queries the Steam API for all API methods. Used
     * to white-list requests made using #doApiCall.
     * @returns A Q promise resolved if successfully got list of
     *          methods from the Steam API.
     */
    this.loadApiMethods = function () {
        return cachedHttpGet(SUPPORTED_API_LIST_METHOD, {key: apiKey}, 60 * 60 * 24 * 30)
            .then(function (response) {
                if (response.status !== 200) {
                    return Q.reject('HTTP Error: ' + response.status);
                } else {
                    try {
                        var jsonBody = JSON.parse(response.body);
                    } catch (err) {
                        return Q.reject(err);
                    }

                    if (jsonBody['apilist'] && util.isArray(jsonBody['apilist']['interfaces'])) {
                        // Parse the api listing and format it to a map.
                        // see comment on apiInterfaces for format.
                        jsonBody['apilist']['interfaces'].forEach(function (interface) {
                            var interfaceObj = {};
                            interface['methods'].forEach(function (method) {
                                if (method['httpmethod'] !== 'GET') {
                                    return; // Only supporting GET for now
                                }
                                var methodObj = interfaceObj[method['name']] || {};
                                var paramsObj = {};

                                method['parameters'].forEach(function (parameter) {
                                    paramsObj[parameter['name']] = {
                                        'optional': parameter['optional']
                                    };
                                });
                                methodObj[method['version']] = paramsObj;
                                interfaceObj[method['name']] = methodObj;
                            });
                            apiInterfaces[interface['name']] = interfaceObj;
                        });
                    } else {
                        return Q.reject(new Error('Bad format of API listing data.'));
                    }
                    return Q.resolve();
                }
            });
    };

    /**
     * Performs a Steam API call. Returns a Q promise that is resolved
     * @param interfaceName The interface name of the Steam API
     * @param methodName The method of the interface to query
     * @param versionNumber The version number of the method
     * @param queryParams A key-value object of query parameters.
     * @returns A Q promise resolved with the Steam API result on success.
     */
    this.doApiCall = function (interfaceName, methodName, versionNumber, queryParams) {
        var startTime = new Date().getTime();

        // "v00001" -> "1"
        versionNumber = parseInt(versionNumber.replace(/[^-0-9]/g, ''), 10).toString();

        if (apiMethodExists(interfaceName, methodName, versionNumber)) {
            var methodParams = apiInterfaces[interfaceName][methodName][versionNumber];
            queryParams['key'] = apiKey;

            // Make sure we have all required params before making the request
            for (var paramName in methodParams) {
                if (!methodParams.hasOwnProperty(paramName)) continue;

                if (!methodParams[paramName].optional && !(paramName in queryParams)) {
                    return Q.reject(new SteamApiError('Missing required parameter: "' + paramName + '"', 400));
                }
            }

            var methodPath = '/' + interfaceName + '/' + methodName + '/v' + versionNumber;
            var cacheExpire = METHOD_CACHE_EXPIRE_TIME[methodPath] || 60 * 60;

            // Make the request
            return cachedHttpGet(methodPath, queryParams, cacheExpire)
                .then(function (response) {
                    if (response.status === 200) {
                        try {
                            var jsonBody = JSON.parse(response.body);
                            console.log(methodPath, response.cache ? '(Cached)' : '', (new Date().getTime() - startTime) + "ms");
                            return Q.resolve(jsonBody);
                        } catch (err) {
                            return Q.reject(err);
                        }
                    } else if (response.status === 401) {
                        return Q.reject(new SteamApiError('Invalid API Key.', 401));
                    } else {
                        return Q.reject(new Error('Unexpected HTTP response code "' + response.status + '".'));
                    }
                })
        } else {
            return Q.reject(new SteamApiError("The API method specified does not exist.", 404));
        }
    }
}

module.exports = {
    SteamApi: SteamApi,
    SteamApiError: SteamApiError
};