'use strict';

/* Services */
var services = angular.module('myApp.services', ['LocalStorageModule']);

services.factory('steamApi', function ($q, $http, localStorageService) {
    var LS_PREFIX = 'steamApi.';

    var API_HOST = 'http://127.0.0.1:3000/api';
    var VALIDATE_USER_METHOD = API_HOST + '/ISteamUser/GetPlayerSummaries/v0002/';


    var validateUserId = function (userId) {
        var validateDefer = $q.defer();

        if (!angular.isString(userId)) {
            validateDefer.reject("userId should be a string");
        } else {
            $http.get(VALIDATE_USER_METHOD + "?steamids=" + userId)
                .success(function (data, status) {
                    if (status !== 200) {
                        validateDefer.reject("Got an unexpected HTTP status code: " + status);
                    } else if (!data || !data['response'] || !data['response']['players']) {
                        validateDefer.reject('Missing required data from the response');
                    } else if (data['response']['players'].length === 0) {
                        validateDefer.reject('No player matched that id');
                    } else {
                        validateDefer.resolve(data['response']['players'][0]);
                    }
                }).error(function (err) {
                    validateDefer.reject("HTTP Error.")
                });
        }
        return validateDefer.promise;
    };

    return {
        validateUserId: validateUserId,
    };
});
