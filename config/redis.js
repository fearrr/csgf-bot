/*
Redis Config file
*/
var redis_conf = {
    host: null,
    port: null,
    password: 'g9LzUfRtX5Vnz4Kxb7',
    path: '/run/redis/redis.sock',
    unix: true,
    channels:{
        app: {
            show_winners: 'show.winners',
            queue: 'queue',
            ctime: 'ctime',
            dice: 'dice',
            out_new: 'out_new',
            coin_scroll: 'coin_scroll',
            coin_new: 'coin_new',
            fuser_add: 'fuser_add',
            fuser_del: 'fuser_del',
            fuser_delall: 'fuser_delall',
            newDeposit: 'newDeposit',
            msgChannel: 'msgChannel',
            app_log: 'app_log',
            depositDecline: 'depositDecline'
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
                    betsList: 'bets.list',
                    usersQueue: 'usersQueue.list'
                }
                return channels;
            }
        },
        shop: {
            itemsToSale: 'items.to.sale',
            itemsToCheck: 'items.to.check',
            itemsToGive: 'items.to.give',
            offersToCheck: 'offers.to.check',
            depositResult: 'offers.deposit.result',
            declineList: 'shop.decline.list',
            updateShop: 'updateShop'
        }
    }

}
module.exports = redis_conf;
