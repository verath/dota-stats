#
# app-config.coffee
# Contains configuration for app-global dependencies
#

angular.module('dotaStats')
.config ['$locationProvider',
  ($locationProvider) ->
    $locationProvider.html5Mode(true).hashPrefix('!')
]
