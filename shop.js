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
    socket_conf = require('./config/socket.js'),
    Steam = require('steam'),
    SteamWebLogOn = require('steam-weblogon'),
    getSteamAPIKey = require('steam-web-api-key'),
    SteamTradeOffers = require('steam-tradeoffers'),
    SteamCommunity = require('steamcommunity'),
    SteamcommunityMobileConfirmations = require('steamcommunity-mobile-confirmations'),
    SteamTotp = require('steam-totp'),
    redis = require('redis'),
    fs = require('fs'),
    requestify = require('requestify');
    

if(socket_conf.unix){
  if ( fs.existsSync(config.ports.deposit.path) ) { fs.unlinkSync(config.ports.deposit.path); }
  process.umask(socket_conf.procumask);
  app.listen(config.ports.deposit.path);
  console.log('APP started on ' + config.ports.deposit.path);
} else {
  server.listen(config.ports.deposit.port, socket_conf.host);
  console.log('APP started on ' + socket_conf.host + ':'  + config.ports.deposit.port);
}
if(socket_conf.unix){
  if ( fs.existsSync(config.ports.shop.path) ) { fs.unlinkSync(config.ports.shop.path); }
  process.umask(socket_conf.procumask);
  server.listen(config.ports.shop.path);
  console.log('APP started on ' + config.ports.shop.path);
} else {
  server.listen(config.ports.shop.port, socket_conf.host);
  console.log('APP started on ' + socket_conf.host + ':'  + config.ports.shop.port);
}

const redisChannels = redis_conf.Shop_Channels;

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
    
function query(sql, callback) {
	if (typeof callback === 'undefined') {
		callback = function() {};
	}
	pool.getConnection(function(err, connection) {
		if(err) return callback(err);
		//logger.info('Ид соединения с базой данных: '+connection.threadId);
		connection.query(sql, function(err, rows) {
			if(err) return callback(err);
			connection.release();
			return callback(null, rows);
		});
	});
}
setTimeout(rediSubscribe, 1000);
function rediSubscribe() {
	rediClient.subscribe('addShop');
	rediClient.subscribe('delShop');
	rediClient.subscribe(redisChannels.updateShop);
	rediClient.setMaxListeners(0);
	rediClient.on("message", function (channel, message) {
		if (channel == redisChannels.updateShop){
			if (WebSession) {
				MyInvToSite();
			}
		} else {
			io.sockets.emit(channel, message);
		}
	});
}

var details = {
    account_name: config.bots.shop_bots.shop_bot_1.username,
    password: config.bots.shop_bots.shop_bot_1.password,
    two_factor_code: generatekey(config.bots.shop_bots.shop_bot_1.secret)
};

var steamClient = new Steam.SteamClient();
var steamUser = new Steam.SteamUser(steamClient);
var steamFriends = new Steam.SteamFriends(steamClient);
var steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
var offers = new SteamTradeOffers();

// Generation Device_ID
var hash = require('crypto').createHash('sha1');
hash.update(Math.random().toString());
hash = hash.digest('hex');
var device_id = 'android:' + hash;

var checkingOffers = [],
    WebCookies = [],
    WebSession = false,
    globalSession;
var errCount = 0;
function makeErr() {
    errCount++;
	if (errCount > 3){
		errCount = 0;
		reWebLogonShop();
	}
}

