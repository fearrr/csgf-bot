/*
Redis Config file
*/
var socket_conf = {
    host: '127.0.0.1',
    procumask: 0007,
    unix: true,
    ports:{
        app:{
            port: 8081,
            path: '/var/run/csgf/app.sock'
        },
        double:{
            port: 8082,
            path: '/var/run/csgf/double.sock'
        },
        chat:{
            port: 8083,
            path: '/var/run/csgf/chat.sock'
        },
        shop:{
            port: 8084,
            path: '/var/run/csgf/shop.sock'
        },
        bot:{
            port: 8085,
            path: '/var/run/csgf/bot.sock'
        },
        deposit: {
            port: 8086,
            path: '/var/run/csgf/deposit.sock'
        }
    }
}
module.exports = socket_conf;

