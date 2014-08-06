steamApiModule = angular.module('steamApi', [
  'lodash'
  'steamApi.caller'
  'steamApi.player'
  'steamApi.dota.match'
  'steamApi.dota.heroes'
])

steamApiModule.factory 'steamApi', ['SteamPlayer', 'SteamDotaMatch',
  (SteamPlayer, SteamDotaMatch) ->
    new class SteamApi
      getPlayer: (steamId) ->
        new SteamPlayer(steamId)

      getMatch: (matchId) ->
        new SteamDotaMatch(matchId)
]