function generatekey(secret) {
    code = SteamTotp.generateAuthCode(secret);
	siteShopLogger('Код Авторизации : ' + code);
    return code;
}
function siteShopLogger(log) {
    console.tag('Магазин').log(log);
}
function disconnected(){
    siteShopLogger('Отключен от стима');
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
steamClient.on('debug', siteShopLogger);
steamClient.on('error', disconnected);
steamClient.on('connected', function () {
    steamUser.logOn(details);
});
steamClient.on('disconnected', function () {
	WebSession = false;
	setTimeout(function(){
		steamClient = new Steam.SteamClient();
		steamUser = new Steam.SteamUser(steamClient);
		steamFriends = new Steam.SteamFriends(steamClient);
		steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
		offers = new SteamTradeOffers();
		steamClient.connect();
	}, 60000);
});

steamFriends.on('friendMsg', function(steamID, message, type) {
	if (WebSession){
		if (config.admins.indexOf(steamID) == -1) return;
		if (message.indexOf("/update") == 0) {
			steamFriends.sendMessage(steamID, "Магазин обновляется");
			MyInvToSite();
		}
	}
});

steamClient.on('logOnResponse', function (logonResp) {
    if (logonResp.eresult === Steam.EResult.OK) {
		siteShopLogger('Вход выполнен!');
        steamFriends.setPersonaState(Steam.EPersonaState.Online);

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
                    siteShopLogger('Обмены доступны!');
					handleOffers();
					setTimeout(AcceptMobileOffer, 5000);
					//reWebLogonShop();
                });

            });
        });
    }
});

function makecode() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function reWebLogonShop() {
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
                siteShopLogger('Сессия перезагружена !');
            });
        });
    });
}

function handleOffers() {
    offers.getOffers({
        get_received_offers: 1,
        active_only: 1
    }, function (error, body) {
        if (body && body.response && body.response.trade_offers_received) {
            body.response.trade_offers_received.forEach(function (offer) {
                if (offer.trade_offer_state == 2) {
                    if ((config.admins.indexOf(offer.steamid_other) != -1) || (offer.items_to_give == null && offer.items_to_receive != null)) {
						siteShopLogger('Принимаем обмен #' + offer.tradeofferid + ' от: ' + offer.steamid_other );
						var mes = {steamid : offer.steamid_other,message : 'Ваш обмен принимается'}
						io.sockets.emit('notification', JSON.stringify(mes));
						offers.getTradeHoldDuration({
							tradeOfferId: offer.tradeofferid
						}, function(err, response) {
							if(offer.steamid_other != config.bots.game_bots.game_bot.steamid){
								if (err) {
									makeErr();
									siteShopLogger('Ошибка проврки на задержку: ' + offer.tradeofferid);
									var mes = {steamid : offer.steamid_other,message : 'Трейд отменен из за ошибки'}
									io.sockets.emit('notification', JSON.stringify(mes));
									return;
								} else if (response.their != 0) {
									siteShopLogger('response.their: ' + response.their);
									offers.declineOffer({
										tradeOfferId: offer.tradeofferid
									});
									siteShopLogger('Трейд отменен из за задержки: ' + offer.tradeofferid);
									var mes = {steamid : offer.steamid_other,message : 'Обмен отклонен из за задержки'}
									io.sockets.emit('notification', JSON.stringify(mes));
									return;
								}
							}
						});
						
                        offers.acceptOffer({
                            tradeOfferId: offer.tradeofferid
						}, function (error, traderesponse) {
							var ECode = '';
							if(error){
								var mes = {steamid : offer.steamid_other,message : 'Ошибка: ' + error.message}
								io.sockets.emit('notification', JSON.stringify(mes));
								siteShopLogger('Ошибка принятия: ' + error.message + ' #' + offer.tradeofferid);
								makeErr();
								getErrorCode(error.message, function (errCode) {
									ECode = errCode;
								});
							}
                            if (!error || ECode == 16 || ECode == 11) {
								setTimeout(function(){
									if ('undefined' != typeof traderesponse) {
										if ('undefined' != typeof traderesponse.tradeid) {
											offers.getItems({
												tradeId: traderesponse.tradeid
											}, function (error_items, recieved_items) {
												if (!error_items) {
													var mes = {steamid : offer.steamid_other,message : 'Подсчет результатов'}
													io.sockets.emit('notification', JSON.stringify(mes));
													var itemsForParse = [], itemsForSale = [], i = 0;
													recieved_items.forEach(function (item) {
														itemsForParse[i++] = item.id;
													})
													offers.loadMyInventory({
														appId: 730,
														contextId: 2,
														language: 'russian'
													}, function (error_my, botItems) {
														if (!error_my) {
															i = 0;
															botItems.forEach(function (item) {
																if (itemsForParse.indexOf(item.id) != -1) {
																	var rarity = '', type = '';
																	var arr = item.type.split(',');
																	if (arr.length == 2) rarity = arr[1].trim();
																	if (arr.length == 3) rarity = arr[2].trim();
																	if (arr.length && arr[0] == 'Нож') rarity = 'Тайное';
																	if (arr.length) type = arr[0];
																	var quality = item.market_name.match(/\(([^()]*)\)/);
																	if (quality != null && quality.length == 2) quality = quality[1];
																	itemsForSale[i++] = {
																		depositorid: offer.steamid_other,
																		inventoryId: item.id,
																		classid: item.classid,
																		name: item.name,
																		appid: item.appid,
																		market_hash_name: item.market_hash_name,
																		rarity: rarity,
																		quality: quality,
																		type: type
																	}
																}
															});
														}
														redisClient.rpush(redisChannels.itemsToSale, JSON.stringify(itemsForSale));
													});
												}
											});
										}
									}
								}, 15000);
                            }
                        });
                    } else {
                        //offers.declineOffer({tradeOfferId: offer.tradeofferid});
                    }
                }
            });
        }
    });
}


