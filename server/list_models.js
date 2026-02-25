const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just to check connectivity
        console.log("Testing with gemini-1.5-flash...");
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-flash!");
    } catch (e) {
        console.error("Connectivity test failed:", e.message);
        if (e.message.includes("404")) {
            console.log("404 error - model name might be wrong or API version mismatch.");
        }
    }
}

listModels();
