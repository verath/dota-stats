#
# match-player-filter.coffee
#
# Filter for adding a player property to each match in an array of matches. The
# added player property will point at the player with the provided accountId.
#
# This is useful for views that want to display multiple matches but only one player per
# match. Like the player view.
#

angular.module('dotaStats.filters')
.filter 'matchPlayer', ['_',
  (_) ->
    (matches, accountId) ->
      _.map(matches, (match) ->
        match.player = _.find(match.players, {account_id: accountId})
        return match
      )
]
