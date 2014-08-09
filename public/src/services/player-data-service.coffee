#
# player-data-service.coffee
#
# A service for resolving data required by the player view.
#

angular.module('dotaStats.services')
.factory "PlayerData", ['$route', '$q', '$location', 'steamApi',
  ($route, $q, $location, steamApi) ->
    () ->
      steamId = $route.current.params['steamId']
      player = steamApi.getPlayer(steamId)

      # Redirect 32bit ids to 64bit ids
      if player.steamid64 != steamId
        $location.path('/player/' + player.steamid64)
        $location.replace()
        return $q.reject('Redirect')

      player.loadSummary()
      .then () ->
        return player
]