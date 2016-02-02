'use strict';

// Declare app level module which depends on views, and components
angular.module('tools', [
  'ngRoute',
]);

angular.module('tools').directive('navbar', function() {
  return {
    restrict: 'E',
    replace: true,
    templateUrl: 'static/statusIcon.html',
    scope: {
      bad: '=badWhen',
      good: '=goodWhen',
      gray: '=grayWhen',
    },
    link: function(scope, element, attrs) {
      scope.$watch('bad', function() { refresh(scope); });
      scope.$watch('good', function() { refresh(scope); });
      scope.$watch('gray', function() { refresh(scope); });
    },
  };
});
