require('dotenv').config();
const {
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
    markExpiringRequests,
} = require('./message-handlers');

const {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,
    onConfirmCommentQuery,
    onEscalateQuery,
    onUpdateCommentQuery,
    onReqTakeQuery,
    onMoreStatusesQuery,
    onConfirmClosePending,
    onChangeLanguageQuery,
    onAutoAsnwerQuery,
    onBlockUserQuery,
} = require('./query-callbacks');

const {
    onGetQuiz,
    onSpecificQuizQuery,
    onSpecificQuiz,
    onStartQuizQuery,
    onAnswerQuizQuery,
    onNextQuestionQuery
} = require('./quiz.js');

const {answerInlineQuery} = require("./inline-query");

const mongoose = require("mongoose");
const DailyStats = mongoose.model('DailyStats');

//TELEGRAM BOT
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TGTOKEN;
const bot = new TelegramBot(token, { polling: true });
const admins = String(process.env.ADMINS).split(',');
const commentGroup = process.env.TGCOMMENTSGROUP;
const escalationGroup = process.env.TGESCALATIONGROUP;

const {
    CheckContentText,
    SubscribtionText,
    QuizText,
    ChangeLanguage,
    SetFakesRequestText
} = require('./contstants');
const {safeErrorLog, delay, deleteMessage} = require("./utils");
const {
    isValidCheckRequest,
    isReplyWithCommentRequest,
    isUnsupportedContent,
    isTextFromDict,
} = require("./validation");
const {checkUserStatus, incrementBlockedMessagesCount} = require("./authorization");

//Notify about reloading
try {
    bot.sendMessage(admins[0], 'Bot reloaded v2.01');
} catch (e) {
    safeErrorLog(e);
}

//Lauch needUpdate
const {onTryToUpdate} = require("./needUpdate");
const {processChatMessage, onChatModeQuery, unpauseCallback} = require("./chat");

//Schedule job to mark expiring requests
const schedule = require("node-schedule");
schedule.scheduleJob("*/15 * * * *", async () => markExpiringRequests(bot));

onTryToUpdate(bot);

bot.on('message', async (msg) => {
    const text = msg.text;
    const user = msg.from.id
    
    const userStatus = await checkUserStatus(user);
    if (userStatus && userStatus === 'blocked') {
        await incrementBlockedMessagesCount(user)
    } else if (userStatus && userStatus.startsWith('chat_') && msg.chat.id === user) {
        await processChatMessage(msg, userStatus, bot)
    } else if (msg.chat.id.toString() === escalationGroup) {
        //ignore messages in escalation group
    } else if (msg.chat.id.toString() === commentGroup && msg.text){
        await saveCommentToDB(msg, bot)
    } else if (msg.via_bot && msg.via_bot.id.toString() === token.split(':')[0]) {
        await confirmComment(msg, bot)
    } else if (text === '/start') {
        await onStart(msg, bot, 'ua');
    } else if (text === '/start en') {
        await onStart(msg, bot, 'en');
    } else if (text === '/start fakes') {
        await onStart(msg, bot, 'ua');
        await delay(3000);
        await onSubscription(msg, bot);
    } else if (text && text.startsWith('/start c_')) {
        var lang = 'ua', campaign = text.split(' c_')[1];
        if (campaign && campaign.startsWith('en_')) lang = 'en';
        await onStart(msg, bot, lang, campaign);
    } else if (isTextFromDict(text, QuizText) || text === '/quiz') {
        await onGetQuiz(msg, bot);
    } else if (text === '/start quiz') {
        await onStart(msg, bot, 'ua');
        await delay(3000);
        await onGetQuiz(msg, bot);
    } else if (text && text.startsWith('/start quiz_')) {
        await onStart(msg, bot, 'ua');
        await delay(3000);
        await onSpecificQuiz(msg, bot);
    } else if (text && text.startsWith('/quiz_')) {
        await onSpecificQuiz(msg, bot);
    } else if (isTextFromDict(text, CheckContentText)) {
        await onCheckContent(msg, bot)
    } else if (isTextFromDict(text, SubscribtionText) || text === '/weekly_fakes') {
        await onSubscription(msg, bot)
    } else if (isTextFromDict(text, ChangeLanguage) || text === '/change_language') {
        await onChangeLanguage(msg, bot)
    } else if (text === '/setfakes') {
        await onSetFakesRequest(msg, bot);
    } else if (text && text.startsWith('/setblacksource')) { 
        await onSetSource(msg, bot, true);
    } else if (text && text.startsWith('/setwhitesource')) { 
        await onSetSource(msg, bot, false);
    } else if (text === '/allowrequests') {
        await onRequestStatus(msg, bot, true);
    } else if (text === '/forbidrequests') {
        await onRequestStatus(msg, bot, false);
    }  else if (msg.reply_to_message && msg.reply_to_message.text === SetFakesRequestText) {
        await onSetFakes(msg, bot);
    } else if (text === '/sendfakes') {
        await onSendFakes(msg, bot);
    } else if (text && text.startsWith('/closepending')) {
        await onCloseOldRequests(msg, bot)
    } else if (isReplyWithCommentRequest(msg)) {
        await onReplyWithComment(msg, bot);
    } else if (isValidCheckRequest(msg)) {
        if (msg.media_group_id) await onCheckGroupRequest(msg, bot);
        else await onCheckRequest(msg, bot);
    } else if (isUnsupportedContent(msg)) {
        await onUnsupportedContent(msg, bot);
    }
});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
    const {data, message} = callbackQuery;
    if (!data) {
        return console.error('INVALID callback query, no action provided', callbackQuery)
    }
    const userStatus = await checkUserStatus(callbackQuery.from.id);
    if (userStatus && userStatus.startsWith("chat_")){
        try {
            return await bot.answerCallbackQuery(
                callbackQuery.id,
                {
                    text: "Ця дія недоступна, тому що у вас відкрито діалог з користувачем",
                    show_alert: true,
                }
            );
        } catch (e) { return safeErrorLog(e) }
    }
    if (data.startsWith('FS_')) {
        await onFakeStatusQuery(callbackQuery, bot, false)
    } else if (data.startsWith('CS_')) {
        await onChangeStatusQuery(callbackQuery, bot)
    } else if (data.startsWith('COMMENT_')) {
        await onCommentQuery(callbackQuery, bot)
    } else if (data.startsWith('SUB_')) {
        await onSubscriptionQuery(callbackQuery, bot)
    } else if (data.startsWith('SENDFAKES_')) {
        await onSendFakesQuery(callbackQuery, bot)
    } else if (data.startsWith('REASON_')) {
        console.log("old reason message") 
    } else if (data.startsWith('CONFIRM_')) {
        await onConfirmCommentQuery(callbackQuery, bot)
    } else if (data.startsWith('CLOSETIMEOUT_')) {
        await onConfirmClosePending(callbackQuery, bot)
    } else if (data.startsWith('ESCALATE_')) {
        await onEscalateQuery(callbackQuery, bot)
    } else if (data.startsWith('UPDATECOMMENT_')) {
        await onUpdateCommentQuery(callbackQuery, bot)
    } else if (data.startsWith('CHAT_')) {
        await onChatModeQuery(callbackQuery, bot)
    } else if (data.startsWith('TAKEREQ_')) {
        await onReqTakeQuery(callbackQuery, bot)
    } else if (data.startsWith('UNPAUSE_')) {
        await unpauseCallback(callbackQuery, bot)
    } else if (data.startsWith('MORESTATUSES_')) {
        await onMoreStatusesQuery(callbackQuery, bot)
    } else if (data.startsWith('SKIP')) {
        await onFakeStatusQuery(callbackQuery, bot, true)
    } else if (data.startsWith('LANG')) {
        await onChangeLanguageQuery(callbackQuery, bot)
    } else if (data === 'QUIZ') {
        await deleteMessage(message, bot)
        await onGetQuiz(message, bot)
    } else if (data.startsWith('QUIZ_')) {
        await onSpecificQuizQuery(callbackQuery, bot)
    } else if (data.startsWith('STARTQUIZ_')) {
        await onStartQuizQuery(callbackQuery, bot)
    } else if (data.startsWith('ANS_')) {
        await onAnswerQuizQuery(callbackQuery, bot)
    } else if (data.startsWith('NEXTQ_')) {
        await onNextQuestionQuery(callbackQuery, bot)
    } else if (data.startsWith('AUTOANSWER_')) {
        await onAutoAsnwerQuery(callbackQuery, bot)
    } else if (data.startsWith('BLOCK_')) {
        await onBlockUserQuery(callbackQuery, bot)
    }
});

