const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5001;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY is not defined in .env file!");
} else {
    // 키 로드 확인 로그 (앞뒤 4자리만 노출)
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`✅ Tier 1 Key Authorized: ${maskedKey}`);
}

app.use(cors());
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Ensure audio directory exists
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

const genAI = new GoogleGenerativeAI(apiKey || "");

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'Universal Speaker Pro', model: 'gemini-1.5-flash-latest' });
});

const contextCache = new Map(); // Global session context storage

// Semantic Translation Endpoint
app.post('/api/translate', async (req, res) => {
    const { text, targetLang, sessionId = "default", speakerProfile = "Professional Seminar Speaker" } = req.body;

    // Manage context memory for consistent terminology
    let recentContext = contextCache.get(sessionId) || [];
    recentContext.push(text);
    if (recentContext.length > 5) recentContext.shift();
    contextCache.set(sessionId, recentContext);

    console.log(`[Translate] → ${targetLang}: ${text.substring(0, 40)}...`);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are an elite simultaneous interpreter.
        
        CONTEXT: ${recentContext.join(" | ")}
        
        TASK:
        1. Translate: "${text}" into [${targetLang}].
        2. Contextual Link: Ensure this follows the flow of previous sentences.
        3. Identity: Speaker is a "${speakerProfile}". Use appropriate honorifics.
        
        RULES:
        - Output ONLY the translation.
        - NO explanation. No quotes.
        - If input is a short fragment, wait for context or translate naturally.`;

        const result = await model.generateContent(prompt);
        const translatedText = result.response.text().trim().replace(/^"|"$/g, '');
        console.log(`[Translate] ✓ ${translatedText.substring(0, 40)}...`);
        res.json({ translatedText });
    } catch (error) {
        console.error("[Translate] DETAILED ERROR:", error);
        // Fallback: return a meaningful demo translation
        const fallbacks = {
            'ko': '(번역 처리 중... 잠시 후 다시 시도합니다)',
            'ja': '(翻訳処理中... しばらくお待ちください)',
            'zh': '(翻译处理中... 请稍候)',
            'es': '(Procesando traducción... por favor espere)',
            'fr': '(Traduction en cours... veuillez patienter)',
            'de': '(Übersetzung wird verarbeitet... bitte warten)',
            'ar': '(جارٍ معالجة الترجمة... يرجى الانتظار)',
        };
        res.json({ translatedText: fallbacks[targetLang] || text });
    }
});

// AI Voice Synthesis (ElevenLabs Integration)
app.post('/api/synthesize', async (req, res) => {
    const { text, voiceId = "21m00Tcm4lpxNFCpHZ1M" } = req.body;
    console.log(`[Synthesize] voice=${voiceId}: ${text.substring(0, 30)}...`);

    if (!process.env.ELEVENLABS_API_KEY) {
        return res.json({
            audioUrl: null,
            useBrowserTTS: true,
            textToSpeak: text,
            message: "Using Browser Native TTS (No API Key Required)"
        });
    }

    try {
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`,
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
            timeout: 15000
        });

        const fileName = `speech_${Date.now()}.mp3`;
        const filePath = path.join(audioDir, fileName);
        fs.writeFileSync(filePath, response.data);

        // Clean up old audio files (keep last 20)
        const files = fs.readdirSync(audioDir).sort().reverse();
        files.slice(20).forEach(f => {
            try { fs.unlinkSync(path.join(audioDir, f)); } catch (e) { }
        });

        res.json({
            audioUrl: `http://localhost:${port}/audio/${fileName}`,
            fileName
        });
    } catch (error) {
        console.error("[Synthesize] Error:", error.message);
        res.json({ audioUrl: null, message: "Synthesis temporarily unavailable" });
    }
});

// Sync metadata for audience
app.get('/api/sync-metadata', (req, res) => {
    res.json({
        engineVersion: '3.0',
        model: 'gemini-2.5-flash',
        voiceEngine: 'ElevenLabs Multilingual V2',
        supportedLanguages: ['ko', 'en', 'zh', 'ja', 'es', 'fr', 'de', 'ar'],
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`\n🎙️  Universal Speaker Pro — Engine Running`);
    console.log(`   Port: ${port}`);
    console.log(`   Model: gemini-2.5-flash (Tier 1 Enabled)`);
    console.log(`   Voice: ${process.env.ELEVENLABS_API_KEY ? 'ElevenLabs Connected' : 'Text-only mode'}`);
    console.log(`   Ready: http://localhost:${port}\n`);
});
