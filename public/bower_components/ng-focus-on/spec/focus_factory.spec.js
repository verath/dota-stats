// Generated by CoffeeScript 1.7.1
(function() {
  describe('focus factory', function() {
    return it('sends the focusOn event on the root scope', function(done) {
      module('focusOn', function($provide) {
        $provide.value('$rootScope', {
          $broadcast: function(event, name) {
            expect(event).to.equal('focusOn');
            expect(name).to.equal('test');
            return done();
          }
        });
        return null;
      });
      return inject(function(focus, $timeout) {
        focus('test');
        return $timeout.flush();
      });
    });
  });

}).call(this);

//# sourceMappingURL=focus_factory.spec.map