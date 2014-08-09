#
# user-controller.coffee
#
# The user controller provides a simple api for signing in, signing out and optionally showing
# a sign in modal. It also provides a user object when the user is signed in.
#

angular.module('dotaStats.controllers')
.controller "UserController", ['$scope', '$modal', 'steamUser',
  ($scope, $modal, steamUser) ->
    new class UserController
      # An object for the signed in user
      user: null

      error: {}

      signInModal = $modal(
        scope: $scope
        template: '/partials/modals/sign-in.html'
        container: 'body'
        show: false
      )

      constructor: ->
        steamUser.getUser()
        .then (user) =>
          @user = user

      showSignInModal: () ->
        signInModal.$promise.then(signInModal.show);

      signIn: () ->
        steamUser.signIn()
        .then (steamPlayer) =>
          signInModal.$promise.then(signInModal.hide);
          @user = steamPlayer
        .catch (err) =>
          @error.signIn = err

      signOut: () ->
        steamUser.signOut()
        @user = null
]
