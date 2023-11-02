const mongoose = require('mongoose');
const admins = String(process.env.ADMINS).split(',');
const redactionGroup = process.env.TGREDACTIONSGROUP;

const Request = mongoose.model('Request');
const Escalation = mongoose.model('Escalation');
const Image = mongoose.model('Image');
const Video = mongoose.model('Video');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');
const SourceTelegram = mongoose.model('SourceTelegram');
const SourceDomain = mongoose.model('SourceDomain');
const Comment = mongoose.model('Comment');

const {
    CheckContentText,
    SubscribtionText,
    QuizText,
    ChangeLanguage,
    NoCurrentFakes,
    UnsupportedContentText,
    SetFakesRequestText,
    RequestTimeout
} = require('./contstants');
const { getText, getLanguageTGChat} = require('./localisation');
const {
    getSubscriptionBtn,
    getDomainWithoutSubdomain,
    newFacebookSource,
    newTwitterSource,
    newYoutubeSource,
    getLabeledSource,
    safeErrorLog,
    getLanguage,
    shiftOffsetEntities,
    parseSource,
    updateSource,
    getUserName,
    checkUserThrottling,
} = require("./utils");

const {
    takeRequestKeyboard
} = require("../keyboard");
const { sendTextMessage } = require('../whatsapp/functions');
const { sendTextMessageMessenger } = require('../messenger/functions');

const onStart = async (msg, bot, lang, campaign) => {

    const replyOptions = await getReplyOptions(lang);

    try {
        await getText('welcome', lang, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                await bot.sendMessage(msg.chat.id, text, replyOptions);
            } catch (e) { safeErrorLog(e) }
        });
    } catch (e) { safeErrorLog(e) }
    //Check if user registered
    let newUser = new TelegramUser({
        _id: new mongoose.Types.ObjectId(),
        telegramID: msg.chat.id,
        language: lang,
        joinedCampaign: campaign,
        createdAt: new Date()
    });
    await newUser.save().then(() => {}).catch(() => {});
}

const getReplyOptions = async (lang) => {

    var keyboard = [
        [{ text: CheckContentText[`${lang}`] }],
        [{ text: SubscribtionText[`${lang}`] }],
        [{ text: QuizText[`${lang}`] }],
        [{ text: ChangeLanguage[`${lang}`] }]
    ];
    if (lang == 'en') {
        keyboard.splice(1,2)
    }

    return {
        reply_markup: {
            resize_keyboard: true,
            one_time_keyboard: false,
            keyboard: keyboard
        }
    };
}

const onCheckContent = async (msg, bot) => {
    const {language} = await getLanguage(msg.chat.id);
    try {
        await getText('check_content', language, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                await bot.sendMessage(msg.chat.id, text);
            } catch (e) { safeErrorLog(e) }
        });
    } catch (e) { safeErrorLog(e) }
}

const onSubscription = async (msg, bot) => {
    const user = await TelegramUser.findOne({telegramID: msg.chat.id});
    if (!user) return console.log("User not found 1.1")
    const inline_keyboard = getSubscriptionBtn(user.subscribed, user._id);

    const fakeNews = await Data.findOne({name: 'fakeNewsText'});
    if (!fakeNews) { 
        try {
            return await bot.sendMessage(message.chat.id, NoCurrentFakes);
        } catch (e) { return safeErrorLog(e) }
    }
    const content = JSON.parse(fakeNews.value);
    const text = content.text;
    const entities = content.entities;
    
    var options = {
        entities: JSON.stringify(entities),
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };

    try {
        await bot.sendMessage(msg.chat.id, text, options);
    } catch (e) { safeErrorLog(e) }
}

const onChangeLanguage = async (msg, bot) => {
    const user = await TelegramUser.findOne({telegramID: msg.chat.id});
    if (!user) return console.log("User not found 1.1");

    var lang = user.language;
    if (!lang) return console.log("User has no language");

    if (lang == 'en') lang = 'ua';
    else if (lang == 'ua') lang = 'en';
    
    await TelegramUser.findByIdAndUpdate(user._id, {language: lang});
    const replyOptions = await getReplyOptions(lang);
    
    try {
        await getText('change_lang', lang, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                await bot.sendMessage(msg.chat.id, text, replyOptions);
            } catch (e) { safeErrorLog(e) }
        });
    } catch (e) { safeErrorLog(e) }

}

