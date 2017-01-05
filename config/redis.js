/*
Redis Config file
*/
var redis_conf = {
    host: '127.0.0.1',
    port: '6379',
    password: 'g9LzUfRtX5Vnz4Kxb7',
    path: '/run/redis/redis.sock',
    unix: false,
    channels:{
        app: {
            show_winners: 'show.winners',
            depositDecline: 'depositDecline',
            queue: 'queue',
            ctime: 'ctime',
            dice: 'dice',
            gifts: 'gifts',
            out_new: 'out_new',
            coin_scroll: 'coin_scroll',
            coin_new: 'coin_new',
            fuser_add: 'fuser_add',
            fuser_del: 'fuser_del',
            fuser_delall: 'fuser_delall',
            fuser_delone: 'fuser_delone',
            newDeposit: 'newDeposit',
            msgChannel: 'msgChannel',
            app_log: 'app_log',
            view_bet: 'view_bet',
            usersQueue: 'usersQueue.list'
        },
        bot: {
            betsList: 'bets.list',
            usersQueue: 'usersQueue.list',
            getChannels: function(bot_id){
                var channels = {
                    checkItemsList: 'b' + bot_id + '_checkItems.list',
                    checkList: 'b' + bot_id + '_check.list',
                    checkedList: 'b' + bot_id + '_checked.list',
                    sendOffersList: 'b' + bot_id + '_send.offers.list',
                    tradeoffersList: 'b' + bot_id + '_tradeoffers.list',
                    declineList: 'b' + bot_id + '_decline.list',
                    usersQueue: 'usersQueue.list',
                    betsList: 'bets.list',
                    queue: 'queue'
                }
                return channels;
            }
        },
        shop: {
            getChannels: function(bot_id){
                var channels = {
                    itemsToSale: 's' + bot_id + '_items.to.sale',
                    itemsToCheck: 's' + bot_id + '_items.to.check',
                    itemsToGive: 's' + bot_id + '_items.to.give',
                    offersToCheck: 's' + bot_id + '_offers.to.check',
                    depositResult: 's' + bot_id + '_offers.deposit.result',
                    declineList: 's' + bot_id + '_shop.decline.list',
                    updateShop: 's' + bot_id + '_updateShop',
                    updateStatus: 's' + bot_id + '_items.to.status',
                    tempDeposit: 's' + bot_id + '_deposit.temp'
                }
                return channels;
            }
        }
    }

}
module.exports = redis_conf;
