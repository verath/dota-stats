var util = require('util')
var querystring = require('querystring');
var Q = require('q');
var q_http = require("q-io/http");

// The base url of the steam API.
var STEAM_API_BASE_URL = 'http://api.steampowered.com';

// Test url for validating steam key
var VALIDATE_KEY_URL_PATTERN = STEAM_API_BASE_URL + '/IDOTA2Match_570/GetMatchDetails/v1?match_id=-1&key=_KEY_';

// URL listing the api methods
var METHOD_LIST_URL = STEAM_API_BASE_URL + '/ISteamWebAPIUtil/GetSupportedAPIList/v0001/';

function SteamApi() {

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

    /**
     * Sets the Steam API key used for any future requests. The key
     * is validated against an API method to make sure it is valid.
     * Returns a promise that is resolved on success.
     * @param key The Steam API key to use.
     * @returns A Q promise resolved on success.
     */
    this.setApiKey = function (key) {
        return q_http.request(VALIDATE_KEY_URL_PATTERN.replace('_KEY_', key))
            .then(function (response) {
                if (response.status === 200) {
                    apiKey = key;
                    return Q.resolve();
                } else if (response.status === 401) {
                    return Q.reject(new Error('Invalid API Key'));
                } else {
                    return Q.reject(new Error('Unexpected HTTP response code "' + response.status + '"'));
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
        return q_http.request(METHOD_LIST_URL + '?key=' + apiKey)
            .then(function (response) {
                if (response.status !== 200) {
                    return Q.reject('HTTP Error: ' + response.status);
                } else {
                    return response.body.read();
                }
            }).then(function (body) {
                try {
                    var jsonBody = JSON.parse(body.toString());
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
            });
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

    /**
     * Performs a Steam API call. Returns a Q promise that is resolved
     * @param interfaceName The interface name of the Steam API
     * @param methodName The method of the interface to query
     * @param versionNumber The version number of the method
     * @param queryParams A key-value object of query parameters.
     * @returns A Q promise resolved with the Steam API result on success.
     */
    this.doApiCall = function (interfaceName, methodName, versionNumber, queryParams) {
        // "v00001" -> "1"
        versionNumber = parseInt(versionNumber.replace(/[^-0-9]/g, ''), 10).toString();

        if (apiMethodExists(interfaceName, methodName, versionNumber)) {
            var methodParams = apiInterfaces[interfaceName][methodName][versionNumber];

            if('key' in methodParams) {
                // Add the api key if it is required
                queryParams['key'] = apiKey;
            }

            // Make sure we have all required params before making the request
            for (var paramName in methodParams) {
                if (!methodParams.hasOwnProperty(paramName)) continue;
                if (!methodParams[paramName].optional && !(paramName in queryParams)) {
                    return Q.reject(new Error('Missing required parameter: "' + paramName + '"'));
                }
            }

            var methodUrl = [STEAM_API_BASE_URL, interfaceName, methodName, 'v' + versionNumber].join('/');
            var queryString = querystring.stringify(queryParams);

            // Make the request
            return q_http.request(methodUrl + '?' + queryString)
                .then(function (response) {
                    if (response.status === 200) {
                        return response.body.read();
                    } else if (response.status === 401) {
                        return Q.reject(new Error('Invalid API Key'));
                    } else {
                        return Q.reject(new Error('Unexpected HTTP response code "' + response.status + '"'));
                    }
                })
                .then(function(body){
                    try {
                        return Q.resolve(JSON.parse(body.toString()));
                    } catch (err) {
                        return Q.reject(err);
                    }
                });

            return Q.resolve();
        } else {
            return Q.reject("The Steam API method specified does not exist!");
        }
    }
}

var steamApi;

module.exports = new SteamApi();