const onSetFakesRequest = async (msg, bot) => {
    
    if (admins.includes(String(msg.from.id))) {
        var options = {
            reply_markup: JSON.stringify({
                force_reply: true
            })
        };
        try {
            await bot.sendMessage(msg.chat.id, SetFakesRequestText, options);
        } catch (e) { safeErrorLog(e) }
    } else {console.log('not allowed')}
}

const onSetSource = async (msg, bot, fake) => {
    
    if (admins.includes(String(msg.from.id))) {
        const text = msg.text;
        const source = text.split(' ')[1];
        const description = text.split(' ').slice(2).join(' ');
        
        if (!source || source.length < 5) {
            try {
                return await bot.sendMessage(msg.chat.id, 'Введені дані некоректні');
            } catch (e) { safeErrorLog(e) }
        }
        //Check if telegram channel
        if (source.startsWith('https://t.me/')) {
            const username = '@' + source.split('https://t.me/')[1];
            var chatInfo;
            try {
                chatInfo = await bot.getChat(username);
            } catch (i) {
                try {
                    return await bot.sendMessage(msg.chat.id, "Такого ресурсу не знайдено");
                } catch (e) { safeErrorLog(e) }
            }
            var newSourceTelegram = new SourceTelegram({
                _id: new mongoose.Types.ObjectId(),
                telegramId: chatInfo.id,
                telegramUsername: chatInfo.username,
                fake: fake,
                description: description,
                createdAt: new Date()
            });
            await newSourceTelegram.save().then(async () => {
                try {
                    await bot.sendMessage(msg.chat.id, "Чат @" + chatInfo.username + " успішно додано. Опис:\n" + description);
                } catch (e) { safeErrorLog(e) }
            }).catch(async () => {
                await SourceTelegram.findOneAndUpdate({telegramId: chatInfo.id}, {fake: fake, description: description});
                try {
                    await bot.sendMessage(msg.chat.id, "Інформацію про чат оновлено");
                } catch (e) { safeErrorLog(e) }
            });
            
        } else {
            var hostname, username, params, url, host;
            try {
                url = new URL(source);
                host = getDomainWithoutSubdomain(url.origin);
            } catch (e) {
                safeErrorLog(e)
                try {
                    await bot.sendMessage(msg.chat.id, 'Некоректний URL'); 
                    return false
                } catch (e) { safeErrorLog(e) }
            }

            if (host == 'facebook.com') params = await newFacebookSource(url);
            else if (host == 'twitter.com') params = await newTwitterSource(url);
            else if (host == 'youtube.com') params = await newYoutubeSource(url);
            else hostname = host;

            if (params) {
                hostname = params.hostname;
                username = params.username;
            }
            if (!hostname) {
                try {
                    await bot.sendMessage(msg.chat.id, 'На жаль такий формат поки не підтримується.'); 
                    return false
                } catch (e) { safeErrorLog(e) }
            }
            const domain = username ? hostname + '/' + username : hostname;
            var newSourceDomain = new SourceDomain({
                _id: new mongoose.Types.ObjectId(),
                domain: domain,
                hostname: hostname,
                username: username,
                fake: fake,
                description: description,
                createdAt: new Date()
            });
            await newSourceDomain.save().then(async () => {
                if (!username) await bot.sendMessage(msg.chat.id, "Ресурс " + hostname + " успішно додано. Опис:\n" + description);
                else bot.sendMessage(msg.chat.id, "Профіль " + username + " на ресурсі " + hostname + " успішно додано. Опис:\n" + description);
            }).catch(async () => {
                await SourceDomain.findOneAndUpdate({domain: domain}, {fake: fake, hostname: hostname, username: username, description: description});
                await bot.sendMessage(msg.chat.id, "Інформацію про ресурс оновлено");
            });

        }
    } else {console.log('not allowed')}
}

const onSetFakes = async (msg, bot) => {

    if (admins.includes(String(msg.from.id))) {
        const fakeNews = msg.message_id + '_' + msg.chat.id;
        await Data.findOneAndUpdate({name: 'fakeNews'}, {value: fakeNews });
        try {
            await bot.sendMessage(msg.chat.id, 'Зміни збережено');
            await bot.copyMessage(msg.chat.id, msg.chat.id, msg.message_id);
        } catch (e) { safeErrorLog(e) }
        //save text as well
        var content = {text: msg.text, entities: msg.entities};
        content = JSON.stringify(content)
        console.log("set fake news = " + content);
        const fakeNewsText = await Data.findOneAndUpdate({name: 'fakeNewsText'}, {value: content });
        if (fakeNewsText == null) {
            var newData = new Data({
                _id: new mongoose.Types.ObjectId(),
                name: 'fakeNewsText',
                value: content
            });
            await newData.save()
        }
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
        try {
            await bot.sendMessage(msg.chat.id, 'Надіслати актуальні фейки користувачам?', options);
        } catch (e) { safeErrorLog(e) }
    } else {console.log('not allowed')}
}

