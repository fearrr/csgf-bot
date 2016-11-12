var auth = require('http-auth'),
    scribe = require('scribe-js')(),
    console = process.console,
    config = require('./config/config.js'),
    redis_conf = require('./config/redis.js'),
    socket_conf = require('./config/socket.js'),
    app = require('express')(),
    server = require('http').Server(app),
    io = require('socket.io')(server),
    redis = require('redis'),
	mysql = require('mysql'),
    requestify = require('requestify');

if(redis_conf.unix){
    var redis_config = {
        'path': redis_conf.path,
        'password': redis_conf.password
    }
} else {
    var redis_config = {
        'host': redis_conf.host,
        'port': redis_conf.port,
        'password': redis_conf.password
    }
}

var redisClient = redis.createClient(redis_config);

if(socket_conf.unix){
    server.listen(config.ports.double.path);
    console.log('DOUBLE started on ' + socket_conf.path);
} else {
    server.listen(config.ports.double.port, socket_conf.host);
    console.log('DOUBLE started on ' + socket_conf.host + ':'  + config.ports.double.port);
}


setTimeout(rediSubscribe, 1000);
function rediSubscribe() {
	getCurrentGame();
	redisClient.subscribe('nbdouble');
	redisClient.setMaxListeners(0);
	redisClient.on("message", function (channel, message) {
		if (channel == 'nbdouble') {
			if (!timerStatus && !sliderStatus) getCurrentGame();
			io.sockets.emit(channel, message);
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
    requestify.post('http://' + config.web_api_data.domain + '/api/double/getCurrentGame', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		game = JSON.parse(response.body);
		console.tag('Double').log('Текущая игра #' + game.id);
		if (game.status != 0) { 
			if (game.status != 3) { 
				startTimer();
			} else {
				newGame();
			}
		}
	}, function (response) {
		console.tag('Игра').log('Ошибка [getCurrentGame]');
		setTimeout(getCurrentGame, 1000);
	});
}
	
function startTimer() {
    var time = timerTime;
    timerStatus = true;
    clearInterval(timer);
    console.tag('Double').log('Новая игра.');
    timer = setInterval(function () {
        io.sockets.emit('dbtimer', time--);
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
            console.tag('Double').log('Конец игры.');
            showSliderWinners();
        }
    }, 1000);
}

function setGameStatus(status) {
    requestify.post('http://' + config.web_api_data.domain + '/api/double/setGameStatus', {
        status: status,
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		game = JSON.parse(response.body);
		console.tag('Double').log('Статус игры: ' + status);
	}, function (response) {
		console.tag('Double').error('Something wrong [setGameStatus]');
		setTimeout(setGameStatus, 1000);
	});
}

function showSliderWinners() {
    requestify.post('http://' + config.web_api_data.domain + '/api/double/startGame', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		var winners = response.body;
		console.tag('Double').log('Показываем слайдер!');
		setGameStatus(3);
		var time = sliderTime;
		var data = JSON.parse(winners);
		data.showSlider = true;
		clearInterval(ngtimer);
		console.tag('Double').log('Отсчет пошел');
		ngtimer = setInterval(function () {
			time--;
			if (time <= 10) data.showSlider = false;
			io.sockets.emit('doubleslider', data);
			if (time <= 0) {
				clearInterval(ngtimer);
				newGame();
				console.tag('Игра').log('Отсчет окончен');
				sliderStatus = false;
			}
		}, 1000);
	}, function (response) {
		console.tag('Double').error('Something wrong [showSlider]');
		setTimeout(showSliderWinners, 1000);
	});
}

function newGame() {
    requestify.post('http://' + config.web_api_data.domain + '/api/double/newGame', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		var data = JSON.parse(response.body);
		preFinish = false;
		console.tag('Double').log('Новая игра! #' + data.id);
		game = data;
		io.sockets.emit('ngdouble', data.id);
	}, function (response) {
		console.tag('Double').error('Something wrong [newGame]');
		setTimeout(newGame, 1000);
	});
}

//getCurrentGame();