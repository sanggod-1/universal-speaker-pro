const API_BASE_URL = 'http://localhost:5001/api';

export const translateText = async (text: string, targetLang: string, speakerProfile: string = "Expert Speaker") => {
    try {
        const response = await fetch(`${API_BASE_URL}/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, targetLang, speakerProfile }),
        });

        if (!response.ok) {
            throw new Error('Translation API failed');
        }

        const data = await response.json();
        return data.translatedText;
    } catch (error) {
        console.error('Translation error:', error);
        return null;
    }
};

export const synthesizeText = async (text: string, voiceId?: string) => {
    try {
        const response = await fetch(`${API_BASE_URL}/synthesize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, voiceId }),
        });

        const data = await response.json();
        return data.audioUrl;
    } catch (error) {
        console.error('Synthesis error:', error);
        return null;
    }
};

export const getSyncMetadata = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/sync-metadata`);
        const data = await response.json();
        return data;
    } catch (error) {
        return null;
    }
};
