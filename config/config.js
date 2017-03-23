var accounts = require('./accounts.js');
var config = {
    graphite: true,
    graphite_conf:{
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
        checkBrokenGamesTime: 900,   // Time for check broken games
        noActiveBot: 300,           // Time for bot session without trades
    },
    web:{
        secretKey: 'Fzrc6bu0y7XTl74W8L',    // Provided to prevent HackingAttemps
        domain: 'https://csgf.ru',            // Site IP for direct connecion
        nameSite: 'https://csgf.ru/'        // Shown when buying or winnig something
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
        sids.push(accounts.shop[id].steamid);
    }
    return sids;
}
