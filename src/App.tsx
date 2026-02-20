import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { translateText, synthesizeText } from './services/api';

// Mock Data
const LANGUAGES = [
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
];

function App() {
  const [view, setView] = useState<'dashboard' | 'audience' | 'screen'>('dashboard');
  const [isEngineLive, setIsEngineLive] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState("Ladies and Gentlemen, it's an honor to be here today.");
  const [translatedSpeech, setTranslatedSpeech] = useState("신사 숙녀 여러분, 오늘 이 자리에 오게 되어 영광입니다.");
  const [selectedLang, setSelectedLang] = useState('ko');
  const [isTranslating, setIsTranslating] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // Webcam Setup
  useEffect(() => {
    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (stageVideoRef.current) stageVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Webcam not accessible:", err);
      }
    }
    setupWebcam();
  }, [view]); // Re-setup when switching views to ensure correct element ref

  // Real-time Translation & Voice Sync Cycle
  useEffect(() => {
    let interval: any;
    if (isEngineLive) {
      interval = setInterval(async () => {
        // Simulating continuous speech chunks
        const chunks = [
          "AI technology is breaking boundaries.",
          "We are building a future where language is no longer a barrier.",
          "Universal Speaker Pro makes global communication seamless."
        ];
        const randomChunk = chunks[Math.floor(Math.random() * chunks.length)];
        setCurrentSpeech(randomChunk);

        setIsTranslating(true);
        // 1. Translate
        const translated = await translateText(randomChunk, selectedLang);
        if (translated) {
          setTranslatedSpeech(translated);
          // 2. Synthesize Voice (Optional: Add ElevenLabs Key to .env)
          const audioUrl = await synthesizeText(translated);
          if (audioUrl) {
            audioRef.current.src = audioUrl;
            audioRef.current.play();
          }
        }
        setIsTranslating(false);
      }, 7000);
    }
    return () => {
      clearInterval(interval);
      audioRef.current.pause();
    };
  }, [isEngineLive, selectedLang]);

  // Big Screen Component (What the audience sees on stage)
  const ScreenView = () => (
    <div className="container screen-view">
      <div className="main-stage glass">
        <div className="live-video-rect">
          {/* Real Webcam Feed */}
          <div className={`video-container large ${isTranslating ? 'processing' : ''}`}>
            <video ref={stageVideoRef} autoPlay playsInline muted className="live-video" />
            <div className="visual-ai-overlay">
              <div className="mouth-wave large" style={{ animationPlayState: isEngineLive ? 'running' : 'paused' }}></div>
            </div>
          </div>
        </div>
        <div className="stage-captions">
          {isEngineLive && <h1>{translatedSpeech}</h1>}
        </div>
        <div className="stage-meta">
          <div className="qr-container">
            <div className="qr-box">QR</div>
            <span>Scan to listen in your language</span>
          </div>
          <div className="live-badge">LIVE SEMANTIC TRANSLATION</div>
        </div>
      </div>
      <button className="back-btn" onClick={() => setView('dashboard')}>Return to Dashboard</button>
    </div>
  );

  // Dashboard Component
  const Dashboard = () => (
    <div className="container dashboard">
      <header>
        <div className="logo">UNIVERSAL SPEAKER <span className="premium">PRO</span></div>
        <div className="status">
          <span className={`indicator ${isEngineLive ? 'live' : ''}`}></span>
          {isEngineLive ? 'ENGINE LIVE' : 'ENGINE READY'}
        </div>
      </header>

      <main>
        <section className="live-preview glass">
          <h3><span className="icon">🎬</span> AI Visual Sync Preview</h3>
          <div className="video-placeholder">
            {/* Real Webcam Feed */}
            <div className={`video-container ${isTranslating ? 'processing' : ''}`}>
              <video ref={videoRef} autoPlay playsInline muted className="live-video" />
              <div className="visual-ai-overlay">
                <div className="mouth-wave" style={{ animationPlayState: isEngineLive ? 'running' : 'paused' }}></div>
              </div>
            </div>
            <div className="overlay-captions">
              {isEngineLive && <p className="animate-pulse-slow">{translatedSpeech}</p>}
            </div>
          </div>
          <div className="controls">
            <button className={`glow-btn ${isEngineLive ? 'stop' : ''}`} onClick={() => setIsEngineLive(!isEngineLive)}>
              {isEngineLive ? 'PAUSE SESSION' : 'START GLOBAL BROADCAST'}
            </button>
            <button className="secondary-btn" onClick={() => setView('screen')} style={{ marginLeft: '10px' }}>View Stage Screen</button>
          </div>
        </section>

        <section className="metrics">
          <div className="metric-box glass">
            <h4>Live Audience</h4>
            <div className="value">1,248</div>
            <div className="sub">Active connections</div>
          </div>
          <div className="metric-box glass">
            <h4>Top Language</h4>
            <div className="value">Korean</div>
            <div className="sub">42% of listeners</div>
          </div>
          <div className="metric-box glass">
            <h4>Sync Latency</h4>
            <div className="value">180ms</div>
            <div className="sub">Ultra-low delay</div>
          </div>
        </section>

        <section className="config glass">
          <h3><span className="icon">⚙️</span> Session Config</h3>
          <div className="qr-preview">
            <div className="qr-code">QR</div>
            <p>Scan to join the audience</p>
            <button className="secondary-btn" onClick={() => setView('audience')}>View Audience Page</button>
          </div>
        </section>
      </main>
    </div>
  );

  // Audience Page Component
  const AudiencePage = () => (
    <div className="container audience-page">
      <div className="audience-card glass">
        <h2>Select Your Language</h2>
        <div className="lang-list">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              className={`lang-item ${selectedLang === lang.code ? 'active' : ''}`}
              onClick={() => setSelectedLang(lang.code)}
            >
              <span className="flag">{lang.flag}</span>
              <span className="name">{lang.name}</span>
            </button>
          ))}
        </div>
        <div className="listening-status">
          <div className="audio-visualizer">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bar" style={{ height: `${Math.random() * 100}%` }}></div>
            ))}
          </div>
          <p>Listening to Live Translation...</p>
        </div>
        <button className="back-btn" onClick={() => setView('dashboard')}>Return to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="app-root">
      {view === 'dashboard' && <Dashboard />}
      {view === 'audience' && <AudiencePage />}
      {view === 'screen' && <ScreenView />}
    </div>
  );
}

export default App;
