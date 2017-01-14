var bot_id = process.argv[2],
    config = require('./config/config.js'),
    config_redis = require('./config/redis.js'),
    socket_conf = require('./config/socket.js');
const redisChannels = config_redis.channels.shop.getChannels(bot_id);
console = process.console;
var requestify = require('requestify'),
    crypto = require('crypto'),
    redis = require('redis'),
    fs = require('fs'),
    app = require('express')(),
    server = require('http').Server(app),
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
var redisClient = redis.createClient(redis_config),
    Client = redis.createClient(redis_config);
Client.subscribe(redisChannels.updateShop);
Client.setMaxListeners(0);
Client.on("message", function (channel, message) {
    if (channel == redisChannels.updateShop){
        MyInvToSite();
    }
});
if(socket_conf.unix){
    if ( fs.existsSync(socket_conf.ports.deposit.gpath(bot_id)) ) { fs.unlinkSync(socket_conf.ports.deposit.gpath(bot_id)); }
    process.umask(socket_conf.procumask);
    app.listen(socket_conf.ports.deposit.gpath(bot_id));
    console.log('SHOP started on ' + socket_conf.ports.deposit.gpath(bot_id));
} else {
    server.listen(socket_conf.ports.deposit.port, socket_conf.host);
    console.log('SHOP started on ' + socket_conf.host + ':'  + socket_conf.ports.deposit.port);
}
// Getting account info
function account(){
    var data = {
        account_name: config.accounts.shop[bot_id].username,
        password: config.accounts.shop[bot_id].password,
        two_factor_code: generatekey(config.accounts.shop[bot_id].secret)
    };
    return data;
}
// Some global data
var itemsToSaleProcced = false,
    itemsToCheckProcced = false,
    depProcceed = false,
    checkingOffers = [],
    WebCookies = [],
    errCount = 0,
    lastBetTime = Date.now(),
    declineProcceed = false,
    checkProcceed = false,
    sendProcceed = false,
    ccProcceed = false,
    itemStatus = false,
    WebSession = false,
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
    console.log('Шоп подключается к steam');
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
                        steamid: config.accounts.shop[bot_id].steamid,
                        identity_secret: config.accounts.shop[bot_id].identity_secret,
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
    console.error('Ошибок насчитано: ' + errCount);
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
    console.error('Отключен от стима');
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
// Initialisong intervals
var Queue = setInterval(function(){queueProceed();}, 3000),
    WorkCheck = setInterval(function(){checkWorking()}, 5000),
    Handlier = setInterval(function(){handleOffers()}, 10000),
    DepQ = setInterval(function(){queueDep()}, 30000),
    Accepter = setInterval(function(){AcceptMobileOffer()}, 10000);
