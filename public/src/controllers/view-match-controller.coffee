#
# view-match-controller.coffee
#
# Controller for the match view.
#

angular.module('dotaStats.controllers')
.controller "ViewMatchCtrl", ['matchData',
  (matchData) ->
    new class ViewMatchCtrl
      constructor: ->
        @match = matchData.match
]