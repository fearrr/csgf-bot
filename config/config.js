/*
Config file
*/
var config = {
    timers:{    // Timers (sec)
        check_steam_status: 30,     // Check Steam Status interval
        give_out_timer: 900,        // Give out interval nick check
        price_update_timer: 10800   // Price update timer
    },
    web_api_data:{
        secretKey: '',    // Provided to prevent HackingAttemps
        domain: '...',       // Site IP for direct connecion
        nameSite: 'http://.ru/',    // Shown when buying or winnig something
    },
    steam:{
        apiKey: '',
    },
    ports:{
        appServerPort: 2082,    // io port for games
        doubleServerPort: 2083, // io port for double
        chatServerPort: 2084,   // io port for chat
        shopServerPort: 2085,   // io port for shop
        botServerPort: 2086,    // io port for bot
        depositPort: 9770       // local port for local requests
    },
    bots:{  // your bots data
        game_bots:{
            game_bot: {
                steamid: '',
                username: '',
                password: '',
                secret: '=',
                identity_secret: '=',
                timeForCancelOffer: 300
            }
        },
        shop_bots:{
            shop_bot_1: {
                steamid: '',
                username: '',
                password: '',
                secret: '=',
                identity_secret: '=',
                timeForCancelOffer: 1800
            }
        }
    },
    admins: [
        '76561198073063637', '76561198067721846'
    ]
}

module.exports = config;