// Queue Interval
var queueProceed = function() {
    redisClient.llen(redisChannels.updateStatus, function (err, length) {
        if (length > 0 && !itemStatus) {
            console.log('Ожидает статуса:' + length);
            itemStatus = true;
            setItemStatusReq();
        }
    });
    redisClient.llen(redisChannels.itemsToSale, function (err, length) {
        if (length > 0 && !itemsToSaleProcced) {
            console.log('Ожидает добавления:' + length);
            itemsToSaleProcced = true;
            addNewItems();
        }
    });
    redisClient.llen(redisChannels.itemsToCheck, function (err, length) {
        if (length > 0 && !itemsToCheckProcced) {
            console.log('Ожидает проверки:' + length);
            itemsToCheckProcced = true;
            addCheckItems();
        }
    });
    redisClient.llen(redisChannels.declineList, function(err, length) {
        if (length > 0 && !declineProcceed && WebSession) {
            console.log('Отмененных трейдов:' + length);
            declineProcceed = true;
            redisClient.lindex(redisChannels.declineList, 0, function(err, offer) {
                declineOffersProcceed(offer);
            });
        }
    });
    redisClient.llen(redisChannels.itemsToGive, function (err, length) {
        if (length > 0 && !sendProcceed && WebSession) {
            console.log('Ожидает отправки:' + length);
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
    redisClient.llen(redisChannels.tempDeposit, function(err, length) {
        redisClient.lindex(redisChannels.tempDeposit, 0, function (err, offer) {
            depCheckOffer(offer);
        });
    });
    if(depProcceed && !ccProcceed){
        ccProcceed = true;
        redisClient.llen(redisChannels.tempDeposit, function(err, length) {
            if (length == 0) checkDepositComplete();
        });
    }
}
var queueDep = function() {
    if(!depProcceed && WebSession ){
        depProcceed = true;
        requestify.post('http://' + config.web.domain + '/api/shop/deposit/toCheck', {
            bot_id: bot_id,
            secretKey: config.web.secretKey
        }).then(function (response) {
            var answer = JSON.parse(response.body);
            if (answer.success) {
                var trades = answer.trades;
                if(trades.length > 0){
                    console.log('Депозитов для проверки: ' + trades.length);
                    trades.forEach(function(trade) {
                        redisClient.rpush(redisChannels.tempDeposit, trade);
                    });
                } else {
                    depProcceed = false;
                }
            } else {
                depProcceed = false;
            }
        }), function (response) {
            console.error('Ошибка проверки депозитов');
            depProcceed = false;
        }
    }
}
// bot main functions
function checkWorking(){
    if(((Date.now() - lastBetTime)/1000) >= config.timers.noActiveBot ){
        if(!itemsToSaleProcced && !itemsToCheckProcced && !depProcceed && !declineProcceed && !checkProcceed && !sendProcceed){
            lastBetTime = Date.now();
            steamClient.disconnect();
            steamLogin();
        }
    }
}
function makecode() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for(var i=0; i < 5; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
function handleOffers() {
    if (WebSession && !handleOff){
        handleOff = true;
        steamOffers.getOffers({
            get_received_offers: 1,
            active_only: 1
        }, function(error, body) {
            if (!body){makeErr();handleOff=false;return;}
            if (!body.response){makeErr();return;}
            if (!body.response.trade_offers_received){handleOff=false;return;}
            body.response.trade_offers_received.forEach(function(offer) {
                if (offer.trade_offer_state != 2){handleOff=false;return;}
                if (offer.items_to_give != null && config.admins.indexOf(offer.steamid_other) != -1) {
                    try {
                        console.log('Обрабатываем обмен #' + offer.tradeofferid + ' От: ' + offer.steamid_other + ' Без проверок');
                        steamOffers.acceptOffer({
                            tradeOfferId: offer.tradeofferid
                        }, function(err, body) {
                            if (err) {
                                makeErr();
                                console.error('Ошибка при принятии обмена #' + offer.tradeofferid);
                            }
                        });
                    } catch (ex) {
                        makeErr();
                        console.error('Ошибка при принятии обмена #' + offer.tradeofferid);
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
                        console.error('Ошибка проверки на задержку: #' + offer.tradeofferid);
                        handleOff=false;
                        return;
                    } else if (response.their != 0) {
                        steamOffers.declineOffer({tradeOfferId: offer.tradeofferid});
                        console.log('Трейд отменен из за задержки: #' + offer.tradeofferid);
                        handleOff=false;
                        return;
                    }
                    if (offer.items_to_receive != null && offer.items_to_give == null) {
                        console.log('Обмен обработан #' + offer.tradeofferid + ' От: ' + offer.steamid_other);
                        steamOffers.acceptOffer({
                            tradeOfferId: offer.tradeofferid
						}, function (error, traderesponse) {
							var ECode = '';
							if(error){
								console.error('Ошибка принятия: ' + error.message + ' #' + offer.tradeofferid);
								makeErr();
								getErrorCode(error.message, function (errCode) {
									ECode = errCode;
								});
							}
                            if (!error || ECode == 16 || ECode == 11) {
                                console.log('Обмен принят #' + offer.tradeofferid + ' Проверяем на наличие');
								setTimeout(function(){
									if ('undefined' == typeof traderesponse){
                                        console.error('Не смогли принять #' + offer.tradeofferid);
                                        handleOff=false;
                                        return;
                                    } 
                                    if ('undefined' == typeof traderesponse.tradeid){
                                        console.error('Не смогли принять #' + offer.tradeofferid);
                                        handleOff=false;
                                        return;
                                    }
                                    steamOffers.getItems({
                                        tradeId: traderesponse.tradeid
                                    }, function (error_items, recieved_items) {
                                        if (!error_items) {
                                            var itemsForParse = [], itemsForSale = [], i = 0;
                                            recieved_items.forEach(function (item) {
                                                itemsForParse[i++] = item.id;
                                            })
                                            steamOffers.loadMyInventory({
                                                appId: config.steam.appid,
                                                contextId: 2,
                                                language: 'russian'
                                            }, function (error_my, botItems) {
                                                if (error_my) {
                                                    console.error('Не смогли принять #' + offer.tradeofferid);
                                                    handleOff=false;
                                                    return;
                                                }
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
                                                            bot_id: bot_id,
                                                            name: item.name,
                                                            appid: item.appid,
                                                            market_hash_name: item.market_hash_name,
                                                            rarity: rarity,
                                                            quality: quality,
                                                            type: type
                                                        }
                                                    }
                                                });
                                                redisClient.rpush(redisChannels.itemsToSale, JSON.stringify(itemsForSale), function (err, data) { handleOff=false; });
                                                console.log('Обмен засчитан #' + offer.tradeofferid);
                                                lastBetTime = Date.now();
                                            });
                                        } else {
                                            console.error('Не смогли принять #' + offer.tradeofferid);
                                            handleOff=false;
                                        }
                                    });
								}, 15000);
                            }
                        });
                    }
                });
            });
        });
    }
}
app.get('/socket.io/sendTrade/' + bot_id + '/', function (req, res) {
	if (req.query['secretKey'] == config.web.secretKey && WebSession){
        if(!sendProcceed){
            if(req.query['data']){
                var offer = JSON.parse(req.query['data']);
                var assetids = offer.items;
                assetids = assetids.split(',');
                console.log('Отправляем обмен для депозта: ' + offer.steamid);
                var senditems = [];
                for(var i = 0; i < assetids.length; i++) {
                    if(assetids[i] == "") continue;
                    senditems.push({
                        appid: config.steam.appid,
                        contextid: 2, 
                        assetid: assetids[i]
                    });
                }
                var code = makecode();
                sendProcceed = true;
                steamOffers.makeOffer({
                    partnerSteamId: offer.steamid,
                    accessToken: offer.accessToken,
                    itemsFromThem: senditems,
                    itemsFromMe: [],
                    message: 'Code: ' + code + ' | Перед принятием убедитесь в актуальности обмена на ' + config.web.nameSite
                }, function(err, r) {
                    if(err) {
                        console.error('Ошибка при отправке трейда' + err.message);
                        sendProcceed = false;
                        res.json({
                            success: false,
                            error: err.toString()
                        });
                    } else {
                        sendProcceed = false;
                        res.json({
                            success: true,
                            tradeid: r.tradeofferid,
                            code: code
                        });
                    }
                });
            } else {
                res.json({
                    success: false,
                    error: 'Ошибка обработки запроса'
                });
            }
        } else {
            res.json({
                success: false,
                error: 'Подождите'
            });
        }
	} else {
        res.json({
            success: false,
            error: 'Ошибка доступа'
        });
	}
});
var sendTradeOffer = function(offerJson) {
    var offer = JSON.parse(offerJson);
    console.log('Отправляем обмен: ' + offer.steamid);
    steamOffers.loadMyInventory({
        appId: offer.appId,
        contextId: 2
    }, function(err, items) {
        lastBetTime = Date.now();
        if (err) {
            makeErr();
            console.error('Не могу загрузить свой инвентарь');
            sendProcceed = false;
            return;
        }
        var itemsFromMe = [], itemsFromMeObj = [], nfitems = [], checkArr = [], num = 0, i = 0;
        for (var i = 0; i < offer.items.length; i++) {
            for (var j = 0; j < items.length; j++) {
                if (items[j].tradable && (items[j].id == offer.items[i])) {
                    if (checkArr.indexOf(items[j].id) == -1) {
                        checkArr[i] = items[j].id;
                        itemsFromMe[num] = { appid: config.steam.appid, contextid: 2,amount: items[j].amount, assetid: items[j].id };
                        itemsFromMeObj[num] = offer.items[i]; num++; break;
                    }
                }
            }
        }
        if (num > 0) {
            steamOffers.makeOffer({ partnerSteamId: offer.steamid, accessToken: offer.accessToken, itemsFromMe: itemsFromMe, itemsFromThem: [], message: 'Спасибо за покупку на сайте ' + config.web.nameSite}, 
            function(err, response) {
                if (err) {
                    makeErr();
                    console.error('Ошибка отправки обмена: ' + err.message);
                    getErrorCode(err.message, function(errCode) {
                        if (errCode == 15 || errCode == 25 || err.message.indexOf('an error sending your trade offer.  Please try again later.')) {
                            redisClient.lrem(redisChannels.itemsToGive, 0, offerJson); 
                            sendProcceed = false;
                        }
                        setItemStatus(offer.items, 4);
                        sendProcceed = false;
                    });
                    sendProcceed = false;
                } else {
                    redisClient.lrem(redisChannels.itemsToGive, 0, offerJson, function (err, data) {
                        sendProcceed = false; num = 0;
                        for (var i = 0; i < offer.items.length; i++) {
                            if (itemsFromMeObj.indexOf(offer.items[i]) == -1) {
                                nfitems[num] = offer.items[i]; 
                                num++; 
                            }
                        }
                        setItemStatus(nfitems, 2); 
                        setItemStatus(itemsFromMeObj, 3);
                        console.log('Обмен #' + response.tradeofferid + ' Отправлен!');
                        redisClient.rpush(redisChannels.offersToCheck, response.tradeofferid);
                    });
                }
            });
        } else {
            console.log('Предметы не найдены!');
            setItemStatus(offer.items, 2);
            redisClient.lrem(redisChannels.itemsToGive, 0, offerJson, function (err, data) { sendProcceed = false; });
        }
    });
};

