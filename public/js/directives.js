'use strict';

/* Directives */
var directives = angular.module('myApp.directives', []);

directives.directive('error', function ($route, $rootScope, $location) {
    return {
        scope: {
            'errorText': '@'
        },
        restrict: 'E',
        templateUrl: '/partials/directives/error.html',
        link: function (scope, element, attrs) {
            scope.retry = function () {
                $route.reload();
            };

            var history = [];

            $rootScope.$on('$routeChangeSuccess', function () {
                history.push($location.$$path);
            });

            scope.goBack = function () {
                var prevUrl = history.length > 1 ? history.splice(-2)[0] : "/";
                $location.path(prevUrl);
            }
        }
    }
});