const onRequestStatus = async (msg, bot, status) => {
    if (admins.includes(String(msg.from.id))) {
        await Data.findOneAndUpdate({name: 'requestStatus'}, {value: status});
        const confirmMsg = status ? "Прийом запитів увімкнено" : "Прийом запитів вимкнено"
        try {
            await bot.sendMessage(msg.chat.id, confirmMsg);
        } catch (e) { safeErrorLog(e) }
    } else {console.log('not allowed')}
}

const onReplyWithComment = async (msg, bot) => {
    //Process moderator's comment
    const request_id = msg.reply_to_message.text.split('_')[1];
    const commentMsgId = msg.message_id;
    const request = await Request.findByIdAndUpdate(request_id, {commentMsgId: commentMsgId, commentChatId: msg.chat.id });
    await informRequestersWithComment(request, msg.chat.id, commentMsgId, bot, msg.text);
}

const onCheckRequest = async (msg, bot) => {
    console.log(msg);
    const requestStatus = await checkRequestStatus(msg, bot);
    if (!requestStatus) return
    //Check any input message
    const requestId = new mongoose.Types.ObjectId();
    var mediaId, newImage, newVideo, notified = false;
    const {language, id} = await getLanguage(msg.chat.id);
    if (await checkUserThrottling(id, false)) {
        await getText("throttling", language, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                await bot.sendMessage(msg.chat.id, text);
            } catch (e) { safeErrorLog(e) }
        });
        return;
    }
    var request = new Request({
        _id: requestId,
        requesterTG: msg.chat.id,
        requesterId: id,
        requesterMsgID: msg.message_id,
        requesterUsername: msg.from.username,
        createdAt: new Date(),
        lastUpdate: new Date(),
        language: language,
    });
    if (msg.forward_from_chat) { //Check if message has forwarded data (chat)
        request.telegramForwardedChat = msg.forward_from_chat.id;
        request.telegramForwardedMsg = msg.forward_from_message_id;

        const bannedChat = await SourceTelegram.findOneAndUpdate({ telegramId: request.telegramForwardedChat }, { $inc: { requestsAmount: 1 }});

        const foundRequest = await Request.findOne({$and: [{telegramForwardedChat: request.telegramForwardedChat}, {telegramForwardedMsg: request.telegramForwardedMsg} ]}, '_id fakeStatus commentChatId commentMsgId');
        if (foundRequest) {
            if (foundRequest.fakeStatus === 0) return addToWaitlist(msg, foundRequest, bot);
            return reportStatus(msg, foundRequest, bot, foundRequest);
        } else if (bannedChat) {
            const sourceText = bannedChat.fake ? 'black_source' : 'white_source';
            request.fakeStatus = bannedChat.fake ? -3 : 2;
            try {
                const description = bannedChat.description ? bannedChat.description : '';
                await getText(sourceText, language, async function(err, text){
                    if (err) return safeErrorLog(err);
                    try {
                        if (language == 'ua') await bot.sendMessage(msg.chat.id, text + '\n\n' + description);
                        else await bot.sendMessage(msg.chat.id, text);
                    } catch (e) { safeErrorLog(e) }
                });
                notified = true;           
            } catch (e) {safeErrorLog(e)}

        }
        //If block redirect msgs
        //else { return unsupportedContent(msg, bot); }  
    } 

    if (msg.photo) {
        //Check if message has photo data
        mediaId = new mongoose.Types.ObjectId();
        var image = msg.photo[msg.photo.length - 1]; //Let's take the highest possible resolution
        var imageFile;
        try {
            imageFile = await bot.getFile(image.file_id);
        } catch (e) { safeErrorLog(e) }
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

    } 

    if (msg.text) { //Get text data
        const labeledSource = await getLabeledSource(msg.text);
        const foundText = await Request.findOne({text: msg.text}, '_id fakeStatus commentChatId commentMsgId');
        if (foundText) {
            if (foundText.fakeStatus === 0) return addToWaitlist(msg, foundText, bot);
            return reportStatus(msg, foundText, bot, labeledSource);
            
        } else if (labeledSource) {
            const sourceText = labeledSource.fake ? 'black_source' : 'white_source';
            request.fakeStatus = labeledSource.fake ? -3 : 2;
            try {
                const description = labeledSource.description ? labeledSource.description : '';
                await getText(sourceText, language, async function(err, text){
                    if (err) return safeErrorLog(err);
                    try {
                        if (language == 'ua') await bot.sendMessage(msg.chat.id, text + '\n\n' + description);
                        else await bot.sendMessage(msg.chat.id, text);
                    } catch (e) { safeErrorLog(e) }
                });
                notified = true;
            } catch (e) {safeErrorLog(e)}
        } 

        request.text = msg.text;
    } else if (msg.caption) {
        request.text = msg.caption;
    }
    
    //Send message to moderation
    let moderatorsChanel = getLanguageTGChat(language)

    const reqsCount = await Request.countDocuments({});
    request.requestId = reqsCount + 1;

    var options, sentMsg, inline_keyboard, sentActionMsg;
    let initiator = getUserName(msg.from);
    if (!notified) {
        
        //Inform user
        var informOptions = {
            disable_web_page_preview: true
        };
        await getText('new_requests', language, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                await bot.sendMessage(msg.chat.id, text, informOptions);
            } catch (e) { safeErrorLog(e) }
        });

        //Inform moderators
        inline_keyboard = await takeRequestKeyboard(requestId);
        
        try {
            if (initiator.startsWith("@")) { initiator = initiator.substring(1)}
            var moderatorMsg = '№' + request.requestId + '\nініціатор: ' + initiator + '\n#pending';
            //Forward original  msg
            try {
                sentMsg = await bot.forwardMessage(moderatorsChanel, msg.chat.id, msg.message_id);
                request.moderatorMsgID = sentMsg.message_id;
            } catch (e) { return safeErrorLog(e) }
            //Send moderator message
            options = {
                reply_to_message_id: sentMsg.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                }),
                disable_web_page_preview: true
            };
            sentActionMsg = await bot.sendMessage(
                moderatorsChanel,
                moderatorMsg,
                options
            );
            request.moderatorActionMsgID = sentActionMsg.message_id;
        } catch (e) { safeErrorLog(e) }
    
    } else {

        try {
            sentMsg = await bot.forwardMessage(moderatorsChanel, msg.chat.id, msg.message_id);
            request.moderatorMsgID = sentMsg.message_id;
        } catch (e) { return safeErrorLog(e) }

        inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
        inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
        options = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        var status = "#autoDecline"
        if (request.fakeStatus == 2) status = "#autoConfirm";
        try {
            sentActionMsg = await bot.sendMessage(
                moderatorsChanel,
                '№' + request.requestId + '\nініціатор: ' + initiator + '\n' + status,
                options,
            );
        } catch (e) { safeErrorLog(e) }
        request.moderatorMsgID = sentMsg.message_id;
        request.moderatorActionMsgID = sentActionMsg.message_id;

    }
    await updateSource(parseSource(msg));
    
    //Save new request in DB
    if (newImage) await newImage.save();
    else if (newVideo) await newVideo.save();
    await request.save();
    await TelegramUser.findByIdAndUpdate(id, {$push: {requests: requestId}});

}

