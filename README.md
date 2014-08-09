# Dota 2 Stats
An AngularJS app for displaying dota stats from the Steam Web API.

## Running the app
### Prerequisites 
 * [Node.js and npm](http://nodejs.org/)
 * [Redis](http://redis.io/). (There is a Windows version of Redis available at [MSOpenTech/redis](https://github.com/MSOpenTech/redis), 
clone and unzip the file in bin/release)
 * A Steam API key. Get one here; http://steamcommunity.com/dev/apikey.

### 1. Clone the repository
```
git clone https://github.com/verath/dota-stats.git
```
### 2. Download and install required node modules

```
cd dota-stats
npm install
```

### 3. Configure the app

#### 3.1 Create and edit the config.js file for the backend.
```
cd app/config
cp config.example.js config.js
```

#### 3.2 Edit the Google Analytics snippet
Find the Google Analytics script in the public/index.html file. Either remove it entirely or change the
Analytics id to your own.

### 4. Run the app

#### 4.1 Start the Redis server
*This step is not completely mandatory, but very highly recommended. Without a cache for the Steam API the site
will be very sluggish.*

On windows this can be done by running the redis-server.exe file via cmd.

#### 4.2 Start the app
From the project root director run `npm start`.


## Developing

### Dev dependencies

There are a couple of additional node modules necessary to develop the app.

#### [gulp](http://gulpjs.com/) 
```
npm install -g gulp
```

Gulp is the build tool used for the public side of the app. It handles the coffee-script to 
javascript compiling, combining of resources, minimization and various other things. 
See the gulpfile.js for the entire process.

It can be run on demand by running `gulp` in the project root directory. It can also be set to 
automatically run when files changes by running `gulp watch`.

#### [bower](http://bower.io/)
```
npm install -g bower
```

Bower is used for as much of the client-side dependencies as possible. These are all added to the 
*public/bower_components* directory, and are listed in the bower.json file.

To install a new dependency using bower run `bower install --save ProjectName`. Also make sure to 
include the new dependency in the index.html file. If the library is available on a CDN, one can 
include that file directly. Otherwise, add it to the list of scripts/styles/images in the
gulpfile.js file to include it in the build.

