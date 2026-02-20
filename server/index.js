const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Ensure audio directory exists
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.post('/api/translate', async (req, res) => {
    const { text, targetLang, speakerProfile } = req.body;
    console.log(`Translating to ${targetLang}: ${text.substring(0, 30)}...`);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Translate to [${targetLang}] for a professional seminar speaker. Use a respectful and authoritative tone. Text: "${text}"`;
        const result = await model.generateContent(prompt);
        const translatedText = result.response.text();
        console.log(`Success: ${translatedText.substring(0, 30)}...`);
        res.json({ translatedText });
    } catch (error) {
        console.error("Translation ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

// AI Voice Synthesis (ElevenLabs Integration)
app.post('/api/synthesize', async (req, res) => {
    const { text, voiceId = "pNInz6obpg8nEByWQX2t" } = req.body; // Default voice
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
        return res.json({ audioUrl: null, message: "Add ELEVENLABS_API_KEY to enable voice cloning" });
    }

    try {
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            { text, model_id: "eleven_multilingual_v2" },
            { headers: { "xi-api-key": apiKey }, responseType: 'arraybuffer' }
        );

        const fileName = `speech_${Date.now()}.mp3`;
        const filePath = path.join(audioDir, fileName);
        fs.writeFileSync(filePath, response.data);

        res.json({ audioUrl: `http://localhost:${port}/audio/${fileName}` });
    } catch (error) {
        console.error("Speech Synthesis Error:", error);
        res.status(500).json({ error: "Synthesis failed" });
    }
});

app.listen(port, () => {
    console.log(`Universal Speaker Hub (Production Ready) running on http://localhost:${port}`);
});
