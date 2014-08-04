angular.module('steamApi.dota.heroes', [])
.service 'steamApiDotaHeroes',
  class SteamApiDotaHeroes

    constructor: ($q, steamApiCaller) ->
      @$q = $q
      @steamApiCaller = steamApiCaller
      @_heroes = null

    loadHeroes: () ->
      if @_heroes
        return @$q.when(true)
      else
        @steamApiCaller.getHeroes({language: 'en'})
          .then (heroes) =>
            @_heroes = {}
            for hero in heroes
              @_heroes[hero.id] = hero
            true

    getHeroById: (heroId) ->
      if @_heroes?.hasOwnProperty(heroId)
        @_heroes[heroId]
      else
        null