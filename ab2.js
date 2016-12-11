/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~####~~##~~##~~####~~##~~##~######~##~~##~~####~~
~##~~~~~##~##~~##~~##~###~##~~~##~~~##~##~~##~~~~~
~~####~~####~~~##~~##~##~###~~~##~~~####~~~~####~~
~~~~~##~##~##~~##~~##~##~~##~~~##~~~##~##~~~~~~##~
~~####~~##~~##~~####~~##~~##~######~##~~##~~####~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~####~~##~~##~######~~####~~#####~~~####~~######~
~##~~##~##~~##~~~##~~~##~~##~##~~##~##~~##~~~##~~~
~######~##~~##~~~##~~~##~~##~#####~~##~~##~~~##~~~
~##~~##~##~~##~~~##~~~##~~##~##~~##~##~~##~~~##~~~
~##~~##~~####~~~~##~~~~####~~#####~~~####~~~~##~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
| Created: 04.11.2016 |  V.1.0  | vk.com/skoniks |
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var crypto = require('crypto'),
    Steam = require('steam'),
    auth = require('http-auth'),
    scribe = require('scribe-js')(),
    console = process.console,
    SteamWebLogOn = require('steam-weblogon'),
    getSteamAPIKey = require('steam-web-api-key'),
    SteamTradeOffers = require('steam-tradeoffers'),
    SteamCommunity = require('steamcommunity'),
    SteamcommunityMobileConfirmations = require('steamcommunity-mobile-confirmations'),
    SteamTotp = require('steam-totp');

/*  ----------------------------------------------------------
    Для использования данного скрипта нужно установить NODE.JS
    Скачать его можно тут: https://nodejs.org/en/download/ 
    ----------------------------------------------------------
    Особенности и возможности: 
    - Автоматическая отправка предметов из ивенторя если они
        есть через определенные промежутки времени
    - При отключении от стима бот сам переподключается или
        перезагружается при многочисленных ошибках
    - Бот стабилен, доказано тестами.
    --------------------------------------------------------*/
    
var config = {
    bot: { // Данные бота
        /*steamid: '76561198251620172',                       // Steamid64 вашего аккаунта (можно получить на https://steamid.xyz/)
        username: 'sotkadowvt',                                 // Логин в стим
        password: 'i21k19Sv650817',                         // Пароль (если боитесь можете не вводить, если это канешно не оригинальный софт от SKONIKS`a и получен он не прямо от него)
        secret: '02hSwEw9JnvijXES4wtmO1TbvnY=',             // Можно узнать в телефоне с рутом или при покупке аккаунта
        identity_secret: 'K6Sq8poaDAZxiXTysLpLVfg/3iU='     // Можно узнать в телефоне с рутом или при покупке аккаунта
        */
        steamid: '76561198310237081',
        username: 'amadilesperish',
        password: 'Y7gbvupmkK1LT3ibfkkTVcEiELXW8g',
        secret: '4IaBxnrTReGBWj0Tf3m/CPTqFKo=',
        identity_secret: 'FQH5RgJKHNOoJ4QHJ9A12cwglBY='
    },
    to: { //Кому отправлять
        appId: '730',                            // ID приложения в стиме от которого берутся вещи (730 - CSGO) можно узнать в стиме
        partnerSteamId: '76561198251620172',     // Steamid64 Того кому отправляем (можно получить на https://steamid.xyz/)
        accessToken: 'yN0pufjQ'                  // Возьмете из трейд ссылки (https://steam.../new/?partner=179583356&token=Dr9suBpB - token=Dr9suBpB)
    },
    time: 60, //Время в секундах между отправкой обменов
    admins: [ //Принимает любые обмены от них (лучше прописать себя чтобы забирать вещи на ключенном боте!)
        '76561198073063637'
    ]
}
var details = {
    account_name: config.bot.username,
    password: config.bot.password,
    two_factor_code: generatekey(config.bot.secret)
};
var steamClient = new Steam.SteamClient();
var steamUser = new Steam.SteamUser(steamClient);
var steamFriends = new Steam.SteamFriends(steamClient);
var steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
var offers = new SteamTradeOffers();
// Generation Device_ID
var hash = crypto.createHash('sha1');
hash.update(Math.random().toString());
hash = hash.digest('hex');
var device_id = 'android:' + hash;
var checkingOffers = [],
    WebCookies = [],
    WebSession = false,
    globalSession;

function AutoBotLogger(log) {
    console.tag('Автобот').log(log);
}