var mediaGroups = [];
const onCheckGroupRequest = async (msg, bot) => {
    console.log(msg);

    var mediaFileId, mediaType;
    if (msg.photo) {
        const image = msg.photo[msg.photo.length - 1]; //Let's take the highest possible resolution
        mediaFileId = image.file_id;
        mediaType = 'photo';

    } else if (msg.video) {
        const video = msg.video;
        mediaFileId = video.file_id;
        mediaType = 'video';
    }

    //Handle group of media files
    const index = mediaGroups.findIndex(group => {
        return group.groupId === msg.media_group_id;
    });
    if (index < 0) {
        if (msg.caption) mediaGroups.push({ groupId: msg.media_group_id, text: msg.caption, mediaFiles: [{mediaFileId: mediaFileId, mediaType: mediaType}], sent: false});
        else mediaGroups.push({ groupId: msg.media_group_id, mediaFiles: [{mediaFileId: mediaFileId, mediaType: mediaType}], sent: false});
    } else {
        mediaGroups[index].mediaFiles.push({mediaFileId: mediaFileId, mediaType: mediaType});
        if (msg.caption && mediaGroups[index].text) mediaGroups[index].text += msg.caption;
        else if (msg.caption) mediaGroups[index].text = msg.caption;
    }
    //Send interactive action
    try {
        bot.sendChatAction(msg.chat.id, 'typing');
    } catch (e) { safeErrorLog(e) }

    await sleep(2000).then(async () => { 
        const index = mediaGroups.findIndex(group => {
            return group.groupId === msg.media_group_id;
        });
        const {language, id} = await getLanguage(msg.chat.id);
        if (!mediaGroups[index].sent) {
            mediaGroups[index].sent = true; 
            const requestStatus = await checkRequestStatus(msg, bot);
            if (!requestStatus) return
            var mediaFiles = [];
            for (var i in mediaGroups[index].mediaFiles) {
                const mediaFile = mediaGroups[index].mediaFiles[i];
                mediaFiles.push({type: mediaFile.mediaType, media: mediaFile.mediaFileId})
            }
            var sentMsg;
            let moderatorsChanel = getLanguageTGChat(language);

            if (mediaGroups[index].text) {
                var textpart;
                try {
                    textpart = await bot.sendMessage(moderatorsChanel, mediaGroups[index].text);
                } catch (e) { safeErrorLog(e) }
                const options = {
                    reply_to_message_id: textpart.message_id
                };
                try {
                    sentMsg = await bot.sendMediaGroup(moderatorsChanel, mediaFiles, options);
                } catch (e) { safeErrorLog(e) }
            } else {
                try {
                    sentMsg = await bot.sendMediaGroup(moderatorsChanel, mediaFiles);
                } catch (e) { safeErrorLog(e) }
            }
            const requestId = new mongoose.Types.ObjectId();

            if(!sentMsg) return // in case main body wasn't sent

            //new
            var inline_keyboard = await takeRequestKeyboard(requestId);
            var options = {
                reply_to_message_id: sentMsg.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            };

            const reqsCount = await Request.countDocuments({});
            var sentActionMsg;
            try {
                sentActionMsg = await bot.sendMessage(moderatorsChanel, '№' + (reqsCount + 1) + '\n#pending', options);
            } catch (e) { safeErrorLog(e) }
            var request = new Request({
                _id: requestId,
                requestId: reqsCount + 1,
                requesterTG: msg.chat.id,
                requesterId: id,
                requesterMsgID: msg.message_id,
                requesterUsername: msg.from.username,
                createdAt: new Date(),
                lastUpdate: new Date(),
                text: msg.caption
            });
            if(sentMsg[0]) request.moderatorMsgID = sentMsg[0].message_id;
            if(sentActionMsg) request.moderatorActionMsgID = sentActionMsg.message_id;
            await request.save();
            //Inform user
            var options = {
                disable_web_page_preview: true
            };
            await getText('new_requests', language, async function(err, text){
                if (err) return safeErrorLog(err);
                try {
                    await bot.sendMessage(msg.chat.id, text, options);
                } catch (e) { safeErrorLog(e) }
            });
            
        } else return
    });
}

