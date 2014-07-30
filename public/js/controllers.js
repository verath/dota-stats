'use strict';

/* Controllers */

var ctrls = angular.module('myApp.controllers', []);

ctrls.controller("AppCtrl", function ($rootScope, $location, $scope, $timeout) {
    this.loading = {
        isLoading: true
    };

    this.error = {
        isError: false,
        errorMessage: ''
    };

    var showLoadingTimeout;

    $rootScope.$on("$routeChangeStart", function (event, next, current) {
        // Delay showing of loading screen, if the page loads faster than 300ms
        showLoadingTimeout = $timeout(function () {
            this.loading.isLoading = true;
        }.bind(this), 300);
        this.error.isError = false;
    }.bind(this));

    $rootScope.$on("$routeChangeSuccess", function (event, current, previous) {
        $timeout.cancel(showLoadingTimeout);
        this.loading.isLoading = false;
    }.bind(this));

    $rootScope.$on("$routeChangeError", function (event, current, previous, rejection) {
        $timeout.cancel(showLoadingTimeout);
        console.log("ROUTE CHANGE ERROR: ", rejection);
        this.loading.isLoading = false;
        this.error.isError = true;

        if(rejection instanceof Error) {
            this.error.errorMessage = rejection.message;
        } else if(angular.isString(rejection)) {
            this.error.errorMessage = rejection;
        } else {
            this.error.errorMessage = "An unexpected error occurred while loading the page."
        }

    }.bind(this));
});


ctrls.controller("ViewHomeCtrl", function ($location, $timeout, focus, steamApi) {
    this.isSearching = false;

    this.searchSteamId = function (searchStr) {
        $location.path('/player/' + searchStr)
    };
});

var ViewPlayerCtrl = ctrls.controller("ViewPlayerCtrl", function ($scope, playerSummary) {
    this.player = playerSummary;
});

ViewPlayerCtrl.resolve = {
    playerSummary: function ($route, steamApi) {
        return steamApi.getPlayerSummary($route.current.params.steamId);
    }
};