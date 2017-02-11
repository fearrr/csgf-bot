var config = require('./config/config.js'),
    requestify = require('requestify');
console = process.console;
getOutNames();
setInterval(getOutNames, 1000 * config.timers.give_out_timer);
function getOutNames() {
    requestify.post(config.web.domain + '/api/out/check', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		console.log('Пользователи проверены');
	}, function (response) {
		console.log('Ошибка [getOutNames]');
	});
}

checkBroken();
setInterval(checkBroken, 1000 * config.timers.checkBrokenGamesTime);

function checkBroken() {
    requestify.post(config.web.domain + '/api/checkBrokenGames', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		console.log('Трейды переотправлены');
	}, function (response) {
		console.log('Ошибка [checkBroken]');
	});
}

setInterval(function(){
    requestify.post(config.web.domain + '/api/gifts/check', {
        secretKey: config.web.secretKey
    }).then(function(response) {
        console.log('Отправка гифтов на обработку');
    }, function(response) {
        console.log('Не можем отправить гифты. Retry...');
    });
}, 900000);