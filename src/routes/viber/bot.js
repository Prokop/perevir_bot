const ViberBot = require('viber-bot').Bot;
const BotEvents = require('viber-bot').Events;
const TextMessage = require('viber-bot').Message.Text;
const PictureMessage = require('viber-bot').Message.Picture;
const VideoMessage = require('viber-bot').Message.Video;
const KeyboardMessage = require('viber-bot').Message.Keyboard;
require('dotenv').config();
var {messageId} = require('../bot/bot');
const { statusesKeyboard } = require("../keyboard");

const ngrok = require('../get_public_url');
const request = require('request');
const http = require('http');

const mongoose = require('mongoose');
const {checkUserThrottling, safeErrorLog} = require("../bot/utils");
const User = mongoose.model('ViberUser');
const Request = mongoose.model('Request');

//VIBER BOT
if (!process.env.VIBER_PUBLIC_ACCOUNT_ACCESS_TOKEN_KEY) {
    console.log('Could not find the Viber account access token key in your environment variable. Please make sure you followed readme guide.');
    return;
}

const bot = new ViberBot({
    authToken: process.env.VIBER_PUBLIC_ACCOUNT_ACCESS_TOKEN_KEY,
    name: "Перевірка",
    avatar: "../assets/img/perevirka_logo.png"
});

bot.onConversationStarted((userProfile, isSubscribed, context) => {
    var action = "checkContent";
    if (context) action += '_' + context;
    if (isSubscribed == false) {
        const SAMPLE_KEYBOARD = {
            "Type": "keyboard",
            "Revision": 1,
            "InputFieldState": "hidden",
            "Buttons": [
                {
                    "Columns": 6,
                    "Rows": 1,
                    "Text": "Перевірити контент",
                    "ActionType": "reply",
                    "ActionBody": action,
                    "TextSize": "large"
                }
            ]
        };

        const message = new TextMessage('🟡 ПЕРЕВІРКА — бот від журналістів @gwaramedia для виявлення сумнівної інформації та суперечливих фактів.\n\nНадсилай новини, статті, фото, посилання, пересилай повідомлення в наш бот, а ми перевіримо, чи правдива ця інформація. Відповідь надійде протягом доби.',SAMPLE_KEYBOARD,null,null,null,3);
        bot.sendMessage(userProfile, message)
    }
});

bot.on(BotEvents.MESSAGE_RECEIVED, (message, response) => {
    if ((message instanceof TextMessage) || (message instanceof PictureMessage) || (message instanceof VideoMessage)) {
        onMessage(message, response);
    } else {
        onUnsupportedContent(response);
    }
});

function onMessage(message, response) {

    const viberId = response.userProfile.id;

    User.findOne({ 'viberId': viberId }, async function (err, user) {
        if (user.status === 'blocked') return;

        if (user == null || user == undefined) {
            const text = message.text;
            var campaign;
            if (text && text.startsWith('checkContent_c_')) {
                campaign = text.split('_c_')[1];
            }

            const newUser = new User({
                _id: new mongoose.Types.ObjectId(),
                viberId: viberId,
                joinedCampaign: campaign,
                createdAt: new Date()
            });
            try {
                await newUser.save();
            } catch (error) {
                console.error(error);
            }
            handleMsg(message, response);
        } else {
            handleMsg(message, response);
        }
    });
}

function handleMsg(message, response) {
    const text = message.text;
    if (text && text.startsWith('checkContent')) {
        onCheckContent(response);
    } else {
        onNewRequest(message, response);
    }
}

function onUnsupportedContent(response) {
    bot.sendMessage(response.userProfile, [
        new TextMessage('Ми не обробляємо даний тип звернення. Будь ласка, надішліть нам фото, відео, текст, посилання. Ми обов’язково його перевіримо і дамо вам відповідь протягом доби.')
    ]);
}

function onCheckContent(response) {

    const SAMPLE_KEYBOARD = {
        "Type": "keyboard",
        "Revision": 1,
        "InputFieldState": "hidden",
        "Buttons": [
            {
                "Columns": 6,
                "Rows": 1,
                "Text": "Перевірити контент",
                "ActionType": "reply",
                "ActionBody": "checkContent",
                "TextSize": "large"
            }
        ]
    };

    bot.sendMessage(response.userProfile, [
        new TextMessage('Надішліть нам матеріали, які бажаєте перевірити. Це може бути фото, відео, текст чи посилання.'),
        new KeyboardMessage(SAMPLE_KEYBOARD)
    ]);
}

