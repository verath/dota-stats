'use strict';

angular.module('myApp', [
    'ngRoute',
    'myApp.filters',
    'myApp.services',
    'myApp.directives',
    'myApp.controllers'
]).config(['$routeProvider', function ($routeProvider) {
    $routeProvider
        .when('/', {
            controller: 'ViewHomeCtrl',
            templateUrl: 'partials/home.html'
        })
        .when('/setup', {
            controller: 'ViewSetupCtrl',
            controllerAs: 'setupCtrl',
            templateUrl: 'partials/setup.html'
        })
        .otherwise({
            redirectTo: '/'
        });
}]);
