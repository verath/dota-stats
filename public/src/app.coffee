'use strict';

angular.module 'dotaStats', [
  'ngRoute'
  'ngAnimate'
  'lodash'
  'ui.ladda'
  'angularMoment'
  'mgcrea.ngStrap'
  'LocalForageModule'
  'angulartics'
  'angulartics.google.analytics'
  'EventEmitter'
  'dotaStats.controllers'
  'dotaStats.directives'
  'dotaStats.filters'
  'dotaStats.services'
  'dotaStats.services.steamApi'
]

angular.module('dotaStats.controllers', [])
angular.module('dotaStats.directives', [])
angular.module('dotaStats.filters', [])
angular.module('dotaStats.services', [])
angular.module('dotaStats.services.steamApi', [])