steamUser.on('tradeOffers', function (number) {
    siteShopLogger('Предложений обмена: ' + number);
    if (number > 0) {
        handleOffers();
    }
});

app.get('/sendTrade/', function (req, res) {
	if (req.query['SHOP_SECRET'] == config.web_api_data.secretKey && !sendProcceed && WebSession){
		if(req.query['data']){
			var offer = JSON.parse(req.query['data']);
			var assetids = offer.items;
			siteShopLogger('Отправляем обмен для депозта: ' + offer.steamid);
			var senditems = [];
			for(var i = 0; i < assetids.length; i++) {
				if(assetids[i] == "") continue;
				senditems.push({
					appid: 730,
					contextid: 2, 
					assetid: assetids[i]
				});
			}
			var code = makecode();
			sendProcceed = true;
			offers.makeOffer({
				partnerSteamId: offer.steamid,
				accessToken: offer.accessToken,
				itemsFromThem: senditems,
				itemsFromMe: [],
				message: 'Code: ' + code + ' | Перед принятием убедитесь в актуальности обмена на ' + config.web_api_data.nameSite
			}, function(err, r) {
				if(err) {
					siteShopLogger('Ошибка при отправке трейда' + err.message);
					sendProcceed = false;
					res.json({
						success: false,
						error: err.toString()
					});
				} else {
					res.json({
						success: true,
						tradeid: r.tradeofferid,
						code: code
					});
					sendProcceed = false;
				}
			});
		} else {
			res.json({
				success: false,
				error: 'Ошибка.'
			});
		}
	} else {
		res.json({
			success: false,
			error: 'Ошибка.'
		});
	}
});

