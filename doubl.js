var config = require('./config/config.js'),
    redis_conf = require('./config/redis.js'),
    socket_conf = require('./config/socket.js'),
    cent_conf = require('./config/cent.js'),
    app = require('express')(),
    server = require('http').Server(app),
    redis = require('redis'),
    fs = require('fs'),
    jscent = require("jscent"),
    requestify = require('requestify');
console = process.console;
var c = new jscent(cent_conf);
if(redis_conf.unix){
    var redis_config = {
        'path': redis_conf.path,
        'password': redis_conf.password
    }
} else {
    var redis_config = {
        'host': redis_conf.host,
        'port': redis_conf.port
    }
}
var redisClient = redis.createClient(redis_config);

setTimeout(rediSubscribe, 1000);
function rediSubscribe() {
	getCurrentGame();
	redisClient.subscribe('nbdouble');
	redisClient.setMaxListeners(0);
	redisClient.on("message", function (channel, message) {
		if (channel == 'nbdouble') {
			if (!timerStatus && !sliderStatus) getCurrentGame();
		}
	});
}

var timer,
	ngtimer,
    timerStatus = false,
	sliderStatus = false,
    timerTime = 35,
	sliderTime = 20,
    preFinishingTime = 2;
	
var preFinish = false;

function getCurrentGame() {
    requestify.post(config.web.domain + '/api/double/getCurrentGame', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		game = JSON.parse(response.body);
		console.log('Текущая игра #' + game.id);
		if (game.status != 0) { 
			if (game.status != 3) { 
				startTimer();
			} else {
				newGame();
			}
		}
	}, function (response) {
		console.log('Ошибка [getCurrentGame]');
		setTimeout(getCurrentGame, 1000);
	});
}
	
function startTimer() {
    var time = timerTime;
    timerStatus = true;
    clearInterval(timer);
    console.log('Новая игра.');
    timer = setInterval(function () {
        c.publish("dbtimer", time--, function(err, resp){});
        if ((game.status == 1) && (time <= preFinishingTime)) {
            if (!preFinish) {
                preFinish = true;
                setGameStatus(2);
            }
        }
        if (time <= 0) {
            clearInterval(timer);
            timerStatus = false;
			sliderStatus = true;
            console.log('Конец игры.');
            showSliderWinners();
        }
    }, 1000);
}

function setGameStatus(status) {
    requestify.post(config.web.domain + '/api/double/setGameStatus', {
        status: status,
        secretKey: config.web.secretKey
    }).then(function (response) {
		game = JSON.parse(response.body);
		console.log('Статус игры: ' + status);
	}, function (response) {
		console.error('Something wrong [setGameStatus]');
		setTimeout(setGameStatus, 1000);
	});
}

function showSliderWinners() {
    requestify.post(config.web.domain + '/api/double/startGame', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		var winners = response.body;
		console.log('Показываем слайдер!');
		setGameStatus(3);
		var time = sliderTime;
		var data = JSON.parse(winners);
		data.showSlider = true;
		clearInterval(ngtimer);
		console.log('Отсчет пошел');
		ngtimer = setInterval(function () {
			time--;
			if (time <= 10) data.showSlider = false;
            c.publish("doubleslider", data, function(err, resp){});
			if (time <= 0) {
				clearInterval(ngtimer);
				newGame();
				console.log('Отсчет окончен');
				sliderStatus = false;
			}
		}, 1000);
	}, function (response) {
		console.error('Something wrong [showSlider]');
		setTimeout(showSliderWinners, 1000);
	});
}

function newGame() {
    requestify.post(config.web.domain + '/api/double/newGame', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		var data = JSON.parse(response.body);
		preFinish = false;
		console.log('Новая игра! #' + data.id);
		game = data;
        c.publish("ngdouble", data.id, function(err, resp){});
	}, function (response) {
		console.error('Something wrong [newGame]');
		setTimeout(newGame, 1000);
	});
}

//getCurrentGame();
