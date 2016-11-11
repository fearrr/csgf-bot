var auth = require('http-auth'),
    scribe = require('scribe-js')(),
    console = process.console,
    app = require('express')(),
    server = require('http').Server(app),
    io = require('socket.io')(server),
    fs = require('fs'),
    crypto = require('crypto'),
    config = require('./config/config.js'),
    redis_conf = require('./config/redis.js'),
    Steam = require('steam'),
    SteamWebLogOn = require('steam-weblogon'),
    getSteamAPIKey = require('steam-web-api-key'),
    SteamTradeOffers = require('steam-tradeoffers'),
    SteamCommunity = require('steamcommunity'),
    SteamcommunityMobileConfirmations = require('steamcommunity-mobile-confirmations'),
    SteamTotp = require('steam-totp'),
    redis = require('redis'),
    requestify = require('requestify');

server.listen(config.ports.botServerPort);

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

var redisClient = redis.createClient(redis_config),
    rediClient = redis.createClient(redis_config);

var details = {
    account_name: config.bots.game_bots.game_bot.username,
    password: config.bots.game_bots.game_bot.password,
    two_factor_code: generatekey(config.bots.game_bots.game_bot.secret)
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

const redisChannels = redis_conf.Bot_Channels;

function steamBotLogger(log) {
    if(typeof(log) == "string"||typeof(log) == "number"||typeof(log) == "boolean"||typeof(log) == "object") console.tag('Бот').log(log);
}
function makeErr() {
    errCount++;
	if (errCount > 3){
		errCount = 0;
		reWebLogonShop();
	}
}

function generatekey(secret) {
    code = SteamTotp.generateAuthCode(secret);
    steamBotLogger('Код Авторизации : ' + code);
    return code;
}
function disconnected(){
    steamBotLogger('Отключен от стима');
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
steamClient.on('debug', steamBotLogger);
steamClient.on('error', disconnected);
steamClient.on('connected', function() {
    steamUser.logOn(details);
});
steamClient.on('logOnResponse', function(logonResp) {
    if (logonResp.eresult === Steam.EResult.OK) {
        steamBotLogger('Вход выполнен!');
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
                    redisClient.lrange(redisChannels.tradeoffersList, 0, -1, function(err, offers) {
                        offers.forEach(function(offer) {
                            checkingOffers.push(offer);
                        });
                        handleOffers();
						setTimeout(AcceptMobileOffer, 5000);
                    });
                    steamBotLogger('Обмены доступны!');
                });

            });
        });
    }
});

function reWebLogonBot() {
    steamWebLogOn.webLogOn(function (sessionID, newCookie) {
        getSteamAPIKey({
            sessionID: sessionID,
            webCookie: newCookie
        }, function (err, APIKey) {
            offers.setup({
                sessionID: sessionID,
                webCookie: newCookie,
                APIKey: APIKey
            }, function (err) {
                WebSession = true;
                globalSession = sessionID;
                WebCookies = newCookie;
                steamBotLogger('Сессия перезагружена !');
            });
        });
    });
}

