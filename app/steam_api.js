var util = require('util');
var http = require('http');
var querystring = require('querystring');
var crypto = require('crypto');
var q = require('q');
var q_http = require("q-io/http");

/**
 * Error thrown to indicate that an error occurred on Steam's end.
 * @param message
 * @param status
 * @constructor
 */
function SteamApiError(message, status) {
    this.name = 'SteamApiError';
    this.message = message;
    this.status = status || 500;
    this.stack = (new Error()).stack;
}

/**
 * Error to be returned when the Steam API is busy.
 * @extends SteamApiError
 * @constructor
 */
function SteamApiBusyError() {
    this.name = 'SteamApiBusyError';
    this.message = 'The Steam API is busy and was unable to handle the request.';
    this.status = 503;
}
SteamApiBusyError.prototype = Object.create(SteamApiError.prototype);

/**
 * A class for querying the Steam API.
 * @param {RedisClient} redisClient
 * @constructor
 */
function SteamApi(redisClient) {

    /**
     * The base url of the steam API.
     * @type {string}
     * @constant
     */
    var STEAM_API_BASE_URL = 'http://api.steampowered.com';

    /**
     * Test url for validating steam key
     * @type {string}
     * @constant
     */
    var VALIDATE_KEY_METHOD = '/IDOTA2Match_570/GetMatchDetails/v1/';

    /**
     * API method listing the api methods
     * @type {string}
     * @constant
     */
    var SUPPORTED_API_LIST_METHOD = '/ISteamWebAPIUtil/GetSupportedAPIList/v1';


    /**
     * An object holding the number of seconds specific Steam API paths should be cached.
     * @type {Object}
     * @constant
     */
    var METHOD_CACHE_EXPIRE_TIME = (function () {
        var SECONDS_MINUTE = 60;
        var SECONDS_HOUR = 60 * SECONDS_MINUTE;
        var SECONDS_DAY = 24 * SECONDS_HOUR;
        var SECONDS_MONTH = 31 * SECONDS_DAY;

        return {
            '/ISteamWebAPIUtil/GetSupportedAPIList/v1': SECONDS_MONTH,
            '/IEconDOTA2_570/GetHeroes/v1': SECONDS_DAY,
            '/IDOTA2Match_570/GetMatchDetails/v1': SECONDS_DAY,
            '/ISteamUser/GetPlayerSummaries/v2': SECONDS_DAY,
            '/IDOTA2Match_570/GetMatchHistory/v1': 5 * SECONDS_MINUTE
        }
    })();

    /**
     * The default time (sec) to cache an http response if a specific time is not specified in
     * {@link METHOD_CACHE_EXPIRE_TIME}.
     * @type {number}
     * @constant
     **/
    var METHOD_CACHE_EXPIRE_TIME_DEFAULT = 60 * 60;

    /**
     * Delay in milliseconds that must pass between each call to the api.
     * @type {number}
     * @constant
     */
    var STEAM_API_REQUEST_DELAY = 1000;

    /**
     * Delay in milliseconds that must pass between an API call getting a
     * 503 return and the next API call.
     * @type {number}
     * @constant
     */
    var STEAM_API_BUSY_REQUEST_DELAY = 30 * 1000;


    /**
     * The redis client instance to use for connecting to redis.
     * @type {RedisClient}
     * @private
     */
    this._redisClient = redisClient;

    /**
     * The Steam API key used for requests.
     * @type {string}
     * @private
     */
    this._apiKey = '';

    /**
     * Map of interfaces and their methods.
     * @type {{}}
     * @private
     */
    this._apiInterfaces = {
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

    /**
     * Timestamp indicating when/if the Steam API was busy (got a 503 http response), we must
     * not do any API calls until {@see STEAM_API_BUSY_REQUEST_DELAY} ms has passed.
     * @type {number}
     * @private
     */
    this._steamApiBusyTimestamp = 0;

    /**
     * A promise for chaining requests with delay between each.
     * @type Promise
     * @private
     */
    this._apiRequestAwaitDefer = q.resolve();

    /**
     * Queues an HTTP API request to perform as soon as the STEAM_API_REQUEST_DELAY allows. Returns a
     * promise for a q_http response.
     * @param url The url to send the HTTP request to.
     * @returns {Promise} A promise for a q_http response.
     * @private
     */
    this._queueApiRequest = function (url) {
        /** @type {SteamApi} */
        var _this = this;
        /** @type {q.defer} */
        var requestDefer = q.defer();

        // If we are waiting for the Steam API to stop being busy, fast fail.
        if ((new Date().getTime() - _this._steamApiBusyTimestamp) < STEAM_API_BUSY_REQUEST_DELAY) {
            return q.reject(new SteamApiBusyError());
        }

        _this._apiRequestAwaitDefer = _this._apiRequestAwaitDefer.then(function () {
            q_http.request(url).then(function (response) {
                if (response.status === 503) {
                    _this._steamApiBusyTimestamp = new Date().getTime();
                    requestDefer.reject(new SteamApiBusyError());
                } else {
                    requestDefer.resolve(response);
                }
            }, function (err) {
                if (err.code == 'ETIMEDOUT') {
                    requestDefer.reject(new SteamApiError("The request to the Steam API timed out.", 503));
                } else {
                    requestDefer.reject(err);
                }
            });
            return q.delay(STEAM_API_REQUEST_DELAY)
        });

        return requestDefer.promise;
    };

    /**
     * Does an http get request to the Steam API at the provided path. Returns a promise
     * resolved with an object {{status: number, body:string}} on success.
     * @param {string} path The Steam API path to make the request to.
     * @param {Object} queryParams An object of query parameters to include in the request.
     * @returns {Promise} A promise for an http response.
     * @private
     *
     */
    this._httpGet = function (path, queryParams) {
        var url = STEAM_API_BASE_URL + path + "?" + querystring.stringify(queryParams);
        var status;
        return this._queueApiRequest(url).then(function (response) {
            status = response.status;
            return response.body.read();
        }).then(function (bodyBuffer) {
            var body = bodyBuffer.toString();
            return {status: status, body: body};
        });
    };

    /**
     * Wrapper around httpGet for storing/querying redis for a cached response
     * before doing a real request. Returns a promise resolved with an object
     * {{status: number, body: string, ?cache: boolean}} on success.
     * @param {string} path The Steam API path to make the request to.
     * @param {Object} queryParams An object of query parameters to include in the request.
     * @param {number} [expire] The time in seconds the possible response should be cached.
     * @returns {Promise} A promise for an http response.
     * @see {@link _httpGet}
     * @private
     */
    this._cachedHttpGet = function (path, queryParams, expire) {
        var expireTime;
        if (expire) {
            expireTime = expire;
        } else {
            expireTime = METHOD_CACHE_EXPIRE_TIME[path] || METHOD_CACHE_EXPIRE_TIME_DEFAULT;
        }

        // Let's not store the api key in the redis database.
        var paramsNoKey = queryParams;
        delete paramsNoKey['key'];
        var md5sum = crypto.createHash('md5');
        var redisKey = md5sum.update(path + "?" + querystring.stringify(paramsNoKey)).digest('hex');

        var _this = this;
        return q.ninvoke(this._redisClient, "get", redisKey).then(function (data) {
            if (data) {
                return q.resolve({status: 200, body: data, cache: true});
            } else {
                return q.reject('No cache entry for that key');
            }
        }).catch(function () {
            return _this._httpGet(path, queryParams).then(function (result) {
                if (result['status'] === 200) {
                    _this._redisClient.set(redisKey, result['body']);
                    _this._redisClient.expire(redisKey, expireTime);
                }
                return result;
            });
        });
    };


    /**
     * Tests if interfaceName, methodName, versionNumber entry exist in the
     * map of Steam API methods.
     * @param interfaceName
     * @param methodName
     * @param versionNumber
     * @returns {boolean} True if the combination exist, else false
     * @private
     */
    this._apiMethodExists = function (interfaceName, methodName, versionNumber) {
        return (
            this._apiInterfaces.hasOwnProperty(interfaceName) &&
            this._apiInterfaces[interfaceName].hasOwnProperty(methodName) &&
            this._apiInterfaces[interfaceName][methodName].hasOwnProperty(versionNumber)
            );
    };

    // Tests if queryParams contains all the required parameters for the api method.
    this._hasRequiredParameters = function (interfaceName, methodName, versionNumber, queryParams) {
        var methodParams = this._apiInterfaces[interfaceName][methodName][versionNumber];

        for (var paramName in methodParams) {
            if (!methodParams.hasOwnProperty(paramName)) {
                continue;
            }

            if (!methodParams[paramName].optional && !(paramName in queryParams)) {
                return false;
            }
        }
        return true;
    };


    /**
     * Sets the Steam API key used for any future requests. The key is validated against an
     * API method to make sure it is valid. Returns a promise that is resolved on success.
     * @param {string} key The Steam API key to use.
     * @returns {Promise} A Q promise resolved on success.
     */
    this.setApiKey = function (key) {
        var _this = this;
        return this._cachedHttpGet(VALIDATE_KEY_METHOD, {match_id: -1, key: key}, 60 * 60 * 24)
            .then(function (response) {
                if (response.status === 200) {
                    _this._apiKey = key;
                    return q.resolve();
                } else if (response.status === 401) {
                    return q.reject(new SteamApiError('Invalid API Key.', 401));
                } else {
                    return q.reject(new Error(
                            'Unexpected HTTP response code "' + response.status +
                            '" (' + http.STATUS_CODES[response.status] + ').'));
                }
            });
    };

    /**
     * Queries the Steam API for all API methods available. This method must resolve
     * before any calls to {@link doApiCall} will succeed.
     * @returns {Promise} A Q promise resolved if successfully got list of methods from the Steam API.
     */
    this.loadApiMethods = function () {
        var _this = this;
        return this._cachedHttpGet(SUPPORTED_API_LIST_METHOD, {key: this._apiKey})
            .then(function (response) {
                if (response.status !== 200) {
                    return q.reject('HTTP Error: ' + response.status);
                } else {
                    try {
                        var jsonBody = JSON.parse(response.body);
                    } catch (err) {
                        return q.reject(err);
                    }

                    if (jsonBody['apilist'] && util.isArray(jsonBody['apilist']['interfaces'])) {
                        // Parse the api listing and format it to a map.
                        // see comment on apiInterfaces for format.
                        jsonBody['apilist']['interfaces'].forEach(function (interface_) {
                            var interfaceObj = {};
                            interface_['methods'].forEach(function (method) {
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
                            _this._apiInterfaces[interface_['name']] = interfaceObj;
                        });
                    } else {
                        return q.reject(new Error('Bad format of API listing data.'));
                    }
                    return q.resolve();
                }
            });
    };

    /**
     * Performs a Steam API call. Returns a Q promise that is resolved with the JSON-decoded
     * response from the Steam API. {@link loadApiMethods} must successfully resolve before this
     * method should be called.
     * @param {string} interfaceName The interface name of the Steam API
     * @param {string} methodName The method of the interface to query
     * @param {string} versionNumber The version number of the method
     * @param {Object} [queryParams={}] A key-value object of query parameters.
     * @param {boolean} [cache=true] A flag for if the result is allowed to be cached.
     * @returns {Promise} A Q promise resolved with the JSON-decoded Steam API result on success.
     */
    this.doApiCall = function (interfaceName, methodName, versionNumber, queryParams, cache) {
        queryParams = queryParams || {};
        cache = cache || true;
        versionNumber = parseInt(versionNumber.replace(/[^-0-9]/g, ''), 10).toString();

        queryParams['key'] = apiKey;
        var startTime = new Date().getTime();

        var imv = [interfaceName, methodName, versionNumber];
        if (this._apiMethodExists.apply(this, imv)) {
            if (this._hasRequiredParameters.apply(this, imv) !== true) {
                return q.reject(new SteamApiError('Missing required parameter.', 400));
            }

            var requestMethod = cache ? this._cachedHttpGet : this._httpGet;
            var methodPath = '/' + interfaceName + '/' + methodName + '/v' + versionNumber;

            // Make the request
            return requestMethod.call(this, methodPath, queryParams)
                .then(function (response) {
                    if (response.status === 200) {
                        try {
                            var jsonBody = JSON.parse(response.body);
                            console.log(methodPath, response.cache ? '(Cached)' : '', (new Date().getTime() - startTime) + "ms");
                            return q.resolve(jsonBody);
                        } catch (err) {
                            return q.reject(err);
                        }
                    } else if (response.status === 401) {
                        return q.reject(new SteamApiError('Invalid API Key.', 401));
                    } else {
                        return q.reject(new Error('Unexpected HTTP response code "' + response.status + '".'));
                    }
                })
        } else {
            return q.reject(new SteamApiError("The API method specified does not exist.", 404));
        }
    }
}

module.exports = {
    SteamApi: SteamApi,
    SteamApiError: SteamApiError
};
