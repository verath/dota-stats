'use strict';

/* Controllers */

var ctrls = angular.module('myApp.controllers', []);


ctrls.controller("AppCtrl", function ($rootScope) {
    $rootScope.$on("$routeChangeError", function () {
        console.log("failed to change routes");
    });
});


ctrls.controller("ViewHomeCtrl", function($scope, $location, steamApi) {
    if(!steamApi.getApiKey()) {
        $location.path('/setup');
    }
    $scope.message = "Hello World!";
});

ctrls.controller("ViewSetupCtrl", function($location, steamApi) {
    this.apiKey = steamApi.getApiKey();

    this.saveKey = function saveKey() {
        steamApi.setApiKey(this.apiKey)
            .then(function() {
                $location.path('/');
            }, function(){
                console.log("ERRORS!");
            });
    }
});