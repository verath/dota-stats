'use strict';

var app = angular.module('myApp', [
    'ngRoute',
    'ngAnimate',
    'myApp.filters',
    'myApp.services',
    'myApp.directives',
    'myApp.controllers',
    'ui.ladda',
    'focusOn'
]);

app.config(['$routeProvider', function ($routeProvider) {
    $routeProvider
        .when('/', {
            controller: 'ViewHomeCtrl as homeCtrl',
            templateUrl: 'partials/home.html'
        })
        .when('/player/:steamId', {
            controller: 'ViewPlayerCtrl as playerCtrl',
            templateUrl: 'partials/player/index.html',
            resolve: ViewPlayerCtrl.resolve
        })
        .otherwise({
            redirectTo: '/'
        });
}]);
