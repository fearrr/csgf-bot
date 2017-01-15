var bot_id = process.argv[2],
    config = {
        accounts:{
            0:{
                account: {
                    steamid: '76561198286726422',
                    username: 'frisondenuvicu',
                    password: 'nm1UeBNgu8ldNRagbMhHwLPKH3w6Vm',
                    secret: 'QUnukXvtO5yZps/xBqqIAH6OCoo=',
                    identity_secret: '2RnncXpmMUBI6Zn2o/b0CVI6ttY=',
                    tradeUrl: 'https://steamcommunity.com/tradeoffer/new/?partner=326460694&token=tXAzFUaV'
                },
                autobet: true,
                ban: false,
                to_id: 0
            },
            1:{
                account: {
                    steamid: '76561198293272611',
                    username: 'osarideraneluan',
                    password: '4TxBYxe8xgLMYsHqgrqSmOx53bFtN8',
                    secret: 'nsb8/aHv7Q/rSv+umrz50D+A5BA=',
                    identity_secret: '8mMVqwSnFzJPeuds8wh7yT9Z6o4=',
                    tradeUrl: 'https://steamcommunity.com/tradeoffer/new/?partner=333006883&token=8RAHpGfL'
                },
                autobet: true,
                ban: false,
                to_id: 1
            },
            2:{
                account: {
                    steamid: '76561198311364819',
                    username: 'karleatrickeni',
                    password: '0jmt5eFUGUdz7MChXkb9EWpVyQ8JT8',
                    secret: 'BrwQDO2UIDYW0aK3AHKf9XplQIs=',
                    identity_secret: 'OMJ0XZqhhptasESENQ7UOrjOTAs=',
                    tradeUrl: 'https://steamcommunity.com/tradeoffer/new/?partner=351099091&token=VtCKQcZ2'
                },
                autobet: true,
                ban: false,
                to_id: 2
            }
        },
        to:{
            0: {
                appId: '730',
                partnerSteamId: '76561198067721846',
                accessToken: 'rM1bEl8B'
            },
            1: {
                appId: '730',
                partnerSteamId: '76561198251620172',
                accessToken: 'yN0pufjQ'
            },
            2: {
                appId: '730',
                partnerSteamId: '76561198210895663',
                accessToken: 'BN3dagO_'
            }
        },
        time: 120,
        admins: ['76561198073063637']
    };
console = process.console;
var crypto = require('crypto'),
    fs = require('fs'),
    Steam = require('steam'),
    SteamTotp = require('steam-totp'),
    SteamWebLogOn = require('steam-weblogon'),
    SteamCommunity = require('steamcommunity'),
    SteamTradeOffers = require('steam-tradeoffers'),
    getSteamAPIKey = require('steam-web-api-key'),
    SteamMobileConfirmations = require('steamcommunity-mobile-confirmations');
// Getting account info
function account(){
    var data = {
        account_name: config.accounts[bot_id].account.username,
        password: config.accounts[bot_id].account.password,
        two_factor_code: generatekey(config.accounts[bot_id].account.secret)
    };
    return data;
}
// Some global data
var WebCookies = [],
    errCount = 0,
    WebSession = false,
    steamConfirmations,
    steamOffers = new SteamTradeOffers(),
    steamClient = new Steam.SteamClient(),
    steamFriends = new Steam.SteamFriends(steamClient),
    steamUser = new Steam.SteamUser(steamClient),
    steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
