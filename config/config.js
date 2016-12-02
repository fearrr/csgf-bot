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
        secretKey: 'Fzrc6bu0y7XTl74W8L',    // Provided to prevent HackingAttemps
        domain: '46.105.42.220',            // Site IP for direct connecion
        nameSite: 'http://csgf.ru/',        // Shown when buying or winnig something
    },
    steam:{
        apiKey: '3271FFD21F6302D62F4CE63C387DBDCA',
    },
    ports:{
        app:{
            port: 8081,
            path: '/var/run/csgf/app.sock'
        },
        double:{
            port: 8082,
            path: '/var/run/csgf/double.sock'
        },
        chat:{
            port: 8083,
            path: '/var/run/csgf/chat.sock'
        },
        shop:{
            port: 8084,
            path: '/var/run/csgf/shop.sock'
        },
        bot:{
            port: 8085,
            path: '/var/run/csgf/bot.sock'
        },
        deposit: {
            port: 8086,
            path: '/var/run/csgf/deposit.sock'
        }
    },
    bots:{  // your bots data
        game_bots:{
            game_bot: {
                steamid: '76561198067721846',
                username: 'skyfis67rus',
                password: 'nWZPzoSqCQgu4GHFa7xO21J594nZgbRpvQwMImpPWHD0r',
                secret: 'H8XA4CpNVRkCeExfaz1ZV5WyqK8=',
                identity_secret: 'oj43OcFfoMLG8HRPt2jYbTbZpWk=',
                timeForCancelOffer: 300
            }
        },
        shop_bots:{
            shop_bot_1: {
                steamid: '76561198073063637',
                username: 'skolya16',
                password: 'skonik16',
                secret: 'cyvp4RIJY6G9rlgJ+vO0XP0HmGE=',
                identity_secret: 'kxuhUWH+COaJ8ewQYA5SD8E4loo=',
                timeForCancelOffer: 1800
            }
        }
    },
    admins: [
        '76561198073063637', '76561198067721846'
    ]
}
module.exports = config;
