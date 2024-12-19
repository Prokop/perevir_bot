'use strict';
var express = require('express');
var router = express.Router();
var fs = require('fs');
const mongoose = require('mongoose');
const passport = require('passport');
const auth = require('./dashboard/auth');
require('dotenv').config();

//DataBase connection 
mongoose.connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, db) {
    if (err) {
        console.log('Unable to connect to the server. Please start the server\n'+ err);
    } 
});

//Model connection
fs.readdirSync(__dirname + '/model').forEach(function (filename) {
    if (~filename.indexOf('.js')) require(__dirname + '/model/' + filename)
});

const Admin = mongoose.model('Admin');
const DailyStats = mongoose.model('DailyStats');
const Requests = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');
const ViberUser = mongoose.model('ViberUser');
const Request = mongoose.model('Request');
const SourceStatistics = mongoose.model('SourceStatistics');
const Quiz = mongoose.model('Quiz');
const PassingQuiz = mongoose.model('PassingQuiz');
const SourceTelegram = mongoose.model('SourceTelegram');
const SourceDomain = mongoose.model('SourceDomain');
const ParsingSource = mongoose.model('ParsingSource');
const AICheck = mongoose.model('AICheck');

require('./bot/bot');
require('./parser-bot/parser');
const {FakeStatusesStrToInt, FakeStatusesStrToHuman} = require("./bot/contstants");
//router.use(require('./api'));

router.get('/', auth.optional, async (req, res) => {
    DailyStats.find({}).sort('-_id').limit(14).exec(async function(err, stats){
        stats = stats.reverse();
        var data = {
            days: [],
            rTotal: [],
            rTrue: [],
            rFake: [],
            rSemiTrue: [],
            rNoProofs: [],
            rReject: [],
            rPending: [],
            rToday: [],
            rTodayTrue: [],
            rTodayFake: [],
            rTodaySemiTrue: [],
            rTodayNoProofs: [],
            rTodayReject: [],
            rTodayPending: [],
            subs: [],
            nSubs: [],
            nRecived: [],
            requestPerUserLabel: [],
            requestPerUserData: [],
            reqTotal: 0,
            trueTotal: 0,
            falseTotal: 0,
            semiTotal: 0
        };
        for (var i in stats) {
            const dateParts = stats[i].stringDate.slice(0, -5);
            const date = dateParts.replace(/-/g, '.');
            if (stats[i].rTotal) {
                data.days.push(date);
                data.rTotal.push(stats[i].rTotal);
                data.rTrue.push(stats[i].rTrue);
                data.rFake.push(stats[i].rFake);
                data.rSemiTrue.push(stats[i].rSemiTrue);
                
                if(stats[i].rTotal) data.reqTotal = stats[i].rTotal;
                if(stats[i].rTrue) data.trueTotal = stats[i].rTrue;
                if(stats[i].rFake) data.falseTotal = stats[i].rFake;
                if(stats[i].rSemiTrue) data.semiTotal = stats[i].rSemiTrue;

                data.rNoProofs.push(stats[i].rNoProofs);
                data.rReject.push(stats[i].rReject);
                data.rPending.push(stats[i].rPending);

                data.rToday.push(stats[i].rToday);
                data.rTodayTrue.push(stats[i].rTodayTrue);
                data.rTodayFake.push(stats[i].rTodayFake);
                data.rTodaySemiTrue.push(stats[i].rTodaySemiTrue);
                data.rTodayNoProofs.push(stats[i].rTodayNoProofs);
                data.rTodayReject.push(stats[i].rTodayReject);
                data.rTodayPending.push(stats[i].rTodayPending);

                data.subs.push(stats[i].subs);
                data.nSubs.push(stats[i].nSubs);
                data.nRecived.push(stats[i].nRecived);
            }
        }

        return res.render('landing', {data: data}); 
    });
});

router.get('/sign-up', auth.optional, async (req, res) => {
    return res.render('sign-up');
});

