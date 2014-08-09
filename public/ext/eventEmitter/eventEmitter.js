// EventEmitter service for injection
angular.module('EventEmitter', [])
    .factory('EventEmitter', ['$window',
        function ($window) {
            return $window.EventEmitter
        }
    ]);