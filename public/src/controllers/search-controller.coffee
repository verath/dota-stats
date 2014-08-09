#
# search-controller.coffee
#
# A controller for searching for a steam player or match by id.
#

angular.module('dotaStats.controllers')
.controller "SearchCtrl", ['$location',
  ($location) ->
    new class SearchCtrl
      @isSearching = false

    searchSteamId: (searchStr) ->
      $location.path('/player/' + searchStr)
]
