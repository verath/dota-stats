#
# progress-loader-service.coffee
#
# A service providing the ProgressLoader class for easier progress tracking of promises.
#

angular.module('dotaStats.services')
.factory 'ProgressLoader', ['$q', 'EventEmitter'
  ($q, EventEmitter) ->

    # Class ProgressLoader
    #
    # A helper class for waiting for promises, emitting events for different stages of
    # loading.
    #
    # * "start" - Emitted when .load is called and there are promises added.
    # * "progress" - Emitted whenever any of the promises loading is resolved.
    # * "finish" - Emitted when all promises loading has been resolved.
    # * "error" - Emitted if any of the promises are rejected.
    #
    # If an "error" event is emitted, the current loading will not continue and the "finish"
    # event will not be emitted.
    #
    class ProgressLoader
      constructor: () ->
        # A flag for if we are currently loading or not.
        @_isLoading = false
        # An array of promises that will be loaded once .load is called.
        @_promisesToLoad = []
        # A map of id: promise that is currently loading.
        @_promisesLoading = {}
        # The total number of promises that were added to the load process.
        @_numLoading = 0
        # The number of promises that has finished loading
        @_numFinished = 0
        # An id to keep track of promises added to _promisesLoading
        @_promiseId = 0
        # An instance of EventEmitter used to notify listeners of load events.
        @_eventEmitter = new EventEmitter()

      # Helper method for notifying listeners of loading progress, possibly also
      # emitting the finish event if all promises have now been resolved.
      _progress: (promise) ->
        if @_isLoading
          @_numFinished += 1
          @_eventEmitter.emit('progress', promise, @_numFinished, @_numLoading)

      _finish: (allPromise) ->
        if @_isLoading
          @_eventEmitter.emit('finish', allPromise, @_numLoading)
          @stop()

      # Method called for each loading promise when it is resolved.
      _onResolve: (promiseId) ->
        # We have to check the promise is still listened for, as it might have
        # been removed due to an error of another promise or a call to stop
        if @_promisesLoading.hasOwnProperty(promiseId)
          promise = @_promisesLoading[promiseId]
          @_progress(promise)

      # Method called when all loading promises are resolved.
      _onAllResolve: (promiseIds, allPromise) ->
        for id in promiseIds
          if not @_promisesLoading.hasOwnProperty(id)
            return
        @_finish(allPromise)

      # Method called if a promise is rejected.
      _onReject: (promiseId, err) ->
        # We have to check the promise is still listened for, as it might have
        # been removed due to an error of another promise or a call to stop
        if @_promisesLoading.hasOwnProperty(promiseId)
          @_eventEmitter.emit('error', err)
          @stop()

      # Stops the currently loading (if any) promises from emitting any more events
      # and removes them from the ProgressLoader.
      stop: ->
        @_isLoading = false
        @_promisesLoading = {}
        @_numLoading = 0

      # Adds a promise or an array of promises to be loaded the next time load is called.
      add: (promise) ->
        if angular.isArray(promise)
          @_promisesToLoad = @_promisesToLoad.concat(promise)
        else
          @_promisesToLoad.push(promise)
        return this

      # Starts loading promises added via the add method. The load method also takes an optional
      # promise or array of promises to add before starting the load process.
      # Load will throw an error if the ProgressLoader is already loading.
      load: (promise=null) ->
        if @_isLoading
          throw new Error('Can not start loading until the previous loading process has finished.')

        if promise?
          @add(promise)

        if @_promisesToLoad
          @_isLoading = true
          @_numLoading = @_promisesToLoad.length
          @_numFinished = 0

          # Set up progress and error for each promise
          promiseIds = _.map(@_promisesToLoad, (promise) =>
            promise.then () =>
              @_onResolve(promiseId)
            .catch (err) =>
              @_onReject(promiseId, err)

            promiseId = @_promiseId++
            @_promisesLoading[promiseId] = promise
            return promiseId
          )

          # Add a finish listener for when all promises are resolved
          $q.all(@_promisesToLoad).then (promise) =>
            @_onAllResolve(promiseIds, promise)

          @_promisesToLoad = []
          @_eventEmitter.emit('start', @_numLoading)

        return this

      on: (evt, listener) ->
        @_eventEmitter.on(evt, listener)
        return this

      once: (evt, listener) ->
        @_eventEmitter.once(evt, listener)
        return this
]