function handleOffers() {
    offers.getOffers({
        get_received_offers: 1,
        active_only: 1
    }, function(error, body) {
        if (body && body.response && body.response.trade_offers_received) {
            body.response.trade_offers_received.forEach(function(offer) {
                if (offer.trade_offer_state == 2) {
                    if (is_checkingOfferExists(offer.tradeofferid)) return;
					timetrade[offer.tradeofferid] = Date.now();
                    if (offer.items_to_give != null && config.admins.indexOf(offer.steamid_other) != -1) {
                        steamBotLogger('Обмен #' + offer.tradeofferid + ' От админа: ' + offer.steamid_other);
						try {
							steamBotLogger('Принимаем обмен: #' + offer.tradeofferid);
							offers.acceptOffer({
								tradeOfferId: offer.tradeofferid
							}, function(err, body) {
								if (err) {
                                    makeErr();
									steamBotLogger('Ошибка. Принятие обмена #' + offer.offerid).tag('Бот').log(err);
								}
							});
						} catch (ex) {
							steamBotLogger('Ошибка принятия ставки');
						}
                        return;
                    }
                    if (offer.items_to_give != null) {
                        offers.declineOffer({
                            tradeOfferId: offer.tradeofferid
                        });
                        return;
                    }
                    offers.getTradeHoldDuration({
                        tradeOfferId: offer.tradeofferid
                    }, function(err, response) {
                        if (err) {
                            makeErr();
                            steamBotLogger('Ошибка проврки на задержку: ' + err);
                            offers.declineOffer({
                                tradeOfferId: offer.tradeofferid
                            });
                            steamBotLogger('Трейд отменен из за ошибки: ' + offer.tradeofferid);
                            return;
                        } else if (response.their != 0) {
                            steamBotLogger('response.their: ' + response.their);
                            offers.declineOffer({
                                tradeOfferId: offer.tradeofferid
                            });
                            steamBotLogger('Трейд отменен из за задержки: ' + offer.tradeofferid);
                            return;
                        }
                    });
                    if (offer.items_to_receive != null && offer.items_to_give == null) {
                        checkingOffers.push(offer.tradeofferid);
                        steamBotLogger('Обмен #' + offer.tradeofferid + ' От: ' + offer.steamid_other);
                        redisClient.multi([
                            ['rpush', redisChannels.tradeoffersList, offer.tradeofferid],
                            ['rpush', redisChannels.checkItemsList, JSON.stringify(offer)],
                            ['rpush', redisChannels.usersQueue, offer.steamid_other]
                        ]).exec(function() {
                            redisClient.lrange(redisChannels.usersQueue, 0, -1, function(err, queues) {
                                io.sockets.emit('queue', queues);
                            });
                        });
                        return;
                    }
                }
            });
        }
    });
}

steamUser.on('tradeOffers', function(number) {
    if (number > 0) {
        handleOffers();
    }
});


