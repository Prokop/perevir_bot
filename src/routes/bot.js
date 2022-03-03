const mongoose = require('mongoose');
require('dotenv').config();

//TELEGRAM BOT
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TGTOKEN;
const bot = new TelegramBot(token, { polling: true });
const admins = String(process.env.ADMINS).split(',');

const Request = mongoose.model('Request');
const Image = mongoose.model('Image');
const Video = mongoose.model('Video');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');

//BUTTONS TEXT
const CheckContentText = "Перевірити контент"
const SubscribtionText = "🔥 Актуальні фейки"
//OTHER TEXT
const FakeNewsText = "Надсилаємо тобі підбірку фейків, які зараз літають по Україні та світу і загрожують нам. Знай найголовніше, поширюй це в соціальних мережах та протидій.\n\n";

bot.on('message', async (msg) => {
    const text = msg.text;

    if (text == '/start') {
        let replyOptions = {
            reply_markup: {
                resize_keyboard: true,
                one_time_keyboard: false,
                keyboard: [
                    [{ text: CheckContentText }],
                    [{ text: SubscribtionText }]
                ]
            }
        };

        bot.sendMessage(msg.chat.id, 'Перевір - інформаційний бот для перевірки даних та повідомлення сумнівних новин.\n\nПовідомляй дані, які хочеш перевірити:\n-пости в соціальних мережах\n-посилання\n-медіафайли або фото\n\nЦей контент перевіриться вручну та алгоритмами і ми дамо тобі відповідь.\n\nПеревіряють інформацію журналісти @gwaramedia, медіаволонтери та громадські активісти.', replyOptions);
        //Check if user registerd
        var newUser = new TelegramUser({
            _id: new mongoose.Types.ObjectId(),
            telegramID: msg.chat.id
        });
        newUser.save().then(() => {}).catch((error) => {
            console.log("MongoErr: " + error.code);
        });


    } else if (text == CheckContentText) {
        bot.sendMessage(msg.chat.id, 'Надішліть чи перешліть матеріали які бажаєте перевірити');

    } else if (text == SubscribtionText) {
        const user = await TelegramUser.findOne({telegramID: msg.chat.id});
        if (!user) return console.log("User not found 1.1")
        const inline_keyboard = getSubscriptionBtn(user.subscribed, user._id);
        var options = {
            parse_mode: 'HTML',
            reply_markup: JSON.stringify({
                inline_keyboard
            }) 
        };
        const fakeNews = await Data.findOne({name: 'fakeNews'});
        try {
            bot.sendMessage(msg.chat.id, FakeNewsText + fakeNews.value, options);
        } catch (e) { console.log(e) }

    } else if (text.indexOf('/setfakes ') != -1) {
        if (admins.includes(String(msg.from.id)) && text.split(' ')[2] != undefined) { //Check if >1 word
            const newFakes = text.substring(text.split(' ')[0].length + 1);
            Data.findOneAndUpdate({name: 'fakeNews'}, {value: newFakes}, function(){});
            bot.sendMessage(msg.chat.id, FakeNewsText + newFakes);
        } else {console.log('not allowed')}
    
    } else if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.text.indexOf('#comment_') != -1){
        //Process moderator's comment
        const request_id = msg.reply_to_message.text.split('_')[1];
        const commentMsgId = msg.message_id;
        const request = await Request.findByIdAndUpdate(request_id, {commentMsgId: commentMsgId, commentChatId: msg.chat.id });
        informRequestersWithComment(request, msg.chat.id, commentMsgId);

    } else if ((msg.photo || msg.video || (msg.text && msg.text.length > 10)) && !msg.reply_to_message) { //Check if text > 10 in order to sort out short msgs
        console.log(msg);
        //Check any input message 
        const requestId = new mongoose.Types.ObjectId();
        var mediaId, newImage, newVideo;
        var request = new Request({
            _id: requestId,
            requesterTG: msg.chat.id,
            requesterMsgID: msg.message_id,
            requesterUsername: msg.from.username
        });

        if (msg.forward_from_chat) { //Check if message has forwarded data (chat)
            request.telegramForwardedChat = msg.forward_from_chat.id;
            request.telegramForwardedMsg = msg.forward_from_message_id;

            const foundRequest = await Request.findOne({$and: [{telegramForwardedChat: request.telegramForwardedChat}, {telegramForwardedMsg: request.telegramForwardedMsg} ]}, '_id fakeStatus commentChatId commentMsgId');
            if (foundRequest != null) {
                if (foundRequest.fakeStatus == 0) return addToWaitlist(msg, foundRequest);
                return reportStatus(msg, foundRequest);
            }
        } else if (msg.forward_from) { //Check if message has forwarded data
            request.telegramForwardedChat = msg.forward_from.id;
        }
        
        if (msg.photo) { //Check if message has photo data
            mediaId = new mongoose.Types.ObjectId();
            var image = msg.photo.find(obj => { return obj.width === 1280 }) //For now only first photo with 1280*886 resolution
            if (image = []) image = msg.photo[msg.photo.length - 1]; //If there is no 1280 image, let's take the highest possible resolution
            const imageFile = await bot.getFile(image.file_id);
            //const fileUrl = 'https://api.telegram.org/file/bot' + token + '/' + imageFile.file_path;
            
            newImage = new Image({
                _id: mediaId, 
                telegramFileId: image.file_id, 
                telegramUniqueFileId: image.file_unique_id, 
                telegramFilePath: imageFile.file_path,
                fileSize: image.file_size, 
                width: image.width,  
                height: image.height, 
                request: requestId
            });
            request.image = mediaId;

        } else if (msg.video) { //Check if message has video data
            mediaId = new mongoose.Types.ObjectId();
            const video = msg.video;
            newVideo = new Video({
                _id: mediaId, 
                telegramFileId: video.file_id, 
                telegramUniqueFileId: video.file_unique_id,
                fileSize: video.file_size, 
                width: video.width,  
                height: video.height, 
                duration: video.duration,
                request: requestId
            });
            request.video = mediaId;
            
        } else {
            //Check if text is already in DB
            const foundText = await Request.findOne({text: msg.text}, '_id fakeStatus commentChatId commentMsgId');
            if (foundText != null) {
                if (foundText.fakeStatus == 0) return addToWaitlist(msg, foundText);
                return reportStatus(msg, foundText);
            }
        }

        if (msg.text) { //Get text data
            request.text = msg.text;
        } else if (msg.caption) {
            request.text = msg.caption;
        }

        //Save new request in DB
        if (newImage) newImage.save();
        else if (newVideo) newVideo.save(); 
        await request.save(); 

        //Inform user
        bot.sendMessage(msg.chat.id, 'Ми нічого не знайшли або не бачили такого. Почали опрацьовувати цей запит');
        
        //Send message to moderation
        const sentMsg = await bot.forwardMessage(process.env.TGMAINCHAT, msg.chat.id, msg.message_id);

        var inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
        inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
        var options = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            }) 
        };
        const sentActionMsg = await bot.sendMessage(process.env.TGMAINCHAT,'#pending',options);
        Request.findByIdAndUpdate(requestId, {moderatorMsgID: sentMsg.message_id, moderatorActionMsgID: sentActionMsg.message_id }, function(){});
    
    } else if (msg.audio || msg.document || msg.voice || msg.location) {
        bot.sendMessage(msg.chat.id, 'Ми поки не обробляємо даний тип звернення.\n\nЯкщо ви хочете поділитись даною інформацією, надішліть на пошту hello@gwaramedia.com з темою ІНФОГРИЗ_Тема_Контекст про що мова. \n\nДодайте якомога більше супроводжуючої інформації:\n- дата матеріалів\n- локація\n- чому це важливо\n- для кого це\n\nЯкщо це важкі файли, краще завантажити їх в клауд з постійним зберіганням і надіслати нам посилання.');
    }
  
});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {

    const action = callbackQuery.data;
    const msg = callbackQuery.message;

    if (action.indexOf('FS_') == 0) {
        const requestId = action.split('_')[2], fakeStatus = action.split('_')[1];
        Request.findByIdAndUpdate(requestId, {fakeStatus: fakeStatus}, function(err, request){
            if (!request) return console.log('No request ' + requestId);
            var inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
            if (!request.commentChatId) inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
            var status;
            if (fakeStatus == 1) status = "#true | Правда"
            else if (fakeStatus == -1) status = "#false | Фейк"

            bot.editMessageText("#resolved | " + status, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            });

            notifyUsers(request, fakeStatus);
                
        });

    } else if (action.indexOf('CS_') == 0) {
        //Change status back to pending
        const requestId = action.split('_')[1];
        const request = await Request.findByIdAndUpdate(requestId, {fakeStatus: 0});
        if (!request) return console.log('No request ' + requestId);
        var inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
        if (!request.commentChatId) inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
        
        try {
            bot.editMessageText("#pending", {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            });
        } catch (e){ console.log(e) }
    
    } else if (action.indexOf('COMMENT_') == 0) {
        const requestId = action.split('_')[1];
        const moderator = callbackQuery.from.id;
        const request = await Request.findById(requestId);
        //Send message to moderator (forwarded + action)
        try {
            var sentMsg = await bot.forwardMessage(moderator, msg.chat.id, request.moderatorMsgID);
            var options = {
                reply_to_message_id: sentMsg.message_id,
                reply_markup: JSON.stringify({
                    force_reply: true
                })
            };
        } catch (e){
            bot.sendMessage(msg.chat.id, 'Необхідно стартанути бота @perevir_bot\n@' + callbackQuery.from.username + '\n\n' + "FYI @betabitter43");
        }
        
        try {
            bot.sendMessage(moderator, '#comment_' + requestId , options);
        } catch (e){ console.log(e) }
        //Update moderators action message
        var inline_keyboard;
        if (request.fakeStatus == 0) {
            inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
        } else {
            inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
        }
        bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
                chat_id: msg.chat.id,
                message_id: msg.message_id
            });
        //Set moderator for the comment
        Request.findByIdAndUpdate(requestId, {commentChatId: msg.chat.id }, function(){});

    } else if (action.indexOf('SUB_') == 0) {
        //Change status back to pending
        const status = Boolean(parseInt(action.split('_')[1]));
        const userId = action.split('_')[2];
        //Update DB
        const user = await TelegramUser.findByIdAndUpdate(userId, {subscribed: status});
        //Update MSG
        const inline_keyboard = getSubscriptionBtn(status, user._id);
        bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
                chat_id: msg.chat.id,
                message_id: msg.message_id
            });

    }
});

