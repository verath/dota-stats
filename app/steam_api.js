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

function SteamApi(redisClient) {

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

    // Tests if interfaceName, methodName, versionNumber entry exist in the
    // map of Steam API methods.
    var apiMethodExists = function (interfaceName, methodName, versionNumber) {
        return (
            apiInterfaces.hasOwnProperty(interfaceName) &&
            apiInterfaces[interfaceName].hasOwnProperty(methodName) &&
            apiInterfaces[interfaceName][methodName].hasOwnProperty(versionNumber)
            );
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
            return q_http.request(url).then(function (response) {
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
                    return Q.reject(new Error('Invalid API Key.'));
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

        var err;

        if (apiMethodExists(interfaceName, methodName, versionNumber)) {
            var methodParams = apiInterfaces[interfaceName][methodName][versionNumber];
            queryParams['key'] = apiKey;

            // Make sure we have all required params before making the request
            for (var paramName in methodParams) {
                if (!methodParams.hasOwnProperty(paramName)) continue;
                if (!methodParams[paramName].optional && !(paramName in queryParams)) {
                    err = new Error('Missing required parameter: "' + paramName + '"');
                    err.status = 400;
                    return Q.reject(err);
                }
            }

            var methodPath = '/' + interfaceName + '/' + methodName + '/v' + versionNumber;

            // Make the request
            return cachedHttpGet(methodPath, queryParams, 60*60)
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
                        var err = new Error('Invalid API Key.');
                        err.code = 401;
                        return Q.reject(err);
                    } else {
                        return Q.reject(new Error('Unexpected HTTP response code "' + response.status + '".'));
                    }
                })
        } else {
            err = new Error("The API method specified does not exist.");
            err.status = 404;
            return Q.reject(err);
        }
    }
}

module.exports = SteamApi;