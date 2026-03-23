import { useState, useEffect, useRef } from "react";
import questionsRaw from '../QuizPatenteB-main/quizPatenteB2023.json';

// ─────────────────────────────────────────────
// PARSE JSON → FLAT QUESTION ARRAY
// ─────────────────────────────────────────────
function formatCat(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const ALL_Q = (() => {
  const out = [];
  let id = 1;
  for (const [cat, subs] of Object.entries(questionsRaw)) {
    const category = formatCat(cat);
    for (const items of Object.values(subs)) {
      for (const item of items) {
        out.push({
          id: id++,
          text: item.q,
          options: ['Vero', 'Falso'],
          correct: item.a ? 0 : 1,
          category,
          img: item.img || null,
        });
      }
    }
  }
  return out;
})();

// Fast lookup by id
const Q_BY_ID = Object.fromEntries(ALL_Q.map(q => [String(q.id), q]));
const ALL_CATS = [...new Set(ALL_Q.map(q => q.category))];

// ─────────────────────────────────────────────
// HISTORY & STATS PERSISTENCE
// ─────────────────────────────────────────────
const HISTORY_KEY = 'quiz_patente_history';
const QSTATS_KEY  = 'quiz_patente_qstats';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function loadQStats() {
  try { return JSON.parse(localStorage.getItem(QSTATS_KEY)) || {}; }
  catch { return {}; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* quota or private mode */ }
}
function saveQStats(s) {
  try { localStorage.setItem(QSTATS_KEY,  JSON.stringify(s)); } catch { /* quota or private mode */ }
}

// ─────────────────────────────────────────────
// READINESS ALGORITHM
// ─────────────────────────────────────────────
// Score = weighted average of 4 components (0–100):
//   40% → average accuracy of last 5 exam sessions
//   30% → pass rate of last 5 exam sessions
//   20% → % of categories where accuracy ≥ 70% (min 3 answers seen)
//   10% → unique questions seen, target 150
function calcReadiness(history, qStats) {
  if (history.length === 0) return 0;

  const exams   = history.filter(s => s.mode !== 'infinito' && s.mode !== 'errori' && s.mode !== 'normale');
  const recent  = (exams.length > 0 ? exams : history).slice(-5);

  const accScore  = recent.reduce((s, h) => s + h.correct / Math.max(h.totalAnswered, 1), 0) / recent.length;
  const passScore = exams.length > 0
    ? exams.slice(-5).filter(s => s.passed).length / Math.min(exams.length, 5)
    : 0;

  // Category accuracy from per-question stats
  const catAcc = {};
  for (const [qid, st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid];
    if (!q || st.seen < 3) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen: 0, correct: 0 };
    catAcc[q.category].seen    += st.seen;
    catAcc[q.category].correct += st.correct;
  }
  const catsWithData = ALL_CATS.filter(c => catAcc[c]);
  const catScore = catsWithData.length === 0 ? 0
    : catsWithData.filter(c => catAcc[c].correct / catAcc[c].seen >= 0.70).length / ALL_CATS.length;

  const seen          = Object.values(qStats).filter(s => s.seen > 0).length;
  const coverageScore = Math.min(seen / 150, 1);

  return Math.round((accScore * 0.40 + passScore * 0.30 + catScore * 0.20 + coverageScore * 0.10) * 100);
}

// Returns top weak categories (accuracy < 80%, min 3 seen)
function getWeakCategories(qStats) {
  const catAcc = {};
  for (const [qid, st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid];
    if (!q || st.seen < 3) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen: 0, correct: 0 };
    catAcc[q.category].seen    += st.seen;
    catAcc[q.category].correct += st.correct;
  }
  return Object.entries(catAcc)
    .map(([cat, s]) => ({ cat, acc: s.correct / s.seen, seen: s.seen }))
    .filter(x => x.acc < 0.80)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 6);
}