bot.on("inline_query", async function onCallbackQuery(inlineQuery) {
    const {query} = inlineQuery;
    if (query.length > 3) {
        await answerInlineQuery(inlineQuery, bot)
    }
});

bot.on("polling_error", (err) => safeErrorLog(err));

module.exports = {
    message: async function (msg, pin, options) {
        try {
            const sentMsg = await bot.sendMessage(process.env.TGMAINCHAT, msg, options);
            if (pin) await bot.pinChatMessage(process.env.TGMAINCHAT, sentMsg.message_id);
        } catch (e){ safeErrorLog(e) }
    },
    messageId: async function (id, msg, pin, options) {
        try {
            const sentMsg = await bot.sendMessage(id, msg, options);
            if (pin) await bot.pinChatMessage(id, sentMsg.message_id);
            return sentMsg;
        } catch (e){ safeErrorLog(e) }
    },
    sendImage: async function (id, imageUrl, options) {
        try {
            const sentMsg = await bot.sendPhoto(id, imageUrl, options);
            return sentMsg;
        } catch (e){ safeErrorLog(e) }
    },
    sendMediaGroup: async function (id, mediaGroup, options) {
        try {
            const sentMsg = await bot.sendMediaGroup(id, mediaGroup, options);
            return sentMsg;
        } catch (e){ safeErrorLog(e) }
    },
    sendLetters: async function (ids, msg) {
        sendLettersF(ids, msg)
    }
};

async function sendLettersF(ids, msg) {
    const RPS = 10; //Requests per second
    const now = new Date();
    const stringDate = now.getDate() + '-' + (parseInt(now.getMonth()) + 1) + '-' + now.getFullYear();

    for (var index = 0; index < ids.length; index++) {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000 / RPS));
            try {
                await bot.sendMessage(ids[index], msg);
                await DailyStats.findOneAndUpdate({stringDate: stringDate}, {$inc: {nRecived: 1}});
            } catch (e) { safeErrorLog(e) }
            console.log(index + " - " + ids.length );
        } catch (e) { 
            safeErrorLog(e);
        }
    }
}