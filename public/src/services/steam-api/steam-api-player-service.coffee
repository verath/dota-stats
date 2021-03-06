#
# steam-api-player-service.coffee
#
# A service exposing a class for modelling a steam player as returned from the
# Steam API.
#

angular.module('dotaStats.services.steamApi')
.factory 'SteamPlayer', ['$q', 'steamApiCaller', 'SteamDotaMatch',
  ($q, steamApiCaller, SteamDotaMatch) ->
    class SteamPlayer

      PRIVATE_ID_32 = "4294967295"

      constructor: (steamId) ->
        if(steamId.length != 17)
          steamId = SteamPlayer.steamId32To64(steamId)
        @steamid64 = steamId
        @steamid32 = SteamPlayer.steamId64To32(@steamid64)
        @is_private = (@steamid32 == PRIVATE_ID_32)
        @is_loaded = false

      @steamId64To32 = (steam64Id) ->
        parseInt(steam64Id.substr(3), 10) - 61197960265728 + "";

      @steamId32To64 = (steam32Id) ->
        '765' + (parseInt(steam32Id, 10) + 61197960265728);

      loadSummary: (cache = true) ->
        if @is_private
          $q.reject(new Error('The player has not made their profile publicly available to third-party websites.'))
        else
          steamApiCaller.getPlayerSummaries({steamids: @steamid64}, cache)
          .then (summaries) =>
            if summaries.length == 1
              angular.extend(this, summaries[0])
              @is_loaded = true
            else
              $q.reject(new Error('Could not find a player with that id.'))

      getMatches: (numMatches = 5, startAtId = null, cache = true) ->
        if @is_private
          $q.reject(new Error('The player has not made their profile publicly available to third-party websites.'))
        else
          steamApiCaller.getMatchHistory({
            account_id: @steamid64
            matches_requested: numMatches
            start_at_match_id: startAtId}, cache)
          .then (result) ->
            meta = {
              num_results: result.num_results
              total_results: result.total_results
              results_remaining: result.results_remaining
            }
            matches = (new SteamDotaMatch(match.match_id) for match in result.matches)
            return {
            matches: matches,
            meta: meta
            }
]
