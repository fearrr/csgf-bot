var config = require('./config/config.js'),
    redis_conf = require('./config/redis.js'),
    default_conf = require('./config/default.js'),
    socket_conf = require('./config/socket.js'),
    cent_conf = require('./config/cent.js'),
    app = require('express')(),
    server = require('http').Server(app),
    jscent = require("jscent"),
    redis = require('redis'),
    fs = require('fs'),
    requestify = require('requestify'),
    graphite = require('graphite-udp');
console = process.console;
if(config.graphite) var metric = graphite.createClient(config.graphite_conf);
var c = new jscent(cent_conf);
var online = [];
setInterval(function(){
    c.presence("online", function(err, message){
        online = Object.keys(message.body.data).map(function (key) { return message.body.data[key]['user']; });
        c.publish("online", online.length, function(err, resp){});
    });
}, 1000);
setInterval(function(){
    var users = [];
    for(var key in online) if(users.indexOf(key) == -1) users.push(key);
    if(config.graphite) metric.put('users.online', users.length);
}, 50000);
var bets_per_m = 0;
setInterval(function(){
    if(config.graphite) metric.put('bets.bpm', bets_per_m);
    bets_per_m = 0;
}, 60000);
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
var redisClient = redis.createClient(redis_config),
    client = redis.createClient(redis_config);
    
redisClient.subscribe('show.winners');
redisClient.subscribe('queue');
redisClient.subscribe('ctime');
redisClient.subscribe('newDeposit');
redisClient.subscribe('app_log');
redisClient.subscribe('new_user');
redisClient.setMaxListeners(0);
redisClient.on("message", function (channel, message) {
    if (channel == 'queue') {
        client.lrange('usersQueue.list', 0, -1, function(err, queues) {
            c.publish("queue", queues, function(err, resp){});
        });
    }
    if (channel == 'app_log') {
        console.log(JSON.parse(message));
    }
    if (channel == 'new_user') {
        setTimeout(function(){c.publish("update#" + message, updateinfo, function(err, resp){});}, 1000);
    }
    if (channel == 'show.winners') {
        clearInterval(timer);
        timerStatus = false;
        console.log('Остановка!');
        game.status = 3;
        showSliderWinners();
    }    
	if (channel == 'ctime') {
        message = JSON.parse(message);
		time = message.time;
    }
    if (channel == 'newDeposit') {
        message = JSON.parse(message);
        if(message.bettype == 0) bets_per_m++;
		game.status = message.gameStatus;
        if (!timerStatus){
			if (message.gameStatus == 1) startTimer();
		}
        var addtime = Math.round(Math.round(message.betprice)/10);
        if (addtime < 60){
            time = time + addtime;
        } else {
            time = time + 60;
        }
    }
});

function updateInformation() {
    requestify.post(config.web.domain + '/api/update', {
        secretKey: config.web.secretKey
    }).then(function(response) {
		updateinfo = JSON.parse(response.body);
	}, function(response) {
		console.log('Ошибка [updateinfo]');
		setTimeout(updateInformation, 1000);
	});
}

/* USERS ONLINE SITE END */

var steamStatus = [],
    game,
    timer,
    ngtimer,
	updateinfo,
    timerStatus = false,
	sstatus = true,
    timerTime = 121,
    preFinishingTime = 3,
	ngtime = 0,
	time = 0;
	
var preFinish = false;
getCurrentGame();
checkSteamInventoryStatus();
updateInformation();

function startTimer() {
    time = timerTime;
    timerStatus = true;
    clearInterval(timer);
    console.log('Игра начинается.');
    timer = setInterval(function () {
		if (time <= 0) { 
            c.publish("timer", 0, function(err, resp){});
		} else {
            c.publish("timer", time--, function(err, resp){});
		}
        if ((game.status == 1) && (time <= preFinishingTime)) {
            if (!preFinish) {
                preFinish = true;
				sstatus = false;
                setGameStatus(2);
                client.set('delayForNewGame', true);
            }
        }
        if (time <= 0) {
			if (sstatus){
				clearInterval(timer);
				console.log('Конец игры.');
				showSliderWinners();
			}
        }
    }, 1000);
}
function getCurrentGame() {
    requestify.post(config.web.domain + '/api/getCurrentGame', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		game = JSON.parse(response.body);
		console.log('Текущая игра #' + game.id);
		if (game.status == 1) startTimer();
		if (game.status == 2) startTimer();
		if (game.status == 3) newGame();
	}, function (response) {
        console.log(response);
		console.log('Ошибка [getCurrentGame]');
		setTimeout(getCurrentGame, 1000);
	});
}

