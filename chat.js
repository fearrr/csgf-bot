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
    server.listen(config.ports.chat.path);
    console.log('CHAT started on ' + socket_conf.path);
} else {
    server.listen(config.ports.chat.port, socket_conf.host);
    console.log('CHAT started on ' + socket_conf.host + ':'  + config.ports.chat.port);
}


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