var sendTradeOffer = function(offerJson) {
	var offer = JSON.parse(offerJson);
	siteShopLogger('Отправляем обмен: ' + offer.steamid);
	try {
		offers.loadMyInventory({
			appId: 730,
			contextId: 2
		}, function(err, items) {
			if (err) {
				siteShopLogger(err);
				makeErr();
				sendProcceed = false;
				return;
			}
			var itemsFromMe = [],
				itemsFromMeObj = [],
				nfitems = [],
				checkArr = [],
				num = 0;
			var i = 0;
			for (var i = 0; i < offer.items.length; i++) {
				for (var j = 0; j < items.length; j++) {
					if (items[j].tradable && (items[j].id == offer.items[i])) {
						if (checkArr.indexOf(items[j].id) == -1) {
							checkArr[i] = items[j].id;
							itemsFromMe[num] = {
								appid: 730,
								contextid: 2,
								amount: items[j].amount,
								assetid: items[j].id,
							};
							itemsFromMeObj[num] = offer.items[i];
							num++;
							break;
						}
					}
				}
			}
			if (num > 0) {
				offers.makeOffer({
					partnerSteamId: offer.steamid,
					accessToken: offer.accessToken,
					itemsFromMe: itemsFromMe,
					itemsFromThem: [],
					message: 'Спасибо за покупку на сайте ' + config.web_api_data.nameSite
				}, function(err, response) {
                    if (err) {
						makeErr();
                        getErrorCode(err.message, function (errCode) {
                            if (errCode == 15 || errCode == 25 || err.message.indexOf('an error sending your trade offer.  Please try again later.')) {
                                redisClient.lrem(redisChannels.itemsToGive, 0, offerJson, function (err, data) {
                                    sendProcceed = false;
                                });
                                sendProcceed = false;
                            }
							for (var i = 0; i < offer.items.length; i++) {
								setItemStatus(offer.items[i], 4);
							}
                            sendProcceed = false;
                        });
                        sendProcceed = false;
						//reWebLogonShop();
                    } else if (response) {
                        redisClient.lrem(redisChannels.itemsToGive, 0, offerJson, function (err, data) {
							var mes = {steamid : offer.steamid,message : 'Обмен отправлен'}
							io.sockets.emit('notification', JSON.stringify(mes));
                            sendProcceed = false;
							num = 0;
							for (var i = 0; i < offer.items.length; i++) {
								if (itemsFromMeObj.indexOf(offer.items[i]) == -1) {
									nfitems[num] = offer.items[i];
									num++;
								}
							}
							for (var i = 0; i < nfitems.length; i++) {
								setItemStatus(nfitems[i], 2);
							}
							for (var i = 0; i < itemsFromMeObj.length; i++) {
								setItemStatus(itemsFromMeObj[i], 3);
							}
                            siteShopLogger('Трейд #' + response.tradeofferid + ' Отправлен!');
                            redisClient.rpush(redisChannels.offersToCheck, response.tradeofferid);
                        });
                    }
				});
			} else {
                siteShopLogger('Предметы не найдены!');
				for (var i = 0; i < offer.items.length; i++) {
					setItemStatus(offer.items[i], 2);
				}
                redisClient.lrem(redisChannels.itemsToGive, 0, offerJson, function (err, data) {
                    sendProcceed = false;
                });
			}
		});
		setTimeout(AcceptMobileOffer, 5000);
	} catch (ex) {
        siteShopLogger('Ошибка отправки предмета');
        sendProcceed = false;
		//reWebLogonShop();
	}
};

var MyInvToSite = function() {
	siteShopLogger('Обновляем инвентарь и список предметов на сайте');
	if (WebSession){
		try {
			sentItems = [];
			offers.getOffers({
				get_sent_offers: 1,
				active_only : 1
			}, function(error, body) {
				if (body && body.response && body.response.trade_offers_sent) {
					body.response.trade_offers_sent.forEach(function(offer) {
						if (offer.trade_offer_state == 2 || offer.trade_offer_state == 9) {
							if (offer.items_to_give != null) {
								var items = offer.items_to_give;
								for (var i = 0; i < items.length; i++) {
									sentItems.push(items[i].assetid);
								}
							}
						}
					});
				}
			});
			var itemsForCheck = [], i = 0;
			offers.loadMyInventory({
				appId: 730,
				contextId: 2,
				language: 'russian'
			}, function (error, botItems) {
				if (!error) {
					i = 0;
					botItems.forEach(function (item) {
						if ((sentItems.indexOf(item.id) == -1) && item.tradable) {
							var rarity = '', type = '';
							var arr = item.type.split(',');
							if (arr.length == 2) rarity = arr[1].trim();
							if (arr.length == 3) rarity = arr[2].trim();
							if (arr.length && arr[0] == 'Нож') rarity = 'Тайное';
							if (arr.length) type = arr[0];
							var quality = item.market_name.match(/\(([^()]*)\)/);
							if (quality != null && quality.length == 2) quality = quality[1];
							itemsForCheck[i++] = {
								inventoryId: item.id,
								classid: item.classid,
								name: item.name,
								market_hash_name: item.market_hash_name,
								rarity: rarity,
								quality: quality,
								type: type
							}
						}
					});
				}
				redisClient.rpush(redisChannels.itemsToCheck, JSON.stringify(itemsForCheck));
				return;
			});
		} catch (ex) {
			siteShopLogger('Ошибка:' + ex);
		}
	} else {
		setTimeout(MyInvToSite,1000);
	}
};

