const ViberBot = require('viber-bot').Bot;
const BotEvents = require('viber-bot').Events;
const TextMessage = require('viber-bot').Message.Text;
const PictureMessage = require('viber-bot').Message.Picture;
const VideoMessage = require('viber-bot').Message.Video;
const KeyboardMessage = require('viber-bot').Message.Keyboard;
require('dotenv').config();
var {messageId} = require('../bot/bot');

const ngrok = require('../get_public_url');
const http = require('http');
const {
    statusesKeyboard
} = require("../keyboard");

const mongoose = require('mongoose');
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
                    "ActionBody": "checkContent",
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

    User.findOne({ 'viberId': viberId }, function (err, user) {
        if (user == null || user == undefined) {
            const newUser = new User({
                _id: new mongoose.Types.ObjectId(),
                viberId: viberId,
                createdAt: new Date()
            });

            newUser.save()
                .then(function () {
                    handleMsg(message, response);
                });
        } else {
            handleMsg(message, response);
        }
    });
}

function handleMsg(message, response) {
    const text = message.text;
    if (text === 'checkContent') {
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
        var msgText = '#VIBER\n\n';
        if(text) msgText += text + '\n\n';
        if(url) msgText += "<a href='" + url + "'>Медіа</a>";
        //Send to moderation
        const moderatorsChanel = process.env.TGMAINCHAT;
        const options = {
            parse_mode: "HTML"
        };
        const sentMsg = await messageId(moderatorsChanel, msgText, false, options);
        
        const inline_keyboard = await statusesKeyboard(requestId, true);
        const optionsMod = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        const sentActionMsg = await messageId(moderatorsChanel, "№" + request.requestId + '\n#pending', false, optionsMod);
        request.moderatorMsgID = sentMsg.message_id;
        request.moderatorActionMsgID = sentActionMsg.message_id;
        request.save();
        //Inform user
        bot.sendMessage(response.userProfile, [
            new TextMessage('Поки що ми не знайшли достатньої кількості доказів щодо цієї інформації. Ми нічого не знайшли або не бачили такої інформації у нашій базі перевірених новин.\n\nФактчекери почали опрацьовувати цей запит, це може зайняти до доби.')
        ]);

    } else {
        bot.sendMessage(response.userProfile, [
            new TextMessage('На жаль, ми не можемо обробити цей запит')
        ]);
    }
}

const local = process.env.LOCAL;
const webhookUrl = process.env.WEBHOOKURL;
if (local == parseInt(1)) {
    ngrok.getPublicUrl().then(publicUrl => {
        console.log('Set the new webhook to"', publicUrl);
        http.createServer(bot.middleware()).listen(8080, () => bot.setWebhook(publicUrl));
    }).catch(error => {
        console.log('Can not connect to ngrok server. Is it running?\nIf you dont work with Viber, please IGNORE');
        console.error(error);
    });
} else {
    const port = 8080;
    const https = require('https');
    https.createServer(bot.middleware()).listen(port, () => bot.setWebhook(webhookUrl).then((m) => console.log(m)));
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
