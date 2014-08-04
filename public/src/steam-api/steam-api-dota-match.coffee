angular.module('steamApi.dota.match', [])
.factory 'SteamDotaMatch', ($q, steamApiCaller, steamApiDotaHeroes, _) ->
  class SteamDotaMatch

    game_mode_lookup = {
      0: 'None'
      1: 'All Pick'
      2: 'Captain\'s Mode'
      3: 'Random Draft'
      4: 'Single Draft'
      5: 'All Random'
      6: 'Intro'
      7: 'Diretide'
      8: 'Reverse Captain\'s Mode'
      9: 'The Greeviling'
      10: 'Tutorial'
      11: 'Mid Only'
      12: 'Least Played'
      13: 'New Player Pool'
      14: 'Compendium Matchmaking'
    }

    constructor: (matchId) ->
      @_loadPromise = null
      @match_id = matchId
      @is_loaded = false;
      @is_loading = false;

    loadDetails: () ->
      if @is_loaded
        $q.when(true)
      else if @is_loading
        @_loadPromise
      else
        @is_loading = true
        @_loadPromise = steamApiCaller.getMatchDetails({match_id: @match_id})
        .then (matchDetails) =>
          angular.extend(this, matchDetails)

          # Add game_mode_name
          @game_mode_name = game_mode_lookup[matchDetails.game_mode] || 'Unknown'

          @players.forEach (player) =>
            # Add a radiant/dire faction flag to each player based on their slot
            # bit 8 = Team (false if Radiant, true if Dire)
            player.radiant = (player.player_slot & 128) == 0
            # Add a flag for if they won or lost
            player.winning_team = (player.radiant && @.radiant_win || !player.radiant && !@.radiant_win)
            # Steam ids should be strings for consistency
            player.account_id = player.account_id?.toString()

          loadHeroNames.call(this).then () =>
            @is_loaded = true
        .catch (err) =>
          @is_loading = false
          $q.reject(err)


    loadHeroNames = () ->
      steamApiDotaHeroes.loadHeroes()
      .then () =>
        for player in @players
          player.hero_name = steamApiDotaHeroes.getHeroById(player.hero_id)?.localized_name
          player.hero_name ?= 'Unknown'