function AcceptMobileOffer() {
	if(WebSession){
		// Информация для мобильных подтверждений
		var steamcommunityMobileConfirmations = new SteamcommunityMobileConfirmations({
			steamid: config.bots.shop_bots.shop_bot_1.steamid,
			identity_secret: config.bots.shop_bots.shop_bot_1.identity_secret,
			device_id: device_id,
			webCookie: WebCookies,
		});

		steamcommunityMobileConfirmations.FetchConfirmations((function (err, confirmations) {
			if (err) {
				//reWebLogonShop();
				return;
			}
			if (!confirmations.length) {
				return;
			} else {
				siteShopLogger('Ожидает подтверждения: ' + confirmations.length);
				steamcommunityMobileConfirmations.AcceptConfirmation(confirmations[0], (function (err, result) {
					if (err) {
						//siteShopLogger(err);
						//reWebLogonShop();
						return;
					}
				}).bind(this));
			}
		}).bind(this));
	}
}

var setItemStatus = function (item, status) {
    requestify.post('http://' + config.web_api_data.domain + '/api/shop/setItemStatus', {
        secretKey: config.web_api_data.secretKey,
        id: item,
        status: status
    }).then(function (response) {}, function (response) {
		siteShopLogger('Something wrong with setItemStatus. Retry...');
		setTimeout(function () {
			setItemStatus()
		}, 1000);
	});
}
var setTradeStatus = function (id, items, tradeid, status) {
	var value = {
		id : id,
		tradeid : tradeid,
		status : status,
		items : items
	};
	redisClient.rpush(redisChannels.itemsCheckToTakeCheck, JSON.stringify(value));
    requestify.post('http://' + config.web_api_data.domain + '/api/shop/setTradeStatus', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {}, function (response) {
		siteShopLogger('Something wrong with setTradeStatus. Retry...');
		setTimeout(function () {
			setTradeStatus()
		}, 1000);
	});
}

var addNewItems = function () {
    requestify.post('http://' + config.web_api_data.domain + '/api/shop/newItems', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		var answer = JSON.parse(response.body);
		if (answer.success) {
			siteShopLogger('Предметы добавлены на сайт !');
			itemsToSaleProcced = false;
		} else {
			siteShopLogger(answer);
		}
	}, function (response) {
		siteShopLogger('Something wrong with newItems. Retry...');
		setTimeout(function () {
			addNewItems()
		}, 1000);
	});
}

var addCheckItems = function () {
    requestify.post('http://' + config.web_api_data.domain + '/api/shop/checkShop', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		var answer = JSON.parse(response.body);
		if (answer.success) {
			siteShopLogger('Проверка завершена успешно!');
			itemsToCheckProcced = false;
		}
		else {
			siteShopLogger(answer);
		}
	}, function (response) {
		siteShopLogger('Something wrong with check. Retry...');
	});
}

var checkAllOffers = function () {
    requestify.post('http://' + config.web_api_data.domain + '/api/shop/checkAllOffers', {
        secretKey: config.web_api_data.secretKey
    }).then(function (response) {
		var answer = JSON.parse(response.body);
		if (answer.success) {
			siteShopLogger('Проверка завершена успешно!');
		} else {
			siteShopLogger(answer);
		}
	}, function (response) {
		siteShopLogger('Something wrong with check. Retry...');
	});
}

