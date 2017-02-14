var config = require('./config/config.js'),
    requestify = require('requestify');
console = process.console;

setInterval(function(){
    requestify.post(config.web.domain + '/api/out/check', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		console.log('Пользователи проверены');
	}, function (response) {
		console.log('Ошибка [getOutNames]');
	});
}, 1000 * config.timers.give_out_timer);
setInterval(function(){
    requestify.post(config.web.domain + '/api/checkBrokenGames', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		console.log('Трейды переотправлены');
	}, function (response) {
		console.log('Ошибка [checkBroken]');
	});
}, 1000 * config.timers.checkBrokenGamesTime);
setInterval(function(){
    requestify.post(config.web.domain + '/api/gifts/check', {
        secretKey: config.web.secretKey
    }).then(function(response) {
        console.log('Отправка гифтов на обработку');
    }, function(response) {
        console.log('Не можем отправить гифты. Retry...');
    });
}, 900000);
setInterval(function(){
    requestify.post(config.web.domain + '/api/vk/checkSending', {
        secretKey: config.web.secretKey
    }).then(function(response) {
        console.log('Обработка отправки сообщений');
    }, function(response) {
        console.log('Не можем отправить сообщения. Retry...');
    });
}, 1000);