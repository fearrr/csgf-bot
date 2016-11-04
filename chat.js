var auth = require('http-auth'),
    scribe = require('scribe-js')(),
    console = process.console,
    config = require('./config/config.js'),
    app = require('express')(),
    server = require('http').Server(app),
    io = require('socket.io')(server),
    redis = require('redis'),
    requestify = require('requestify');

var redisClient = redis.createClient(),
    client = redis.createClient();

server.listen(config.ports.chatServerPort);

console.log('Chat started on ' + config.web_api_data.domain + ':' + config.ports.chatServerPort);

redisClient.setMaxListeners(0);

/* CHAT MESSGAGE */

redisClient.subscribe('chat.message');
redisClient.subscribe('new.msg');
redisClient.on("message", function (channel) {
    if (channel == 'new.msg'){
        updateChat();
    }
});
function updateChat() {
    requestify.post('http://' + config.web_api_data.domain + '/api/chat', {
        secretKey: config.web_api_data.secretKey
    }).then(function(response) {
		chat_messages = JSON.parse(response.body);
		io.sockets.emit('chat_messages', chat_messages);
	}, function(response) {
		console.tag('Чат').taf('Ошибка [getChatMessages]').log(response);
	});
}
/* CHAT MESSGAGE END */