function showSliderWinners() {
    requestify.post(config.web.domain + '/api/getWinners', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		var winners = response.body;
		console.log('Показываем слайдер!');
		setGameStatus(3);
		startNGTimer(winners);
		updateInformation();
	}, function (response) {
		console.error('Ошибка [showSlider]');
		setTimeout(showSliderWinners, 1000);
	});
}

function startNGTimer(winners) {
	ngtime = 20;
	var data = JSON.parse(winners);
    if(config.graphite) metric.put('games.price', data.tickets/100);
	data.showSlider = true;
	clearInterval(ngtimer);
	console.log('Отсчет пошел');
	ngtimer = setInterval(function() {
		ngtime = ngtime - 1;
		data.time = ngtime;
		if (ngtime <= 10) data.showSlider = false;
        c.publish("slider", data, function(err, resp){});
		if (ngtime <= 0) {
			clearInterval(ngtimer);
			newGame();
			console.log('Отсчет окончен');
		}
	}, 1000);
}

function setGameStatus(status) {
    requestify.post(config.web.domain + '/api/setGameStatus', {
		status: status,
		secretKey: config.web.secretKey
	}).then(function (response) {
		sstatus = true;
		game = JSON.parse(response.body);
		console.log('Статус игры изменен: ' + status);
	}, function (response) {
		console.error('Something wrong [setGameStatus]');
		setTimeout(function(){setGameStatus(status)}, 1000);
	});
}

function newGame() {
    requestify.post(config.web.domain + '/api/novigra', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		updateinfo.last = updateinfo.last + 1;
		preFinish = false;
		timerStatus = false;
		game = JSON.parse(response.body);
		console.log('Новая игра! #' + game.id);
        c.publish("newGame", game, function(err, resp){});
        c.publish("update", updateinfo, function(err, resp){});
		setTimeout(function(){
            client.set('delayForNewGame', false);
		}, 3000);
	}, function (response) {
		console.error('Ошибка [newGame]');
		setTimeout(newGame, 1000);
	});
}
function checkSteamInventoryStatus() {
    try {
        requestify.get('https://api.steampowered.com/ICSGOServers_730/GetGameServersStatus/v1/?key=' + config.steam.apiKey)
        .then(function (response) {
            var answer = JSON.parse(response.body);
            steamStatus = answer.result.services;
            client.set('steam.community.status', steamStatus.SteamCommunity);
            client.set('steam.inventory.status', steamStatus.IEconItems);
            var stat = 'good';
            var rus = 'Нагрузка серверов Steam: Средняя';
            if(steamStatus.IEconItems == 'normal' && steamStatus.SteamCommunity == 'normal'){
                stat = 'good';
                rus = 'Нагрузка серверов Steam: Слабая';
            }
            if(steamStatus.IEconItems == 'normal' && steamStatus.SteamCommunity == 'delayed'){
                stat = 'normal';
                rus = 'Нагрузка серверов Steam: Средняя';
            }
            if(steamStatus.IEconItems == 'critical' || steamStatus.SteamCommunity == 'critical'){
                stat = 'bad';
                rus = 'Нагрузка серверов Steam: Сильная';
            }
            var result = {
                'rus': rus,
                'stat': stat
            }
            c.publish("status", result, function(err, resp){});
        }, function (response) {
            console.log('Ошибка - Стим недоступен [5]');
        });
    } catch (ex) {
        console.log('Ошибка - Стим недоступен [5]');
	}
}
var checkNewBet = function() {
    requestify.post(config.web.domain + '/api/newBet', {
        secretKey: config.web.secretKey
    }).then(function(response) {
        var answer = JSON.parse(response.body);
        if (answer.success) {
            betsProcceed = false;
        }
    }, function(response) {
        console.log('Не можем отправить новую ставку. Retry...');
        setTimeout(function() {
            checkNewBet()
        }, 4000);
    });
}
setInterval(checkSteamInventoryStatus, 1000 * config.timers.check_steam_status);
var queueProceed = function() {
    client.llen(redis_conf.channels.bot.betsList, function(err, length) {
        if (length > 0 && !betsProcceed) {
            console.log('Ставок:' + length);
            betsProcceed = true;
            checkNewBet();
        }
    });
}
var betsProcceed = false;

setInterval(queueProceed, 3000);