var SteamTotp = require('steam-totp'),
    fs = require('fs'),
    SteamAuthLoad = require('node-steam-url-load'),
    config_redis = require('./config/redis.js'),
    config = require('./config/config.js'),
    requestify = require('requestify'),
    redis = require('redis');
    
console = process.console;
var UrlLoad = new SteamAuthLoad();

if(config_redis.unix){
    var redis_config = {
        'path': config_redis.path,
        'password': config_redis.password
    }
} else {
    var redis_config = {
        'host': config_redis.host,
        'port': config_redis.port
    }
}
var redisClient = redis.createClient(redis_config);

var PCount = 90;
var itemscount
function url(page){
    var start = 100 * (page - 1);
    if(start != 0) start++;
    var url = 'http://steamcommunity.com/market/search/render/?l=en&start=' + start + '&count=100&currency=5&search_descriptions=0&sort_column=price&sort_dir=asc&appid=730';
    return url;
}
function account(){
    var data = {
        account_name: '544t4t',
        password: 'i21k19Sv650817',
        two_factor_code: generatekey('32kukrOEzVI9qMV2oqPWD4TMxIk=')
    };
    return data;
}
function generatekey(secret) {
    code = SteamTotp.generateAuthCode(secret);
    return code;
}
parce();
function parce(){
    console.log('Запускаем парсер');
    UrlLoad.login(account(), function(error, session, cookie, steamguard, oauthToken) {
        if (error) {
            console.log(error);
            return;
        } else {
            var page = 1, loading = false;
            var parcer = setInterval(function(){
                if(!loading){
                    loading = true;
                    console.log('Грузим страницу: ' + page);
                    UrlLoad.loadPage(url(page), 'get', function(result) {
                        console.log('Загрузили: ' + page);
                        redisClient.rpush('parserSteam', result);
                        requestify.post(config.web.domain + '/api/parseSteam', {
                            secretKey: config.web.secretKey
                        }).then(function (response) {
                            console.log('Вещи загружены');
                            page++; loading = false;
                            if(page >= PCount){
                                page = 0;
                                clearInterval(parcer);
                                return;
                            }
                        });
                    });
                }
            }, 10000);
        }
    });
}