// Returns all category stats sorted by accuracy (for the full breakdown)
function getAllCategoryStats(qStats) {
  const catAcc = {};
  for (const [qid, st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid];
    if (!q || st.seen === 0) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen: 0, correct: 0 };
    catAcc[q.category].seen    += st.seen;
    catAcc[q.category].correct += st.correct;
  }
  return Object.entries(catAcc)
    .map(([cat, s]) => ({ cat, acc: s.correct / s.seen, seen: s.seen }))
    .sort((a, b) => a.acc - b.acc);
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const fmt     = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const fmtDate = ts => new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const MODES = {
  infinito: {
    id: 'infinito', name: 'Quiz Infinito', icon: '∞', subtitle: 'domande infinite',
    desc: 'Domande casuali infinite dal database ufficiale 2023. Nessun limite di tempo.',
    totalQ: null, qTimer: null, totalTimer: null, maxErr: null, color: '#06b6d4',
  },
  normale: {
    id: 'normale', name: 'Quiz Normale', icon: '✏', subtitle: '30 dom · senza timer',
    desc: 'Allenamento libero. 30 domande casuali senza limite di tempo e senza penalità errori.',
    totalQ: 30, qTimer: null, totalTimer: null, maxErr: null, color: '#a855f7',
  },
  ministeriale: {
    id: 'ministeriale', name: 'Simulazione Ministeriale', icon: '🏛', subtitle: '20 min · max 3 errori',
    desc: 'Riproduce l\'esame ministeriale di Stato. 30 domande, 20 minuti, massimo 3 errori consentiti.',
    totalQ: 30, qTimer: null, totalTimer: 1200, maxErr: 3, color: '#f59e0b',
  },
  errori: {
    id: 'errori', name: 'Ripassa Errori', icon: '🔁', subtitle: 'Solo domande sbagliate',
    desc: 'Ripasssa solo le domande che hai risposto male in precedenza. Ideale per colmare le lacune.',
    totalQ: null, qTimer: null, totalTimer: null, maxErr: null, color: '#f43f5e',
  },
};

