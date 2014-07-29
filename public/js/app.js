'use strict';

angular.module('myApp', [
    'ngRoute',
    'myApp.filters',
    'myApp.services',
    'myApp.directives',
    'myApp.controllers',
    'ui.ladda',
    'focusOn'
]).config(['$routeProvider', function ($routeProvider) {
    $routeProvider
        .when('/', {
            controller: 'ViewHomeCtrl as homeCtrl',
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
