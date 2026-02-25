const axios = require('axios');

async function testTranslate() {
    try {
        const response = await axios.post('http://localhost:5001/api/translate', {
            text: "Hello, this is a test segment for the seminar.",
            targetLang: "ko",
            speakerProfile: "Professional Seminar Speaker"
        });
        console.log("Translation Result:", response.data);
    } catch (e) {
        console.error("Test Request Failed:", e.message);
    }
}

testTranslate();