const C = {
  bg: '#080e1c', surface: '#0f1929', border: '#1a2944',
  text: '#e2e8f8', dim: '#5a7099', green: '#10b981', red: '#f43f5e', yellow: '#f59e0b',
};

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]   = useState('home');
  const [mode, setMode]       = useState(null);
  const [results, setResults] = useState(null);
  const [quizKey, setQuizKey] = useState(0);
  const [history, setHistory] = useState(loadHistory);
  const [qStats,  setQStats]  = useState(loadQStats);

  const start   = (modeId) => { setMode(MODES[modeId]); setScreen('quiz'); setQuizKey(k => k + 1); };
  const restart = ()       => { setScreen('quiz'); setQuizKey(k => k + 1); };

  const finish = (data) => {
    // Persist session
    const entry = {
      date: Date.now(),
      mode: data.mode.id,
      correct: data.correct,
      errors: data.errors,
      totalAnswered: data.totalAnswered,
      passed: data.passed,
      reason: data.reason,
    };
    const newHistory = [...history, entry];
    setHistory(newHistory);
    saveHistory(newHistory);

    // Update per-question stats
    const newQStats = { ...qStats };
    for (const { id, correct } of (data.questionResults || [])) {
      const key = String(id);
      if (!newQStats[key]) newQStats[key] = { seen: 0, correct: 0 };
      newQStats[key].seen++;
      if (correct) newQStats[key].correct++;
    }
    setQStats(newQStats);
    saveQStats(newQStats);

    setResults(data);
    setScreen('results');
  };

  const clearStats = () => {
    if (!window.confirm('Cancellare tutto lo storico e le statistiche?')) return;
    setHistory([]);
    setQStats({});
    saveHistory([]);
    saveQStats({});
  };

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Nunito:wght@400;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    button { cursor: pointer; font-family: inherit; outline: none; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #1a2944; border-radius: 4px; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes popIn  { from { opacity:0; transform:scale(0.95); }       to { opacity:1; transform:scale(1); } }
    .fadeup { animation: fadeUp 0.3s ease both; }
    .popin  { animation: popIn 0.2s ease both; }

    /* Responsive Overrides */
    @media (max-width: 600px) {
      .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
      .responsive-grid-2 { grid-template-columns: 1fr !important; }
      .hide-mobile { display: none !important; }
      .mobile-padding { padding: 32px 16px 60px !important; }
    }
  `;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <style>{globalStyles}</style>
      {screen === 'home'    && <HomeScreen onStart={start} onStats={() => setScreen('stats')} history={history} qStats={qStats} />}
      {screen === 'quiz'    && mode && <QuizScreen key={quizKey} mode={mode} qStats={qStats} onDone={finish} />}
      {screen === 'results' && results && <ResultsScreen results={results} mode={mode} qStats={qStats} onRestart={restart} onHome={() => setScreen('home')} />}
      {screen === 'stats'   && <StatsScreen history={history} qStats={qStats} onHome={() => setScreen('home')} onClear={clearStats} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME SCREEN
// ─────────────────────────────────────────────
function HomeScreen({ onStart, onStats, history, qStats }) {
  const readiness = calcReadiness(history, qStats);
  const rColor = readiness >= 85 ? C.green : readiness >= 55 ? C.yellow : C.red;

  const [ip, setIp] = useState(null);
  useEffect(() => {
    fetch('/api/ip')
      .then(res => res.json())
      .then(data => setIp(data.ip))
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }} className="fadeup mobile-padding">
      {/* Network connectivity hint */}
      {ip && ip !== 'localhost' && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b98115', border: '1px solid #10b98130', borderRadius: 8, padding: '5px 12px', fontSize: 11, color: C.green, fontWeight: 700 }}>
            <span>🌐</span> Connettiti da altri dispositivi: <strong style={{ color: '#fff' }}>http://{ip}:5173</strong>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'inline-flex', gap: 8, background: '#13213d', border: '1px solid #1e3357', borderRadius: 100, padding: '7px 20px', marginBottom: 28, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>🇮🇹</span>
          <span style={{ fontSize: 12, color: C.dim, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Patente di Guida · Categoria B</span>
        </div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(44px,9vw,76px)', fontWeight: 700, lineHeight: 1, marginBottom: 18, background: 'linear-gradient(135deg, #ffffff 0%, #7090c0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          QUIZ PATENTE
        </h1>
        <p style={{ color: C.dim, fontSize: 17, lineHeight: 1.65, maxWidth: 440, margin: '0 auto' }}>
          Preparati con {ALL_Q.length.toLocaleString('it')} domande ufficiali aggiornate al 2023
        </p>
      </div>

      {/* Readiness teaser */}
      {history.length > 0 && (
        <button
          onClick={onStats}
          style={{ width: '100%', marginBottom: 14, background: `${rColor}0d`, border: `1px solid ${rColor}40`, borderRadius: 16, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', color: C.text, transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = rColor}
          onMouseLeave={e => e.currentTarget.style.borderColor = `${rColor}40`}
        >
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${rColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: rColor }}>{readiness}%</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 3 }}>
              {readiness >= 85 ? '🎉 Sei pronto per l\'esame!' : readiness >= 55 ? '📚 Stai progredendo bene' : '💪 Continua ad allenarti'}
            </div>
            <div style={{ fontSize: 12, color: C.dim }}>Clicca per vedere storico, statistiche e cosa ripassare →</div>
          </div>
        </button>
      )}
      {history.length === 0 && (
        <button
          onClick={onStats}
          style={{ width: '100%', marginBottom: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: C.dim, fontSize: 13, fontWeight: 600, transition: 'border-color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#3a5580'}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
        >
          <span style={{ fontSize: 18 }}>📊</span> Storico & Preparazione — inizia un quiz per tracciare i tuoi progressi
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.values(MODES).map((m, i) => {
          const wrongCount = m.id === 'errori'
            ? Object.values(qStats).filter(s => s.seen > 0 && s.correct < s.seen).length
            : null;
          return (
            <ModeCard key={m.id} m={m} delay={i * 60} onSelect={() => onStart(m.id)}
              disabled={m.id === 'errori' && wrongCount === 0}
              badge={m.id === 'errori' && wrongCount > 0 ? `${wrongCount} dom` : null}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', marginTop: 44, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {[[ALL_Q.length.toLocaleString('it'), 'Domande'], ['4', 'Modalità'], ['Gratis', 'Sempre']].map(([v, l], i) => (
          <div key={l} style={{ flex: 1, padding: '20px 10px', textAlign: 'center', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, color: '#fff' }}>{v}</div>
            <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeCard({ m, onSelect, delay, disabled, badge }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="fadeup"
      style={{ animationDelay: `${delay}ms`, background: disabled ? C.surface : hov ? `${m.color}08` : C.surface, border: `1px solid ${disabled ? C.border : hov ? m.color : C.border}`, borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 20, textAlign: 'left', transition: 'all 0.2s', width: '100%', color: C.text, opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' }}
    >
      <div style={{ width: 58, height: 58, borderRadius: 16, background: `${m.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: m.id === 'infinito' ? 30 : 22, fontWeight: 700, color: m.color, flexShrink: 0, fontFamily: m.id === 'infinito' ? "'Oswald', sans-serif" : 'inherit' }}>
        {m.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 19, fontWeight: 700, color: '#fff' }}>{m.name}</span>
          <span style={{ fontSize: 10, color: m.color, background: `${m.color}1a`, padding: '3px 10px', borderRadius: 100, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{m.subtitle}</span>
          {badge && <span style={{ fontSize: 10, color: '#fff', background: m.color, padding: '3px 10px', borderRadius: 100, fontWeight: 800, whiteSpace: 'nowrap' }}>{badge}</span>}
        </div>
        <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.55 }}>{disabled ? 'Completa almeno un quiz per sbloccare questa modalità.' : m.desc}</p>
      </div>
      <div style={{ color: m.color, fontSize: 22, flexShrink: 0, opacity: hov ? 1 : 0.3, transition: 'opacity 0.2s' }}>›</div>
    </button>
  );
}