async function onNewRequest (message, response) {
    const url = message.url;
    const text = message.text;
    const requester = response.userProfile.id;
    if (await checkUserThrottling(requester, true)) {
        bot.sendMessage(response.userProfile, [
            new TextMessage('Ви перевищили ліміт запитів. Відпочиньте і спробуйте пізніше.')
        ]);
        return;
    }
    if (text || url) {
        const requestId = new mongoose.Types.ObjectId();
        const reqsCount = await Request.countDocuments({});
        var request = new Request({
            _id: requestId,
            viberReq: true, 
            viberRequester: requester, 
            viberMediaUrl: url,
            requestId: reqsCount + 1,
            createdAt: new Date(),
            lastUpdate: new Date()
        });
        var msgText = '';
        if(text) msgText += text + '\n\n';
        if(url) msgText += "<a href='" + url + "'>Медіа</a>";
        //Send to moderation
        const moderatorsChanel = process.env.TGMAINCHAT;
        const options = {
            parse_mode: "HTML"
        };
        const sentMsg = await messageId(moderatorsChanel, msgText, false, options);
        if (sentMsg == null) {
            return bot.sendMessage(response.userProfile, [
                new TextMessage('На жаль, ми не можемо обробити цей запит зараз. Спробуйте ще раз, за декілька хвилин.')
            ]);
        }
        
        const inline_keyboard = await statusesKeyboard(requestId, true);
        const optionsMod = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        const sentActionMsg = await messageId(moderatorsChanel, "№" + request.requestId + '\n#pending | #viber', false, optionsMod);
        request.moderatorMsgID = sentMsg.message_id;
        request.moderatorActionMsgID = sentActionMsg.message_id;
        request.save();
        //Inform user
        bot.sendMessage(response.userProfile, [
            new TextMessage('Поки що ми не знайшли достатньої кількості доказів щодо цієї інформації. Ми нічого не знайшли або не бачили такої інформації у нашій базі перевірених новин.\nФактчекери почали опрацьовувати цей запит, це може зайняти до доби.\n\n📝Переходь до Telegram-боту Перевірки та проходь освітні тести для того, щоб навчитися самостійно боротися з фейками: https://t.me/perevir_bot?start=quiz')
        ]);

    } else {
        bot.sendMessage(response.userProfile, [
            new TextMessage('На жаль, ми не можемо обробити цей запит')
        ]);
    }
}

const local = process.env.LOCAL;
const webhookUrl = process.env.VIBER_WEBHOOK_SERVER_URL;
const port = process.env.VIBER_WEBHOOK_SERVER_PORT;

if (local == parseInt(1)) {
    ngrok.getPublicUrl().then(publicUrl => {
        console.log('Set the new webhook to', publicUrl);
        http.createServer(bot.middleware()).listen(8080, () => bot.setWebhook(publicUrl)
          .then((m) => console.log(m))
          .catch(async (e) => {
              console.log('err')
              console.log(e)
          })
        );
    }).catch(error => {
        console.log('Can not connect to ngrok server. Is it running?\nIf you dont work with Viber, please IGNORE');
        console.error(error);
    });
} else {
    setWebhook();
}

async function setWebhook() {
    var options = {
        'method': 'GET',
        'url': webhookUrl
    };
    
    request(options, async function (error, response) {
        if (error || response.statusCode == 503) {
            console.log(error)
            console.log("Unable to connect to " + webhookUrl);
            await sleep(1000); 
            return setWebhook();
        }
        
        console.log("Setting webhook to: " + webhookUrl + " and port: " + port);
        http.createServer(bot.middleware()).listen(port, () => bot.setWebhook(webhookUrl)
          .then((m) => console.log(m))
          .catch(async (e) => {
              console.log('err')
              console.log(e)
          })
        );
    });
}

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

module.exports = {
    messageViber: async function (text, userId) {
        try {
            return await bot.sendMessage({id: userId}, [
                new TextMessage(text)
            ]);
        } catch (e){ console.log(e) }
    }
};
