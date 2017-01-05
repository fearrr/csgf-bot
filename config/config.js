/*
Config file
*/
var accounts = require('./accounts.js');
var config = {
    graphite:{
        host: 'alpha.mh00.net', // graphite server host or ip 
        port: 2003, // graphite server udp port
        verbose: false,
        prefix: 'csgf'
    },
    timers:{
        check_steam_status: 120,    // Check Steam Status interval
        give_out_timer: 900,        // Give out interval nick check
        price_update_timer: 10800,  // Price update timer
        timeForCancelOffer: 1800,   // Time for cancel trade
        checkBrokenGamesTime: 900,  // Time for check broken games
        noActiveBot: 300,           // Time for bot session without trades
    },
    web:{
        secretKey: 'Fzrc6bu0y7XTl74W8L',    // Provided to prevent HackingAttemps
        domain: '167.114.232.119',            // Site IP for direct connecion
        nameSite: 'http://csgf.ru/'        // Shown when buying or winnig something
    },
    steam:{
        appid: 730,
        apiKey: 'A1B9C023D3EC63BB68A28155AE24629B'
    },
    admins: admins(),
    accounts: accounts
}
module.exports = config;

function admins(){
    var sids = ['76561198073063637'];
    for (id in accounts.classic) {
        sids.push(accounts.classic[id].steamid);
    }
    for (id in accounts.shop) {
        sids.push(accounts.classic[id].steamid);
    }
    return sids;
}
