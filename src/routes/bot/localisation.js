var fs = require('fs');

function getLanguageTGChat(language) {
    let moderatorChat = process.env.TGMAINCHAT;
    if (language === 'en' && process.env.TGENGLISHCHAT) {
        moderatorChat = process.env.TGENGLISHCHAT;
    }
    return moderatorChat;
}

module.exports = {
    getText: async function (name, lang, callback) {
        await fs.readFile('texts.json',
            function(err, texts) {       
                if (err) return callback(err);
                try {
                    const textsObj = JSON.parse(texts);
                    for (var i in textsObj) {
                        if (textsObj[i].name == name){
                            if (lang == null) return callback(null, textsObj[i]);
                            return callback(null, textsObj[i][lang]);
                        } 
                    }
                } catch (e) {
                    console.log(e);
                    return callback(e);
                }
            });
    },
    getLanguageTGChat: getLanguageTGChat,
}