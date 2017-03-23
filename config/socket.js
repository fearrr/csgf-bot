var socket_conf = {
    host: null,
    procumask: 0007,
    unix: true,
    ports:{
        deposit: {
            port: null,
            path: '/srv/csgf/web/storage/app/deposit.sock',
            gpath: function(id){
                return '/srv/csgf/web/storage/app/deposit_' + id + '.sock';
            }
        }
    }
}
module.exports = socket_conf;

