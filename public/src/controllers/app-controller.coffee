#
# app-controller.coffee
# Contains the main controller for the app.
#
# The main controller is used to catch route change (error)
# and similar global events.
#

angular.module('dotaStats.controllers')
.controller "AppCtrl", ['$rootScope', '$location', '$scope', '$timeout',
  ($rootScope, $location, $scope, $timeout) ->
    new class AppCtrl
      loading: {isLoading: true}

      error: {isError: false, errorMessage: '' }

      pageTitle: null

      constructor: ->
        $rootScope.$on "$routeChangeStart", () =>
          @pageTitle = 'Loading...'
          @loading.isLoading = true
          @error.isError = false

        $rootScope.$on "$routeChangeSuccess", () =>
          # Next-frame timeout, as without it seems to run before view is fully ready.
          $timeout () =>
            @loading.isLoading = false

        $rootScope.$on "$routeChangeError", (event, current, previous, rejection) =>
          console.error("ROUTE CHANGE ERROR: ", rejection)
          @loading.isLoading = false
          @error.isError = true

          if angular.isString(rejection?['message'])
            @error.errorMessage = rejection['message']
          else if angular.isString(rejection)
            @error.errorMessage = rejection
          else
            @error.errorMessage = "An unexpected error occurred while loading the page."
]
