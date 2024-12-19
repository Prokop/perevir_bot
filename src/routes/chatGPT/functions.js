const axios = require('axios');

const getGoogleResults = async(requestSummary, lang) => {
    return new Promise(async (resolve, reject) => {
        try {
            var answer = 'Search results:';
            await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: process.env.GOOGLE_API_KEY,
                    cx: process.env.GOOGLE_SEARCH_ENGINE_CX,
                    q: requestSummary.search_query
                }
            })
            .then(response => {
                const results = response.data.items;
                if (!results) {
                    console.log(response)
                }
                for (var i in results) {
                    const link = results[i].link;
                    var text = results[i].snippet;
                    if (results[i].pagemap && results[i].pagemap.metatags && results[i].pagemap.metatags[0] && results[i].pagemap.metatags[0]['og:description']) {
                        text += results[i].pagemap.metatags[0]['og:description'];
                    }
                    
                    if (text) {
                        answer += `\n\nsource: ${link}\ntext:${text}`;
                    }
                }
            })
            .catch(error => {
                if (error.response?.data) console.error('Error fetching search results:', error.response.data);
                else console.error('Error fetching search results:', error);
            });

            resolve(answer); //Answer
        } catch (e) {
            return reject(e);
        }   
    });
}

module.exports = {
    getGoogleResults
};
