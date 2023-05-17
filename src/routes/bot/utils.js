const mongoose = require("mongoose");
const { URL } = require('url');
const { getText, getLanguageTGChat} = require('./localisation');
const {RequestThrottleLimit} = require("./contstants");
const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');
const Moderator = mongoose.model('Moderator');
const SourceDomain = mongoose.model('SourceDomain');
const SourceStatistics = mongoose.model('SourceStatistics');
const DailyStats = mongoose.model('DailyStats');
const User = mongoose.model('User');
require('dotenv').config();

function getSubscriptionBtn(status, user_id) {
    var inline_keyboard = [];
    if (status) inline_keyboard.push([{ text: '🔴 Відмовитися від підбірок', callback_data: 'SUB_0_' + user_id }]);
    else inline_keyboard.push([{ text: '✨ Отримувати підбірки', callback_data: 'SUB_1_' + user_id }]);
    return inline_keyboard;
}

function getMailBtn () {
    const inline_keyboard = [[{text: '🔎 Дізнатися більше', url: 'https://t.me/gwaramedia'}]];
    return inline_keyboard;
}

function getUserName(user) {
    if (!user) return '';
    if (user.username) {
        return "@" + user.username;
    }
    let fullname = user.first_name;
    if (user.last_name) fullname = fullname + " " + user.last_name
    return fullname;
}

async function notifyUsers(foundRequest, fakeStatus, bot) {

    foundRequest = await TelegramUser.populate(foundRequest,{ path: 'requesterId' });
    foundRequest = await TelegramUser.populate(foundRequest,{ path: 'otherUsetsTG.requesterId' });

    var textArg;
    if (fakeStatus == "1") textArg = 'true_status';
    else if (fakeStatus == "-1") textArg = 'fake_status';
    else if (fakeStatus == "-2") textArg = 'reject_status';
    else if (fakeStatus == "-4") textArg = 'noproof_status';
    else if (fakeStatus == "-5") textArg = 'manipulation_status';
    else if (fakeStatus == "-6") textArg = 'timeout_request';

    await getText(textArg, null, async function(err, text){
        if (err) return safeErrorLog(err);
        let lang;
        //Notify original requester
        if (foundRequest.viberReq) {
            notifyViber(text['ua'], foundRequest.viberRequester);
        } else {
            let options = {
                reply_to_message_id: foundRequest.requesterMsgID
            };
            lang = getRequesterLanguage(foundRequest.requesterId)
            try {
                await bot.sendMessage(foundRequest.requesterTG, text[lang], options);
            } catch (e){ safeErrorLog(e) }
        }
        //Notify other requesters
        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            lang = getRequesterLanguage(foundRequest.otherUsetsTG[i].requesterId)
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, text[lang], optionsR);
            } catch (e){ safeErrorLog(e) }
        }
    });
}

function writeNReceivers(receivedUsers) {
    const now = new Date();
    const stringDate = now.getDate() + '-' + (parseInt(now.getMonth()) + 1) + '-' + now.getFullYear();
    DailyStats.findOneAndUpdate({stringDate:stringDate}, {$inc: {nRecived: receivedUsers}}, function(e, d){
        if (e) console.log(e);
        //Potential bug, if function is called before DS created this day
    });
}

async function sendFakes(users, message_id, chat_id, admin, bot) {
    const RPS = 10; //Requests per second
    var sent = 0;

    for (var index = 0; index < users.length; index++) {
        try {
            const inline_keyboard = getMailBtn();
            var options = {
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            };
            await new Promise(resolve => setTimeout(resolve, 1000 / RPS));
            try {
                await bot.copyMessage(users[index].telegramID, chat_id, message_id, options);
                await TelegramUser.updateOne(users[index], {lastFakeNews: message_id + "_" + chat_id});
                sent++;
                console.log(index + " - " + users.length + " - " + users[index].telegramID + ". Sent: " + sent);
            } catch (e) { safeErrorLog(e) }
        } catch (e) { 
            safeErrorLog(e);
        }
        if (index == users.length - 1) {
            //Notify admin about end result
            const receivedUsers = await TelegramUser.find({lastFakeNews: message_id + "_" + chat_id}, '');
            try {
                await bot.sendMessage(admin, "Результат розсилки\nДоставлено: " + receivedUsers.length);
            } catch (e) { safeErrorLog(e) }
            try {
                await bot.sendMessage(394717645, "Результат розсилки\nДоставлено: " + receivedUsers.length);
            } catch (e) { safeErrorLog(e) }
            writeNReceivers(receivedUsers.length);
        }
    }
}

