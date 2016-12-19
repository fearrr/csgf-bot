var fs = require('fs'),
    redis = require('redis'),
    app = require('express')(),
    server = require('http').Server(app),
    io = require('socket.io')(server),
    redis_conf = require('./config/redis.js'),
    socket_conf = require('./config/socket.js'),
    scribe = require('scribe-js')({createDefaultConsole: false}),
    console = scribe.console({console : {logInConsole: true},createBasic : false});
    
console.addLogger('notice', 'grey');
console.addLogger('info', 'cyan');
console.addLogger('log', 'white');
console.addLogger('error', 'red');
process.console = console;

if(socket_conf.unix){
    if ( fs.existsSync(socket_conf.ports.shop.path) ) { fs.unlinkSync(socket_conf.ports.shop.path); }
    process.umask(socket_conf.procumask);
    server.listen(socket_conf.ports.shop.path);
    console.log('SHOP_IO started on ' + socket_conf.ports.shop.path);
} else {
    server.listen(socket_conf.ports.shop.port, socket_conf.host);
    console.log('SHOP_IO started on ' + socket_conf.host + ':'  + socket_conf.ports.shop.port);
}

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

var rediClient = redis.createClient(redis_config);

setTimeout(rediSubscribe, 1000);
function rediSubscribe() {
	rediClient.subscribe('addShop');
	rediClient.subscribe('delShop');
	rediClient.setMaxListeners(0);
	rediClient.on("message", function (channel, message) {
        io.sockets.emit(channel, message);
	});
}
