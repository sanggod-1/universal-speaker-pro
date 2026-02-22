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
    const { text, targetLang, speakerProfile = "Professional Seminar Speaker" } = req.body;
    console.log(`Translating to ${targetLang}: ${text.substring(0, 30)}...`);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            Role: Expert Simultaneous Interpreter
            Task: Translate the following text to [${targetLang}] for a [${speakerProfile}].
            Guidelines:
            1. Maintain the original professional, authoritative, and respectful tone.
            2. Adjust cultural nuances to fit the target language audience.
            3. Ensure the translation is concise and suitable for real-time speech.
            4. If the source contains technical terms, use standard industry terminology in [${targetLang}].
            
            Text: "${text}"
        `;
        const result = await model.generateContent(prompt);
        const translatedText = result.response.text().trim();
        console.log(`Success: ${translatedText.substring(0, 30)}...`);
        res.json({ translatedText });
    } catch (error) {
        console.error("Translation ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

// AI Voice Synthesis (ElevenLabs Integration)
app.post('/api/synthesize', async (req, res) => {
    const { text, voiceId = "21m00Tcm4lpxNFCpHZ1M" } = req.body;
    console.log(`Synthesizing with voice ${voiceId}: ${text.substring(0, 30)}...`);

    if (!process.env.ELEVENLABS_API_KEY) {
        return res.json({ audioUrl: null, message: "ELEVENLABS_API_KEY Missing" });
    }

    try {
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            data: {
                text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            },
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
            timeout: 10000
        });

        const fileName = `speech_${Date.now()}.mp3`;
        const filePath = path.join(audioDir, fileName);
        fs.writeFileSync(filePath, response.data);

        res.json({
            audioUrl: `http://localhost:${port}/audio/${fileName}`,
            fileName: fileName
        });
    } catch (error) {
        console.error("Speech Synthesis Error:", error);
        res.status(500).json({ error: "Synthesis failed" });
    }
});

app.listen(port, () => {
    console.log(`Universal Speaker Hub (Production Ready) running on http://localhost:${port}`);
});
