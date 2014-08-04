callerModule = angular.module('steamApi.caller', [])


callerModule.service 'steamApiCallerCache',
  class SteamApiCallerCache

    constructor: ($q) ->
      @$q = $q
      @_cache = {}

    getKey = (methodName, args...) ->
      "apiCaller" + "." + methodName + "__" + args.join('+');

    set: (methodName, args..., value) ->
      key = getKey(methodName, args)
      @_cache[key] = value;

    get: (methodName, args...) ->
      key = getKey(methodName, args)
      if (entry = @_cache[key])?
        @$q.when(entry)
      else
        @$q.reject('No cache entry')


callerModule.service 'steamApiCaller',
  class SteamApiCaller

    API_HOST = '/api'

    API_METHODS = {}
    API_METHODS.getPlayerSummaries = {
      url: API_HOST + '/ISteamUser/GetPlayerSummaries/v2/'
      possibleOptions: ['steamids']
      validateCallback: (data, resolve, reject) ->
        if data['response']?['players']?
          resolve(data['response']['players'])
        else
          reject()
    }

    API_METHODS.getMatchHistory = {
      url: API_HOST + '/IDOTA2Match_570/GetMatchHistory/v1/'
      possibleOptions: ["hero_id", "game_mode", "skill", "Skill", "date_min", "date_max", "min_players",
                        "account_id", "league_id", "start_at_match_id", "matches_requested", "tournament_games_only"]
      validateCallback: (data, resolve, reject) ->
        if data['result']?['status'] == 1
          resolve(data['result'])
        else
          reject()
    }

    API_METHODS.getMatchDetails = {
      url: API_HOST + '/IDOTA2Match_570/GetMatchDetails/v1/'
      possibleOptions: ['match_id']
      validateCallback: (data, resolve, reject) ->
        if !(data['result']?['error']?)
          resolve(data['result'])
        else
          reject()
    }

    API_METHODS.getHeroes = {
      url: API_HOST + '/IEconDOTA2_570/GetHeroes/v1/'
      possibleOptions: ['language']
      validateCallback: (data, resolve, reject) ->
        if data['result']?['heroes']?
          resolve(data['result']['heroes'])
        else
          reject()
    }

    constructor: ($http, $q, steamApiCallerCache) ->
      @$http = $http
      @$q = $q
      @cache = steamApiCallerCache

    createQueryString = (possibleOptions, options) ->
      validOptions = []
      for key in possibleOptions
        if options.hasOwnProperty(key) && options[key]?
          validOptions.push(key + '=' + options[key])
      if validOptions
        '?' + validOptions.join('&')
      else
        ''
    createSimpleApiMethod = (methodName) ->
      possibleOptions = API_METHODS[methodName].possibleOptions
      url = API_METHODS[methodName].url
      validateCallback = API_METHODS[methodName].validateCallback

      (options = {}, cache=true) ->
        queryString = createQueryString(possibleOptions, options)
        cachePromise = if cache then @cache.get(methodName, queryString) else @$q.reject('')
        cachePromise.catch () =>
          apiReqDefer = @$q.defer();
          @$http.get(url + queryString, {cache: cache})
          .success (data) =>
            validateCallback data, apiReqDefer.resolve, () ->
              apiReqDefer.reject(new Error('Received unexpected results from the Steam API'))
          .error (err) ->
            apiReqDefer.reject(err)

          @cache.set(methodName, queryString, apiReqDefer.promise)
          return apiReqDefer.promise

    getPlayerSummaries: createSimpleApiMethod('getPlayerSummaries')
    getMatchHistory: createSimpleApiMethod('getMatchHistory')
    getMatchDetails: createSimpleApiMethod('getMatchDetails')
    getHeroes: createSimpleApiMethod('getHeroes')

