var auth = require('http-auth'),
    scribe = require('scribe-js')(),
    console = process.console,
    config = require('./config/config.js'),
    requestify = require('requestify');

getOutNames();
setInterval(getOutNames, 1000 * config.timers.give_out_timer);

function getOutNames() {
    requestify.post('http://' + config.web_api_data.domain + '/api/out/check', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		console.tag('Раздача').log('Пользователи проверены');
	}, function (response) {
		console.tag('Раздача').log('Ошибка [getOutNames]');
	});
}