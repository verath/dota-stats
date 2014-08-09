#
# error-directive.coffee
#
# A directive for displaying an error message and providing go back/retry options.
#

angular.module('dotaStats.directives')
.directive 'error', ['$route', '$rootScope', '$location',
  ($route, $rootScope, $location) ->
    scope:
      'errorText': '@'
    restrict: 'E'
    templateUrl: '/partials/directives/error.html'
    link: (scope) ->
      scope.retry = () ->
        $route.reload()

      history = []

      $rootScope.$on '$routeChangeSuccess', () ->
        history.push($location.$$path)

      scope.goBack = () ->
        if history.length
          $location.path(history.splice(-1)[0])
        else
          $location.path('/')
]
