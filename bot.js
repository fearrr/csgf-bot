var bot_id = process.argv[2],
    config = require('./config/config.js'),
    config_redis = require('./config/redis.js'),
    scribe = require('scribe-js')({createDefaultConsole: false}),
    console = scribe.console({console : {logInConsole: true},createBasic : false});
const redisChannels = config_redis.channels.bot.getChannels(bot_id);
console.addLogger('notice', 'grey');
console.addLogger('info', 'cyan');
console.addLogger('log', 'white');
console.addLogger('error', 'red');
process.console = console;
var requestify = require('requestify'),
    crypto = require('crypto'),
    redis = require('redis'),
    fs = require('fs'),
    Steam = require('steam'),
    SteamTotp = require('steam-totp'),
    SteamWebLogOn = require('steam-weblogon'),
    SteamCommunity = require('steamcommunity'),
    SteamTradeOffers = require('steam-tradeoffers'),
    getSteamAPIKey = require('steam-web-api-key'),
    SteamMobileConfirmations = require('steamcommunity-mobile-confirmations');
// Openning redis connection
if(config_redis.unix){
    var redis_config = {
        'path': config_redis.path,
        'password': config_redis.password
    }
} else {
    var redis_config = {
        'host': config_redis.host,
        'port': config_redis.port,
        'password': config_redis.password
    }
}
var redisClient = redis.createClient(redis_config);
// Getting account info
function account(){
    var data = {
        account_name: config.accounts.classic[bot_id].username,
        password: config.accounts.classic[bot_id].password,
        two_factor_code: generatekey(config.accounts.classic[bot_id].secret)
    };
    return data;
}
// Some global data
var checkingOffers = [],
    checkArrGlobal = [],
    WebCookies = [],
    errCount = 0,
    parseItemsProcceed = false,
    delayForNewGame = false,
    checkedProcceed = false,
    declineProcceed = false,
    checkProcceed = false,
    betsProcceed = false,
    sendProcceed = false,
    WebSession = false,
    MobileConf = false,
    handleOff = false,
    steamConfirmations,
    steamOffers = new SteamTradeOffers(),
    steamClient = new Steam.SteamClient(),
    steamFriends = new Steam.SteamFriends(steamClient),
    steamUser = new Steam.SteamUser(steamClient),
    steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
// Full login function
function steamLogin(){
    // Reinit steam libs
    console.tag('Бот #' + bot_id).info('Бот запускается');
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
            steamLogger('Вход выполнен!');
            steamFriends.setPersonaState(Steam.EPersonaState.Online);
            WebLogon();
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
                    steamLogger('Обмены доступны!');
                    handleOffers();
                    steamConfirmations = new SteamMobileConfirmations({
                        steamid: config.accounts.classic[bot_id].steamid,
                        identity_secret: config.accounts.classic[bot_id].identity_secret,
                        device_id: device_id,
                        webCookie: WebCookies,
                    });
                    //AcceptMobileOffer();
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
    if(typeof(log) == "string"||typeof(log) == "number"||typeof(log) == "boolean"||typeof(log) == "object") console.tag('Бот #' + bot_id).log(log);
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
	steamLogger('Код Авторизации : ' + code);
    return code;
}
// Err code parser
function getErrorCode(err, callback) {
    var errCode = 0;
    var match = err.match(/\(([^()]*)\)/);
    if (match != null && match.length == 2) errCode = match[1];
    callback(errCode);
}
// Disconected from steam function
function disconnected(){
    console.tag('Бот #' + bot_id).error('Отключен от стима');
    WebSession = false;
	setTimeout(function(){
		steamLogin();
	}, 60000);
}
// Starting steam;
//
steamLogin();
steamUser.on('tradeOffers', function(number) {
    if (number > 0) {
        handleOffers();
    }
});
var Queue = setInterval(function(){queueProceed()}, 3000),
    aOfrs = setInterval(function(){AcceptMobileOffer()}, 15000);
