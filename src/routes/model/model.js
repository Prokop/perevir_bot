var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

var requestSchema = Schema({
    _id: Schema.Types.ObjectId, //Request ID
    requestId: Number, //Internal ID
    viberReq: Boolean, //If request from Viber 
    viberRequester: String, //Viber requester ID
    viberMediaUrl: String, //Viber media URL
    requesterTG: Number, //Telegram ID of requester | REMOVE after migration
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'TelegramUser' },
    requesterMsgID: Number, //Telegram message ID
    moderatorMsgID: Number, //Telegram message ID of resent message
    moderatorActionMsgID: Number, //Telegram message ID of action message
    moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'Moderator' }, //Moderator
    takenModerator: Number, //If shows in volunteer bot
    otherUsetsTG: [{
        requesterTG: Number,
        requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'TelegramUser' },
        requesterMsgID: Number
    }], //Other people who asked for same content
    telegramForwardedChat: Number, //Telegram ID of source
    telegramForwardedMsg: Number, //Telegram MSG ID of source
    telegramPhotoId: String, //Telegram photo fileID
    image: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }], //Image
    video: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }], //Video
    text: String, //Text of the message
    searchPhrase: String, //Processed text for search
    tags: [String], //Tags, each separate
    commentChatId: Number, //Telegram ID of moderator of the comment
    commentMsgId: Number, //Telegram message ID of comment message
    fakeStatus: {type: Number, default: 0}, //Request Fake status: 0 - uncertain, 1 - not fake, -1 - fake, -2 - rejected, -3 - auto reject, 2 - auto confirm
    requestReason: Number, //0 - emergency, 1 - decision, 2 - important
    lastUpdate: {type: Date, default: new Date()}, //Time of last setting update
    needUpdate: Boolean,
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var escalationSchema = Schema({
    _id: Schema.Types.ObjectId, //Escalation ID
    request: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Request' }], //Original request
    actionMsgID: Number, //Telegram message ID of action message in escalation group
    isResolved: {type: Boolean, default: false}, //Is escalation resolved or not
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var imageSchema = Schema({
    _id: Schema.Types.ObjectId, //Image ID
    telegramFileId: String, //file_id of the photo from Telegram
    telegramUniqueFileId: String, //file_unique_id of the photo from Telegram
    fileSize: Number, //file_size of the photo from Telegram
    width: Number, //width of the photo from Telegram
    height: Number, //height of the photo from Telegram
    img: {
        data: Buffer,
        contentType: String
    },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' }, //Original request
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var videoSchema = Schema({
    _id: Schema.Types.ObjectId, //Video ID
    telegramFileId: String, //file_id of the video from Telegram
    telegramUniqueFileId: String, //file_unique_id of the video from Telegram
    fileSize: Number, //file_size of the video from Telegram
    duration: Number, //width of the video from Telegram
    width: Number, //width of the video from Telegram
    height: Number, //height of the video from Telegram
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' }, //Original request
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var telegramUserSchema = Schema({
    _id: Schema.Types.ObjectId, //User ID
    telegramID: {type: Number, unique: true}, //User's telegram ID
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Request' }], //Requests
    subscribed: {type: Boolean, default: true}, //Subscription status for newslatters
    lastFakeNews: String, //Last sent fakeNews,
    language: String, //Preffered language
    status: String, //Status for the user TBD:(blocked/suspended/chat etc)
    joinedCampaign: String, //Name of Campaign from where pressed /start
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var dataSchema = Schema({
    _id: Schema.Types.ObjectId,
    name: String, 
    value: String
});

var sourceTelegramSchema = Schema({
    _id: Schema.Types.ObjectId, 
    telegramId: {type: Number, unique: true},
    telegramUsername: String,
    fake: Boolean,
    description: String,
    requestsAmount: {type: Number, default: 0},
    createdAt: {type: Date, default: new Date()}
});

var sourceDomainSchema = Schema({
    _id: Schema.Types.ObjectId, 
    domain: {type: String, unique: true},
    hostname: String,
    username: String, //For SoMe pages
    fake: Boolean,
    description: String,
    requestsAmount: {type: Number, default: 0},
    createdAt: {type: Date, default: new Date()}
});

var moderatorSchema = Schema({
    _id: Schema.Types.ObjectId, 
    telegramID: {type: Number, unique: true}, //Moderator's telegram ID
    name: String, //Username or name
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Requests' }], //Involved requests
    lastAction: Date, //Time of the last action,
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var commentSchema = Schema({
    _id: Schema.Types.ObjectId,
    tag: String,
    comment: String,
    entities: {type : Array , "default" : []},
    createdAt: {type: Date, default: new Date()}
})

var adminSchema = Schema({
    _id: Schema.Types.ObjectId,
    username: { type: String, required: true, index: { unique: true } }, //Login
    lastLogin: Date,
    lastAction: Date,
    hash: String,
    salt: String,
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var dailyStatsSchema = Schema({
    _id: Schema.Types.ObjectId,
    stringDate: { type: String, required: true, index: { unique: true } }, //String date
    subs: Number, //Total subsctiber
    nSubs: Number, //Subscribed to newsletter
    nRecived: Number, //Received newsletter
    rTotal: Number, //Total requests
    rFake: Number, //Total fake requests
    rTrue: Number, //Total true requests
    rSemiTrue: Number, //Total semi-true requests
    rNoProofs: Number, //Total no proofs requests
    rReject: Number, //Total reject requests
    rPending: Number, //Total pending requests
    rTrue: Number, //Total true requests
    rToday: Number, //Today requests
    rTodayFake: Number, //Today fake requests
    rTodayTrue: Number, //Today true requests
    rTodaySemiTrue: Number, //Today semi-true requests
    rTodayNoProofs: Number, //Today no proofs requests
    rTodayReject: Number, //Today reject requests
    rTodayPending: Number, //Today pending requests
    createdAt: {type: Date, default: new Date()} //Time of colelction
});

adminSchema.methods.setPassword = function (password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

adminSchema.methods.validatePassword = function (password) {
    const hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
    return this.hash === hash;
};

adminSchema.methods.generateJWT = function () {
    const today = new Date();
    const expirationDate = new Date(today);
    expirationDate.setDate(today.getDate() + 60);

    return jwt.sign({
        username: this.username,
        id: this._id,
        exp: parseInt(expirationDate.getTime() / 1000, 10),
    }, 'secret');
};

adminSchema.methods.toAuthJSON = function () {
    return {
        _id: this._id,
        username: this.username,
        token: this.generateJWT(),
    };
};

var viberUserSchema = Schema({
    _id: Schema.Types.ObjectId,
    viberId: {type: String, unique: true}, 
    joinedCampaign: String, //Name of Campaign from where pressed button
    createdAt: {type: Date, default: new Date()}
});

var sourceStatisticsSchema = Schema({
    _id: Schema.Types.ObjectId,
    sourceTgId: String,
    sourceName: String,
    trueCount: {type : Number , "default" : 0},
    falseCount: {type : Number , "default" : 0},
    manipulationCount: {type : Number , "default" : 0},
    noproofCount: {type : Number , "default" : 0},
    rejectCount: {type : Number , "default" : 0},
    totalRequests: {type : Number , "default" : 0},
    createdAt: {type: Date, default: new Date()},
})

//Volunteer bot user
var userSchema = Schema({
    _id: Schema.Types.ObjectId,
    telegram_id: Number,
    username: String,
    first_name: String,
    last_name: String,
    language_code: String,
    phoneNumber: Number,
    last_activity_at: Date,
    is_blocked: Boolean,
    is_deactivated: Boolean,
    createdAt: Date
})

mongoose.model('ViberUser', viberUserSchema); 
mongoose.model('Admin', adminSchema);
mongoose.model('Request', requestSchema);
mongoose.model('Image', imageSchema);
mongoose.model('Video', videoSchema);
mongoose.model('TelegramUser', telegramUserSchema);
mongoose.model('Data', dataSchema);
mongoose.model('SourceTelegram', sourceTelegramSchema);
mongoose.model('SourceDomain', sourceDomainSchema);
mongoose.model('Moderator', moderatorSchema);
mongoose.model('Comment', commentSchema);
mongoose.model('DailyStats', dailyStatsSchema);
mongoose.model('Escalation', escalationSchema);
mongoose.model('SourceStatistics', sourceStatisticsSchema);
mongoose.model('User', userSchema);