var checkOfferForExpired = function (offer) {
    offers.getOffer({tradeOfferId: offer}, function (err, body) {
        if (body.response.offer) {
            var offerCheck = body.response.offer;
            if (offerCheck.trade_offer_state == 2) {
                var timeCheck = Math.floor(Date.now() / 1000) - offerCheck.time_created;
                if (timeCheck >= config.bots.shop_bots.shop_bot_1.timeForCancelOffer) {
                    offers.cancelOffer({tradeOfferId: offer}, function (err, response) {
                        if (!err) {
                            redisClient.lrem(redisChannels.offersToCheck, 0, offer, function (err, data) {
                                siteShopLogger('Offer #' + offer + ' был просрочен!');
                                checkProcceed = false;
                            });
                        } else {
                            checkProcceed = false;
                        }
                    });
					for (var i = 0; i < offerCheck.items_to_give.length; i++) {
						setItemStatus(offerCheck.items_to_give[i].assetid, 0);
					}
                } else {
                    checkProcceed = false;
                }
                return;
            } else if (offerCheck.trade_offer_state == 3 || offerCheck.trade_offer_state == 7) {
                redisClient.lrem(redisChannels.offersToCheck, 0, offer, function (err, data) {
                    checkProcceed = false;
                });
            } else {
                redisClient.lrem(redisChannels.offersToCheck, 0, offer, function (err, data) {
                    checkProcceed = false;
                });
                checkProcceed = false;
            }
        } else {
            checkProcceed = false;
        }
    })
}

var declineOffersProcceed = function(offerid) {
    siteShopLogger('Отклоняем обмен: #' + offerid);
    offers.declineOffer({
        tradeOfferId: offerid
    }, function(err, body) {
        if (!err) {
            siteShopLogger('Обмен #' + offerid + ' Отклонен!');
            redisClient.lrem(redisChannels.declineList, 0, offerid);
            declineProcceed = false;
        } else {
            siteShopLogger('Ошибка. Не можем отклонить обмен #' + offerid).tag('Бот').log(err);
            declineProcceed = false;
        }
    });
}

var queueProceed = function () {
    redisClient.llen(redisChannels.itemsToSale, function (err, length) {
        if (length > 0 && !itemsToSaleProcced) {
            siteShopLogger('Ожидает добавления:' + length);
            itemsToSaleProcced = true;
            addNewItems();
        }
    });
    redisClient.llen(redisChannels.itemsToCheck, function (err, length) {
        if (length > 0 && !itemsToCheckProcced) {
            siteShopLogger('Ожидает проверки:' + length);
            itemsToCheckProcced = true;
            addCheckItems();
        }
    });
    redisClient.llen(redisChannels.declineList, function(err, length) {
        if (length > 0 && !declineProcceed && WebSession) {
            siteShopLogger('Отмененных трейдов:' + length);
            declineProcceed = true;
            redisClient.lindex(redisChannels.declineList, 0, function(err, offer) {
                declineOffersProcceed(offer);
            });
        }
    });
    redisClient.llen(redisChannels.itemsToGive, function (err, length) {
        if (length > 0 && !sendProcceed && WebSession) {
            siteShopLogger('Ожидает отправки:' + length);
            sendProcceed = true;
            redisClient.lindex(redisChannels.itemsToGive, 0, function (err, offerJson) {
                sendTradeOffer(offerJson);
            });
        }
    });
    redisClient.llen(redisChannels.offersToCheck, function (err, length) {
        if (length > 0 && !checkProcceed && WebSession) {
            checkProcceed = true;
            redisClient.lindex(redisChannels.offersToCheck, 0, function (err, offer) {
				checkOfferForExpired(offer);
            });
        }
    });
}

var itemsToSaleProcced = false;
var itemsToCheckProcced = false;
var sendProcceed = false;
var checkProcceed = false;
var declineProcceed = false;
setInterval(queueProceed, 5000);
setInterval(checkAllOffers, 30000);
setInterval(AcceptMobileOffer, 10000);
setInterval(handleOffers, 30000);

function getErrorCode(err, callback) {
    var errCode = 0;
    var match = err.match(/\(([^()]*)\)/);
    if (match != null && match.length == 2) errCode = match[1];
    callback(errCode);
}
