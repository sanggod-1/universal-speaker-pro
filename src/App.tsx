import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { translateText, synthesizeText } from './services/api';

// Supported Languages
const LANGUAGES = [
  { code: 'ko', name: '한국어', nameEn: 'Korean', flag: '🇰🇷' },
  { code: 'en', name: 'English', nameEn: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文', nameEn: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', nameEn: 'Japanese', flag: '🇯🇵' },
  { code: 'es', name: 'Español', nameEn: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', nameEn: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', nameEn: 'German', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية', nameEn: 'Arabic', flag: '🇸🇦' },
];

const VOICES = [
  { id: '21m00Tcm4lpxNFCpHZ1M', name: 'Rachel — Professional' },
  { id: 'ErXw9S1q38YvI0E2yyE8', name: 'Antoni — Calm Authority' },
  { id: 'EXAVITpSAn99nh8B5vCr', name: 'Bella — Soft & Clear' },
  { id: 'GBv7mTt0atIp3i8iCnoE', name: 'Thomas — Deep Presence' },
];

// Demo speech chunks for showcase mode
const DEMO_SPEECHES = [
  "Ladies and Gentlemen, it is a great honor to stand before this distinguished audience today.",
  "Artificial Intelligence is not replacing human creativity. It is amplifying it beyond measure.",
  "Our research demonstrates a 300% improvement in cross-lingual communication effectiveness.",
  "The future of global discourse depends on breaking down language barriers with technology.",
  "Universal Speaker Pro represents a paradigm shift in how we experience multilingual events.",
];

function App() {
  const [view, setView] = useState<'dashboard' | 'audience' | 'screen'>('dashboard');
  const [isEngineLive, setIsEngineLive] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [translatedSpeech, setTranslatedSpeech] = useState('');
  const [selectedLang, setSelectedLang] = useState('ko');
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [audienceCount, setAudienceCount] = useState(0);
  const [latency, setLatency] = useState(0);
  const [translationCount, setTranslationCount] = useState(0);
  const [useMic, setUseMic] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [speakerProfile, setSpeakerProfile] = useState("Professional Seminar Speaker");

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const recognitionRef = useRef<any>(null);
  const demoIndexRef = useRef(0);

  // Webcam Setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (stageVideoRef.current) stageVideoRef.current.srcObject = stream;
        setWebcamActive(true);
      } catch (err) {
        console.warn("Webcam not accessible:", err);
        setWebcamActive(false);
      }
    }
    setupWebcam();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [view]);

  // Simulated audience count animation
  useEffect(() => {
    if (isEngineLive) {
      const target = 1248 + Math.floor(Math.random() * 200);
      let current = 0;
      const step = Math.ceil(target / 40);
      const interval = setInterval(() => {
        current = Math.min(current + step, target);
        setAudienceCount(current);
        if (current >= target) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    } else {
      setAudienceCount(0);
    }
  }, [isEngineLive]);

  // Demo mode translation cycle
  useEffect(() => {
    let interval: any;
    if (isEngineLive && !useMic) {
      const runDemo = async () => {
        const speech = DEMO_SPEECHES[demoIndexRef.current % DEMO_SPEECHES.length];
        demoIndexRef.current++;
        setCurrentSpeech(speech);
        setIsTranslating(true);
        const startTime = Date.now();

        try {
          const translated = await translateText(speech, selectedLang, speakerProfile);
          const elapsed = Date.now() - startTime;
          setLatency(elapsed);
          if (translated) {
            setTranslatedSpeech(translated);
            setTranslationCount(prev => prev + 1);
            // Voice synthesis (optional - depends on ElevenLabs key)
            const audioUrl = await synthesizeText(translated, selectedVoice);
            if (audioUrl) {
              audioRef.current.src = audioUrl;
              audioRef.current.play().catch(() => { });
            }
          }
        } catch (e) {
          console.error('Translation cycle error:', e);
        }
        setIsTranslating(false);
      };

      runDemo();
      interval = setInterval(runDemo, 8000);
    }

    return () => {
      clearInterval(interval);
      audioRef.current.pause();
    };
  }, [isEngineLive, selectedLang, useMic, selectedVoice]);

  // Live Mic STT Mode (Web Speech API)
  useEffect(() => {
    if (isEngineLive && useMic) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let lastFinal = '';

      recognition.onresult = async (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (interim) setCurrentSpeech(interim);

        if (final && final !== lastFinal) {
          lastFinal = final;
          setCurrentSpeech(final);
          setIsTranslating(true);
          const startTime = Date.now();

          try {
            const translated = await translateText(final, selectedLang, speakerProfile);
            setLatency(Date.now() - startTime);
            if (translated) {
              setTranslatedSpeech(translated);
              setTranslationCount(prev => prev + 1);
            }
          } catch (e) {
            console.error('STT Translation error:', e);
          }
          setIsTranslating(false);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };

      recognition.start();
      recognitionRef.current = recognition;

      return () => {
        recognition.stop();
        recognitionRef.current = null;
      };
    }
  }, [isEngineLive, useMic, selectedLang]);

  const toggleEngine = useCallback(() => {
    if (isEngineLive) {
      setIsEngineLive(false);
      setCurrentSpeech('');
      setTranslatedSpeech('');
      audioRef.current.pause();
    } else {
      setIsEngineLive(true);
      demoIndexRef.current = 0;
    }
  }, [isEngineLive]);

  const selectedLangObj = LANGUAGES.find(l => l.code === selectedLang) || LANGUAGES[0];

  // ========== STAGE SCREEN VIEW ==========
  const ScreenView = () => (
    <div className="container screen-view">
      <div className="main-stage glass">
        <div className="live-video-rect">
          <div className={`video-container large ${isTranslating ? 'processing' : ''}`}>
            <video ref={stageVideoRef} autoPlay playsInline muted className="live-video" />
            <div className="visual-ai-overlay">
              {/* [2026 고도화] 번역 부하에 따른 동적 애니메이션 싱크 */}
              <div
                className="mouth-wave large"
                style={{
                  animationPlayState: isEngineLive ? 'running' : 'paused',
                  animationDuration: isTranslating ? '0.5s' : '1.2s',
                  filter: isTranslating ? 'drop-shadow(0 0 12px var(--glow-gold))' : 'none'
                }}
              />
            </div>
            {isEngineLive && (
              <div className="ai-badge" style={{ background: isTranslating ? 'var(--accent-gold)' : 'rgba(0,0,0,0.6)' }}>
                <div className="dot" style={{ animation: isTranslating ? 'pulse 0.5s infinite' : 'none' }} />
                {isTranslating ? 'SEMANTIC ANALYZING...' : 'AI ENGINE STANDBY'}
              </div>
            )}
            <div className="lang-badge-overlay">
              {selectedLangObj.flag} Translating to {selectedLangObj.nameEn}
              {latency > 0 && (
                <span style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  background: latency < 800 ? '#10b981' : latency < 1500 ? '#f59e0b' : '#ef4444'
                }}>
                  {latency}ms
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="stage-captions">
          {isEngineLive && translatedSpeech && (
            <h1 key={translatedSpeech.substring(0, 20)}>{translatedSpeech}</h1>
          )}
        </div>

        <div className="stage-meta">
          <div className="qr-container">
            <div className="qr-box">📱 QR</div>
            <span>Scan to listen in your language</span>
          </div>
          <div className="live-badge">
            {isEngineLive ? '● LIVE SEMANTIC TRANSLATION' : 'STANDBY'}
          </div>
        </div>
      </div>
      <button className="back-btn" onClick={() => setView('dashboard')}>← Return to Dashboard</button>
    </div>
  );

  // ========== DASHBOARD ==========
  const Dashboard = () => (
    <div className="container dashboard">
      <header>
        <div className="logo">UNIVERSAL SPEAKER <span className="premium">PRO</span></div>
        <div className="status">
          <span className={`indicator ${isEngineLive ? 'live' : ''}`} />
          {isEngineLive ? 'ENGINE LIVE' : 'ENGINE READY'}
        </div>
      </header>

      <main>
        {/* Live Preview */}
        <section className="live-preview glass">
          <h3><span className="icon">🎬</span> AI Visual Sync Preview</h3>

          <div className="video-placeholder">
            <div className={`video-container ${isTranslating ? 'processing' : ''}`}>
              {webcamActive ? (
                <video ref={videoRef} autoPlay playsInline muted className="live-video" />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '2.5rem' }}>📷</span>
                  <span style={{ fontSize: '0.8rem' }}>Camera Preview</span>
                </div>
              )}
              <div className="visual-ai-overlay">
                <div className="mouth-wave" style={{ animationPlayState: isEngineLive ? 'running' : 'paused' }} />
              </div>
              {isEngineLive && (
                <div className="ai-badge">
                  <div className="dot" />
                  {isTranslating ? 'PROCESSING...' : 'LISTENING'}
                </div>
              )}
            </div>

            {isEngineLive && (currentSpeech || translatedSpeech) && (
              <div className="overlay-captions">
                <div className="caption-box">
                  {currentSpeech && (
                    <p className="original-speech-hint">
                      🎙️ Recognized: {currentSpeech}
                    </p>
                  )}
                  {translatedSpeech && (
                    <p className="translated-text">{translatedSpeech}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="controls">
            <button
              className={`glow-btn ${isEngineLive ? 'stop' : ''}`}
              onClick={toggleEngine}
            >
              {isEngineLive ? '■  PAUSE SESSION' : '▶  START GLOBAL BROADCAST'}
            </button>
            <button className="secondary-btn" onClick={() => setView('screen')}>
              🖥 Stage Screen
            </button>
            <button className="secondary-btn" onClick={() => setView('audience')}>
              📱 Audience View
            </button>
          </div>

          {/* Input Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', gap: '8px' }}>
            <button
              className={`nav-tab ${!useMic ? 'active' : ''}`}
              onClick={() => setUseMic(false)}
              style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: !useMic ? 'var(--glow-gold)' : 'transparent', color: !useMic ? 'var(--accent-gold)' : 'var(--text-dim)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
            >
              🎭 Demo Mode
            </button>
            <button
              className={`nav-tab ${useMic ? 'active' : ''}`}
              onClick={() => setUseMic(true)}
              style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: useMic ? 'var(--glow-gold)' : 'transparent', color: useMic ? 'var(--accent-gold)' : 'var(--text-dim)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
            >
              🎤 Live Mic (STT)
            </button>
          </div>
        </section>

        {/* Metrics */}
        <div className="metrics-area">
          <div className="metric-box glass">
            <div className="metric-icon">👥</div>
            <h4>Live Audience</h4>
            <div className="value">{audienceCount.toLocaleString()}</div>
            <div className="sub">Active connections</div>
          </div>
          <div className="metric-box glass">
            <div className="metric-icon">🌍</div>
            <h4>Target Language</h4>
            <div className="value">{selectedLangObj.flag} {selectedLangObj.name}</div>
            <div className="sub">{LANGUAGES.length} languages available</div>
          </div>
          <div className="metric-box glass">
            <div className="metric-icon">⚡</div>
            <h4>Sync Latency</h4>
            <div className="value">{latency > 0 ? `${latency}ms` : '—'}</div>
            <div className="sub">{latency <= 500 ? 'Ultra-low delay' : latency <= 1500 ? 'Normal' : 'High'}</div>
          </div>
          <div className="metric-box glass">
            <div className="metric-icon">📊</div>
            <h4>Translated</h4>
            <div className="value">{translationCount}</div>
            <div className="sub">Segments processed</div>
          </div>
        </div>

        {/* Config */}
        <section className="config glass">
          <h3><span className="icon">⚙️</span> Session Config</h3>

          <div className="config-grid">
            {/* Language Selection */}
            <div>
              <label className="config-label">Translation Target</label>
              <div className="lang-grid">
                {LANGUAGES.slice(0, 4).map(lang => (
                  <button
                    key={lang.code}
                    className={`lang-chip ${selectedLang === lang.code ? 'active' : ''}`}
                    onClick={() => setSelectedLang(lang.code)}
                  >
                    <span className="flag">{lang.flag}</span>
                    {lang.name}
                  </button>
                ))}
              </div>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="glass-select"
                style={{ marginTop: '8px' }}
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.nameEn} ({l.name})</option>
                ))}
              </select>
            </div>

            {/* Voice Profile */}
            <div>
              <label className="config-label">AI Voice Profile</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="glass-select"
              >
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {/* Translation Domain (Speaker Profile) */}
            <div>
              <label className="config-label">Translation Domain</label>
              <select
                value={speakerProfile}
                onChange={(e) => setSpeakerProfile(e.target.value)}
                className="glass-select"
              >
                <option value="Professional Seminar Speaker">💼 General / Business</option>
                <option value="Senior Medical Researcher/Doctor. Use precise medical terminology and professional tone.">⚕️ Medical / Dental</option>
                <option value="Lead Tech Entrepreneur/Engineer. Use cutting-edge tech jargon and energetic tone.">🚀 Tech / IT</option>
                <option value="Academic Professor. Use formal, academic, and highly structured language.">🎓 Academic</option>
              </select>
            </div>

            {/* QR */}
            <div className="qr-preview">
              <div className="qr-code">📱 QR</div>
              <p>Share this link with your audience</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );

  // ========== AUDIENCE PAGE ==========
  const AudiencePage = () => (
    <div className="audience-page">
      <div className="audience-card glass">
        <h2>🌐 Universal Speaker Pro</h2>
        <p className="audience-subtitle">Select your preferred language to receive live translation</p>

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
          <div className="listening-label">
            {isEngineLive ? '● Live Translation Active' : '○ Waiting for broadcast...'}
          </div>
          {isEngineLive && (
            <>
              <div className="audio-visualizer">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bar" style={{ height: `${20 + Math.random() * 80}%` }} />
                ))}
              </div>
              {translatedSpeech && (
                <div className="audience-translated-text">{translatedSpeech}</div>
              )}
            </>
          )}
        </div>

        <button className="back-btn" onClick={() => setView('dashboard')}>← Return to Dashboard</button>
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
