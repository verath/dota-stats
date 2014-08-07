'use strict';

ctrls = angular.module('myApp.controllers', [])

# Main controller, used to catch route change (error)
# and similar global events
ctrls.controller "AppCtrl", ['$rootScope', '$location', '$scope', '$timeout',
  class AppCtrl
    loading: {isLoading: true}

    error: {isError: false, errorMessage: '' }

    pageTitle: null

    constructor: ($rootScope, $location, $scope, $timeout) ->
      $rootScope.$on "$routeChangeStart", (event, next, current) =>
        @pageTitle = 'Loading...'
        @loading.isLoading = true
        @error.isError = false

      $rootScope.$on "$routeChangeSuccess", (event, current, previous) =>
        # Next-frame timeout, as without it seems to run before view is fully ready.
        $timeout () =>
          this.loading.isLoading = false

      $rootScope.$on "$routeChangeError", (event, current, previous, rejection) =>
        console.error("ROUTE CHANGE ERROR: ", rejection)
        @loading.isLoading = false
        @error.isError = true

        if rejection instanceof Error
          @error.errorMessage = rejection['message']
        else if angular.isString(rejection)
          @error.errorMessage = rejection
        else
          @error.errorMessage = "An unexpected error occurred while loading the page."
]

# Controller for handling the top nav-bar
ctrls.controller "TopNavbarCtrl", ['$scope', '$modal', 'steamUser',
  class TopNavbarCtrl
    # An object for the signed in user
    user: null

    @error: {}

    constructor: ($scope, $modal, steamUser) ->
      @steamUser = steamUser

      steamUser.getUser()
      .then (user) =>
        @user = user

      @signInModal = $modal {
        scope: $scope
        template: '/partials/modals/sign-in.html'
        container: 'body'
        show: false
      }

    showSignInModal: () ->
      @signInModal.$promise.then(@signInModal.show);

    signIn: () ->
      @steamUser.signIn()
      .then (steamPlayer) =>
        @signInModal.$promise.then(@signInModal.hide);
        @user = steamPlayer
      .catch (err) =>
        @error.signIn = err

    signOut: () ->
      @steamUser.signOut()
      @user = null
]

# "/"
ctrls.controller "ViewHomeCtrl", [
  class ViewHomeCtrl
    @isSearching = false

    searchSteamId: (searchStr) ->
      @$location.path('/player/' + searchStr)
]

