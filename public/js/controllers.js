'use strict';

/* Controllers */

var ctrls = angular.module('myApp.controllers', []);


ctrls.controller("AppCtrl", function ($rootScope) {
    $rootScope.$on("$routeChangeError", function () {
        console.log("failed to change routes");
    });
});


ctrls.controller("ViewHomeCtrl", function ($location, $timeout, focus, steamApi) {
    this.isSearching = false;

    this.searchSteamId = function (id) {
        this.isSearching = true;
        steamApi.validateUserId(id)
            .then(function (profileData) {
                console.log(profileData);
            }, function () {
                focus("user-id-input")
                this.isSearching = false;
            }.bind(this))
    };
});

ctrls.controller("ViewSetupCtrl", function ($location, steamApi) {
    this.apiKey = steamApi.getApiKey();

    this.saveKey = function saveKey() {
        steamApi.setApiKey(this.apiKey)
            .then(function () {
                $location.path('/');
            }, function () {
                console.log("ERRORS!");
            });
    }
});