function generatekey(secret) {
    code = SteamTotp.generateAuthCode(secret);
    AutoBotLogger('Код Авторизации : ' + code);
    return code;
}
var errCount = 0;
function makeErr() {
    errCount++;
	if (errCount > 3){
		errCount = 0;
		reWebLogon();
	}
}
function disconnected(){
    AutoBotLogger('Отключен от стима');
    WebSession = false;
	setTimeout(function(){
		steamClient = new Steam.SteamClient();
		steamUser = new Steam.SteamUser(steamClient);
		steamFriends = new Steam.SteamFriends(steamClient);
		steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
		offers = new SteamTradeOffers();
		steamClient.connect();
	}, 60000);
}
steamClient.connect();
steamClient.on('debug', AutoBotLogger);
steamClient.on('error', disconnected);
steamClient.on('connected', function() {
    steamUser.logOn(details);
});
steamClient.on('logOnResponse', function(logonResp) {
    if(logonResp.eresult === Steam.EResult.OK) {
        AutoBotLogger('Вход выполнен!');
        steamFriends.setPersonaState(Steam.EPersonaState.Online);
        steamWebLogOn.webLogOn(function(sessionID, newCookie) {
            getSteamAPIKey({
                sessionID: sessionID,
                webCookie: newCookie
            }, function(err, APIKey) {
                offers.setup({
                    sessionID: sessionID,
                    webCookie: newCookie,
                    APIKey: APIKey
                }, function(err) {
                    WebSession = true;
                    globalSession = sessionID;
                    WebCookies = newCookie;
                    handleOffers();
                    setTimeout(AcceptMobileOffer, 5000);
                    AutoBotLogger('Обмены доступны!');
                });
            });
        });
    }
});

function reWebLogon() {
    steamWebLogOn.webLogOn(function(sessionID, newCookie) {
        getSteamAPIKey({
            sessionID: sessionID,
            webCookie: newCookie
        }, function(err, APIKey) {
            offers.setup({
                sessionID: sessionID,
                webCookie: newCookie,
                APIKey: APIKey
            }, function(err) {
                if(err){makeErr()} else {
                    WebSession = true;
                    globalSession = sessionID;
                    WebCookies = newCookie;
                    AutoBotLogger('Сессия перезагружена !');
                }
            });
        });
    });
}

function handleOffers() {
    offers.getOffers({
        get_received_offers: 1,
        active_only: 1
    }, function(error, body) {
        if(body && body.response && body.response.trade_offers_received) {
            body.response.trade_offers_received.forEach(function(offer) {
                if(offer.trade_offer_state == 2) {
                    if((config.admins.indexOf(offer.steamid_other) != -1) || (offer.items_to_give == null && offer.items_to_receive != null)) {
                        AutoBotLogger('Принимаем обмен #' + offer.tradeofferid + ' от: ' + offer.steamid_other);
                        offers.acceptOffer({
                            tradeOfferId: offer.tradeofferid
                        }, function(error, traderesponse) {
                            if(error)makeErr();
                        });
                    } else {
                        offers.declineOffer({
                            tradeOfferId: offer.tradeofferid
                        });
                    }
                }
            });
        }
    });
}
steamUser.on('tradeOffers', function(number) {
    AutoBotLogger('Предложений обмена: ' + number);
    if(number > 0) {
        handleOffers();
    }
});
var sendTradeOffer = function(appId, partnerSteamId, accessToken) {
    try {
        offers.loadMyInventory({
            appId: appId,
            contextId: 2
        }, function(err, items) {
            if(err) {
                AutoBotLogger(err);
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
                offers.makeOffer({
                    partnerSteamId: partnerSteamId,
                    accessToken: accessToken,
                    itemsFromMe: itemsFromMe,
                    itemsFromThem: [],
                }, function(err, response) {
                    if(err) {
                        AutoBotLogger('Ошибка отправки обмена:' + err.message);
                        makeErr();
                        return;
                    }
                    AutoBotLogger('Обмен #' + response.tradeofferid + ' отправлен!');
                });
            } else {
                AutoBotLogger('Инвентарь пуст!');
            }
        });
        setTimeout(AcceptMobileOffer, 5000);
    } catch(ex) {
        AutoBotLogger('Не можем отправить обмен');
    }
};

function AcceptMobileOffer() {
    if(WebSession) {
        // Информация для мобильных подтверждений
        var steamcommunityMobileConfirmations = new SteamcommunityMobileConfirmations({
            steamid: config.bot.steamid,
            identity_secret: config.bot.identity_secret,
            device_id: device_id,
            webCookie: WebCookies,
        });
        steamcommunityMobileConfirmations.FetchConfirmations((function(err, confirmations) {
            if(err) {
                //AutoBotLogger(err);
                //reWebLogonBot();
                return;
            }
            if(!confirmations.length) {
                return;
            } else {
                AutoBotLogger('Ожидает подтверждения: ' + confirmations.length);
                steamcommunityMobileConfirmations.AcceptConfirmation(confirmations[0], (function(err, result) {
                    if(err) {
                        //AutoBotLogger(err);
                        return;
                    }
                }).bind(this));
            }
        }).bind(this));
    }
}
setInterval(AcceptMobileOffer, 10000);
setInterval(function() {
    sendTradeOffer(config.to.appId, config.to.partnerSteamId, config.to.accessToken)
}, config.time * 1000);