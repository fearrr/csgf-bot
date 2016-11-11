var auth = require('http-auth'),
    scribe = require('scribe-js')(),
    console = process.console,
    config = require('./config/config.js'),
    redis_conf = require('./config/redis.js'),
    default_conf = require('./config/default.js'),
    app = require('express')(),
    server = require('http').Server(app),
    io = require('socket.io')(server),
    redis = require('redis'),
	mysql = require('mysql'),
    requestify = require('requestify');

var users = [];
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

var redisClient = redis.createClient(redis_config),
    client = redis.createClient(redis_config);
    
const redisChannels = redis_conf.App_Channels;

server.listen(config.ports.appServerPort);

console.log('Server started on ' + config.web_api_data.domain + ':' + config.ports.appServerPort);

redisClient.subscribe(redisChannels.show_winners);
redisClient.subscribe(redisChannels.queue);
redisClient.subscribe(redisChannels.ctime);
redisClient.subscribe(redisChannels.dice);
redisClient.subscribe(redisChannels.out_new);
redisClient.subscribe(redisChannels.coin_scroll);
redisClient.subscribe(redisChannels.coin_new);
redisClient.subscribe(redisChannels.fuser_add);
redisClient.subscribe(redisChannels.fuser_del);
redisClient.subscribe(redisChannels.fuser_delall);
redisClient.subscribe(redisChannels.newDeposit);
redisClient.subscribe(redisChannels.msgChannel);
redisClient.subscribe(redisChannels.app_log);
redisClient.subscribe(redisChannels.depositDecline);
redisClient.setMaxListeners(0);
redisClient.on("message", function (channel, message) {
    if (channel == redisChannels.depositDecline || channel == redisChannels.queue) {
        io.sockets.emit(channel, message);
    }
	if (channel == redisChannels.out_new) {
        io.sockets.emit(channel, message);
    }	
    if (channel == redisChannels.dice) {
        io.sockets.emit(channel, message);
    }	
    if (channel == redisChannels.coin_new) {
        io.sockets.emit(channel, message);
    }
    if (channel == redisChannels.coin_scroll) {
        io.sockets.emit(channel, message);
    }
    if (channel == redisChannels.app_log) {
        console.tag('Cайт').log(JSON.parse(message));
    }
    if (channel == redisChannels.show_winners) {
        clearInterval(timer);
        timerStatus = false;
        console.tag('Сайт').log('Остановка!');
        game.status = 3;
        showSliderWinners();
    }    
	if (channel == redisChannels.ctime) {
        message = JSON.parse(message);
		time = message.time;
    }
	if (channel == redisChannels.fuser_add) {
        var id = JSON.parse(message);
		if (id != default_conf.bonus_id){
            requestify.post('http://' + config.web_api_data.domain + '/api/userinfo', {
                steamid: id,
                secretKey: config.web_api_data.secretKey
            }).then(function (response) {
                user = JSON.parse(response.body);
                if(user.steamid64 != default_conf.bonus_id){
                    io.sockets.emit('online_add', user);
                    users[id] = {
                        user: user,
                        ip: adress,
                        steamid: id
                    }
                }
            }, function (response) {
                console.tag('Онлайн').error('Не можем получить информацию');
            });
		}
    }
	if (channel == redisChannels.fuser_del) {
        var id = JSON.parse(message);
		if (users[id] !== undefined) {
			io.sockets.emit('online_del', users[id].user);
			delete users[id];
		}
    }	
	if (channel == redisChannels.fuser_delall) {
		for(var key in users){
			if (key == users[key].user.steamid64){
				io.sockets.emit('online_del', users[key].user);
				delete users[key];
			}
		}
    }
    if (channel == redisChannels.newDeposit) {
        io.sockets.emit(channel, message);
        message = JSON.parse(message);
		game.status = message.gameStatus;
        if (!timerStatus){
			if (message.gameStatus == 1) {
				startTimer(io.sockets);
			}
		} else {
			var addtime = Math.round(Math.round(message.betprice)/10);
			if (addtime<50){
				time = time + addtime;
			} else {
				time = time + 50;
			}
		}
    }
	if (channel == redisChannels.msgChannel){
        var mes = JSON.parse(message);
		setTimeout(function () {
            for(key in users){
                if(users[key].steamid == mes.steamid){
                    if(io.sockets.connected[key]) io.sockets.connected[key].emit('notification', message);
                }
            }
		}, 10);
		console.tag('Уведомление').info('Для: ' + mes.steamid + ' M:'+ mes.message);
    }
});