router.get('/dash', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            DailyStats.find({}).sort('-_id').limit(14).exec(async function(err, stats){
                stats = stats.reverse();
                var data = {
                    days: [],
                    rTotal: [],
                    rTrue: [],
                    rFake: [],
                    rSemiTrue: [],
                    rNoProofs: [],
                    rReject: [],
                    rPending: [],
                    rToday: [],
                    rTodayTrue: [],
                    rTodayFake: [],
                    rTodaySemiTrue: [],
                    rTodayNoProofs: [],
                    rTodayReject: [],
                    rTodayPending: [],
                    subs: [],
                    nSubs: [],
                    nRecived: [],
                    requestPerUserLabel: [],
                    requestPerUserData: []
                };
                for (var i in stats) {
                    const dateParts = stats[i].stringDate.slice(0, -5);
                    const date = dateParts.replace(/-/g, '.');
                    data.days.push(date);
                    data.rTotal.push(stats[i].rTotal);
                    data.rTrue.push(stats[i].rTrue);
                    data.rFake.push(stats[i].rFake);
                    data.rSemiTrue.push(stats[i].rSemiTrue);
                    data.rNoProofs.push(stats[i].rNoProofs);
                    data.rReject.push(stats[i].rReject);
                    data.rPending.push(stats[i].rPending);

                    data.rToday.push(stats[i].rToday);
                    data.rTodayTrue.push(stats[i].rTodayTrue);
                    data.rTodayFake.push(stats[i].rTodayFake);
                    data.rTodaySemiTrue.push(stats[i].rTodaySemiTrue);
                    data.rTodayNoProofs.push(stats[i].rTodayNoProofs);
                    data.rTodayReject.push(stats[i].rTodayReject);
                    data.rTodayPending.push(stats[i].rTodayPending);

                    data.subs.push(stats[i].subs);
                    data.nSubs.push(stats[i].nSubs);
                    data.nRecived.push(stats[i].nRecived);
                }

                const usersData = await getUsersData();
                for (var i in usersData) {
                    data.requestPerUserLabel.push(usersData[i][0]);
                    data.requestPerUserData.push(usersData[i][1]);
                }

                const campaigns = await getCampaigns();
                data.campaigns = campaigns;

                return res.render('dashboard', {data: data}); 
            });
        } 
    } else {
        return res.render('sign-in');
    }
});

let countValuesByKey = (arr, key) => arr.reduce((r, c) => {
    r[c[key]] = (r[c[key]] || 0) + 1
    return r
  }, {})

let countValuesByKeyGroup = (arr, key) => arr.reduce((r, c) => {
    if (c[key] > 50) c[key] = 50;
    else if (c[key] >= 20) c[key] = 20;
    else if (c[key] >= 15) c[key] = 15;
    else if (c[key] >= 10) c[key] = 10;
    r[c[key]] = (r[c[key]] || 0) + 1
    return r
  }, {})

async function getUsersData() {
    
    const requests = await Requests.find({}, 'createdAt requesterTG');
    const groupedReqs = countValuesByKey(requests, 'requesterTG');
    const groupedReqsArr = Object.entries(groupedReqs);
    groupedReqsArr.sort(function(a, b) {
        var x = a[1], y = b[1];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
    const devidedReqs = countValuesByKeyGroup(groupedReqsArr, 1);
    const allUsers = await TelegramUser.countDocuments({});
    devidedReqs[0] = Number(allUsers-groupedReqsArr.length);
    return Object.entries(devidedReqs);
}

async function getCampaigns() {

    const users = await TelegramUser.find({joinedCampaign: { $exists: true}}, 'joinedCampaign');
    const groupedUsers = countValuesByKey(users, 'joinedCampaign');
    const groupedReqsArr = Object.entries(groupedUsers);

    const usersVB = await ViberUser.find({joinedCampaign: { $exists: true}}, 'joinedCampaign');
    const groupedUsersVB = countValuesByKey(usersVB, 'joinedCampaign');
    const groupedReqsArrVB = Object.entries(groupedUsersVB);

    const joined = groupedReqsArr.concat(groupedReqsArrVB); 

    return joined;
}

router.get('/ai-checks', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            return res.render('ai-checks'); 
        } 
    } else {
        return res.render('sign-in');
    }
});


router.get('/ai-checks/:checkId', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            const {checkId} = req.params;
            const check = await AICheck.findOne({_id: checkId}).populate('request', 'requestId');
            if(!check) return res.send('This quiz does not exist');
            return res.render('ai-check', {data: check}); 
        } 
    } else {
        return res.render('sign-in');
    }
});

router.get('/leaderboard', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            return res.render('leaderboard'); 
        } 
    } else {
        return res.render('sign-in');
    }
});

router.get('/newsletter', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            return res.render('newsletter'); 
        } 
    } else {
        return res.render('sign-in');
    }
});

router.get('/texts', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            fs.readFile('texts.json',
            await function(err, data) {       
                if (err) throw err;
                return res.render('texts', {data: JSON.parse(data)}); 
            });
        } 
    } else {
        return res.render('sign-in');
    }
});

router.get('/sourcestats', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in');
        else {
            return res.render('sourcestats');
        }
    } else {
        return res.render('sign-in');
    }
});