async function closeRequestByTimeout(request, bot) {
    let inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + request._id }]];
    if (!request.commentChatId) {
        inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + request._id }])
    }
    if (request.moderatorActionMsgID) {
        let moderatorsChannel = getLanguageTGChat(request.language)
        try {
            await bot.editMessageText("#timeout", {
                chat_id: moderatorsChannel,
                message_id: request.moderatorActionMsgID,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            });
        } catch (e) {
            safeErrorLog(e);
            console.log("Close by timeout failed for message " + request.moderatorActionMsgID + ", sleeping for 30 seconds ")
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }
    await notifyUsers(request, "-6", bot)
    await Request.updateOne(request, {fakeStatus: "-6"});
}

async function involveModerator (requestId, moderatorTg) {

    const request = await Request.findById(requestId, 'moderator');
    if (!request) return console.log('There is no request to assign moderator');
    if (!moderatorTg) return console.log('Moderator id is empty');

    var moderatorTgId = moderatorTg.id;
    if (!moderatorTgId) moderatorTgId = moderatorTg;
    if (request.moderator) {
        console.log('Second assignment of moderator to request');
        var moderator = await Moderator.findOne({telegramID: moderatorTgId});
        return moderator.name;
    } 

    var name = ' ';
    var moderator = await Moderator.findOneAndUpdate({telegramID: moderatorTgId}, {$push: {requests: requestId}, lastAction: new Date()});
    const now = new Date();
    if (!moderator) {
        if (moderatorTg.id) {
            name = getUserName(moderatorTg);
        } else {
            const user = await User.findOne({telegram_id: moderatorTgId});
            if (user) {
                if (user.username) name = '@' + user.username;
                else name = user.first_name + ' ' + user.last_name;
            }
        }

        let newModerator = new Moderator({
            _id: new mongoose.Types.ObjectId(),
            telegramID: moderatorTgId,
            name: name,
            requests: [request._id],
            lastAction: now,
            createdAt: now
        });
        await newModerator.save().then((md) => {
            moderator = md;
        }).catch(() => {});
    } else {
        name = moderator.name;
    }
    
    await Request.findByIdAndUpdate(requestId, {moderator: moderator._id, takenModerator: moderatorTgId, lastUpdate: now});
    return name;

}

const getDomainWithoutSubdomain = hostname => {
    const urlParts = hostname.split('.');
  
    return urlParts
      .slice(urlParts.length - 2)
      .join('.')
}

async function newFacebookSource (url) {
    const { hostname, pathname, searchParams } = url;
    const host = getDomainWithoutSubdomain(hostname);
    const decoded = decodeURI(pathname);
    var username = decoded.split('/')[1];
    if (username == 'groups') return false
    else if (username == 'profile.php' && searchParams.get('id')) {
       username = searchParams.get('id');
    }
    if (username == '') return null;

    return { hostname: host, username: username }
}

async function newTwitterSource (url) {
    const { hostname, pathname } = url;
    const host = getDomainWithoutSubdomain(hostname);
    const decoded = decodeURI(pathname);
    const username = decoded.split('/')[1];
    if (username == '') return null;

    return { hostname: host, username: username }
}

async function newYoutubeSource (url) {
    const { hostname, pathname } = url;
    const host = getDomainWithoutSubdomain(hostname);
    const decoded = decodeURI(pathname);
    var username = decoded.split('/')[2];
    if (!username || username == '') {
        username = decoded.split('/')[1];
    }
    if (username == '') return null;

    return { hostname: host, username: username }
}

function parseSource(message) {
    let telegramId = '';
    let name = '';
    if (message.forward_from_chat){
        telegramId = message.forward_from_chat.id;
        name = message.forward_from_chat.name || message.forward_from_chat.title;
    }
    return {telegramId: telegramId, name:name};
}

async function updateSource(source) {
    const { telegramId, name } = source;
    if (telegramId){
        let existingSource = await SourceStatistics.findOneAndUpdate({sourceTgId: telegramId}, { sourceName: name });
        if (!existingSource) {
            let s = new SourceStatistics({
                _id: new mongoose.Types.ObjectId(),
                sourceTgId: telegramId,
                sourceName: name,
            })
            await s.save()
        }
    }
}

async function getLabeledSource (text){
    try {
        const { hostname, pathname, searchParams} = new URL(text);
        const host = getDomainWithoutSubdomain(hostname);
        const decoded = decodeURI(pathname);
        var username;
        
        if (host == 'facebook.com' || host == 'twitter.com') {
            username = decoded.split('/')[1];
            if (searchParams.get('id')) {
                username = searchParams.get('id');
            } else if (!username || username == '') return null
            return await SourceDomain.findOneAndUpdate({$and: [ {hostname: host}, {username: username} ]}, { $inc: { requestsAmount: 1 }});

        } else if (host == 'youtube.com') {
            username = decoded.split('/')[2];
            if (!username || username == '') {
                username = decoded.split('/')[1];
            }
            if (!username || username == '') return null
            return await SourceDomain.findOneAndUpdate({$and: [ {hostname: host}, {username: username} ]}, { $inc: { requestsAmount: 1 }});

        } else {
            return await SourceDomain.findOneAndUpdate({ domain: host }, { $inc: { requestsAmount: 1 }});
        }
        
    } catch(e) { return null }    
}
function getCallbackDataFromKeyboard(inlineKeyboard) {
    try {
        return inlineKeyboard[0][0].callback_data;
    } catch (e) {
        return '';
    }
}

