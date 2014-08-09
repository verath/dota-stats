#
# steam-api-cache-service.coffee
#
# A simple in-memory cache.
#

angular.module('dotaStats.services.steamApi')
.factory 'steamApiCache', ['$q',
  ($q) ->
    new class SteamApiCallerCache
      constructor: ->
        @_cache = {}

      getKey = (methodName, args...) ->
        "apiCaller" + "." + methodName + "__" + args.join('+');

      set: (methodName, args..., value) ->
        key = getKey(methodName, args)
        @_cache[key] = value;

      get: (methodName, args...) ->
        key = getKey(methodName, args)
        if (entry = @_cache[key])?
          $q.when(entry)
        else
          $q.reject('No cache entry')
]
