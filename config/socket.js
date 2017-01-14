var socket_conf = {
    host: '127.0.0.1',
    procumask: 0000,
    unix: true,
    ports:{
        deposit: {
            port: 8086,
            path: '/var/run/csgf/deposit.sock',
            gpath: function(id){
                return '/var/run/csgf/deposit_' + id + '.sock';
            }
        }
    }
}
module.exports = socket_conf;

