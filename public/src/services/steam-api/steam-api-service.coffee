#
# steam-api-service.coffee
#
# A service exposing methods for creating SteamPlayers and SteamDotaMatches
#

angular.module('dotaStats.services.steamApi')
.factory 'steamApi', ['SteamPlayer', 'SteamDotaMatch',
  (SteamPlayer, SteamDotaMatch) ->
    new class SteamApi
      getPlayer: (steamId) ->
        new SteamPlayer(steamId)

      getMatch: (matchId) ->
        new SteamDotaMatch(matchId)
]
