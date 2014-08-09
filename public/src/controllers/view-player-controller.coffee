#
# view-player-controller.coffee
#
# Controller for the player view.
#

angular.module('dotaStats.controllers')
.controller "ViewPlayerCtrl", ['$q', '$timeout', '$location', '$scope', '_', 'playerData', 'ProgressLoader'
  ($q, $timeout, $location, $scope, _, playerData, ProgressLoader) ->
    new class ViewPlayerCtrl
      REFRESH_MATCHES_INTERVAL = 2 * 60 * 1000

      # The player we are viewing
      player: null
      # Matches that we have loaded details for
      matches: []
      # Flag for if we are currently loading more matches
      matchLoadProgress: false
      # Flag for if there was an error loading matches
      loadingMatchesError: false
      # Flag for if we have more matches to load
      hasMoreMatches: true
      # A ProgressLoader used so that we can update the progress bar whenever
      # we load new matches
      @matchProgressLoader: null

      onMatchesLoadStart: () =>
        @matchLoadProgress = 0.01
        @loadingMatchesError = false

      onMatchesLoadProgress: (promise, done, total) =>
        @matchLoadProgress = done / total

      onMatchesLoadFinish: () =>
        @matchLoadProgress = false

      onMatchesLoadError: () =>
        @loadingMatchesError = true
        @matchLoadProgress = false
        $timeout(() =>
          @loadingMatchesError = false
        , 3000)

      constructor: ->
        @player = playerData
        @matchProgressLoader = new ProgressLoader()

        # Attach our progress listeners
        @matchProgressLoader
        .on('start', @onMatchesLoadStart)
        .on('progress', @onMatchesLoadProgress)
        .on('finish', @onMatchesLoadFinish)
        .on('error', @onMatchesLoadError)

        # Load matches for the player
        @loadMoreMatches()

        # Refresh matches every REFRESH_MATCHES_INTERVAL
        @matchProgressLoader.once('finish', () =>
          @refreshMatchTimeout = $timeout(@refreshMatches, REFRESH_MATCHES_INTERVAL)
        )

        $scope.$on '$destroy', () =>
          $timeout.cancel(@refreshMatchTimeout)


      # Adds new matches to the current array of matches, also
      # making sure there are no duplicates
      addMatches: (matches) ->
        _.forEach(@matches, (match) =>
          if (index = _.findIndex(matches, {match_id: match.match_id})) != -1
            matches.splice(index, 1)
        )
        @matches = @matches.concat(matches)


      # Method for loading more matches after the current loaded ones
      loadMoreMatches: () ->
        if @matchLoadProgress == false
          @matchLoadProgress = true
          if @matches.length
            lastMatchId = _.last(@matches).match_id - 1

          @player.getMatches(10, lastMatchId).then (matchData) =>
            @matchProgressLoader.load(_.invoke(matchData.matches, 'loadDetails'))
            .once('finish', () =>
              @addMatches(matchData.matches)
              @hasMoreMatches = (matchData.meta.results_remaining > 0)
            )
          .catch @onMatchesLoadError

      # Method for refreshing the first few match
      refreshMatches: () =>
        @player.getMatches(10, null, false).then (matchData) =>
          highMatchId = @matches[0].match_id
          newMatches = _.filter matchData.matches, (match) ->
            match.match_id > highMatchId

          if newMatches.length
            $q.all(_.invoke(newMatches, 'loadDetails')).then () =>
              @addMatches(newMatches)
          else
            $q.reject('')

        .finally () =>
          @refreshMatchTimeout = $timeout(() =>
            @refreshMatches()
          , REFRESH_MATCHES_INTERVAL)

      goToMatch: (match_id) ->
        $location.path('/match/' + match_id)
]