var parseOffer = function(offer, offerJson) {
    offers.loadPartnerInventory({
        partnerSteamId: offer.steamid_other,
        appId: 730,
        contextId: 2,
        tradeOfferId: offer.tradeofferid,
        language: "russian"
    }, function(err, hitems) {
        if (err) {
            redisClient.multi([
                    ['rpush', redisChannels.declineList, offer.tradeofferid],
                    ['lrem', redisChannels.checkItemsList, 0, offerJson],
                    ['lrem', redisChannels.usersQueue, 1, offer.steamid_other]
                ])
                .exec(function(err, replies) {
                    parseItemsProcceed = false;
                    return;
                });
            return;
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
        redisClient.multi([
			['rpush', redisChannels.checkList, JSON.stringify(value)],
			['lrem', redisChannels.checkItemsList, 0, offerJson]
		])
		.exec(function(err, replies) {
			parseItemsProcceed = false;
		});
    });
}

var checkOfferPrice = function() {
    requestify.post('http://' + config.web_api_data.domain + '/api/checkOffer', {
        secretKey: config.web_api_data.secretKey
    })
	.then(function(response) {
        var answer = JSON.parse(response.body);
        if (answer.success) {
            checkProcceed = false;
        }
    }, function(response) {
        steamBotLogger('Не можем проверить обмен. Retry...');
        steamBotLogger(response);
        setTimeout(function() {
            checkOfferPrice()
        }, 1000);
    });
}

var checkNewBet = function() {
    requestify.post('http://' + config.web_api_data.domain + '/api/newBet', {
        secretKey: config.web_api_data.secretKey
    }).then(function(response) {
        var answer = JSON.parse(response.body);
        if (answer.success) {
            betsProcceed = false;
        }
    }, function(response) {
        steamBotLogger('Не можем отправить новую ставку. Retry...');
        setTimeout(function() {
            checkNewBet()
        }, 1000);
    });
}
var checkArrGlobal = [];

var sendTradeOffer = function(appId, partnerSteamId, accessToken, sendItems, message, game, offerJson) {
	try {
		var sentItems = [];
		offers.getOffers({
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
                steamBotLogger('1');
                steamBotLogger('Не можем отправить обмен');
                sendProcceed = false;
            }
		});
		offers.loadMyInventory({
			appId: appId,
			contextId: 2
		}, function(err, items) {
			if (err) {
				steamBotLogger(err);
                steamBotLogger('2');
				sendProcceed = false;
				return;
			}
			var itemsFromMe = [],
				checkArr = [],
				num = 0;
			var i = 0;
			steamBotLogger('Игра #' + game);
			for (var i = 0; i < sendItems.length; i++) {
				for (var j = 0; j < items.length; j++) {
					if (items[j].tradable && (items[j].classid == sendItems[i])) {
						if ((sentItems.indexOf(items[j].id) == -1) && (checkArr.indexOf(items[j].id) == -1) && (checkArrGlobal.indexOf(items[j].id) == -1)) {
							checkArr[i] = items[j].id;
							itemsFromMe[num] = {
								appid: 730,
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
				offers.makeOffer({
					partnerSteamId: partnerSteamId,
					accessToken: accessToken,
					itemsFromMe: itemsFromMe,
					itemsFromThem: [],
					message: 'Поздравляем с победой на сайте ' + config.web_api_data.nameSite + ' | В игре #' + game
				}, function(err, response) {
					if (err) {
						steamBotLogger('Ошибка отправки обмена:' + err.message);
						getErrorCode(err.message, function(errCode) {
							if (errCode == 15 || errCode == 25 || err.message.indexOf('an error sending your trade offer.  Please try again later.')) {
								redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
									if (game>0 && partnerSteamId != config.bots.shop_bots.shop_bot_1.steamid){
										setPrizeStatus(game, 2);
									}
									sendProcceed = false;
								});
								sendProcceed = false;
							}
							sendProcceed = false;
						});
						return;
					}
					checkArrGlobal = checkArrGlobal.concat(checkArr);
					redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
						if (game>0 && partnerSteamId != config.bots.shop_bots.shop_bot_1.steamid){setPrizeStatus(game, 1);}
						sendProcceed = false;
					});
					steamBotLogger('Обмен #' + response.tradeofferid + ' отправлен!');
				});
			} else {
				steamBotLogger('Предметы не найдены!');
				redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
					if (game>0 && partnerSteamId != config.bots.shop_bots.shop_bot_1.steamid){setPrizeStatus(game, 1);}
					sendProcceed = false;
				});
			}
		});
		setTimeout(AcceptMobileOffer, 5000);
	} catch (ex) {
		steamBotLogger('Не можем отправить обмен');
		if (game>0 && partnerSteamId != config.bots.shop_bots.shop_bot_1.steamid){setPrizeStatus(game, 2);}
		sendProcceed = false;
	}
};

