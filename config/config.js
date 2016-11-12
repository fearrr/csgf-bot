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
        domain: '91.235.129.250',       // Site IP for direct connecion
        nameSite: 'http://csgf.ru/',    // Shown when buying or winnig something
    },
    steam:{
        apiKey: '',
    },
    ports:{
        app:{
            port: 2082,
            path: ''
        },
        double:{
            port: 2083,
            path: ''
        },
        chat:{
            port: 2084,
            path: ''
        },
        shop:{
            port: 2085,
            path: ''
        },
        bot:{
            port: 2086,
            path: ''
        },
        depositPort: 9770       // local port for local requests
    },
    bots:{  // your bots data
        game_bots:{
            game_bot: {
                steamid: '',
                username: ' ',
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
                secret: '+=',
                identity_secret: '+=',
                timeForCancelOffer: 1800
            }
        }
    },
    admins: [
        '76561198073063637', '76561198067721846'
    ]
}
module.exports = config;