const onUnsupportedContent = async (msg, bot) => {
    const {language} = await getLanguage(msg.chat.id);
    await getText('unsupported_request', language, async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            await bot.sendMessage(msg.chat.id, text);
        } catch (e) { safeErrorLog(e) }
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function unsupportedContent(msg, bot) {
    try {
        await bot.sendMessage(msg.chat.id, UnsupportedContentText);
    } catch (e) { safeErrorLog(e) }
}

async function checkRequestStatus(msg, bot) {
    const {value} = await Data.findOne({name: 'requestStatus'});
    var requestStatus = false;
    if (value === 'true') requestStatus = true;
    else {
        const {language} = await getLanguage(msg.chat.id);
        try {
            await getText('stopped_requests', language, async function(err, text){
                if (err) return safeErrorLog(err);
                try {
                    bot.sendMessage(msg.chat.id, text);  
                } catch (e) { safeErrorLog(e) }
            });
        } catch (e) { safeErrorLog(e) }
    }

    return requestStatus;
}

async function addToWaitlist(msg, foundRequest, bot ) {
    const {language, id} = await getLanguage(msg.chat.id);
    try {
        await getText('waitlist', language, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                bot.sendMessage(msg.chat.id, text);  
            } catch (e) { safeErrorLog(e) }
        });
    } catch (e){ safeErrorLog(e) }

    await Request.findByIdAndUpdate(foundRequest._id, {$push: { "otherUsetsTG": {requesterTG: msg.chat.id, requesterId: id, requesterMsgID: msg.message_id }}});
}

