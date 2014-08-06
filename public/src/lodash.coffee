# Lodash service for injection
angular.module('lodash', [])
.factory '_', ['$window',
  ($window) ->
    $window._
]