var setPrizeStatus = function(game, status) {
    requestify.post('http://' + config.web_api_data.domain + '/api/setPrizeStatus', {
        secretKey: config.web_api_data.secretKey,
        game: game,
        status: status
    }).then(function(response) {
        
    }, function(response) {
        steamBotLogger('Не можем установить статус отправки. Повторяем...');
        steamBotLogger(response);
        setTimeout(function() {
            setPrizeStatus()
        }, 1000);
    });
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

var checkedOffersProcceed = function(offerJson) {
    var offer = JSON.parse(offerJson);
    if (offer.success) {
        steamBotLogger('Принимаем обмен: #' + offer.offerid);
        offers.acceptOffer({
            tradeOfferId: offer.offerid
        }, function(err, body) {
            if (!err) {
                redisClient.multi([
					["lrem", redisChannels.tradeoffersList, 0, offer.offerid],
					["lrem", redisChannels.usersQueue, 1, offer.steamid64],
					["rpush", redisChannels.betsList, offerJson],
					["lrem", redisChannels.checkedList, 0, offerJson]
				]).exec(function(err, replies) {
					redisClient.lrange(redisChannels.usersQueue, 0, -1, function(err, queues) {
						io.sockets.emit('queue', queues);
						steamBotLogger("Новая ставка!");
						checkedProcceed = false;
						var lastime = Date.now() - timetrade[offer.offerid];
						io.sockets.emit('bettime', lastime);
					});
				});
            } else {
                steamBotLogger('Ошибка: #' + offer.offerid);
				setTimeout(function(){
					offers.getOffer({
						tradeOfferId: offer.offerid
					}, function(err, body) {
						if(body.response.offer){
							var offerCheck = body.response.offer;
							if (offerCheck.trade_offer_state == 2) {
								checkedProcceed = false;
								return;
							}
							if (offerCheck.trade_offer_state == 3) {
								redisClient.multi([
									["lrem", redisChannels.tradeoffersList, 0, offer.offerid],
									["lrem", redisChannels.usersQueue, 1, offer.steamid64],
									["rpush", redisChannels.betsList, offerJson],
									["lrem", redisChannels.checkedList, 0, offerJson]
								])
								.exec(function(err, replies) {
									redisClient.lrange(redisChannels.usersQueue, 0, -1, function(err, queues) {
										io.sockets.emit('queue', queues);
										checkedProcceed = false;
									});
								});
							} else {
								redisClient.multi([
									["lrem", redisChannels.tradeoffersList, 0, offer.offerid],
									["lrem", redisChannels.usersQueue, 1, offer.steamid64],
									["lrem", redisChannels.checkedList, 0, offerJson]
								])
								.exec(function(err, replies) {
									redisClient.lrange(redisChannels.usersQueue, 0, -1, function(err, queues) {
										io.sockets.emit('queue', queues);
										checkedProcceed = false;
									});
								});
							}
						}
					});
				}, 1000);
            }
        });
    }
}

function AcceptMobileOffer() {
	if (WebSession){
		// Информация для мобильных подтверждений
		var steamcommunityMobileConfirmations = new SteamcommunityMobileConfirmations({
			steamid: config.bots.game_bots.game_bot.steamid,
			identity_secret: config.bots.game_bots.game_bot.identity_secret,
			device_id: device_id,
			webCookie: WebCookies,
		});

		steamcommunityMobileConfirmations.FetchConfirmations((function(err, confirmations) {
			if (err) {
				//steamBotLogger(err);
				//reWebLogonBot();
				return;
			}
			if (!confirmations.length) {
				return;
			} else {
				steamBotLogger('Ожидает подтверждения: ' + confirmations.length);
			
				steamcommunityMobileConfirmations.AcceptConfirmation(confirmations[0], (function(err, result) {
					if (err) {
						//steamBotLogger(err);
						return;
					}
				}).bind(this));
			}
		}).bind(this));
	}
}

var declineOffersProcceed = function(offerid) {
    steamBotLogger('Отклоняем обмен: #' + offerid);
    offers.declineOffer({
        tradeOfferId: offerid
    }, function(err, body) {
        if (!err) {
            steamBotLogger('Обмен #' + offerid + ' Отклонен!');
            redisClient.lrem(redisChannels.declineList, 0, offerid);
			redisClient.lrange(redisChannels.usersQueue, 0, -1, function(err, queues) {
				io.sockets.emit('queue', queues);
			});
            declineProcceed = false;
        } else {
            makeErr();
            steamBotLogger('Ошибка. Не можем отклонить обмен #' + offer.offerid);
            declineProcceed = false;
        }
    });
}

var queueProceed = function() {
    redisClient.llen(redisChannels.checkList, function(err, length) {
        if (length > 0 && !checkProcceed) {
            steamBotLogger('Трейды к проверке:' + length);
            checkProcceed = true;
            checkOfferPrice();
        }
    });
    redisClient.llen(redisChannels.checkedList, function(err, length) {
        if (length > 0 && !checkedProcceed && WebSession) {
            steamBotLogger('Проверенные трейды:' + length);
            checkedProcceed = true;
            redisClient.lindex(redisChannels.checkedList, 0, function(err, offer) {
                checkedOffersProcceed(offer);
            });
        }
    });
    redisClient.llen(redisChannels.declineList, function(err, length) {
        if (length > 0 && !declineProcceed && WebSession) {
            steamBotLogger('Отмененных трейдов:' + length);
            declineProcceed = true;
            redisClient.lindex(redisChannels.declineList, 0, function(err, offer) {
                declineOffersProcceed(offer);
            });
        }
    });
    redisClient.llen(redisChannels.betsList, function(err, length) {
        if (length > 0 && !betsProcceed && !delayForNewGame) {
            steamBotLogger('Ставок:' + length);
            betsProcceed = true;
            checkNewBet();
        }
    });
    redisClient.llen(redisChannels.sendOffersList, function(err, length) {
        if (length > 0 && !sendProcceed) {
			if (WebSession){
				steamBotLogger('Трейдов для отправки:' + length);
				sendProcceed = true;
				redisClient.lindex(redisChannels.sendOffersList, 0, function(err, offerJson) {
					offer = JSON.parse(offerJson);
					sendTradeOffer(offer.appId, offer.steamid, offer.accessToken, offer.items, '', offer.game, offerJson);
				});
			} else {
				steamBotLogger('Трейдов для отправки:' + length);
				redisClient.lindex(redisChannels.sendOffersList, 0, function(err, offerJson) {
					offer = JSON.parse(offerJson);
					redisClient.lrem(redisChannels.sendOffersList, 0, offerJson, function(err, data) {
						if (offer.game>0 && offer.steamid != config.bots.shop_bots.shop_bot_1.steamid){
							setPrizeStatus(offer.game, 2);
						}
					});
				});
			}
        }
    });
	
    redisClient.llen(redisChannels.checkItemsList, function(err, length) {
        if (length > 0 && !parseItemsProcceed && WebSession) {
            steamBotLogger('Ожидает парсинга:' + length);
            parseItemsProcceed = true;
            redisClient.lindex(redisChannels.checkItemsList, 0, function(err, offerJson) {
                offer = JSON.parse(offerJson);
                parseOffer(offer, offerJson);
            });
        }
    });
}
var parseItemsProcceed = false;
var checkProcceed = false;
var checkedProcceed = false;
var declineProcceed = false;
var betsProcceed = false;
var sendProcceed = false;
var delayForNewGame = false;

setInterval(queueProceed, 3000);
setInterval(checkBrokenGames, 600000);
setInterval(AcceptMobileOffer, 10000);
var timetrade = [];

function checkBrokenGames() {
	if (WebSession){
		requestify.post('http://' + config.web_api_data.domain + '/api/checkBrokenGames', {
			secretKey: config.web_api_data.secretKey
		}).then(function (response) {
			steamBotLogger('Автоматическая переотправка выигрышей.');
		}, function (response) {
			steamBotLogger('Ошибка [checkBrokenGames]');
		});
	}
}


/*module.exports.handleOffers = handleOffers;
module.exports.delayForNewGame = function(value) {
	if (value) {
		steamBotLogger('Отключаем прием ставок.');
	} else {
		steamBotLogger('Включаем прием ставок.');
	}
	
    delayForNewGame = value;
};*/

function getErrorCode(err, callback) {
    var errCode = 0;
    var match = err.match(/\(([^()]*)\)/);
    if (match != null && match.length == 2) errCode = match[1];
    callback(errCode);
}