async function reportStatus(msg, foundRequest, bot, bannedChat) {

    var description = '', textArg = '';
    if (bannedChat) {
        textArg = bannedChat.fake ? 'black_source' : 'white_source';
        description = bannedChat.description ? bannedChat.description : '';
    } else {
        if (foundRequest.fakeStatus === 1) textArg = "true_status"
        else if (foundRequest.fakeStatus === -1) textArg = "fake_status"
        else if (foundRequest.fakeStatus === -2) textArg = "reject_status"
    }

    try {
        const {language} = await getLanguage(msg.chat.id);
        await getText(textArg, language, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                if (foundRequest.fakeStatus === -3 || foundRequest.fakeStatus === 2) await bot.sendMessage(msg.chat.id, text + '\n\n' + description);
                else await bot.sendMessage(msg.chat.id, text);
            } catch (e) { safeErrorLog(e) }
        });
        
    } catch (e){ safeErrorLog(e) }
    try {
        if (foundRequest.commentMsgId){
            try {
                await bot.copyMessage(msg.chat.id, foundRequest.commentChatId, foundRequest.commentMsgId);
            } catch (e) { safeErrorLog(e) }
        }
    } catch (e){ safeErrorLog(e) }
}

async function informRequestersWithComment(request, chatId, commentMsgId, bot, text) {
    if (!request) return
    var options = {
        reply_to_message_id: request.requesterMsgID
    };

    let moderatorsChannel = getLanguageTGChat(request.language);
    if (redactionGroup) {
        try {
            await bot.forwardMessage(redactionGroup, moderatorsChannel, request.moderatorMsgID);
            await bot.forwardMessage(redactionGroup, moderatorsChannel, request.moderatorActionMsgID);
            await bot.forwardMessage(redactionGroup, chatId, commentMsgId);
        } catch (e) {
            safeErrorLog(e)
        }
    } else {
        console.log("Redaction group not set in env variables")
    }

    if (request.viberReq) {
        if(text) notifyViber(text, request.viberRequester);
    } else if (request.whatsappReq) {
        if(text) sendTextMessage(request.whatsappRequester, text, request.whatsappMessageId);
    } else if (request.messengerReq) {
        if(text) sendTextMessageMessenger(request.messengerRequester, text);
    } else {
        try {
            await bot.copyMessage(request.requesterTG, chatId, commentMsgId, options);
        } catch (e){ 
            safeErrorLog(e)
            //try again without reply_to_message_id
            try {
                await bot.copyMessage(request.requesterTG, chatId, commentMsgId);
            } catch (e){
                safeErrorLog(e);
            }
        }
    }

    for (var i in request.otherUsetsTG) {
        const optionsR = {
            reply_to_message_id: request.otherUsetsTG[i].requesterMsgID
        };
        try {
            await bot.copyMessage(request.otherUsetsTG[i].requesterTG, chatId, commentMsgId, optionsR);
        } catch (e){
            safeErrorLog(e);
            //try again without reply_to_message_id
            try {
                await bot.copyMessage(request.otherUsetsTG[i].requesterTG, chatId, commentMsgId);
            } catch (e){
                safeErrorLog(e);
            }
        }
    }
    //TASK: Need to handle comment sending for users who joined waiting after comment was send & before fakeStatus changed
}

