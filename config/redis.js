/*
Redis Config file
*/
var redis_conf = {
    App_Channels: {
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
    Bot_Channels: {
        checkItemsList: 'checkItems.list',
        checkList: 'check.list',
        checkedList: 'checked.list',
        betsList: 'bets.list',
        sendOffersList: 'send.offers.list',
        tradeoffersList: 'tradeoffers.list',
        declineList: 'decline.list',
        usersQueue: 'usersQueue.list',
        myItems: 'myItems.list'
    },
    Shop_Channels: {
        itemsToSale: 'items.to.sale',
        itemsToCheck: 'items.to.check',
        itemsToGive: 'items.to.give',
        offersToCheck: 'offers.to.check',
        updateShop: 'updateShop'
    }

}

module.exports = redis_conf;