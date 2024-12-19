var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
var AICheck = mongoose.model('AICheck');

//POST new user route (optional, everyone has access)
router.get('/get', auth.required, async (req, res, next) => {
    
    const page = req.query.page || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const total = await AICheck.countDocuments();
    const pages = Math.ceil(total / limit);

    const checks = await AICheck.find({}, 'request fakeStatus text createdAt').limit(limit).skip(skip).sort({_id: -1}).populate('request', 'requestId');

    return res.send({
        checks: checks,
        pages: pages
    });

});

router.post('/update', auth.required, async (req, res, next) => {

    const data = req.body;
    const id = data.id;
    const betterComment = data.betterComment;
    const betterFakeStatus = data.betterFakeStatus;

    await AICheck.findByIdAndUpdate({_id: id}, {betterComment: betterComment, betterFakeStatus: betterFakeStatus});

    return res.send('Updated');
});

module.exports = router