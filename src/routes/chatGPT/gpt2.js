const { OpenAI } = require('openai');
const { prepareText } = require('../bot/utils');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

//extertal GPT functions
const { getGoogleResults } = require('./functions');

const availableFunctions = {
    getGoogleResults: getGoogleResults
};

const askGPT = async (text, lang) => {
    return new Promise(async (resolve, reject) => {

        const gptAssistandId = process.env.GPT_ASSISTANT_ID;

        //Create a thread
        try {
            const emptyThread = await openai.beta.threads.create();
            threadId = emptyThread.id;
        } catch (e) {
            return reject(e);
        }
        
        //Create a message
        try { 
            // Add system message with current time
            const currentTime = new Date().toISOString();
            await openai.beta.threads.messages.create(
                threadId,
                { role: "assistant", content: `Current time: ${currentTime}` }
            );

            // Add user message
            await openai.beta.threads.messages.create(
                threadId,
                { role: "user", content: text }
            );
        } catch (e) {
            return reject(e);
        }

        //Start run
        var runId;
        try {
            const run = await openai.beta.threads.runs.create(
                threadId,
                { assistant_id: gptAssistandId }
            );
            runId = run.id;
        } catch (e) {
            return reject(e);
        }

        //Wait run complitment
        var search = [];
        try {
            search = await gptRunRetvieve(threadId, runId, lang);
        } catch (e) {
            return reject(e);
        }

        //Get messeges
        try {
            const messages = await openai.beta.threads.messages.list(
                threadId
            );
            const filteredMessages = messages.data
                .filter(message => message.run_id === runId)
                .map(message => message.content[0]?.text?.value || '');
            const reversedArray = filteredMessages.reverse();
            const reversedString = reversedArray.join("\n\n");
            resolve({result: reversedString, search});
        } catch (e) {
            return reject(e);
        }
        
    });   
}

async function gptRunRetvieve(threadId, runId, lang) {
    var search = [];

    return new Promise(async (resolve, reject) => {
        try {
            const checkStatus = async () => {
                try {
                    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
                    if (run.status == "completed") {
                        resolve(search);
                    
                    } else if (run.status == "in_progress" || run.status == "queued") {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
                        await checkStatus(); // Recursive call to continue checking
                    
                    } else if (run.status == "requires_action") {
                        if (run.required_action && run.required_action.submit_tool_outputs && run.required_action.submit_tool_outputs.tool_calls) {
                            const reqActions = run.required_action.submit_tool_outputs.tool_calls;
                            var functionsResponse = [];
                            for (var i in reqActions) {
                                const call = reqActions[i];
                                if (call.type == 'function') {
                                    const functionName = call.function.name;
                                    const functionToCall = availableFunctions[functionName];
                                    const functionArgs = JSON.parse(call.function.arguments);
                                    try {
                                        const functionResponse = await functionToCall(functionArgs, lang);
                                        functionsResponse.push({
                                            tool_call_id: call.id,
                                            output: functionResponse,
                                        });
                                        search.push({
                                            searchTerm: functionArgs.search_query,
                                            searchResult: functionResponse
                                        });
                                    } catch (e) {
                                        await openai.beta.threads.runs.cancel(threadId, runId);
                                        reject(e);
                                    }
                                } else {
                                    console.log(run);
                                    await openai.beta.threads.runs.cancel(threadId, runId);
                                    reject("The run failed.");
                                }
                            }
                            //Update the run
                            await openai.beta.threads.runs.submitToolOutputs(
                                threadId,
                                runId,
                                {
                                  tool_outputs: functionsResponse
                                }
                            );
                            await checkStatus();
                        } else {
                            console.log(run);
                            await openai.beta.threads.runs.cancel(threadId, runId);
                            reject("The run failed.");
                        }
                    
                    } else {
                        console.log(run);
                        reject("The run failed.");
                    }
                } catch (e) {
                    reject(e);
                }
            };

            await checkStatus(); // Start the initial status check
        } catch (e) {
            reject(e);
        }
    });
}

async function getGPTanswer(text, lang) {
    try {
        //Get search term with chatGPT
        const preparedText = await prepareText(text, lang);
        const result = await askGPT(preparedText, lang);
        
        return result;

    } catch (e) {
        if (e.response && e.response.statusText) console.log("GPT error: " + e.response.statusText);
        else console.log(e)
        if (lang == 'uk') return '{"result" : "error", "text": "Вибачте, виникла помилка при обробці запиту. Спробуйте ще раз пізніше."}';
        else return '{"result" : "error", "text": "Sorry, there was an error while processing the request. Please try again later."}';
    }
}

module.exports = {
    getGPTanswer
};