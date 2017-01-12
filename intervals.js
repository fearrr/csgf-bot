var config = require('./config/config.js'),
    requestify = require('requestify');
console = process.console;

getOutNames();
setInterval(getOutNames, 1000 * config.timers.give_out_timer);

function getOutNames() {
    requestify.post('http://' + config.web.domain + '/api/out/check', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		console.tag('Раздача').log('Пользователи проверены');
	}, function (response) {
		console.tag('Раздача').log('Ошибка [getOutNames]');
	});
}

checkBroken();
setInterval(checkBroken, 1000 * config.timers.checkBrokenGamesTime);

function checkBroken() {
    requestify.post('http://' + config.web.domain + '/api/checkBrokenGames', {
        secretKey: config.web.secretKey
    }).then(function (response) {
		console.tag('Боты').log('Трейды переотправлены');
	}, function (response) {
		console.tag('Боты').log('Ошибка [checkBroken]');
	});
}