'use strict';

/* Services */
var services = angular.module('myApp.services', ['LocalStorageModule']);

services.factory('steamApi', function ($q, $http, localStorageService) {
    var LS_PREFIX = 'steamApi.';

    var API_HOST = 'http://127.0.0.1:3000/api';
    var PLAYER_SUMMARY_METHOD = API_HOST + '/ISteamUser/GetPlayerSummaries/v0002/';

    // Tests a string to see if it looks like a valid 64 bit steam id
    var isValidSteamId64 = function (steamId) {
        // A steam 64 bit id is 17 digits starting with
        // 7656119 followed by 10 chars.
        return (/^7656119\d{10}$/.test(steamId));
    };

    var getPlayerSummary = function (steamId) {
        if (isValidSteamId64(steamId)) {
            var getUserDefer = $q.defer();
            $http.get(PLAYER_SUMMARY_METHOD + "?steamids=" + steamId)
                .success(function (data) {
                    if (data['response']['players'].length === 1) {
                        getUserDefer.resolve(data['response']['players'][0]);
                    } else {
                        getUserDefer.reject(new Error('No user with that Steam ID'));
                    }
                }).error(function (err) {
                    getUserDefer.reject(err);
                });
            return getUserDefer.promise;
        } else {
            return $q.reject(new Error('Invalid steam id'));
        }
    };

    return {
        getPlayerSummary: getPlayerSummary
    };
});
