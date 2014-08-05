'use strict';

app = angular.module 'myApp', [
  'ngRoute'
  'ngAnimate'
  'lodash'
  'ui.ladda'
  'focusOn'
  'angularMoment'
  'mgcrea.ngStrap'
  'LocalForageModule'
  'steamApi'
  'myApp.services'
  'myApp.directives'
  'myApp.controllers'
]

app.config ($routeProvider, $locationProvider) ->
  $locationProvider.html5Mode(true).hashPrefix('!')

  $routeProvider
  .when('/', {
      controller: 'ViewHomeCtrl as homeCtrl'
      templateUrl: '/partials/home.html'
  })
  .when('/player/:steamId', {
      controller: 'ViewPlayerCtrl as playerCtrl'
      templateUrl: '/partials/player/player.html'
      resolve: {
        playerData: (ViewPlayerCtrlResolve) -> ViewPlayerCtrlResolve()
      }
  })
  .when('/match/:matchId', {
    controller: 'ViewMatchCtrl as matchCtrl'
    templateUrl: '/partials/match/match.html'
    resolve: {
      matchData:(ViewMatchCtrlResolve) -> ViewMatchCtrlResolve()
    }
  })
  .otherwise({
    redirectTo: '/'
  })
