#
# app-routes-config.coffee
# Contains the route mapping for the app.
#

angular.module('dotaStats')
.config ['$routeProvider',
  ($routeProvider) ->

    $routeProvider
    .when('/',
      templateUrl: '/partials/home.html'
    )
    .when('/player/:steamId',
      controller: 'ViewPlayerCtrl as playerCtrl'
      templateUrl: '/partials/player/player.html'
      resolve:
        playerData: ['PlayerData', (PlayerData) ->
          PlayerData()
        ]
    )
    .when('/match/:matchId',
      controller: 'ViewMatchCtrl as matchCtrl'
      templateUrl: '/partials/match/match.html'
      resolve:
        matchData: ['MatchData', (MatchData) ->
          MatchData()
        ]
    )
    .otherwise({
        redirectTo: '/'
      })
]
