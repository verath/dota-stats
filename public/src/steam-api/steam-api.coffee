steamApiModule = angular.module('steamApi', [
  'lodash'
  'steamApi.caller'
  'steamApi.player'
  'steamApi.dota.match'
  'steamApi.dota.heroes'
])

steamApiModule.service 'steamApi',
  class SteamApi

    constructor: (SteamPlayer, SteamDotaMatch) ->
      @SteamPlayer = SteamPlayer
      @SteamDotaMatch = SteamDotaMatch

    getPlayer: (steamId) -> new @SteamPlayer(steamId)

    getMatch: (matchId) -> new @SteamDotaMatch(matchId)