//
// Queue Interval
//
var queueProceed = function() {
    redisClient.llen(redisChannels.checkList, function(err, length) {
        if (length > 0 && !checkProcceed) {
            console.tag('Бот #' + bot_id).notice('Трейдов ожидают проверки: ' + length);
            checkProcceed = true;
            checkOfferPrice();
        }
    });
    redisClient.llen(redisChannels.checkedList, function(err, length) {
        if (length > 0 && !checkedProcceed && WebSession) {
            console.tag('Бот #' + bot_id).notice('Трейдов ожидают принятия: ' + length);
            checkedProcceed = true;
            redisClient.lindex(redisChannels.checkedList, 0, function(err, offer) {
                checkedOffersProcceed(offer);
            });
        }
    });
    redisClient.llen(redisChannels.declineList, function(err, length) {
        if (length > 0 && !declineProcceed && WebSession) {
            console.tag('Бот #' + bot_id).notice('Трейдов ожидают отмены: ' + length);
            declineProcceed = true;
            redisClient.lindex(redisChannels.declineList, 0, function(err, offer) {
                declineOffersProcceed(offer);
            });
        }
    });
    redisClient.llen(redisChannels.sendOffersList, function(err, length) {
        if (length > 0 && !sendProcceed) {
            console.tag('Бот #' + bot_id).notice('Трейдов ожидают отправки: ' + length);
			if (WebSession){
				sendProcceed = true;
				redisClient.lindex(redisChannels.sendOffersList, 0, function(err, offerJson) {
                    redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
                        sendTradeOffer(offerJson);
                    });
				});
			} else {
				redisClient.lindex(redisChannels.sendOffersList, 0, function(err, offerJson) {
					offer = JSON.parse(offerJson);
                    console.tag('Бот #' + bot_id).error('Ошибка отправки: ' + offer.game + ' Сессия со стимом не установлен!');
					redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
						if (offer.game > 0){
							setPrizeStatus(offer.game, 2);
						}
					});
				});
			}
        }
    });
    redisClient.llen(redisChannels.checkItemsList, function(err, length) {
        if (length > 0 && !parseItemsProcceed && WebSession) {
            console.tag('Бот #' + bot_id).notice('Трейдов ожидают парсинга: ' + length);
            parseItemsProcceed = true;
            redisClient.lindex(redisChannels.checkItemsList, 0, function(err, offerJson) {
                offer = JSON.parse(offerJson);
                parseOffer(offer, offerJson);
            });
        }
    });
}
//
// functions
function handleOffers() {
    if (WebSession && !handleOff){
        handleOff = true;
        steamOffers.getOffers({
            get_received_offers: 1,
            active_only: 1
        }, function(error, body) {
            if (!body){makeErr();handleOff=false;return;}
            if (!body.response){makeErr();return;}
            if (!body.response.trade_offers_received){makeErr();handleOff=false;return;}
            body.response.trade_offers_received.forEach(function(offer) {
                if (offer.trade_offer_state != 2){handleOff=false;return;}
                if (is_checkingOfferExists(offer.tradeofferid)){handleOff=false;return;}
                if (offer.items_to_give != null && config.admins.indexOf(offer.steamid_other) != -1) {
                    try {
                        console.tag('Бот #' + bot_id).notice('Обрабатываем обмен #' + offer.tradeofferid + ' От: ' + offer.steamid_other + ' Без проверок');
                        steamOffers.acceptOffer({
                            tradeOfferId: offer.tradeofferid
                        }, function(err, body) {
                            if (err) {
                                makeErr();
                                console.tag('Бот #' + bot_id).error('Ошибка при принятии обмена #' + offer.tradeofferid);
                            }
                        });
                    } catch (ex) {
                        makeErr();
                        console.tag('Бот #' + bot_id).error('Ошибка при принятии обмена #' + offer.tradeofferid);
                    }
                    handleOff=false;
                    return;
                }
                if (offer.items_to_give != null) {
                    steamOffers.declineOffer({tradeOfferId: offer.tradeofferid});
                    handleOff=false;
                    return;
                }
                steamOffers.getTradeHoldDuration({
                    tradeOfferId: offer.tradeofferid
                }, function(err, response) {
                    if (err) {
                        makeErr();
                        console.tag('Бот #' + bot_id).error('Ошибка проверки на задержку: #' + offer.tradeofferid);
                        handleOff=false;
                        return;
                    } else if (response.their != 0) {
                        steamOffers.declineOffer({tradeOfferId: offer.tradeofferid});
                        console.tag('Бот #' + bot_id).notice('Трейд отменен из за задержки: #' + offer.tradeofferid);
                        handleOff=false;
                        return;
                    }
                    if (offer.items_to_receive != null && offer.items_to_give == null) {
                        checkingOffers.push(offer.tradeofferid);
                        console.tag('Бот #' + bot_id).notice('Обмен обработан #' + offer.tradeofferid + ' От: ' + offer.steamid_other);
                        redisClient.multi([
                            ['rpush', redisChannels.tradeoffersList, offer.tradeofferid],
                            ['rpush', redisChannels.checkItemsList, JSON.stringify(offer)],
                            ['rpush', redisChannels.usersQueue, offer.steamid_other]
                        ]).exec(function(err, replies) {
                            handleOff=false;
                            return;
                        });
                    }
                });
            });
        });
    }
}
var parseOffer = function(offer, offerJson) {
    steamOffers.loadPartnerInventory({
        partnerSteamId: offer.steamid_other,
        appId: 730,
        contextId: 2,
        tradeOfferId: offer.tradeofferid,
        language: "russian"
    }, function(err, hitems) {
        if (err || hitems === 'undefined') {
            redisClient.multi([
                ['rpush', redisChannels.declineList, offer.tradeofferid],
                ['lrem', redisChannels.checkItemsList, 0, offerJson],
                ['lrem', redisChannels.usersQueue, 1, offer.steamid_other]
            ]).exec(function(err, replies) {
                parseItemsProcceed = false;
                return;
            });
        }
        var items = offer.items_to_receive;
        var items_to_check = [],
            num = 0;
        for (var i = 0; i < items.length; i++) {
            for (var j = 0; j < hitems.length; j++) {
                if (items[i].assetid == hitems[j].id) {
                    items_to_check[num] = {
                        appid: hitems[j].appid,
                        name: hitems[j].market_name,
                        market_hash_name: hitems[j].market_hash_name,
                        classid: hitems[j].classid
                    };
                    var type = hitems[j].type;
                    var rarity = '';
                    var arr = type.split(',');
                    if (arr.length == 2) type = arr[1].trim();
                    if (arr.length == 3) type = arr[2].trim();
                    if (arr.length && arr[0] == 'Нож') type = '★';
                    switch (type) {
                        case 'Армейское качество':
                            rarity = 'milspec';
                            break;
                        case 'Запрещенное':
                            rarity = 'restricted';
                            break;
                        case 'Засекреченное':
                            rarity = 'classified';
                            break;
                        case 'Тайное':
                            rarity = 'covert';
                            break;
                        case 'Ширпотреб':
                            rarity = 'common';
                            break;
                        case 'Промышленное качество':
                            rarity = 'common';
                            break;
                        case '★':
                            rarity = 'rare';
                            break;
                    }
                    items_to_check[num].rarity = rarity;
                    num++;
                    break;
                }
            }
        }
        var value = {
            offerid: offer.tradeofferid,
            accountid: offer.steamid_other,
			message: offer.message,
            items: JSON.stringify(items_to_check)
        };
        console.tag('Бот #' + bot_id).notice('Обмен прогружен #' + offer.tradeofferid + ' От: ' + offer.steamid_other);
        redisClient.multi([
			['rpush', redisChannels.checkList, JSON.stringify(value)],
			['lrem', redisChannels.checkItemsList, 0, offerJson]
		]).exec(function(err, replies) {
			parseItemsProcceed = false;
		});
    });
}
var sendTradeOffer = function(offerJson) {
    var offer = JSON.parse(offerJson);
    if (offer.game > 0){
        console.tag('Бот #' + bot_id).info('Отправка выигрыша из игры #' + offer.game + ' Для ' + offer.steamid);
    } else {
        console.tag('Бот #' + bot_id).info('Отправка комиссии в магазин');
    }
	//try {

        var sentItems = [];
		steamOffers.getOffers({
			get_sent_offers: 1,
			active_only : 1
		}, function(error, body) {
			if (!error && body && body.response && body.response.trade_offers_sent) {
				body.response.trade_offers_sent.forEach(function(offer) {
					if (offer.trade_offer_state == 2 || offer.trade_offer_state == 9 ) {
                        if (offer.items_to_give != null){
                            var items = offer.items_to_give;
                            for (var i = 0; i < items.length; i++) {
                                sentItems.push(items[i].assetid);
                            }
                        }
					}
				});
			} else {
                console.tag('Бот #' + bot_id).error('Не могу получить отправленные предметы');
                setPrizeStatus(offer.game, 2);
                sendProcceed = false;
                return;
            }
		});
		steamOffers.loadMyInventory({
			appId: offer.appId,
			contextId: 2
		}, function(err, items) {
			if (err) {
                makeErr();
                console.tag('Бот #' + bot_id).error('Не могу загрузить свой инвентарь');
				sendProcceed = false;
				return;
			}
			var itemsFromMe = [], checkArr = [], num = 0, i = 0;
            // itm sel (will be changed)
			for (var i = 0; i < offer.items.length; i++) {
				for (var j = 0; j < items.length; j++) {
					if (items[j].tradable && (items[j].classid == offer.items[i])) {
						if ((sentItems.indexOf(items[j].id) == -1) && (checkArr.indexOf(items[j].id) == -1) && (checkArrGlobal.indexOf(items[j].id) == -1)) {
							checkArr[i] = items[j].id;
							itemsFromMe[num] = {
								appid: offer.appId,
								contextid: 2,
								amount: items[j].amount,
								assetid: items[j].id
							};
							num++;
							break;
						}
					}
				}
			}
			if (num > 0) {
				steamOffers.makeOffer({
					partnerSteamId: offer.steamid,
					accessToken: offer.accessToken,
					itemsFromMe: itemsFromMe,
					itemsFromThem: [],
					message: 'Поздравляем с победой на сайте ' + config.web.nameSite + ' | В игре #' + offer.game + ' | С уважением, Администрация проекта'
				}, function(err, response) {
					if (err) {
						console.tag('Бот #' + bot_id).error('Ошибка отправки обмена: ' + err.message);
						getErrorCode(err.message, function(errCode) {
							if (errCode == 15 || errCode == 25 || err.message.indexOf('an error sending your trade offer.  Please try again later.')) {
								redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
									if (offer.game > 0){
										setPrizeStatus(offer.game, 2);
									}
								});
							}
						});
                        sendProcceed = false;
						return;
					}
					checkArrGlobal = checkArrGlobal.concat(checkArr);
					redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
						if (offer.game > 0){
                           setPrizeStatus(offer.game, 1); 
                        }
						sendProcceed = false;
					});
					console.tag('Бот #' + bot_id).info('Обмен #' + response.tradeofferid + ' отправлен!');
                    //AcceptMobileOffer();
				});
			} else {
				console.tag('Бот #' + bot_id).notice('Нечего отправлять!');
				redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
					if (offer.game > 0){
                        setPrizeStatus(offer.game, 1);
                    }
					sendProcceed = false;
				});
			}
		});
	/*} catch (ex) {
        console.tag('Бот #' + bot_id).error('Ошибка отправки обмена! Игра №' + offer.game);
        if (offer.game > 0){
            setPrizeStatus(offer.game, 2);
        }
		sendProcceed = false;
	}*/
};
var checkedOffersProcceed = function(offerJson) {
    var offer = JSON.parse(offerJson);
    if (offer.success) {
        console.tag('Бот #' + bot_id).info('Принимаем обмен: #' + offer.offerid);
        steamOffers.acceptOffer({
            tradeOfferId: offer.offerid
        }, function(err, body) {
            if (!err) {
                redisClient.multi([
					["lrem", redisChannels.tradeoffersList, 0, offer.offerid],
					["lrem", redisChannels.usersQueue, 1, offer.steamid64],
					["rpush", redisChannels.betsList, offerJson],
					["lrem", redisChannels.checkedList, 0, offerJson]
				]).exec(function(err, replies) {
                    console.tag('Бот #' + bot_id).info("Новая ставка! Обмен #" + offer.offerid);
                    checkedProcceed = false;
				});
            } else {
                console.tag('Бот #' + bot_id).error('Первичная ошибка проверки обмена : #' + offer.offerid);
				setTimeout(function(){
					steamOffers.getOffer({
						tradeOfferId: offer.offerid
					}, function(err, body) {
                        if(body && body.response && body.response.offer){
                            var offerCheck = body.response.offer;
                            if (offerCheck.trade_offer_state == 2) {
                                checkedProcceed = false;
                                console.tag('Бот #' + bot_id).info("Обмен #" + offer.offerid + ' активен');
                                return;
                            }
                            if (offerCheck.trade_offer_state == 3) {
                                redisClient.multi([
                                    ["lrem", redisChannels.tradeoffersList, 0, offer.offerid],
                                    ["lrem", redisChannels.usersQueue, 1, offer.steamid64],
                                    ["rpush", redisChannels.betsList, offerJson],
                                    ["lrem", redisChannels.checkedList, 0, offerJson]
                                ]).exec(function(err, replies) {checkedProcceed = false;});
                            } else {
                                console.tag('Бот #' + bot_id).info("Обмен #" + offer.offerid + ' не действителен');
                                redisClient.multi([
                                    ["lrem", redisChannels.tradeoffersList, 0, offer.offerid],
                                    ["lrem", redisChannels.usersQueue, 1, offer.steamid64],
                                    ["lrem", redisChannels.checkedList, 0, offerJson]
                                ]).exec(function(err, replies) {checkedProcceed = false;});
                            }
                        }
					});
				}, 5000);
            }
        });
    }
}
var declineOffersProcceed = function(offerid) {
    console.tag('Бот #' + bot_id).info('Отклоняем обмен: #' + offerid);
    steamOffers.declineOffer({
        tradeOfferId: offerid
    }, function(err, body) {
        if (!err) {
            console.tag('Бот #' + bot_id).info('Обмен #' + offerid + ' Отклонен!');
            redisClient.lrem(redisChannels.declineList, 0, offerid);
            declineProcceed = false;
        } else {
            makeErr();
            console.tag('Бот #' + bot_id).error('Ошибка. Не можем отклонить обмен #' + offerid);
            declineProcceed = false;
        }
    });
}
function AcceptMobileOffer() {
	if (WebSession){
        //if(!MobileConf){
            //MobileConf = true;
            steamConfirmations.FetchConfirmations((function(err, confirmations) {
                if (err){
                    //MobileConf = false;
                    return;
                }
                if (!confirmations.length){
                    //MobileConf = false;
                    return;
                }
                console.tag('Бот #' + bot_id).info('Ожидает подтверждения: ' + confirmations.length);
                steamConfirmations.AcceptConfirmation(confirmations[0], (function(err, result) {
                    //MobileConf = false;
                }).bind(this));
            }).bind(this));
        }
    }
}
var is_checkingOfferExists = function(tradeofferid) {
    for (var i = 0, len = checkingOffers.length; i < len; ++i) {
        var offer = checkingOffers[i];
        if (offer == tradeofferid) {
            return true;
            break;
        }
    }
    return false;
}
// Requests
var setPrizeStatus = function(game, status) {
    //console.tag('Бот #' + bot_id).log(game,status,bot_id);
    requestify.post('http://' + config.web.domain + '/api/setPrizeStatus', {
        secretKey: config.web.secretKey,
        game: game,
        status: status,
        botid: bot_id
    }).then(function(response) {}, function(response) {
        console.tag('Бот #' + bot_id).error('Не можем установить статус отправки. Повторяем...');
        setTimeout(function() {
            setPrizeStatus(game, status)
        }, 1000);
    });
}
var checkOfferPrice = function() {
    requestify.post('http://' + config.web.domain + '/api/checkOffer', {
        secretKey: config.web.secretKey,
        botid: bot_id
    }).then(function(response) {
        var answer = JSON.parse(response.body);
        if (answer.success) {
            checkProcceed = false;
        }
    }, function(response) {
        console.tag('Бот #' + bot_id).error('Не можем проверить обмен. Retry...');
        setTimeout(function() {
            checkOfferPrice()
        }, 1000);
    });
}