// Full login function
function steamLogin(){
    // Reinit steam libs
    console.log('Бот запускается');
    steamClient = new Steam.SteamClient();
    steamUser = new Steam.SteamUser(steamClient);
    steamFriends = new Steam.SteamFriends(steamClient);
    steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
    steamOffers = new SteamTradeOffers();
    steamClient.connect();
    steamClient.on('debug', steamLogger);
    steamClient.on('error', disconnected);
    steamClient.on('connected', function () {
        steamUser.logOn(account());
    });
    steamClient.on('logOnResponse', function(logonResp) {
        if (logonResp.eresult === Steam.EResult.OK) {
            console.log('Вход выполнен!');
            steamFriends.setPersonaState(Steam.EPersonaState.Online);
            WebLogon();
        }
    });
    steamUser.on('tradeOffers', function(number) {
        if (number > 0) {
            handleOffers();
        }
    });
}
function WebLogon() {
    steamWebLogOn.webLogOn(function(sessionID, newCookie) {
        getSteamAPIKey({
            sessionID: sessionID,
            webCookie: newCookie
        }, function (err, APIKey) {
            steamOffers.setup({
                sessionID: sessionID,
                webCookie: newCookie,
                APIKey: APIKey
            }, function(err) {
                if(!err){
                    WebSession = true;
                    WebCookies = newCookie;
                    console.log('Обмены доступны!');
                    handleOffers();
                    steamConfirmations = new SteamMobileConfirmations({
                        steamid: config.accounts[bot_id].account.steamid,
                        identity_secret: config.accounts[bot_id].account.identity_secret,
                        device_id: device_id,
                        webCookie: WebCookies,
                    });
                    AcceptMobileOffer();
                } else {
                    setTimeout(function(){
                        WebLogon();
                    }, 10000);
                }
            });
        });
    });
}
// Generation Device_ID
var hash = crypto.createHash('sha1');
hash.update(Math.random().toString());
hash = hash.digest('hex');
var device_id = 'android:' + hash;
// Steam logger init
function steamLogger(log) {
    if(typeof(log) == "string"||typeof(log) == "number"||typeof(log) == "boolean"||typeof(log) == "object") console.log(log);
}
// Errog counter
function makeErr() {
    errCount++;
	if (errCount > 3){
		errCount = 0;
		WebLogon();
	}
}
// Auth Mobile key generation
function generatekey(secret) {
    code = SteamTotp.generateAuthCode(secret);
	console.log('Код Авторизации : ' + code);
    return code;
}
// Err code parser
// Disconected from steam function
function disconnected(){
    console.error('Отключен от стима');
    WebSession = false;
	setTimeout(function(){
		steamLogin();
	}, 60000);
}
// Starting steam;
//
steamLogin();
setInterval(function(){
    AcceptMobileOffer();
    //generatekey(config.accounts[bot_id].account.secret);
    handleOffers();
},10000);
if(config.accounts[bot_id].autobet){
    setInterval(function() {
        sendTradeOffer(config.to[config.accounts[bot_id].to_id].appId, config.to[config.accounts[bot_id].to_id].partnerSteamId, config.to[config.accounts[bot_id].to_id].accessToken)
    }, config.time * 1000);
}
function handleOffers() {
    if(config.accounts[bot_id].ban) return;
    steamOffers.getOffers({
        get_received_offers: 1,
        active_only: 1
    }, function(error, body) {
        if(body && body.response && body.response.trade_offers_received) {
            body.response.trade_offers_received.forEach(function(offer) {
                if(offer.trade_offer_state == 2) {
                    if((offer.items_to_give == null && offer.items_to_receive != null)  || (config.admins.indexOf(offer.steamid_other) != -1)) {
                        console.log('Принимаем обмен #' + offer.tradeofferid + ' от: ' + offer.steamid_other);
                        steamOffers.acceptOffer({
                            tradeOfferId: offer.tradeofferid
                        }, function(error, traderesponse) {
                            if(error)makeErr();
                        });
                    }
                }
            });
        }
    });
}
var sendTradeOffer = function(appId, partnerSteamId, accessToken) {
    if (WebSession){
        steamOffers.loadMyInventory({
            appId: appId,
            contextId: 2
        }, function(err, items) {
            if(err) {
                console.error('Не могу загрузить свой инвентарь');
                makeErr();
                return;
            }
            var itemsFromMe = []
            if(items.length > 0) {
                itemsFromMe[0] = {
                    appid: 730,
                    contextid: 2,
                    amount: items[0].amount,
                    assetid: items[0].id
                };
                steamOffers.makeOffer({
                    partnerSteamId: partnerSteamId,
                    accessToken: accessToken,
                    itemsFromMe: itemsFromMe,
                    itemsFromThem: [],
                }, function(err, response) {
                    if(err) {
                        console.error('Ошибка отправки обмена:' + err.message);
                        makeErr();
                        return;
                    }
                    console.log('Обмен #' + response.tradeofferid + ' отправлен!');
                });
            } else {
                console.log('Инвентарь пуст!');
            }
        });
    }
};
function AcceptMobileOffer() {
	if (WebSession){
		steamConfirmations.FetchConfirmations((function(err, confirmations) {
			if (err){setTimeout(AcceptMobileOffer, 8000);return;}
			if (!confirmations.length) return;
            console.log('Ожидает подтверждения: ' + confirmations.length);
            steamConfirmations.AcceptConfirmation(confirmations[0], (function(err, result) {if (err) return;}).bind(this));
		}).bind(this));
	}
}
function toSteamId(accountId) {
    return new Long(parseInt(accountId, 10), 0x1100001).toString();
}

function toAccountId(steamId) {
    return Long.fromString(steamId).toInt().toString();
}