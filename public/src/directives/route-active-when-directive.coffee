#
# route-active-when-directive.coffee
#
# A directive for adding an active class to an element if the route matches
# a pattern.
#

angular.module('dotaStats.directives')
.directive 'routeActiveWhen', ['$rootScope', '$location',
  ($rootScope, $location) ->
    scope:
      routeActiveWhen: '@'
      routeActiveClass: '@'
    restrict: 'A'
    link: (scope, element, attrs) ->
      activeClass = attrs.routeActiveClass || 'active'

      updateClass = () ->
        if($location.path().match(scope.routeActiveWhen))
          element.addClass(activeClass)
        else
          element.removeClass(activeClass)

      attrs.$observe 'routeActiveWhen', updateClass
      $rootScope.$on '$routeChangeStart', updateClass
]