// ─────────────────────────────────────────────
// QUIZ SCREEN
// ─────────────────────────────────────────────
function QuizScreen({ mode, qStats, onDone }) {
  const isInfinite = mode.id === 'infinito';
  const hasTimer   = (isInfinite && mode.qTimer !== null) || (!isInfinite && mode.totalTimer !== null);

  const buildPool = () => {
    if (mode.id === 'errori') {
      const wrongIds = new Set(
        Object.entries(qStats)
          .filter(([, s]) => s.seen > 0 && s.correct < s.seen)
          .map(([id]) => id)
      );
      const wrong = ALL_Q.filter(q => wrongIds.has(String(q.id)));
      return shuffle(wrong.length > 0 ? wrong : ALL_Q);
    }
    return shuffle(ALL_Q);
  };

  const [pool, setPool]               = useState(() => buildPool());
  const [pidx, setPidx]               = useState(0);
  const [correct, setCorrect]         = useState(0);
  const [errors, setErrors]           = useState(0);
  const [answered, setAnswered]       = useState(0);
  const [wrongList, setWrongList]     = useState([]);
  const [questionResults, setQR]      = useState([]);
  const [selected, setSelected]       = useState(null);
  const [showExp, setShowExp]         = useState(false);
  const [isTO, setIsTO]               = useState(false);
  const [timeLeft, setTimeLeft]       = useState(isInfinite ? (mode.qTimer ?? null) : (mode.totalTimer ?? null));

  const latestRef = useRef({});
  latestRef.current = { correct, errors, answered, wrongList, pool, pidx, questionResults };

  const currentQRef = useRef(pool[pidx % pool.length]);
  currentQRef.current = pool[pidx % pool.length];
  const currentQ = currentQRef.current;

  const showExpRef = useRef(false);
  showExpRef.current = showExp;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const isFailed   = mode.maxErr !== null && errors > mode.maxErr;
  const isComplete = mode.totalQ !== null && answered >= mode.totalQ;

  // ── TIMER ──
  useEffect(() => {
    if (timeLeft <= 0) return;
    if (isInfinite && showExp) return;
    if (isFailed || isComplete) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, showExp, isFailed, isComplete]);

  useEffect(() => {
    if (timeLeft === null || timeLeft > 0) return;
    if (showExpRef.current) return;
    if (isInfinite) {
      const q = currentQRef.current;
      setErrors(e => e + 1);
      setAnswered(a => a + 1);
      setWrongList(w => [...w, { q, selected: -1, timeout: true }]);
      setQR(r => [...r, { id: q.id, correct: false }]);
      setSelected(-1);
      setShowExp(true);
      setIsTO(true);
    } else {
      const r = latestRef.current;
      onDoneRef.current({ mode, correct: r.correct, errors: r.errors, totalAnswered: r.answered, wrongList: r.wrongList, questionResults: r.questionResults, passed: false, reason: 'timeout' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── NEXT ──
  const handleNext = () => {
    const r = latestRef.current;
    const nowFailed   = mode.maxErr !== null && r.errors > mode.maxErr;
    const nowComplete = mode.totalQ !== null && r.answered >= mode.totalQ;

    if (nowFailed || nowComplete) {
      clearTimeout(autoNextTimer.current); // cancel any pending auto-advance
      onDone({ mode, correct: r.correct, errors: r.errors, totalAnswered: r.answered, wrongList: r.wrongList, questionResults: r.questionResults, passed: nowComplete && !nowFailed, reason: nowFailed ? 'errors' : 'complete' });
      return;
    }

    setSelected(null);
    setShowExp(false);
    setIsTO(false);

    const nextIdx = r.pidx + 1;
    if (isInfinite && nextIdx >= r.pool.length) {
      setPool(shuffle(ALL_Q));
      setPidx(0);
    } else {
      setPidx(nextIdx);
    }
    if (isInfinite && mode.qTimer !== null) setTimeLeft(mode.qTimer);
  };

  // Keep ref so setTimeout can always call the latest version
  const handleNextRef = useRef(null);
  handleNextRef.current = handleNext;

  // Cleanup auto-advance timer on unmount
  const autoNextTimer = useRef(null);
  useEffect(() => () => clearTimeout(autoNextTimer.current), []);

  // Cancel auto-advance if the quiz ends while a timer is pending
  useEffect(() => {
    if (isFailed || isComplete) clearTimeout(autoNextTimer.current);
  }, [isFailed, isComplete]);

  // ── ANSWER ──
  const handleAnswer = (idx) => {
    if (showExp) return;
    const q = currentQ;
    const ok = idx === q.correct;
    const newErr  = errors  + (ok ? 0 : 1);
    const newCorr = correct + (ok ? 1 : 0);
    const newAns  = answered + 1;
    setCorrect(newCorr);
    setErrors(newErr);
    setAnswered(newAns);
    setSelected(idx);
    setShowExp(true);
    setIsTO(false);
    setQR(r => [...r, { id: q.id, correct: ok }]);
    if (!ok) setWrongList(w => [...w, { q, selected: idx }]);

    // Infinite mode + correct → auto-advance after a brief green flash
    if (isInfinite && ok) {
      clearTimeout(autoNextTimer.current);
      autoNextTimer.current = setTimeout(() => handleNextRef.current(), 600);
    }
  };

  // ── DERIVED UI ──
  const timerPct   = !hasTimer ? 100 : isInfinite ? (timeLeft / mode.qTimer) * 100 : (timeLeft / mode.totalTimer) * 100;
  const timerColor = !hasTimer ? C.dim : isInfinite
    ? (timeLeft < 10 ? C.red : timeLeft < 20 ? C.yellow : C.green)
    : (timeLeft < 300 ? C.red : timeLeft < 600 ? C.yellow : C.green);
  const progress = mode.totalQ ? (answered / mode.totalQ) * 100 : null;
  const isWrong  = selected !== null && selected !== -1 && selected !== currentQ.correct;
  const isRight  = selected !== null && selected !== -1 && selected === currentQ.correct;
  const r = latestRef.current;
  const nowFailed   = mode.maxErr !== null && r.errors > mode.maxErr;
  const nowComplete = mode.totalQ !== null && r.answered >= mode.totalQ;
  const endBtnLabel = nowFailed ? '❌ Test non superato — Vedi risultati' : nowComplete ? '🎯 Quiz completato — Vedi risultati' : 'Prossima domanda →';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 80px', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExitButton onExit={() => {
            if (window.confirm('Uscire? I progressi andranno persi.')) {
              const r = latestRef.current;
              onDone({ mode, correct, errors, totalAnswered: answered, wrongList, questionResults: r.questionResults, passed: false, reason: 'exit' });
            }
          }} />
          <Chip icon="✓" val={correct} c={C.green} />
          <Chip icon="✗" val={errors}  c={C.red} />
          {mode.totalQ && <Chip icon="#" val={`${answered}/${mode.totalQ}`} c={C.dim} />}
        </div>
        {hasTimer && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, color: timerColor, lineHeight: 1 }}>
              {isInfinite ? `${timeLeft}s` : fmt(timeLeft)}
            </div>
            <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isInfinite ? 'per domanda' : 'rimanenti'}
            </div>
          </div>
        )}
      </div>

      {/* Timer bar */}
      <div style={{ height: 3, background: '#13213d', borderRadius: 2, marginBottom: 18 }}>
        <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, borderRadius: 2, transition: 'width 1s linear, background 0.5s' }} />
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.dim, fontWeight: 700, marginBottom: 5 }}>
            <span>Progresso</span><span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 6, background: '#13213d', borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: mode.color, borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* Category badge */}
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: mode.color, background: `${mode.color}18`, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {currentQ.category}
        </span>
      </div>

      {/* Question card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '26px', marginBottom: 18 }} className="fadeup">
        {currentQ.img && (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <img src={import.meta.env.BASE_URL + currentQ.img.replace(/^\//, '')} alt="Segnale stradale" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8 }} />
          </div>
        )}
        <p style={{ fontSize: 'clamp(15px,2.5vw,19px)', lineHeight: 1.65, fontWeight: 600, color: '#fff' }}>
          {currentQ.text}
        </p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {currentQ.options.map((opt, i) => {
          const isC = i === currentQ.correct;
          const isS = i === selected;
          let bg = C.surface, border = C.border, textC = C.text, badge = String.fromCharCode(65 + i), badgeBg = '#13213d', badgeC = C.dim, op = 1;
          if (showExp) {
            if (isC)              { bg = '#0b2018'; border = C.green; textC = '#fff'; badge = '✓'; badgeBg = C.green; badgeC = '#fff'; }
            else if (isS && !isC) { bg = '#200b14'; border = C.red;   textC = '#fff'; badge = '✗'; badgeBg = C.red;   badgeC = '#fff'; }
            else                  { op = 0.38; }
          }
          return (
            <button key={i} onClick={() => handleAnswer(i)} disabled={showExp}
              style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, color: textC, textAlign: 'left', fontSize: 15, lineHeight: 1.5, fontWeight: 600, transition: 'all 0.2s', width: '100%', opacity: op }}
              onMouseEnter={e => { if (!showExp) e.currentTarget.style.borderColor = mode.color; }}
              onMouseLeave={e => { if (!showExp) e.currentTarget.style.borderColor = C.border; }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 8, background: badgeBg, color: badgeC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, fontFamily: "'Oswald', sans-serif", transition: 'all 0.2s' }}>
                {badge}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {showExp && (
        <div className="popin" style={{ background: isTO || isWrong ? '#1e0a12' : '#0a1e12', border: `1px solid ${isTO || isWrong ? C.red : C.green}40`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 17 }}>{isTO ? '⏱️' : isRight ? '✅' : '❌'}</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: isTO ? C.yellow : isRight ? C.green : C.red }}>
              {isTO ? 'Tempo scaduto!' : isRight ? 'Risposta corretta!' : 'Risposta errata'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#8090b0', lineHeight: 1.6 }}>
            💡 La risposta corretta è: <strong style={{ color: C.green }}>{currentQ.options[currentQ.correct]}</strong>
          </p>
        </div>
      )}

      {/* Next button */}
      {showExp && (
        <button onClick={handleNext} className="popin"
          style={{ width: '100%', background: nowFailed || nowComplete ? mode.color : '#13213d', color: '#fff', border: 'none', borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700, transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {endBtnLabel}
        </button>
      )}
    </div>
  );
}