# "/player/:steamId
ctrls.controller "ViewPlayerCtrl", ['$q', '$timeout', '$location', '$scope', '_', 'playerData',
  class ViewPlayerCtrl
    REFRESH_MATCHES_INTERVAL = 2 * 60 * 1000

    # The player we are viewing
    player: {}
    # Matches that we are loading details for
    matches: []
    # Flag for if we are currently loading more matches
    matchLoadProgress: true
    # Flag for if there was an error loading matches
    loadingMatchesError: false
    # Flag for if we have more matches to load
    hasMoreMatches: false

    constructor: ($q, $timeout, $location, $scope, _, playerData) ->
      @$q = $q
      @$timeout = $timeout
      @$location = $location
      @_ = _

      @player = playerData.player
      @matches = @filterMatchesByPlayer(playerData.matchData.matches, @player.steamid32)
      @matchLoadProgress = 0
      @loadingMatchesError = false
      @hasMoreMatches = (playerData.matchData.meta.results_remaining > 0)

      matchLoadPromises = _.invoke(@matches, 'loadDetails')
      # Whenever details are loaded for a match, increase the progressbar
      @_.forEach(matchLoadPromises, (matchPromise) =>
        matchPromise.then () =>
          @matchLoadProgress += 1 / matchLoadPromises.length
      )
      # Wait for loading of matches all pending before allowing loading more
      $q.all(matchLoadPromises).then () =>
        this.matchLoadProgress = false
        # Refresh matches REFRESH_MATCHES_INTERVAL
        @refreshMatchTimeout = $timeout(() =>
          @refreshMatches()
        , REFRESH_MATCHES_INTERVAL)

      $scope.$on '$destroy', () =>
        $timeout.cancel(@refreshMatchTimeout)

    # Takes an array of SteamMatches and replaces the players property with a
    # player property for only the provided account_id
    filterMatchesByPlayer: (matches, account_id) ->
      @_.map(matches, (match) =>
        match.loadDetails().then () =>
          match.player = @_.find(match.players, {account_id: account_id})
          delete match['players']
        return match
      )

    # Method for loading more matches later than the current loaded ones
    loadMoreMatches: () ->
      if @matchLoadProgress == false
        @matchLoadProgress = 0
        lastMatchId = @_.last(this.matches).match_id
        @player.getMatches(10, (lastMatchId - 1)).then (matchData) =>
          # loadDetails for each of the matches
          matchLoadPromises = @_.invoke(matchData.matches, 'loadDetails')
          # Whenever details are loaded for a match, increase the progressbar
          @_.forEach(matchLoadPromises, (matchPromise) =>
            matchPromise.then () =>
              @matchLoadProgress += 1 / matchLoadPromises.length
          )
          @$q.all(matchLoadPromises)
          .then () =>
            # When all matches has finished loaded, append them to the list
            filteredMatches = @filterMatchesByPlayer(matchData.matches, @player.steamid32)
            @matches = @matches.concat(filteredMatches)
            @hasMoreMatches = (matchData.meta.results_remaining > 0)
            @matchLoadProgress = false
          .catch () =>
            # If there was an error loading any of the matches, throw all away.
            # (successful calls should be cached anyway, so doesn't matter much)
            @loadingMatchesError = true
            @$timeout(() =>
              @loadingMatchesError = false
              @matchLoadProgress = false
            , 3000)

    # Method for refreshing the first few match
    refreshMatches: () ->
      @player.getMatches(10, null, false)
      .then (matchData) =>
        highMatchId = @matches[0].match_id
        newMatches = @_.filter(matchData.matches, (match) ->
          match.match_id > highMatchId)
        if newMatches.length
          filteredMatches = @filterMatchesByPlayer(newMatches, @player.steamid32)
          @$q.all(@_.invoke(filteredMatches, 'loadDetails')).then () =>
            @matches = filteredMatches.concat(@matches)
        else
          @$q.reject('')
      .finally () =>
        @refreshMatchTimeout = @$timeout(() =>
          @refreshMatches()
        , REFRESH_MATCHES_INTERVAL)

    goToMatch: (match_id) ->
      @$location.path('/match/' + match_id)
]

# Resolve before ViewPlayerCtrl
ctrls.factory "ViewPlayerCtrlResolve", ['$route', '$q', '$location', '_', 'steamApi',
  ($route, $q, $location, _, steamApi) ->
    () ->
      steamId = $route.current.params['steamId']
      player = steamApi.getPlayer(steamId)

      # Redirect 32bit ids to 64bit ids
      if player.steamid64 != steamId
        $location.path('/player/' + player.steamid64)
        $location.replace()
        return $q.reject('Redirect')

      $q.all([player.getMatches(10, null, false), player.loadSummary()])
      .then (result) ->
        matchData = result[0]
        matches = matchData.matches
        matchDetailRequests = []

        for match, i in matches
          loadDefer = match.loadDetails()
          # 5 First are critical
          if i < 5
            matchDetailRequests.push(loadDefer)

        $q.all(matchDetailRequests).then () ->
          {matchData: matchData, player: player}
]

# /match/:matchId
ctrls.controller "ViewMatchCtrl", ['matchData'
  class ViewMatchCtrl
    constructor: (matchData) ->
      @match = matchData.match
]

# Resolve before ViewMatchCtrl
ctrls.factory "ViewMatchCtrlResolve", ['$route', '$q', 'steamApi',
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
