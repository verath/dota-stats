#
# steam-api-dota-heroes-service.coffee
#
# A service for resolving dota hero ids to their english names.
#

angular.module('dotaStats.services.steamApi')
.factory 'steamApiDotaHeroes', ['$q', 'steamApiCaller',
  ($q, steamApiCaller) ->
    new class SteamApiDotaHeroes
      @_heroes = null

      loadHeroes: () ->
        if @_heroes
          $q.when(true)
        else
          steamApiCaller.getHeroes({language: 'en'})
            .then (heroes) =>
              @_heroes = {}
              for hero in heroes
                @_heroes[hero.id] = hero
              true

      getHeroById: (heroId) ->
        if @_heroes?[heroId]? then @_heroes[heroId] else null
]
