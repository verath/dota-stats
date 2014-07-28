'use strict';

/* Services */
var services = angular.module('myApp.services', ['LocalStorageModule']);

services.factory('steamApi', function ($q, $http, localStorageService) {
    var LS_PREFIX = 'steamApi.';
    var LS_KEY_API_KEY = LS_PREFIX + 'api_key';

    var VALIDATE_KEY_URL_PATTERN = 'http://127.0.0.1:3000/api/IDOTA2Match_570/GetMatchDetails/v1?match_id=-1&key=_KEY_';

    // Cache of keys that have been validated against the steam API
    var validKeys = [];

    // Get stored key
    var api_key = localStorageService.get(LS_KEY_API_KEY);

    var validateApiKey = function (key) {
        var validateDefer = $q.defer();
        if (!angular.isString(key)) {
            validateDefer.reject("Not a string.");
        } else if (validKeys.indexOf(key) !== -1) {
            validateDefer.resolve(key);
        } else {
            $http
                .get(VALIDATE_KEY_URL_PATTERN.replace('_KEY_', key))
                .success(function (response) {
                    if (response.status !== 401) {
                        validKeys.push(key);
                        validateDefer.resolve(key);
                    } else {
                        validateDefer.reject("Invalid Key.");
                    }
                }).error(function (err) {
                    validateDefer.reject("HTTP Error.")
                });
        }
        return validateDefer.promise;
    };

    var setApiKey = function (key) {
        return validateApiKey(key).then(function () {
            localStorageService.set(LS_KEY_API_KEY, key);
            api_key = key;
        });
    };

    var getApiKey = function () {
        return api_key;
    };

    return {
        setApiKey: setApiKey,
        getApiKey: getApiKey
    };
});
