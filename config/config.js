/*
Config file
*/
var accounts = require('accounts.js');
var config = {
    timers:{
        check_steam_status: 30,     // Check Steam Status interval
        give_out_timer: 900,        // Give out interval nick check
        price_update_timer: 10800,  // Price update timer
        timeForCancelOffer: 1800    // Time for cancel trade    
    },
    web:{
        secretKey: 'Fzrc6bu0y7XTl74W8L',    // Provided to prevent HackingAttemps
        domain: '46.105.42.220',            // Site IP for direct connecion
        nameSite: 'http://csgf.ru/'        // Shown when buying or winnig something
    },
    steam:{
        apiKey: '3271FFD21F6302D62F4CE63C387DBDCA'
    },
    admins: admins(),
    accounts: accounts
}
module.exports = config;

function admins(){
    var sids = ['76561198073063637', '76561198067721846'];
    for (id in accounts.classic) {
        sids.push(accounts.classic[id].steamid);
    }
    for (id in accounts.shop) {
        sids.push(accounts.classic[id].steamid);
    }
    return sids;
}