var checkOfferForExpired = function (offer) {
    steamOffers.getOffer({tradeOfferId: offer}, function (err, body) {
        if (body && body.response && body.response.offer) {
            var offerCheck = body.response.offer;
            if (offerCheck.trade_offer_state == 2) {
                var timeCheck = Math.floor(Date.now() / 1000) - offerCheck.time_created;
                if (timeCheck >= config.timers.timeForCancelOffer) {
                    steamOffers.cancelOffer({tradeOfferId: offer}, function (err, response) {
                        if (!err) {
                            redisClient.lrem(redisChannels.offersToCheck, 0, offer, function (err, data) {
                                console.error('Offer #' + offer + ' был просрочен!');
                                checkProcceed = false;
                            });
                        } else {
                            checkProcceed = false;
                        }
                    });
                    var titems = [];
					for (var i = 0; i < offerCheck.items_to_give.length; i++) titems.push(offerCheck.items_to_give[i].assetid);
                    setItemStatus(titems, 5);
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
            }
        } else {
            checkProcceed = false;
        }
    });
}
var declineOffersProcceed = function(offerid) {
    console.log('Отклоняем обмен: #' + offerid);
    steamOffers.declineOffer({
        tradeOfferId: offerid
    }, function(err, body) {
        if (!err) {
            console.log('Обмен #' + offerid + ' Отклонен!');
            redisClient.lrem(redisChannels.declineList, 0, offerid);
            declineProcceed = false;
        } else {
            makeErr();
            console.error('Ошибка. Не можем отклонить обмен #' + offerid);
            declineProcceed = false;
        }
    });
}
var MyInvToSite = function() {
	console.log('Обновляем инвентарь и список предметов на сайте');
	if (WebSession){
		try { sentItems = [];
			steamOffers.getOffers({ get_sent_offers: 1, active_only : 1 }, function(error, body) {
				if (body && body.response && body.response.trade_offers_sent) {
					body.response.trade_offers_sent.forEach(function(offer) {
						if ((offer.trade_offer_state == 2 || offer.trade_offer_state == 9) && offer.items_to_give != null){ var items = offer.items_to_give; for (var i = 0; i < items.length; i++) sentItems.push(items[i].assetid);}
					});
				}
			});
			var itemsForCheck = [], i = 0;
			steamOffers.loadMyInventory({ appId: config.steam.appid, contextId: 2, language: 'russian' }, function (error, botItems) {
				if (!error) {
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
                                bot_id: bot_id,
								quality: quality,
								type: type
							}
						}
					});
				}
				redisClient.rpush(redisChannels.itemsToCheck, JSON.stringify(itemsForCheck));
				return;
			});
		} catch (ex) { console.error('Ошибка:' + ex); }
	} else { setTimeout(MyInvToSite, 5000); }
};
var depCheckOffer = function(deposit_id) {
    console.log('Проверяем обмен: #' + deposit_id);
    steamOffers.getOffer({
        tradeOfferId: deposit_id
    }, function(err, body) {
        if(!body.response) return;
        if(body.response.offer){
            var offer = body.response.offer;
            if(offer.trade_offer_state == 3){
                var ritems = offer.items_to_receive,
                depItems = [],
                ritems_classid = [],
                siteitems_id = [];
                requestify.post('http://' + config.web.domain + '/api/shop/itemlist', {
                    secretKey: config.web.secretKey,
                    bot_id: bot_id
                }).then(function (response) {
                    var answer = JSON.parse(response.body);
                    if (answer.success) {
                        var sitems = answer.items;
                        ritems.forEach(function (item) { ritems_classid.push(item.classid); });
                        sitems.forEach(function (item) { siteitems_id.push(item); });
                        steamOffers.loadMyInventory({ appId: config.steam.appid, contextId: 2, language: 'russian' }, function (error, items) {
                            if (!error) {
                                var i = 0; items.forEach(function (item) {
                                    if ((ritems_classid.indexOf(item.classid) != -1) && (siteitems_id.indexOf(item.id) == -1) && item.tradable) {
                                        var rarity = '', type = '', arr = item.type.split(','); if (arr.length == 2) rarity = arr[1].trim(); if (arr.length == 3) rarity = arr[2].trim(); if (arr.length && arr[0] == 'Нож') rarity = 'Тайное';
                                        if (arr.length) type = arr[0]; var quality = item.market_name.match(/\(([^()]*)\)/); if (quality != null && quality.length == 2) quality = quality[1];
                                        depItems[i++] = { inventoryId: item.id, classid: item.classid, name: item.name, bot_id: bot_id, appid: item.appid, market_hash_name: item.market_hash_name, rarity: rarity, quality: quality, type: type }
                                    }
                                });
                                var result = { id: deposit_id, status: 1, items: depItems };
                                redisClient.rpush(redisChannels.depositResult, JSON.stringify(result), function(){
                                    console.log('Обмен #' + deposit_id + ' засчитан');
                                });
                            }
                        });
                    }
                }, function (response) { console.error('Something wrong with get items list.'); });
            } else if(offer.trade_offer_state == 2){
                var timeCheck = Math.floor(Date.now() / 1000) - offer.time_created;
                if (timeCheck >= config.timers.timeForCancelOffer) {
                    steamOffers.cancelOffer({tradeOfferId: deposit_id}, function (err, response) {
                        if (!err) {
                            var result = { id: deposit_id, status: 0 };
                            redisClient.rpush(redisChannels.depositResult, JSON.stringify(result));
                            console.log('Обмен #' + deposit_id + ' просрочен');
                        } else {
                            var result = { id: deposit_id, status: 2 };
                            redisClient.rpush(redisChannels.depositResult, JSON.stringify(result));
                            console.log('Обмен #' + deposit_id + ' активен');
                        }
                    });
                } else {
                    var result = { id: deposit_id, status: 2 };
                    redisClient.rpush(redisChannels.depositResult, JSON.stringify(result));
                    console.log('Обмен #' + deposit_id + ' активен');
                }
            } else {
                var result = { id: deposit_id, status: 0 };
                redisClient.rpush(redisChannels.depositResult, JSON.stringify(result));
                console.log('Обмен #' + deposit_id + ' отклонен');
            }
        }
    });
    return;
}
function AcceptMobileOffer() {
	if (WebSession){
        steamConfirmations.FetchConfirmations((function(err, confirmations) {
            if (err){
                return;
            }
            if (!confirmations.length){
                return;
            }
            console.log('Ожидает подтверждения: ' + confirmations.length);
            steamConfirmations.AcceptConfirmation(confirmations[0], (function(err, result) {
            }).bind(this));
        }).bind(this));
    }
}
var setItemStatus = function (items, status) {
    var response = {
        'status': status,
        'items': items
    }
    redisClient.rpush(redisChannels.updateStatus, JSON.stringify(response));
}
var setItemStatusReq = function () {
    requestify.post('http://' + config.web.domain + '/api/shop/setItemStatus', {
        secretKey: config.web.secretKey,
        bot_id: bot_id
    }).then(function (response) {itemStatus = false;}, function (response) {
		console.error('Something wrong with setItemStatus. Retry...');
		setTimeout(function () {
			setItemStatusReq()
		}, 1000);
	});
}
var addNewItems = function () {
    requestify.post('http://' + config.web.domain + '/api/shop/newItems', {
        secretKey: config.web.secretKey,
        bot_id: bot_id
    }).then(function (response) {
		var answer = JSON.parse(response.body);
		if (answer.success) {
			console.log('Предметы добавлены на сайт !');
			itemsToSaleProcced = false;
		}
	}, function (response) {
		console.error('Something wrong with newItems. Retry...');
		setTimeout(function () {
			addNewItems()
		}, 1000);
	});
}

var checkDepositComplete = function () {
    requestify.post('http://' + config.web.domain + '/api/shop/deposit/check', {
        secretKey: config.web.secretKey,
        bot_id: bot_id
    }).then(function (response) {
		var answer = JSON.parse(response.body);
		console.log('Обмены проверены !');
        depProcceed = false;
        ccProcceed = false;
	}, function (response) {
		console.error('Something wrong with checkDepositComplete. Retry...');
		setTimeout(function () {
			checkDepositComplete()
		}, 5000);
	});
}

var addCheckItems = function () {
    requestify.post('http://' + config.web.domain + '/api/shop/checkShop', {
        secretKey: config.web.secretKey,
        bot_id: bot_id
    }).then(function (response) {
		var answer = JSON.parse(response.body);
		if (answer.success) {
			console.log('Проверка завершена успешно!');
			itemsToCheckProcced = false;
		}
	}, function (response) {
		console.error('Something wrong with check. Retry...');
        setTimeout(function () {
            addCheckItems();
        }, 5000);
	});
}