function updateInformation() {
    requestify.post('http://' + config.web_api_data.domain + '/api/update', {
        secretKey: config.web_api_data.secretKey
    }).then(function(response) {
		updateinfo = JSON.parse(response.body);
	}, function(response) {
		console.tag('Сайт').log('Ошибка [updateinfo]');
		setTimeout(updateInformation, 1000);
	});
}
/* USERS ONLINE SITE */
io.sockets.on('connection', function(socket) {
	var user = false;
	adress = socket.request.connection.remoteAddress;
	adress = adress.replace(/[^.0-9]/gim,'');
	socket.on('steamid64', function(id) {
		if (id != default_conf.bonus_id){
            requestify.post('http://' + config.web_api_data.domain + '/api/userinfo', {
                steamid: id,
                secretKey: config.web_api_data.secretKey
            }).then(function (response) {
                user = JSON.parse(response.body);
                if(user.steamid64 != default_conf.bonus_id){
                    users[socket.id] = {
                        user: user,
                        ip: adress,
                        steamid: id
                    }
                    io.sockets.emit('online_add', user);
                }
            }, function (response) {
                console.tag('Онлайн').error('Не можем получить информацию');
            });
		}
        setTimeout(function(){
            for(key in users){
                socket.emit('online_add', users[key].user);
            }
        },1000);
	});
	setTimeout(function(){
        socket.emit('update', updateinfo);
    },1000);
	socket.on('disconnect', function() {
		if (user){
			delete users[socket.id];
			h = false;
			setTimeout(function(){
				for(key in users){
					if (users[key].user.steamid64 == user.steamid64) {
						h = true;
					}
				}
				if (!h){
					io.sockets.emit('online_del', user);
				}
			},3000);
		} else {
		}
	})
});

function updateOnline(){
    io.sockets.emit('online', Object.keys(io.sockets.adapter.rooms).length);
    console.info('Connected ' + Object.keys(io.sockets.adapter.rooms).length + ' clients');
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
    console.tag('Игра').log('Игра начинается.');
    timer = setInterval(function () {
		if (time <= 0) { 
			io.sockets.emit('timer', 0);
		} else {
			io.sockets.emit('timer', time--);
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
				console.tag('Игра').log('Конец игры.');
				showSliderWinners();
			}
        }
    }, 1000);
}

function getCurrentGame() {
    requestify.post('http://' + config.web_api_data.domain + '/api/getCurrentGame', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		game = JSON.parse(response.body);
		console.tag('Игра').log('Текущая игра #' + game.id);
		if (game.status == 1) startTimer();
		if (game.status == 2) startTimer();
		if (game.status == 3) newGame();
	}, function (response) {
		console.tag('Игра').log('Ошибка [getCurrentGame]');
		setTimeout(getCurrentGame, 1000);
	});
}

function showSliderWinners() {
    requestify.post('http://' + config.web_api_data.domain + '/api/getWinners', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		var winners = response.body;
		console.tag('Игра').log('Показываем слайдер!');
		setGameStatus(3);
		startNGTimer(winners);
		updateInformation();
	}, function (response) {
		console.tag('Игра').error('Ошибка [showSlider]');
		setTimeout(showSliderWinners, 1000);
	});
}

function startNGTimer(winners) {
	ngtime = 20;
	var data = JSON.parse(winners);
	data.showSlider = true;
	clearInterval(ngtimer);
	console.tag('Игра').log('Отсчет пошел');
	ngtimer = setInterval(function() {
		ngtime = ngtime - 1;
		data.time = ngtime;
		if (ngtime <= 10) data.showSlider = false;
		io.sockets.emit('slider', data);
		if (ngtime <= 0) {
			clearInterval(ngtimer);
			newGame();
			console.tag('Игра').log('Отсчет окончен');
		}
	}, 1000);
}

function setGameStatus(status) {
    requestify.post('http://' + config.web_api_data.domain + '/api/setGameStatus', {
		status: status,
		secretKey: config.web_api_data.secretKey
	}).then(function (response) {
		sstatus = true;
		game = JSON.parse(response.body);
		console.tag('Игра').log('Статус игры изменен: ' + status);
	}, function (response) {
		console.tag('Игра').error('Something wrong [setGameStatus]');
		setTimeout(setGameStatus, 1000);
	});
}

function newGame() {
    requestify.post('http://' + config.web_api_data.domain + '/api/novigra', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		updateinfo.last = updateinfo.last + 1;
		preFinish = false;
		timerStatus = false;
		game = JSON.parse(response.body);
		console.tag('Игра').log('Новая игра! #' + game.id);
		io.sockets.emit('newGame', game);
		io.sockets.emit('update', updateinfo);
		setTimeout(function(){
            client.set('delayForNewGame', false);
		}, 3000);
	}, function (response) {
		console.tag('Игра').error('Ошибка [newGame]');
		setTimeout(newGame, 1000);
	});
}
function checkSteamInventoryStatus() {
    requestify.get('https://api.steampowered.com/ICSGOServers_730/GetGameServersStatus/v1/?key=' + config.steam.apiKey)
	.then(function (response) {
		var answer = JSON.parse(response.body);
		steamStatus = answer.result.services;
		//console.tag('SteamStatus').info(steamStatus);
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
		io.sockets.emit('status', result);
	}, function (response) {
		console.log('Ошибка - Стим недоступен [5]');
	});
}
setInterval(checkSteamInventoryStatus, 1000 * config.timers.check_steam_status);