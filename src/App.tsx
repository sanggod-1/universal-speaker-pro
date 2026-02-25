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

const DEMO_SPEECHES = [
  "Ladies and Gentlemen, it is a great honor to stand before this distinguished audience today.",
  "Artificial Intelligence is not replacing human creativity. It is amplifying it beyond measure.",
  "Our research demonstrates a 300% improvement in cross-lingual communication effectiveness.",
  "The future of global discourse depends on breaking down language barriers with technology.",
  "Universal Speaker Pro represents a paradigm shift in how we experience multilingual events.",
];

// Global volume ref to share across components without re-renders
const globalVolumeRef = { current: 0 };

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
  const [sourceLang, setSourceLang] = useState('ko-KR');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const recognitionRef = useRef<any>(null);
  const demoIndexRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Singleton Audio Analysis Setup
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Server Health Check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/health');
        if (response.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch (err) {
        setServerStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Persistent Webcam Management
  useEffect(() => {
    async function setupWebcam() {
      if (streamRef.current) return; // Already have one
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        setWebcamActive(true);
        // Bind to refs if they exist
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (stageVideoRef.current) stageVideoRef.current.srcObject = stream;
      } catch (err) {
        console.warn("Webcam not accessible:", err);
        setWebcamActive(false);
      }
    }
    setupWebcam();
    return () => {
      // Don't stop on view change, only on actual unmount if necessary
    };
  }, []);

  // Web Wake Lock to prevent screen dimming
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) { }
    };
    if (isEngineLive) requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
    };
  }, [isEngineLive]);

  // Re-bind stream on view changes
  useEffect(() => {
    if (streamRef.current) {
      const bindStream = () => {
        if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        if (stageVideoRef.current && stageVideoRef.current.srcObject !== streamRef.current) {
          stageVideoRef.current.srcObject = streamRef.current;
        }
      };
      bindStream();
      // Safety interval to ensure video doesn't freeze
      const int = setInterval(bindStream, 3000);
      return () => clearInterval(int);
    }
  }, [view, webcamActive, isEngineLive]);

  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio Analysis Logic
  useEffect(() => {
    if (isEngineLive) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;
      }

      // Connect Mic for Visualization
      if (useMic && !micSourceRef.current && audioContextRef.current && analyserRef.current) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          if (audioContextRef.current && analyserRef.current) {
            micSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            micSourceRef.current.connect(analyserRef.current);
          }
        }).catch(err => console.warn("Mic visualization failed:", err));
      }

      if (!audioSourceRef.current && audioRef.current && audioContextRef.current && analyserRef.current) {
        try {
          audioSourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          audioSourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        } catch (e) {
          console.warn("Audio source connection failed (likely already connected):", e);
        }
      }

      const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
      let frame: number;
      const update = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        globalVolumeRef.current = Math.min((sum / dataArray.length) / 40, 1.5);
        frame = requestAnimationFrame(update);
      };
      update();
      return () => {
        cancelAnimationFrame(frame);
        if (micSourceRef.current) {
          micSourceRef.current.disconnect();
          micSourceRef.current = null;
        }
      };
    }
  }, [isEngineLive, useMic]);

  // Audience count animation
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

  // Translation Cycle (Demo)
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
          setLatency(Date.now() - startTime);
          if (translated) {
            setTranslatedSpeech(translated);
            setTranslationCount(prev => prev + 1);
            const audioUrl = await synthesizeText(translated, selectedVoice);
            if (audioUrl) {
              audioRef.current.src = audioUrl;
              audioRef.current.play().catch(() => { });
            }
          }
        } catch (e) {
          console.error('Demo error:', e);
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
  }, [isEngineLive, useMic, selectedLang, selectedVoice, speakerProfile]);

  // STT Mode
  useEffect(() => {
    if (isEngineLive && useMic) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = sourceLang;

      let lastFinalTranscript = '';
      recognition.onresult = async (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += transcript;
          else interim += transcript;
        }

        if (interim) setCurrentSpeech(interim);

        // Use a small buffer to handle rapid speech/audiobooks
        if (final && final !== lastFinalTranscript) {
          lastFinalTranscript = final;
          setCurrentSpeech(final);
          setIsTranslating(true);
          const start = Date.now();
          try {
            const translated = await translateText(final, selectedLang, speakerProfile);
            setLatency(Date.now() - start);
            if (translated) {
              setTranslatedSpeech(translated);
              setTranslationCount(prev => prev + 1);

              const synthData = await synthesizeText(translated, selectedVoice);
              if (synthData?.audioUrl) {
                audioRef.current.src = synthData.audioUrl;
                audioRef.current.play().catch(() => { });
              } else if (synthData?.useBrowserTTS) {
                window.speechSynthesis.cancel(); // Cancel previous to reduce overlap delay
                const utterance = new SpeechSynthesisUtterance(synthData.textToSpeak);
                utterance.lang = selectedLang;
                const voices = window.speechSynthesis.getVoices();
                const preferredVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Natural')) && v.lang.startsWith(selectedLang))
                  || voices.find(v => v.lang.startsWith(selectedLang));
                if (preferredVoice) utterance.voice = preferredVoice;
                utterance.rate = 1.2; // Even faster for rapid speech sync
                window.speechSynthesis.speak(utterance);
              }
            }
          } catch (e) { console.error(e); }
          setIsTranslating(false);
        }
      };
      recognition.onend = () => {
        if (isEngineLive && useMic && recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.error("Recognition restart error:", e);
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      return () => {
        recognitionRef.current = null;
        recognition.onend = null;
        recognition.stop();
      };
    }
  }, [isEngineLive, useMic, sourceLang, selectedLang, speakerProfile]);

  const toggleEngine = useCallback(() => {
    if (isEngineLive) {
      setIsEngineLive(false);
      setCurrentSpeech('');
      setTranslatedSpeech('');
      audioRef.current.pause();
      globalVolumeRef.current = 0;
    } else {
      setIsEngineLive(true);
      demoIndexRef.current = 0;
    }
  }, [isEngineLive]);

  const selectedLangObj = LANGUAGES.find(l => l.code === selectedLang) || LANGUAGES[0];

  const MetricBox = ({ icon, label, value, sub }: any) => (
    <div className="metric-box glass">
      <div className="metric-icon">{icon}</div>
      <h4>{label}</h4>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );

  const Dashboard = () => (
    <div className="container dashboard">
      <header>
        <div className="logo">UNIVERSAL SPEAKER <span className="premium">PRO</span></div>
        <div className="status">
          <span className={`indicator ${serverStatus === 'online' ? (isEngineLive ? 'live' : 'ready') : 'offline'}`} />
          {serverStatus === 'online' ? (isEngineLive ? 'ENGINE LIVE' : 'ENGINE READY') : 'SERVER DISCONNECTED'}
        </div>
      </header>
      <main>
        <section className="live-preview glass">
          <h3><span className="icon">🎬</span> AI Visual Sync Preview</h3>
          <div className="video-placeholder">
            <div className={`video-container ${isTranslating ? 'processing' : ''}`}>
              <video ref={videoRef} autoPlay playsInline muted className="live-video" style={{ opacity: webcamActive ? 1 : 0 }} />
              {!webcamActive && (
                <div className="camera-error">
                  <span style={{ fontSize: '2.5rem' }}>📷</span>
                  <button onClick={() => window.location.reload()} className="secondary-btn">Restart Camera</button>
                </div>
              )}
              <VisualSync isEngineLive={isEngineLive} isTranslating={isTranslating} />
            </div>
            {isEngineLive && (currentSpeech || translatedSpeech) && (
              <div className="overlay-captions">
                <div className="caption-box">
                  {currentSpeech && <p className="original-speech-hint">🎙️ Recognized: {currentSpeech}</p>}
                  {translatedSpeech && <p className="translated-text">{translatedSpeech}</p>}
                </div>
              </div>
            )}
          </div>
          <div className="controls">
            <button className={`glow-btn ${isEngineLive ? 'stop' : ''}`} onClick={toggleEngine}>
              {isEngineLive ? '■ PAUSE SESSION' : '▶ START GLOBAL BROADCAST'}
            </button>
            <button className="secondary-btn" onClick={() => setView('screen')}>🖥 Stage Screen</button>
            <button className="secondary-btn" onClick={() => setView('audience')}>📱 Audience View</button>
          </div>
          <div className="mode-tabs">
            <button className={`nav-tab ${!useMic ? 'active' : ''}`} onClick={() => setUseMic(false)}>🎭 Demo Mode</button>
            <button className={`nav-tab ${useMic ? 'active' : ''}`} onClick={() => setUseMic(true)}>🎤 Live Mic (STT)</button>
          </div>
        </section>
        <div className="metrics-area">
          <MetricBox icon="👥" label="Live Audience" value={audienceCount.toLocaleString()} sub="Active connections" />
          <MetricBox icon="🌍" label="Target Language" value={`${selectedLangObj.flag} ${selectedLangObj.name}`} sub={`${LANGUAGES.length} available`} />
          <MetricBox icon="⚡" label="Sync Latency" value={latency > 0 ? `${latency}ms` : '—'} sub={latency <= 800 ? 'Ultra-low' : 'Normal'} />
          <MetricBox icon="📊" label="Translated" value={translationCount} sub="Segments" />
        </div>
        <section className="config glass">
          <h3><span className="icon">⚙️</span> Session Config</h3>
          <div className="config-grid">
            <div className="config-item">
              <label>Translation Target</label>
              <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="glass-select">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.nameEn}</option>)}
              </select>
            </div>
            <div className="config-item">
              <label>Speaker Language</label>
              <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="glass-select">
                <option value="en-US">🇺🇸 English</option>
                <option value="ko-KR">🇰🇷 한국어</option>
                <option value="ja-JP">🇯🇵 日本語</option>
                <option value="zh-CN">🇨🇳 中文</option>
              </select>
            </div>
            <div className="config-item">
              <label>AI Voice</label>
              <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="glass-select">
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="config-item">
              <label>Domain</label>
              <select value={speakerProfile} onChange={(e) => setSpeakerProfile(e.target.value)} className="glass-select">
                <option value="Professional Seminar Speaker">💼 Business</option>
                <option value="Senior Medical Researcher/Doctor.">⚕️ Medical</option>
                <option value="Lead Tech Entrepreneur/Engineer.">🚀 Tech</option>
              </select>
            </div>
            <div className="qr-preview">
              <div className="qr-code shadow-glow">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.href.replace('dashboard', 'audience'))}&color=d4a853&bgcolor=030712`} alt="QR" />
              </div>
              <p>Audience Access</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );

  const ScreenView = () => (
    <div className="container screen-view">
      <div className="main-stage glass">
        <div className="live-video-rect">
          <div className={`video-container large ${isTranslating ? 'processing' : ''}`}>
            <video ref={stageVideoRef} autoPlay playsInline muted className="live-video" style={{ opacity: webcamActive ? 1 : 0 }} />
            <VisualSync isEngineLive={isEngineLive} isTranslating={isTranslating} isLarge />
          </div>
        </div>
        <div className="stage-captions">
          {isEngineLive && translatedSpeech && <h1>{translatedSpeech}</h1>}
        </div>
        <div className="stage-meta">
          <div className="live-badge">{isEngineLive ? '● LIVE' : 'STANDBY'}</div>
          <div className="qr-container">
            <div className="qr-box shadow-glow">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(window.location.href)}&color=d4a853&bgcolor=030712`} alt="QR" />
            </div>
          </div>
        </div>
      </div>
      <button className="back-btn" onClick={() => setView('dashboard')}>← Back</button>
    </div>
  );

  const AudiencePage = () => (
    <div className="audience-page">
      <div className="audience-card glass">
        <h2>🌐 Live Translation</h2>
        <div className="lang-list">
          {LANGUAGES.map(lang => (
            <button key={lang.code} className={`lang-item ${selectedLang === lang.code ? 'active' : ''}`} onClick={() => setSelectedLang(lang.code)}>
              <span className="flag">{lang.flag}</span> {lang.name}
            </button>
          ))}
        </div>
        <div className="listening-status">
          <div className="listening-label">{isEngineLive ? '● Listening...' : '○ Waiting...'}</div>
          {isEngineLive && translatedSpeech && <div className="audience-translated-text">{translatedSpeech}</div>}
        </div>
        <button className="back-btn" onClick={() => setView('dashboard')}>← Back</button>
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

// ========== VISUAL SYNC COMPONENT (Optimized) ==========
const VisualSync = ({ isEngineLive, isTranslating, isLarge = false }: any) => {
  const [vol, setVol] = useState(0);

  useEffect(() => {
    if (isEngineLive) {
      let frame: number;
      const update = () => {
        setVol(globalVolumeRef.current);
        frame = requestAnimationFrame(update);
      };
      update();
      return () => cancelAnimationFrame(frame);
    } else {
      setVol(0);
    }
  }, [isEngineLive]);

  return (
    <>
      <div className="visual-ai-overlay">
        <div
          className={`mouth-wave ${isLarge ? 'large' : ''}`}
          style={{
            opacity: vol > 0.1 ? (isLarge ? 0.9 : 0.8) : 0,
            transform: `scaleX(${0.5 + vol}) scaleY(${1 + vol * (isLarge ? 2 : 1.5)})`,
            filter: isTranslating ? 'drop-shadow(0 0 12px var(--glow-gold))' : 'none',
            transition: 'opacity 0.1s ease, transform 0.05s ease'
          }}
        />
      </div>
      <div className="ai-badge" style={{ background: isTranslating ? 'var(--accent-gold)' : 'rgba(0,0,0,0.6)', opacity: isEngineLive ? 1 : 0 }}>
        <div className="dot" style={{ animation: isTranslating ? 'pulse 0.5s infinite' : 'none' }} />
        {isTranslating ? (isLarge ? 'SEMANTIC ANALYZING...' : 'PROCESSING...') : (isLarge ? 'AI ENGINE STANDBY' : 'LISTENING')}
      </div>
    </>
  );
};

export default App;