router.get('/channelrequests', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in');
        else {
            const channelId = req.query.channel_id
            const page = req.query.page || 1
            const limit = 100
            const offset = (page - 1) * limit
            const source = await SourceStatistics.findOne({"sourceTgId": channelId }, 'sourceName')
            let filters = {'telegramForwardedChat': channelId }
            let title = "Запити з каналу:"
            if (req.query.fakeStatus) {
                filters["fakeStatus"] = FakeStatusesStrToInt[req.query.fakeStatus]
                title = "Запити зі статусом " + FakeStatusesStrToHuman[req.query.fakeStatus] + " з каналу:"
            }
            let results = await Request.find(filters, 'moderatorMsgID text video image')
                .sort({createdAt: "desc"})
                .skip(offset)
                .limit(limit);
            return res.render(
                'channelrequests',
                {
                    channelid: req.query.channel_id,
                    channelname: source.sourceName,
                    requests: results,
                    mainchatid: process.env.TGMAINCHAT.replace("-100", ""),
                    page: page,
                    nextpage: page - 0 + 1,
                    previouspage: page - 1,
                    title: title,
                    filterstatus: req.query.fakeStatus,
                }
            );
        }
    } else {
        return res.render('sign-in');
    }
});

router.get('/quiz', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            var data = await Quiz.find({}).sort({ position: 1 });
          
            for (var i in data) {
                var quiz = data[i];
                const amount = await PassingQuiz.aggregate([
                    {
                      $match: {
                        quiz: mongoose.Types.ObjectId(quiz._id),
                        finishedAt: { $exists: true }
                      }
                    },
                    {
                      $group: {
                        _id: "$user",
                        count: { $sum: 1 }
                      }
                    },
                    {
                      $group: {
                        _id: null,
                        uniqueUserCount: { $sum: 1 }
                      }
                    }
                ]);
                if (!amount[0]) {
                    data[i].passed_unique_times = 0;
                } else {
                    data[i].passed_unique_times = amount[0].uniqueUserCount;
                }
            }

            return res.render('quiz-list', {data: data}); 
        } 
    } else {
        return res.render('sign-in');
    }
});

router.get('/quiz/new', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            return res.render('quiz-new'); 
        } 
    } else {
        return res.render('sign-in');
    }
});

router.get('/quiz/stat', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            PassingQuiz.aggregate([
                { $group: {
                    _id: '$quiz',
                    answers: { $push: { $size: '$answers' } }
                }},
                { $lookup: {
                    from: 'quizzes',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'Quiz'
                }},
                { $project: {
                    _id: 1,
                    answers: 1,
                    Quiz: { $arrayElemAt: ['$Quiz', 0] }
                }}
            ]).exec((err, result) => {
                if (err) {
                    console.log(err);
                } else {
                    var answer = [];
                    for (var i in result) {
                        const counts = countDuplicates(result[i].answers);
                        const quiz = {
                            id: result[i]._id,
                            name: result[i].Quiz.name,
                            answers: counts
                        }
                        answer.push(quiz);
                    }
        
                    return res.render('quiz-stat', {data: answer}); 
                }
            }); 
        } 
    } else {
        return res.render('sign-in');
    }
});

function countDuplicates(arr) {
    const counts = {};
    for (const val of arr) {
        counts[val] = (counts[val] || 0) + 1;
    }
    const result = [];
    for (const [value, count] of Object.entries(counts)) {
        result.push({ value: Number(value), count });
    }
    return result;
}

router.get('/quiz/:quizCode', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            const {quizCode} = req.params;
            const quiz = await Quiz.findOne({code: quizCode}).populate('questions');
            if(!quiz) return res.send('This quiz does not exist');
            return res.render('quiz-edit', {data: quiz}); 
        } 
    } else {
        return res.render('sign-in');
    }
});

//Black/White Lists
router.get('/blacklist', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            const dataTg = await SourceTelegram.find({});
            const dataDom = await SourceDomain.find({});
            var data = dataTg.concat(dataDom);
            return res.render('blacklist-tg', {data: data}); 
        } 
    } else {
        return res.render('sign-in');
    }
});

//Monitoring
router.get('/monitoring', auth.optional, async (req, res) => {
    if (req.auth && req.auth.id) {
        const id = req.auth.id;
        const admin = await Admin.findById(id, 'username');
        if (!admin) return res.render('sign-in'); 
        else {
            const data = await ParsingSource.find({});
            return res.render('monitoring', {data: data}); 
        } 
    } else {
        return res.render('sign-in');
    }
});

module.exports = router;