function addToWaitlist(msg, foundRequest) {
    try {
        bot.sendMessage(msg.chat.id, 'Команда вже обробляє даний запит. Повідомимо про результат згодом');
    } catch (e){ console.log(e) }
    Request.findByIdAndUpdate(foundRequest._id, {$push: { "otherUsetsTG": {requesterTG: msg.chat.id, requesterMsgID: msg.message_id }}}, function(){});
}

function getSubscriptionBtn(status, user_id) {
    var inline_keyboard = [];
    if (status) inline_keyboard.push([{ text: '🔴 Відмовитися від підбірок', callback_data: 'SUB_0_' + user_id }]);
    else inline_keyboard.push([{ text: '✨ Отримувати підбірки', callback_data: 'SUB_1_' + user_id }]);
    return inline_keyboard;
}

async function reportStatus(msg, foundRequest) {
    try {
        if (foundRequest.fakeStatus == 1) await bot.sendMessage(msg.chat.id, 'Ця інформація визначена як правдива');
        else if (foundRequest.fakeStatus == -1) await bot.sendMessage(msg.chat.id, 'Ця інформація визначена як оманлива');
    } catch (e){ console.log(e) } 
    try {
        if (foundRequest.commentMsgId) bot.copyMessage(msg.chat.id, foundRequest.commentChatId, foundRequest.commentMsgId);
    } catch (e){ console.log(e) } 
}