function ExitButton({ onExit }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onExit} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: hov ? '#2a0a0f' : '#1a0a0f', border: `1px solid ${hov ? C.red : '#3a1020'}`, borderRadius: 8, padding: '6px 12px', color: C.red, fontSize: 13, fontWeight: 700, transition: 'all 0.18s' }}>
      ✕ Esci
    </button>
  );
}

function Chip({ icon, val, c }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${c}15`, border: `1px solid ${c}30`, borderRadius: 8, padding: '6px 12px' }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: c, fontFamily: "'Oswald', sans-serif" }}>{icon}</span>
      <span style={{ fontSize: 17, fontWeight: 800, color: c, fontFamily: "'Oswald', sans-serif" }}>{val}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// RESULTS SCREEN
// ─────────────────────────────────────────────
function ResultsScreen({ results, mode, qStats, onRestart, onHome }) {
  const { correct, errors, totalAnswered, wrongList, passed, reason } = results;
  const pct = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;
  const isInfinite = mode.id === 'infinito';

  const bannerBg     = isInfinite ? `${mode.color}12` : passed ? '#091a0f' : '#18070e';
  const bannerBorder = isInfinite ? `${mode.color}50` : passed ? `${C.green}50` : `${C.red}50`;
  const titleColor   = isInfinite ? mode.color : passed ? C.green : C.red;

  // Session-level category breakdown from wrong answers
  const sessionCatErrors = {};
  for (const item of wrongList) {
    if (!item.timeout) {
      sessionCatErrors[item.q.category] = (sessionCatErrors[item.q.category] || 0) + 1;
    }
  }
  const topErrors = Object.entries(sessionCatErrors).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px 80px' }} className="fadeup mobile-padding">
      {/* Banner */}
      <div style={{ background: bannerBg, border: `1px solid ${bannerBorder}`, borderRadius: 20, padding: '32px 24px', textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 56, marginBottom: 14, lineHeight: 1 }}>{isInfinite ? '🏆' : passed ? '🎉' : '😞'}</div>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 34, fontWeight: 700, color: titleColor, marginBottom: 8 }}>
          {isInfinite ? 'SESSIONE COMPLETATA' : reason === 'exit' ? 'QUIZ INTERROTTO' : passed ? 'TEST SUPERATO!' : 'TEST NON SUPERATO'}
        </h2>
        {reason === 'timeout' && <p style={{ color: C.yellow, fontSize: 14, marginBottom: 10 }}>⏱ Tempo scaduto</p>}
        {reason === 'exit'    && <p style={{ color: C.dim,    fontSize: 14, marginBottom: 10 }}>Hai interrotto il quiz manualmente</p>}
        {reason === 'errors' && !isInfinite && <p style={{ color: C.red, fontSize: 14, marginBottom: 10 }}>Hai superato il limite di {mode.maxErr} errori</p>}

        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 22, background: '#00000025', borderRadius: 14, overflow: 'hidden' }}>
          {[['✓', correct, C.green, 'Corrette'], ['✗', errors, C.red, 'Errori'], ['📝', totalAnswered, '#7090c0', 'Domande'], ['%', `${pct}%`, mode.color, 'Punteggio']].map(([ic, v, c, l], i) => (
            <div key={l} style={{ padding: '16px 8px', textAlign: 'center', borderRight: i < 3 ? '1px solid #ffffff0d' : 'none' }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Session analysis: where you went wrong */}
      {topErrors.length > 0 && (
        <div style={{ background: '#15080e', border: `1px solid ${C.red}30`, borderRadius: 16, padding: '20px 22px', marginBottom: 22 }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚠️ Aree critiche in questa sessione
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topErrors.map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{cat}</span>
                <span style={{ fontSize: 12, color: C.red, background: `${C.red}15`, padding: '3px 10px', borderRadius: 100, fontWeight: 800 }}>
                  {count} {count === 1 ? 'errore' : 'errori'}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.dim, marginTop: 14, lineHeight: 1.6 }}>
            💡 Rivedi queste categorie nella schermata <strong style={{ color: '#7090c0' }}>Storico & Preparazione</strong> per vedere il tuo storico completo e cosa ripassare.
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 30 }}>
        <button onClick={onHome} style={{ flex: 1, background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700 }}>
          ← Home
        </button>
        <button onClick={onRestart} style={{ flex: 2, background: mode.color, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700 }}>
          🔄 Riprova
        </button>
      </div>

      {/* Wrong answers review */}
      {wrongList.length > 0 && (
        <div>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.red }}>✗</span> Domande errate
            <span style={{ color: C.dim, fontSize: 16, fontWeight: 500 }}>({wrongList.length})</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {wrongList.map((item, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, color: mode.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{item.q.category}</div>
                {item.q.img && (
                  <div style={{ textAlign: 'center', marginBottom: 10 }}>
                    <img src={import.meta.env.BASE_URL + item.q.img.replace(/^\//, '')} alt="Segnale" style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 6 }} />
                  </div>
                )}
                <p style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 12, color: '#fff', lineHeight: 1.55 }}>{item.q.text}</p>
                {item.timeout
                  ? <div style={{ background: '#2a1600', border: `1px solid ${C.yellow}40`, borderRadius: 8, padding: '9px 14px', marginBottom: 8, fontSize: 13, color: C.yellow }}>⏱ Tempo scaduto</div>
                  : <div style={{ background: '#200b14', border: `1px solid ${C.red}40`, borderRadius: 8, padding: '9px 14px', marginBottom: 8, fontSize: 13, color: C.red }}>✗ Data: <strong>{item.q.options[item.selected]}</strong></div>
                }
                <div style={{ background: '#0a1e12', border: `1px solid ${C.green}40`, borderRadius: 8, padding: '9px 14px', fontSize: 13, color: C.green }}>
                  ✓ Corretta: <strong>{item.q.options[item.q.correct]}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {wrongList.length === 0 && totalAnswered > 0 && (
        <div style={{ background: '#0a1e12', border: `1px solid ${C.green}40`, borderRadius: 14, padding: '30px', textAlign: 'center', color: C.green }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⭐</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700 }}>Perfetto! Nessun errore!</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// STATS / HISTORY SCREEN
// ─────────────────────────────────────────────
function StatsScreen({ history, qStats, onHome, onClear }) {
  const readiness  = calcReadiness(history, qStats);
  const weakCats   = getWeakCategories(qStats);
  const allCatSt   = getAllCategoryStats(qStats);
  const recentSess = [...history].reverse().slice(0, 15);

  const rColor = readiness >= 85 ? C.green : readiness >= 55 ? C.yellow : C.red;
  const rMsg   = readiness >= 85 ? 'Sei pronto per l\'esame! 🎉'
               : readiness >= 70 ? 'Quasi pronto, continua così!'
               : readiness >= 55 ? 'Buoni progressi, ma devi ancora esercitarti'
               : readiness >= 30 ? 'Continua ad allenarti, stai migliorando'
               :                   'Inizia a fare quiz per tracciare i tuoi progressi';

  const totalSeen = Object.values(qStats).filter(s => s.seen > 0).length;
  const totalAns  = history.reduce((s, h) => s + h.totalAnswered, 0);
  const totalCorr = history.reduce((s, h) => s + h.correct, 0);
  const examsDone = history.filter(h => h.mode !== 'infinito');
  const examsPassed = examsDone.filter(h => h.passed);

  // Algorithm explanation breakdown
  const exams  = history.filter(s => s.mode !== 'infinito');
  const recent = (exams.length > 0 ? exams : history).slice(-5);
  const accScore  = recent.length > 0
    ? Math.round(recent.reduce((s, h) => s + h.correct / Math.max(h.totalAnswered, 1), 0) / recent.length * 100)
    : 0;
  const passScore = exams.length > 0
    ? Math.round(exams.slice(-5).filter(s => s.passed).length / Math.min(exams.length, 5) * 100)
    : 0;
  const catsWithData = allCatSt.filter(x => x.seen >= 3);
  const goodCats = catsWithData.filter(x => x.acc >= 0.70).length;
  const catScore = catsWithData.length > 0 ? Math.round(goodCats / ALL_CATS.length * 100) : 0;
  const coverageScore = Math.round(Math.min(totalSeen / 150, 1) * 100);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }} className="fadeup mobile-padding">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onHome} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 16px', color: C.text, fontSize: 14, fontWeight: 700 }}>← Home</button>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, color: '#fff' }}>Storico & Preparazione</h1>
        </div>
        {history.length > 0 && (
          <button onClick={onClear} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.dim, fontSize: 12, fontWeight: 600 }}>
            Reset
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: '#fff', marginBottom: 8 }}>Nessuna sessione ancora</div>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>Fai il primo quiz per iniziare a tracciare i tuoi progressi e scoprire quanto sei pronto per l'esame.</p>
        </div>
      ) : (<>

        {/* ── READINESS CARD ── */}
        <div style={{ background: `${rColor}0d`, border: `1px solid ${rColor}40`, borderRadius: 20, padding: '28px 24px', marginBottom: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Prontezza per l'esame</div>

          {/* Big circle */}
          <div style={{ display: 'inline-flex', width: 120, height: 120, borderRadius: '50%', border: `4px solid ${rColor}`, alignItems: 'center', justifyContent: 'center', marginBottom: 14, background: `${rColor}10` }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 38, fontWeight: 700, color: rColor }}>{readiness}%</span>
          </div>

          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>{rMsg}</p>

          {/* Score breakdown */}
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, textAlign: 'left' }}>
            {[
              { label: 'Accuratezza recente', val: accScore, weight: '40%', desc: 'Media ultime 5 sessioni' },
              { label: 'Tasso di superamento', val: passScore, weight: '30%', desc: 'Esami passati su 5 recenti' },
              { label: 'Copertura categorie', val: catScore, weight: '20%', desc: `${goodCats}/${ALL_CATS.length} categorie ≥ 70%` },
              { label: 'Domande viste', val: coverageScore, weight: '10%', desc: `${totalSeen} / 150 obiettivo` },
            ].map(({ label, val, weight, desc }) => {
              const c = val >= 70 ? C.green : val >= 40 ? C.yellow : C.red;
              return (
                <div key={label} style={{ background: '#ffffff08', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>{label}</span>
                    <span style={{ fontSize: 11, color: C.dim, background: '#ffffff10', padding: '2px 7px', borderRadius: 100 }}>×{weight}</span>
                  </div>
                  <div style={{ height: 5, background: '#ffffff12', borderRadius: 3, marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${val}%`, background: c, borderRadius: 3, transition: 'width 0.8s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: C.dim }}>{desc}</span>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 700, color: c }}>{val}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── WHAT TO REPEAT ── */}
        {weakCats.length > 0 && (
          <div style={{ background: '#140b0b', border: `1px solid ${C.red}30`, borderRadius: 16, padding: '20px 22px', marginBottom: 22 }}>
            <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: C.red, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📚 Cosa devi ripassare
            </h2>
            <p style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
              Queste categorie hanno un'accuratezza sotto l'80%. Concentrati su di esse per migliorare rapidamente la tua prontezza.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weakCats.map(({ cat, acc, seen }) => {
                const pct = Math.round(acc * 100);
                const col = pct >= 60 ? C.yellow : C.red;
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{cat}</span>
                      <span style={{ fontSize: 12, color: col, fontWeight: 800 }}>{pct}% · {seen} risp.</span>
                    </div>
                    <div style={{ height: 5, background: '#ffffff10', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3, transition: 'width 0.6s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ALL CATEGORY BREAKDOWN ── */}
        {allCatSt.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 22 }}>
            <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              📂 Andamento per categoria
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allCatSt.map(({ cat, acc, seen }) => {
                const pct = Math.round(acc * 100);
                const col = pct >= 80 ? C.green : pct >= 60 ? C.yellow : C.red;
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{cat}</span>
                      <span style={{ fontSize: 11, color: col }}>{pct}% ({seen} risp.)</span>
                    </div>
                    <div style={{ height: 4, background: '#ffffff10', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── OVERALL STATS ── */}
        <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 22 }}>
          {[
            { label: 'Sessioni totali', val: history.length, icon: '🎯' },
            { label: 'Esami superati', val: `${examsPassed.length} / ${examsDone.length}`, icon: '✅' },
            { label: 'Risposte totali', val: totalAns.toLocaleString('it'), icon: '📝' },
            { label: 'Accuratezza totale', val: totalAns > 0 ? `${Math.round(totalCorr / totalAns * 100)}%` : '—', icon: '📊' },
          ].map(({ label, val, icon }) => (
            <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, color: '#fff' }}>{val}</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── SESSION HISTORY ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px' }}>
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
            🕐 Sessioni recenti
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSess.map((s, i) => {
              const m = MODES[s.mode];
              const acc = s.totalAnswered > 0 ? Math.round(s.correct / s.totalAnswered * 100) : 0;
              const statusColor = s.mode === 'infinito' ? m.color : s.passed ? C.green : C.red;
              const statusLabel = s.mode === 'infinito' ? 'Infinito' : s.passed ? 'Superato' : 'Non sup.';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#ffffff06', borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{m?.name || s.mode}</div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{fmtDate(s.date)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: statusColor }}>{statusLabel}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>{s.correct}/{s.totalAnswered} · {acc}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </>)}
    </div>
  );
}
