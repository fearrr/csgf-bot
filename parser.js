var SteamTotp = require('steam-totp'),
    fs = require('fs'),
    SteamAuthLoad = require('node-steam-url-load'),
    scribe = require('scribe-js')(),
    console = process.console,
    redis_conf = require('./config/redis.js'),
    config = require('./config/config.js'),
    sleep = require('sleep'),
    requestify = require('requestify'),
    redis = require('redis');
    
var UrlLoad = new SteamAuthLoad();

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

var PCount = 15;
var itemscount
function url(page){
    var start = 100 * (page - 1);
    if(start != 0) start++;
    var url = 'http://steamcommunity.com/market/search/render/?l=en&start=' + start + '&count=100&currency=5&search_descriptions=0&sort_column=price&sort_dir=asc&appid=730';
    return url;
}

var account = {
    username: '544t4t',
    password: 'i21k19Sv650817'
}
function generatekey(secret) {
    code = SteamTotp.generateAuthCode(secret);
    return code;
}
parce();
setInterval(function(){
    parce();
}, 3*60*60*1000);
function parce(){
    UrlLoad.login({
        accountName: account.username,
        password: account.password,
        twoFactorCode: generatekey('32kukrOEzVI9qMV2oqPWD4TMxIk=')
    }, function(error, session, cookie, steamguard, oauthToken) {
        if (error) {
            console.tag('Парсер').log(error);
            return;
        } else {
            var page = 1, loading = false;
            var parcer = setInterval(function(){
                if(!loading){
                    loading = true;
                    console.tag('Парсер').log('Грузим страницу: ' + page);
                    UrlLoad.loadPage(url(page), function(result) {
                        console.tag('Парсер').log('Загрузили: ' + page);
                        redisClient.rpush('parserSteam', result);
                        //fs.writeFile('page'+page, result);
                        requestify.post('http://' + config.web_api_data.domain + '/api/parseSteam', {
                            secretKey: config.web_api_data.secretKey
                        }).then(function (response) {
                            console.tag('Парсер').log('Вещи загружены');
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