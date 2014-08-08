var gulp = require('gulp');

var gutil = require('gulp-util');
var coffee = require('gulp-coffee');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var merge = require('merge-stream');
var minifyCSS = require('gulp-minify-css');
var imagemin = require('gulp-imagemin');
var replace = require('gulp-replace');
var plumber = require('gulp-plumber');

var paths = {
    coffee_scripts: ['public/src/**/*.coffee'],
    external_scripts: [
        // Ladda-bootstrap
        'bower_components/ladda-bootstrap/dist/spin.min.js',
        'bower_components/ladda-bootstrap/dist/ladda.min.js',

        // angular-moment
        'bower_components/moment/min/moment.min.js',
        'bower_components/angular-moment/angular-moment.min.js',

        // angular-localForage
        'bower_components/localforage/dist/localforage.min.js',
        'bower_components/angular-localforage/dist/angular-localForage.min.js',

        // angulartics
        'bower_components/angulartics/dist/angulartics.min.js',
        'bower_components/angulartics/dist/angulartics-ga.min.js',

        // angular ui-ladda
        'lib/ui-ladda/ui-ladda.js'

    ].map(function (val) {
            // Add "public/" to all paths
            return 'public/' + val;
        }),

    styles: [
        // Bootstrap-ladda
        'bower_components/ladda-bootstrap/dist/ladda-themeless.min.css',

        // AngularMotion
        'bower_components/angular-motion/dist/angular-motion.min.css',

        // Dota2 Minimap Hero Sprites https://github.com/bontscho/dota2-minimap-hero-sprites
        'lib/dota2-minimap-hero-sprites/assets/stylesheets/dota2minimapheroes.css',

        // Loading spinner style from http://tobiasahlin.com/spinkit/
        'css/loading.css',

        // Shared app styles
        'css/app.css',

        // Player styles
        'css/player.css'
    ].map(function (val) {
            // Add "public/" to all paths
            return 'public/' + val;
        }),

    images: [
        // Dota2 Minimap Hero Sprites https://github.com/bontscho/dota2-minimap-hero-sprites
        'lib/dota2-minimap-hero-sprites/assets/images/minimap_hero_sheet.png'
    ].map(function (val) {
            // Add "public/" to all paths
            return 'public/' + val;
        })
};

var onError = function (err) {
    gutil.beep();
    console.log(err.stack);
};

gulp.task('clean', function (cb) {
    del(['public/build'], cb);
});

gulp.task('scripts', ['clean'], function () {
    var extScripts = gulp.src(paths.external_scripts)
        .pipe(sourcemaps.init({loadMaps: true}));

    var appScripts = gulp.src(paths.coffee_scripts)
        .pipe(plumber({
            errorHandler: onError
        }))
        .pipe(sourcemaps.init())
        .pipe(coffee());

    return merge(extScripts, appScripts)
        .pipe(uglify())
        .pipe(concat('all.min.js'))
        .pipe(sourcemaps.write('/'))
        .pipe(gulp.dest('public/build/js'));
});

gulp.task('css', ['clean'], function () {
    return gulp.src(paths.styles)
        .pipe(minifyCSS())
        .pipe(concat('all.min.css'))
        .pipe(replace('/images', '/img'))
        .pipe(gulp.dest('public/build/css'))
});

// Copy all static images
gulp.task('images', ['clean'], function() {
    return gulp.src(paths.images)
        // Pass in options to the task
        .pipe(imagemin())
        .pipe(gulp.dest('public/build/img'));
});


gulp.task('watch', ['scripts', 'css', 'images'], function () {
    var watchPaths = [];
    for(var path in paths) {
        watchPaths.push(paths[path]);
    }
    gulp.watch(watchPaths, ['scripts', 'css', 'images']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['scripts', 'css', 'images']);