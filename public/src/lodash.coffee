# Lodash service for injection
angular.module('lodash', []).factory('_', () ->
  return window._;
)