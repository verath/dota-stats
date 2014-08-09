#
# match-data-service.coffee
#
# A service for resolving data required by the match view.
#


angular.module('dotaStats.services')
.factory "MatchData", ['$route', '$q', 'steamApi',
  ($route, $q, steamApi) ->
    () ->
      match = steamApi.getMatch($route.current.params['matchId'])
      match.loadDetails().then () ->
        playerSummaryRequests = []

        for player in match['players']
          steamPlayer = steamApi.getPlayer(player.account_id)
          player.steam_player = steamPlayer
          playerSummaryRequests.push(steamPlayer.loadSummary())

        $q.all(playerSummaryRequests).then () ->
          {match: match}
]