function notifyUsers(foundRequest, fakeStatus) {
    var options = {
        reply_to_message_id: foundRequest.requesterMsgID
    };

    if (fakeStatus == 1) {
        try {
            bot.sendMessage(foundRequest.requesterTG, 'Ваше звернення визначено як правдиве', options);
        } catch (e){ console.log(e) }

        for (var i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, 'Ваше звернення визначено як правдиве', optionsR);
            } catch (e){ console.log(e) }
        }

    } else if (fakeStatus == -1) {
        try {
            bot.sendMessage(foundRequest.requesterTG, 'Ваше звернення визначено як оманливе', options);
        } catch (e){ console.log(e) }

        for (var i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, 'Ваше звернення визначено як оманливе', optionsR);
            } catch (e){ console.log(e) }
        }
    }
}

function informRequestersWithComment(request, chatId, commentMsgId) {
    var options = {
        reply_to_message_id: request.requesterMsgID
    };
    
    try {
        bot.copyMessage(request.requesterTG, chatId , commentMsgId, options);
    } catch (e){ console.log(e) }
    
    for (var i in request.otherUsetsTG) {
        const optionsR = {
            reply_to_message_id: request.otherUsetsTG[i].requesterMsgID
        };
        try {
            bot.copyMessage(request.otherUsetsTG[i].requesterTG, chatId , commentMsgId, optionsR);
        } catch (e){ console.log(e) }
    }
    //TASK: Need to handle comment sending for users who joined waiting after comment was send & before fakeStatus changed
}

bot.on("polling_error", (err) => console.log(err.message));

module.exports = {
    message: async function (msg, pin) {
        try {
            const sentMsg = await bot.sendMessage(process.env.TGMAINCHAT, msg);
            if(pin) bot.pinChatMessage(process.env.TGMAINCHAT, sentMsg.message_id);
        } catch (e){ console.log(e) }
    }
};