const onCloseOldRequests = async (msg, bot) => {
    if (admins.includes(String(msg.from.id))) {
        let timeout = parseInt(msg.text.split(" ")[1]) || RequestTimeout
        const closeEscalations = msg.text.split(" ")[2] === "escalations"
        let timeoutDate = new Date();
        let text;
        let options = {};
        let oldRequests;
        timeoutDate.setDate(timeoutDate.getDate() - timeout);

        if (closeEscalations) {
            oldRequests = await Escalation.find({"isResolved": false, "createdAt": {$lt: timeoutDate}});
        } else {
            oldRequests = await Request.find({"fakeStatus": 0, "lastUpdate": {$lt: timeoutDate}});
        }
        if (oldRequests.length) {
            let callback_data = 'CLOSETIMEOUT_' + timeoutDate.getTime()
            if (closeEscalations) callback_data = callback_data + '_ESC'
            let inline_keyboard = [
                [{text: '✅️ Закрити застарілі запити', callback_data: callback_data}],
                [{text: '❌️ Скасувати', callback_data: 'CLOSETIMEOUT_'}]
            ];
            text = 'Знайдено ' + oldRequests.length + ' повідомлень, що створені до '
                + timeoutDate.toLocaleDateString('uk-UA') + ' року та досі знаходяться в статусі #pending.\n' +
                'Перевести їх в статус #timeout?'
            options = {
                reply_to_message_id: msg.message_id,
                reply_markup: JSON.stringify({inline_keyboard}),
            };
        } else {
            text = "Повідомлень , що створені до " + timeoutDate.toLocaleDateString('uk-UA')
                + " року та досі знаходяться в статусі #pending немає. Ми все опрацювали 🥳"
        }
        try {
            await bot.sendMessage(msg.chat.id, text, options);
        } catch (e) { safeErrorLog(e); }
    } else {console.log('not allowed')}
}

async function saveCommentToDB(message, bot) {
    if (!message.text) return
    let tag = message.text.split("\n", 1)[0].split(' ')[0];
    let comment = await Comment.findOne({"tag": tag}, '');
    let text = message.text.slice(tag.length).trim();

    if (comment && comment.comment !== text) {
        let inline_keyboard = [[
            { text: '✅️ Оновити', callback_data: 'UPDATECOMMENT_' + comment._id},
            { text: '❌️ Скасувати', callback_data: 'UPDATECOMMENT_'}
        ]];
        let options = {
            reply_to_message_id: message.message_id,
            reply_markup: {inline_keyboard},
            entities: comment.entities,
        }
        try {
            await bot.sendMessage(
                message.chat.id,
                comment.comment + '\n\n===========================\nОновити існуючий коментар під тегом ' + tag + '?',
                options,
            );
        } catch (e) { safeErrorLog(e) }
    } else {
        if (tag.startsWith('#')) {
            if (text.length < 10) {
                try {
                    return await bot.sendMessage(message.chat.id, 'Коментар відсутній або надто короткий (<10)');
                } catch (e) { return safeErrorLog(e) }
            } 
            
            let entities = shiftOffsetEntities(message.entities, message.text.indexOf(text))

            let comment = new Comment({
                _id: new mongoose.Types.ObjectId(),
                tag: tag,
                comment: text,
                entities: entities,
                createdAt: new Date()
            });
            await comment.save()
            try {
                await bot.sendMessage(message.chat.id, 'Збережено до бази: ' + tag);
            } catch (e) { safeErrorLog(e) }
        }
    }
}

async function confirmComment(message, bot) {
    if (!message.reply_to_message) {
        try {
            return await bot.sendMessage(message.chat.id, 'Не зрозуміло до якого запиту цей коментар.\nНаправте комент через меню "Відповісти"');
        } catch (e) { return safeErrorLog(e) }
    }

    let requestId = message.reply_to_message.text.split("_")[1];
    var request = await Request.findById(requestId, '');
    if (!request){
        try {
            return await bot.sendMessage(message.chat.id, 'Коментар до нерозпізнаного запиту');
        } catch (e) { return safeErrorLog(e) }
    }
    
    let comment = await Comment.findOne({"tag": message.text});
    let inline_keyboard = [[
        { text: '✅️ Відправити', callback_data: 'CONFIRM_' + requestId},
        { text: '❌️ Скасувати', callback_data: 'CONFIRM_'}
    ]];
    let options = {
        reply_to_message_id: message.message_id,
        reply_markup: JSON.stringify({inline_keyboard}),
        entities: JSON.stringify(comment.entities),
    };
    try {
        await bot.sendMessage(
            message.chat.id,
            comment.comment,
            options
        );
    } catch (e) {
        console.log(e);
    }
}

module.exports = {
    onStart,
    onCheckContent,
    onSubscription,
    onChangeLanguage,
    onSetFakesRequest,
    onSetSource,
    onSetFakes,
    onSendFakes,
    onRequestStatus,
    onReplyWithComment,
    onCheckGroupRequest,
    onCheckRequest,
    onUnsupportedContent,
    onCloseOldRequests,
    saveCommentToDB,
    confirmComment,
    informRequestersWithComment,
    getReplyOptions,
}

async function notifyViber(text, viberRequester) {
    const {messageViber} = require('../viber/bot');
    messageViber(text, viberRequester);
}