function changeInlineKeyboard (inlineKeyboard, blockToChange, newBlock) {
    /*
    We have different logical blocks in inline keyboard: decision block, comment block,
    more might be added in the future. These blocks are pretty independent of one another
    and since they might take more than one row changing one of these blocks separately
    might be tricky. This method defines which lines relate to which block and allows
    making changes to one block and not affect others.
    */
    let newKeyboard = [];
    if (blockToChange === 'decision'){
        while (!getCallbackDataFromKeyboard(inlineKeyboard).startsWith('COMMENT_') && inlineKeyboard.length != 0) {
            inlineKeyboard.shift();
        }
        newKeyboard = newKeyboard.concat(newBlock);
    } else if (blockToChange === 'comment') {
        while (!getCallbackDataFromKeyboard(inlineKeyboard).startsWith('COMMENT_') && inlineKeyboard.length != 0) {
            newKeyboard.push(inlineKeyboard.shift());
        }
        while (getCallbackDataFromKeyboard(inlineKeyboard).startsWith('COMMENT_') && inlineKeyboard.length != 0) {
            inlineKeyboard.shift();
        }
        newKeyboard = newKeyboard.concat(newBlock);
    } else {
        console.error(blockToChange + ' inline keyboard block is unknown');
        newKeyboard = inlineKeyboard;
    }
    newKeyboard = newKeyboard.concat(inlineKeyboard)
    return newKeyboard;
}


function safeErrorLog(error) {
    try {
        return console.log(error.response.body.description)
    } catch (e) {
        if (error.message) {
            return console.log(error.message)
        } else {
            return console.log(error);
        }
    }
}

const getLanguage = async (tgId) => {
    const user = await TelegramUser.findOne({telegramID: tgId}, 'language');
    if(!user) return {'language': 'ua'}
    return user;
}

function shiftOffsetEntities(entities, offset) {
    entities.shift();
    for (let index = 0; index < entities.length; index++) {
        entities[index].offset = entities[index].offset - offset
    }
    return entities;
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function getFakeText (fakeStatus) {

    let status;
    if (fakeStatus === '1') status = "#true | Правда"
    else if (fakeStatus === '-1') status = "#false | Фейк"
    else if (fakeStatus === '-2') status = "#reject | Відмова"
    else if (fakeStatus === '-4') status = "#noproof | Немає доказів"
    else if (fakeStatus === '-5') status = "#manipulation | Напівправда"

    return status;

}

function getRequesterLanguage(requester) {
    let lang;
    try {
        lang = requester.language;
    } catch (e) {
        lang = 'ua';
    }
    return lang;
}

async function checkUserThrottling(userId, fromViber) {
    let oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    let filters = {"createdAt": { $gt: oneHourAgo }};
    if (fromViber) {
        filters = { ...filters, viberRequester: userId };
    } else {
        filters = { ...filters, requesterId: userId };
    }
    let hourRequestsCount = await Request.countDocuments(filters);
    return (hourRequestsCount >= RequestThrottleLimit);
}

function updateTextsList(oldList, newList) {
  const oldMap = {};
  for (const obj of oldList) {
    oldMap[obj.name] = obj;
  }

  const result = [];

  for (const newObj of newList) {
    const oldObj = oldMap[newObj.name];

    if (oldObj) {
        let en, ua;
      if (newObj.ua !== '') {
          ua = newObj.ua;
      } else {
          ua = oldObj.ua;
      }
      if (newObj.en !== '') {
          en = newObj.en;
      } else {
          en = oldObj.en;
      }
      result.push({name: newObj.name, en: en, ua: ua});
      delete oldMap[newObj.name];
    } else {
      result.push(newObj);
    }
  }
  return result;
}

function removeQueryParamsFromLink(link) {
  try {
    const url = new URL(link);
    url.search = '';
    return url.href;
  } catch (error) {
    // If the input is not a valid URL, return the input as it is.
    return link;
  }
}

module.exports = {
    getSubscriptionBtn,
    notifyUsers,
    sendFakes,
    getUserName,
    closeRequestByTimeout,
    involveModerator,
    getDomainWithoutSubdomain,
    newFacebookSource,
    newTwitterSource,
    newYoutubeSource,
    getLabeledSource,
    safeErrorLog,
    changeInlineKeyboard,
    getLanguage,
    shiftOffsetEntities,
    delay,
    parseSource,
    updateSource,
    getFakeText,
    checkUserThrottling,
    updateTextsList,
    removeQueryParamsFromLink,
}

async function notifyViber(text, viberRequester) {
    const {messageViber} = require('../viber/bot');
    messageViber(text, viberRequester);
}
