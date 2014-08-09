#
# steam-user-service.coffee
#
# Service for representing a steam user, with sign in done via OpenId
#

angular.module('dotaStats.services')
.factory 'steamUser', ['$window', '$q', '$localForage', 'steamApi',
  ($window, $q, $localForage, steamApi) ->

    new class SteamUser

      constructor: ->
        @_steamUser = null
        @_loginWindow = null
        @_loginDefer = null
        # We have to register a global callback for the pop-up window to call back to
        $window.handleVerifyOpenId = (result) =>
          @_handleVerify.apply(this, arguments)

      # Takes a verified steamId user id and attempts to retrieve profile summary
      # for the user. If successful saves the user and resolves the login defer, else
      # rejects it.
      _handleVerifiedUser: (steamId) ->
        player = steamApi.getPlayer(steamId)
        player.loadSummary()
        .then () =>
          @setUser(player)
          @_loginDefer.resolve(player)
        .catch (err) =>
          @_loginDefer.reject(err?.message || 'An unexpected error occurred.')

      _handleVerify: (jsonResponse) ->
        try
          response = JSON.parse(jsonResponse)
        catch err
          return @_loginDefer.reject('Invalid response.')

        result = response?.result
        error = response?.error

        if error?
          @_loginDefer.reject((error?.message || 'An unexpected error occurred') + '.')
        else if result?['authenticated'] == true && result?['claimedIdentifier']
          @_handleVerifiedUser(result['claimedIdentifier'].replace('http://steamcommunity.com/openid/id/', ''))
        else
          @_loginDefer.reject('Invalid response.')

      setUser: (steamPlayer) ->
        # Can not store a steamPlayer object as it also has methods, convert to
        # a pure value object with the values we are interested in
        @_steamUser = {steamid64: steamPlayer.steamid64, personaname: steamPlayer.personaname}
        $localForage.setItem('steamUser.user', @_steamUser)

      getUser: () ->
        if @_steamUser
          $q.when(@_steamUser)
        else
          $localForage.getItem('steamUser.user')
          .then (steamPlayer) =>
            @_steamUser = steamPlayer

      signOut: () ->
        @_steamUser = null
        $localForage.removeItem('steamUser.user')

      signIn: () ->
        if @_loginWindow?
          # Only do one login, close earlier when clicked again
          @_loginWindow.close()

        @_loginDefer = $q.defer()
        @_loginWindow = $window.open("/authenticate");

        return @_loginDefer.promise
]
