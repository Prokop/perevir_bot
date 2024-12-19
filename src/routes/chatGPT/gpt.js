const mongoose = require('mongoose');
const Request = mongoose.model('Request');
const SourceDomain = mongoose.model('SourceDomain');

const { OpenAI } = require('openai');
const { prepareText, getDomainWithoutSubdomain } = require('../bot/utils');

const openai = new OpenAI();
const google = require('google-it')
const { parser } = require('html-metadata-parser');
const chatGPTmodel = process.env.CHATGPT_MODEL || "gpt-3.5"

const askGPT = async (text) => {
    return new Promise(async (resolve, reject) => {

        try {
            const response = await openai.chat.completions.create({
                model: chatGPTmodel,
                messages: [{"role": "user", "content": text}],
                max_tokens: 1000,
                temperature: 0
            });
            console.log(response.usage);
            console.log(response.choices[0].message);
            // Get the generated text from the OpenAI API response
            var generatedText = response.choices[0].message.content;
            generatedText = generatedText.replace(/"/g, '');
            resolve(generatedText); //Answer
       
        } catch (e) {
            return reject(e);
        }
    });   
}

const getGoogleResulte = async(requestSummary, lang) => {
    return new Promise(async (resolve, reject) => {
        var answer = {
            description: '',
            sources: []
        };
        try {
            const response = await google({'query': requestSummary, 'excludeSites': 'youtube.com,wikipedia.org,facebook.com,t.me,vk.com'});
            for (var i in response) {
                const url = new URL(response[i].link);
                const domain = getDomainWithoutSubdomain(url.origin);
                const source = await SourceDomain.findOne({$and: [{domain: domain}, {fake: false}]});
                if (source) {
                    try {
                        var result = await parser(response[i].link);
                        console.log(result);
                        var metadata = result.meta.title;
                        if (result.meta.description) metadata += '. ' + result.meta.description;
                        answer.description += '- ' + metadata + '\n';
                        answer.sources.push(response[i].link);
                    } catch (e) {
                        console.log("Error with a source " + response[i].link)
                    }
                }
            }
            resolve(answer); //Answer
        } catch (e) {
            return reject(e);
        }   
    });
}

async function automatedCheckGPT(text, lang) {
    try {
        //Get search term with chatGPT
        const preparedText = await prepareText(text);
        var requestText = "Generate search term in ukrainian based on the text:\n" + preparedText;
        const requestSummary = await askGPT(requestText);
        //Request Google
        const searchResults = await getGoogleResulte(requestSummary, lang);
        if (!searchResults || searchResults.sources.length == 0) return false;
        //Ask chatGPT to comment
        var commentRequestText = "Act like fact checker AI bot. You got the statement: " + preparedText + "\n and here is summary from trusted sources: " + searchResults.description + "\nBased on the summary, comment on the truth of the statement in ukrainian.";
        const commentRequest = await askGPT(commentRequestText);
        var replyText = commentRequest + "\n\nДжерела:";
        for (var i in searchResults.sources) {
            replyText += '\n- ' + searchResults.sources[i];
        }
        //replyText += "\n\n⚠️ Зверніть увагу, це повідомлення згенероване штучним інтелектом, та може спотворювати реальні дані."
        
        return replyText;

    } catch (e) {
        console.log(e);
        if(e.response && e.response.statusText) console.log("GPT error: " + e.response.statusText);
        return false;
    }
}

module.exports = {
    automatedCheckGPT
};


