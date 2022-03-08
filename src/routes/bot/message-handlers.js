const mongoose = require('mongoose');
const admins = String(process.env.ADMINS).split(',');

const Request = mongoose.model('Request');
const Image = mongoose.model('Image');
const Video = mongoose.model('Video');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');

const {
    CheckContentText,
    SubscribtionText,
    SetFakesRequestText,
    NoCurrentFakes
} = require('./contstants')
const {getSubscriptionBtn} = require("./utils");

const onStart = async (msg, bot) => {
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

    await bot.sendMessage(msg.chat.id, 'Перевір - інформаційний бот для перевірки даних та повідомлення сумнівних новин.\n\nПовідомляй дані, які хочеш перевірити:\n-пости в соціальних мережах\n-посилання\n-медіафайли або фото\n\nЦей контент перевіриться вручну та алгоритмами і ми дамо тобі відповідь.\n\nПеревіряють інформацію журналісти @gwaramedia, медіаволонтери та громадські активісти.', replyOptions);
    //Check if user registerd
    let newUser = new TelegramUser({
        _id: new mongoose.Types.ObjectId(),
        telegramID: msg.chat.id,
        createdAt: new Date()
    });
    await newUser.save().then(() => {}).catch((error) => {
        console.log("MongoErr: " + error.code);
    });
}

const onCheckContent = async (msg, bot) => {
    await bot.sendMessage(msg.chat.id, 'Надішліть чи перешліть матеріали які бажаєте перевірити');
}

const onSubscription = async (msg, bot) => {
    const user = await TelegramUser.findOne({telegramID: msg.chat.id});
    if (!user) return console.log("User not found 1.1")
    const inline_keyboard = getSubscriptionBtn(user.subscribed, user._id);
    var options = {
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    const fakeNews = await Data.findOne({name: 'fakeNews'});
    if (!fakeNews) return await bot.sendMessage(message.chat.id, NoCurrentFakes);
    const message_id = fakeNews.value.split('_')[0];
    const chat_id = fakeNews.value.split('_')[1];
    try {
        await bot.copyMessage(msg.chat.id, chat_id, message_id, options);
    } catch (e) { console.log(e) }
}

const onSetFakesRequest = async (msg, bot) => {
    
    if (admins.includes(String(msg.from.id))) {
        var options = {
            reply_markup: JSON.stringify({
                force_reply: true
            })
        };
        await bot.sendMessage(msg.chat.id, SetFakesRequestText, options);
    } else {console.log('not allowed')}
}

const onSetFakes = async (msg, bot) => {

    if (admins.includes(String(msg.from.id))) {
        const fakeNews = msg.message_id + '_' + msg.chat.id;
        Data.findOneAndUpdate({name: 'fakeNews'}, {value: fakeNews }, function(){});
        await bot.sendMessage(msg.chat.id, 'Зміни збережено');
        await bot.copyMessage(msg.chat.id, msg.chat.id, msg.message_id);
    } else {console.log('not allowed')}
}

const onSendFakes = async (msg, bot) => {
    if (admins.includes(String(msg.from.id))) {
        var inline_keyboard = [[{ text: 'Так', callback_data: 'SENDFAKES_1' }, { text: 'Ні', callback_data: 'SENDFAKES_0' }]];
        var options = {
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        await bot.sendMessage(msg.chat.id, 'Надіслати актуальні фейки користувачам?', options);
    } else {console.log('not allowed')}
}

const onReplyWithComment = async (msg, bot) => {
    //Process moderator's comment
    const request_id = msg.reply_to_message.text.split('_')[1];
    const commentMsgId = msg.message_id;
    const request = await Request.findByIdAndUpdate(request_id, {commentMsgId: commentMsgId, commentChatId: msg.chat.id });
    await informRequestersWithComment(request, msg.chat.id, commentMsgId, bot);
}

const onCheckRequest = async (msg, bot) => {
    console.log(msg);
    //Check any input message
    const requestId = new mongoose.Types.ObjectId();
    var mediaId, newImage, newVideo;
    var request = new Request({
        _id: requestId,
        requesterTG: msg.chat.id,
        requesterMsgID: msg.message_id,
        requesterUsername: msg.from.username,
        createdAt: new Date(),
        lastUpdate: new Date()
    });

    if (msg.forward_from_chat) { //Check if message has forwarded data (chat)
        request.telegramForwardedChat = msg.forward_from_chat.id;
        request.telegramForwardedMsg = msg.forward_from_message_id;

        const foundRequest = await Request.findOne({$and: [{telegramForwardedChat: request.telegramForwardedChat}, {telegramForwardedMsg: request.telegramForwardedMsg} ]}, '_id fakeStatus commentChatId commentMsgId');
        if (foundRequest != null) {
            if (foundRequest.fakeStatus === 0) return addToWaitlist(msg, foundRequest, bot);
            return reportStatus(msg, foundRequest, bot);
        }
    } else if (msg.forward_from) { //Check if message has forwarded data
        request.telegramForwardedChat = msg.forward_from.id;
    }

    if (msg.photo) {
        //Check if message has photo data
        mediaId = new mongoose.Types.ObjectId();
        //TODO this should be a bug!!!!
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
            request: requestId,
            createdAt: new Date()
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
            request: requestId,
            createdAt: new Date()
        });
        request.video = mediaId;

    } else {
        //Check if text is already in DB
        const foundText = await Request.findOne({text: msg.text}, '_id fakeStatus commentChatId commentMsgId');
        if (foundText != null) {
            if (foundText.fakeStatus === 0) return addToWaitlist(msg, foundText, bot);
            return reportStatus(msg, foundText, bot);
        }
    }

    if (msg.text) { //Get text data
        request.text = msg.text;
    } else if (msg.caption) {
        request.text = msg.caption;
    }

    //Save new request in DB
    if (newImage) await newImage.save();
    else if (newVideo) await newVideo.save();
    await request.save();

    //Inform user
    var options = {
        disable_web_page_preview: true
    };
    await bot.sendMessage(msg.chat.id, 'Ми нічого не знайшли або не бачили такого. Почали опрацьовувати цей запит\n\nЗ початком війни журналісти @gwaramedia запустила бот для перевірки новин на фейки — @perevir_bot\n\nНам надходить дуууже багато повідомлень. Тому відповіді можуть сильно затримуватись.\n\nМи дуже раді, що ви не вірите всьому, що гуляє в мережі, і надсилаєте інфо на перевірку, але нам потрібні додаткові руки. \n\nЯкщо хочеш стати бійцем інфо фронту — заповнюй анкету за лінком:\nhttps://bit.ly/3Cilv7a',options);

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
    await Request.findByIdAndUpdate(requestId, {moderatorMsgID: sentMsg.message_id, moderatorActionMsgID: sentActionMsg.message_id });
}

const onUnsupportedContent = async (msg, bot) => {
    await bot.sendMessage(msg.chat.id, 'Ми поки не обробляємо даний тип звернення.\n\nЯкщо ви хочете поділитись даною інформацією, надішліть на пошту hello@gwaramedia.com з темою ІНФОГРИЗ_Тема_Контекст про що мова. \n\nДодайте якомога більше супроводжуючої інформації:\n- дата матеріалів\n- локація\n- чому це важливо\n- для кого це\n\nЯкщо це важкі файли, краще завантажити їх в клауд з постійним зберіганням і надіслати нам посилання.');
}

async function addToWaitlist(msg, foundRequest, bot ) {
    try {
        await bot.sendMessage(msg.chat.id, 'Команда вже обробляє даний запит. Повідомимо про результат згодом');
    } catch (e){ console.log(e) }

    await Request.findByIdAndUpdate(foundRequest._id, {$push: { "otherUsetsTG": {requesterTG: msg.chat.id, requesterMsgID: msg.message_id }}});
}

async function reportStatus(msg, foundRequest, bot) {
    try {
        if (foundRequest.fakeStatus === 1) await bot.sendMessage(msg.chat.id, 'Ця інформація визначена як правдива');
        else if (foundRequest.fakeStatus === -1) await bot.sendMessage(msg.chat.id, 'Ця інформація визначена як оманлива');
    } catch (e){ console.log(e) }
    try {
        if (foundRequest.commentMsgId) await bot.copyMessage(msg.chat.id, foundRequest.commentChatId, foundRequest.commentMsgId);
    } catch (e){ console.log(e) }
}

async function informRequestersWithComment(request, chatId, commentMsgId, bot) {
    var options = {
        reply_to_message_id: request.requesterMsgID
    };

    try {
        await bot.copyMessage(request.requesterTG, chatId , commentMsgId, options);
    } catch (e){ console.log(e) }

    for (var i in request.otherUsetsTG) {
        const optionsR = {
            reply_to_message_id: request.otherUsetsTG[i].requesterMsgID
        };
        try {
            await bot.copyMessage(request.otherUsetsTG[i].requesterTG, chatId , commentMsgId, optionsR);
        } catch (e){ console.log(e) }
    }
    //TASK: Need to handle comment sending for users who joined waiting after comment was send & before fakeStatus changed
}

module.exports = {
    onStart,
    onCheckContent,
    onSubscription,
    onSetFakesRequest,
    onSetFakes,
    onSendFakes,
    onReplyWithComment,
    onCheckRequest,
    onUnsupportedContent
}