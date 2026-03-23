import { useState, useEffect, useRef } from "react";
import questionsRaw from './QuizPatenteB-main/quizPatenteB2023.json';

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
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const MODES = {
  infinito: {
    id: 'infinito', name: 'Quiz Infinito', icon: '∞', subtitle: '30s per domanda',
    desc: 'Domande casuali infinite dal database ufficiale 2023. Timer di 30 secondi per risposta. Ideale per l\'allenamento quotidiano.',
    totalQ: null, qTimer: 30, totalTimer: null, maxErr: null, color: '#06b6d4',
  },
  normale: {
    id: 'normale', name: 'Quiz Normale', icon: '✏', subtitle: '30 dom · 20 min',
    desc: 'Simulazione realistica. 30 domande casuali dal database ufficiale 2023, 20 minuti totali. Superato con al massimo 4 errori.',
    totalQ: 30, qTimer: null, totalTimer: 1200, maxErr: 4, color: '#a855f7',
  },
  ministeriale: {
    id: 'ministeriale', name: 'Simulazione Ministeriale', icon: '🏛', subtitle: 'Esame ufficiale',
    desc: 'Riproduce fedelmente l\'esame ministeriale di Stato. 30 domande dal database ufficiale 2023, 20 minuti, max 4 errori.',
    totalQ: 30, qTimer: null, totalTimer: 1200, maxErr: 4, color: '#f59e0b',
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

  const start   = (modeId) => { setMode(MODES[modeId]); setScreen('quiz'); setQuizKey(k => k + 1); };
  const finish  = (data)   => { setResults(data); setScreen('results'); };
  const restart = ()       => { setScreen('quiz'); setQuizKey(k => k + 1); };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Nunito:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; font-family: inherit; outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a2944; border-radius: 4px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .fadeup { animation: fadeUp 0.3s ease both; }
        .popin  { animation: popIn 0.2s ease both; }
      `}</style>

      {screen === 'home'    && <HomeScreen onStart={start} />}
      {screen === 'quiz'    && mode && <QuizScreen key={quizKey} mode={mode} onDone={finish} />}
      {screen === 'results' && results && <ResultsScreen results={results} mode={mode} onRestart={restart} onHome={() => setScreen('home')} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME SCREEN
// ─────────────────────────────────────────────
function HomeScreen({ onStart }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }} className="fadeup">
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'inline-flex', gap: 8, background: '#13213d', border: '1px solid #1e3357', borderRadius: 100, padding: '7px 20px', marginBottom: 28, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>🇮🇹</span>
          <span style={{ fontSize: 12, color: C.dim, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Patente di Guida · Categoria B</span>
        </div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(44px,9vw,76px)', fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1, marginBottom: 18, background: 'linear-gradient(135deg, #ffffff 0%, #7090c0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          QUIZ PATENTE
        </h1>
        <p style={{ color: C.dim, fontSize: 17, lineHeight: 1.65, maxWidth: 440, margin: '0 auto' }}>
          Preparati all'esame di guida con {ALL_Q.length.toLocaleString('it')} domande ufficiali aggiornate al 2023
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.values(MODES).map((m, i) => (
          <ModeCard key={m.id} m={m} delay={i * 60} onSelect={() => onStart(m.id)} />
        ))}
      </div>

      <div style={{ display: 'flex', marginTop: 44, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {[[ALL_Q.length.toLocaleString('it'), 'Domande'], ['3', 'Modalità'], ['Gratis', 'Sempre']].map(([v, l], i) => (
          <div key={l} style={{ flex: 1, padding: '20px 10px', textAlign: 'center', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, color: '#fff' }}>{v}</div>
            <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeCard({ m, onSelect, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="fadeup"
      style={{ animationDelay: `${delay}ms`, background: hov ? `${m.color}08` : C.surface, border: `1px solid ${hov ? m.color : C.border}`, borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 20, textAlign: 'left', transition: 'all 0.2s', width: '100%', color: C.text }}
    >
      <div style={{ width: 58, height: 58, borderRadius: 16, background: `${m.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: m.id === 'infinito' ? 30 : 22, fontWeight: 700, color: m.color, flexShrink: 0, fontFamily: m.id === 'infinito' ? "'Oswald', sans-serif" : 'inherit' }}>
        {m.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 19, fontWeight: 700, color: '#fff' }}>{m.name}</span>
          <span style={{ fontSize: 10, color: m.color, background: `${m.color}1a`, padding: '3px 10px', borderRadius: 100, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{m.subtitle}</span>
        </div>
        <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.55 }}>{m.desc}</p>
      </div>
      <div style={{ color: m.color, fontSize: 22, flexShrink: 0, opacity: hov ? 1 : 0.3, transition: 'opacity 0.2s' }}>›</div>
    </button>
  );
}

// ─────────────────────────────────────────────
// QUIZ SCREEN
// ─────────────────────────────────────────────
function QuizScreen({ mode, onDone }) {
  const isInfinite = mode.id === 'infinito';

  const [pool, setPool]         = useState(() => shuffle(ALL_Q));
  const [pidx, setPidx]         = useState(0);
  const [correct, setCorrect]   = useState(0);
  const [errors, setErrors]     = useState(0);
  const [answered, setAnswered] = useState(0);
  const [wrongList, setWrongList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showExp, setShowExp]   = useState(false);
  const [isTO, setIsTO]         = useState(false);
  const [timeLeft, setTimeLeft] = useState(isInfinite ? mode.qTimer : mode.totalTimer);

  const latestRef = useRef({});
  latestRef.current = { correct, errors, answered, wrongList, pool, pidx };

  const currentQRef = useRef(pool[pidx % pool.length]);
  currentQRef.current = pool[pidx % pool.length];
  const currentQ = currentQRef.current;

  const showExpRef = useRef(false);
  showExpRef.current = showExp;

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const isFailed   = mode.maxErr !== null && errors > mode.maxErr;
  const isComplete = mode.totalQ !== null && answered >= mode.totalQ;

  // ── TIMER ──────────────────────────────────
  useEffect(() => {
    if (timeLeft <= 0) return;
    if (isInfinite && showExp) return;
    if (isFailed || isComplete) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, showExp, isFailed, isComplete]);

  useEffect(() => {
    if (timeLeft > 0) return;
    if (showExpRef.current) return;

    if (isInfinite) {
      const q = currentQRef.current;
      setErrors(e => e + 1);
      setAnswered(a => a + 1);
      setWrongList(w => [...w, { q, selected: -1, timeout: true }]);
      setSelected(-1);
      setShowExp(true);
      setIsTO(true);
    } else {
      const r = latestRef.current;
      onDoneRef.current({ mode, correct: r.correct, errors: r.errors, totalAnswered: r.answered, wrongList: r.wrongList, passed: false, reason: 'timeout' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── ANSWER ─────────────────────────────────
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
    if (!ok) setWrongList(w => [...w, { q, selected: idx }]);
  };

  // ── NEXT ───────────────────────────────────
  const handleNext = () => {
    const r = latestRef.current;
    const nowFailed   = mode.maxErr !== null && r.errors > mode.maxErr;
    const nowComplete = mode.totalQ !== null && r.answered >= mode.totalQ;

    if (nowFailed || nowComplete) {
      onDone({ mode, correct: r.correct, errors: r.errors, totalAnswered: r.answered, wrongList: r.wrongList, passed: nowComplete && !nowFailed, reason: nowFailed ? 'errors' : 'complete' });
      return;
    }

    setSelected(null);
    setShowExp(false);
    setIsTO(false);

    const nextIdx = pidx + 1;
    if (isInfinite && nextIdx >= r.pool.length) {
      setPool(shuffle(ALL_Q));
      setPidx(0);
    } else {
      setPidx(nextIdx);
    }

    if (isInfinite) setTimeLeft(mode.qTimer);
  };

  // ── DERIVED UI ────────────────────────────
  const timerPct   = isInfinite ? (timeLeft / mode.qTimer) * 100 : (timeLeft / mode.totalTimer) * 100;
  const timerColor = isInfinite
    ? (timeLeft < 10 ? C.red : timeLeft < 20 ? C.yellow : C.green)
    : (timeLeft < 300 ? C.red : timeLeft < 600 ? C.yellow : C.green);
  const progress = mode.totalQ ? (answered / mode.totalQ) * 100 : null;
  const isWrong  = selected !== null && selected !== -1 && selected !== currentQ.correct;
  const isRight  = selected !== null && selected !== -1 && selected === currentQ.correct;

  const r = latestRef.current;
  const nowFailed   = mode.maxErr !== null && r.errors > mode.maxErr;
  const nowComplete = mode.totalQ !== null && r.answered >= mode.totalQ;
  const endBtnLabel = nowFailed
    ? '❌ Test non superato — Vedi risultati'
    : nowComplete
    ? '🎯 Quiz completato — Vedi risultati'
    : 'Prossima domanda →';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 80px', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExitButton onExit={() => {
            if (window.confirm('Sei sicuro di voler uscire? I progressi andranno persi.')) {
              onDone({ mode, correct, errors, totalAnswered: answered, wrongList, passed: false, reason: 'exit' });
            }
          }} />
          <Chip icon="✓" val={correct} c={C.green} />
          <Chip icon="✗" val={errors}  c={C.red} />
          {mode.totalQ && <Chip icon="#" val={`${answered}/${mode.totalQ}`} c={C.dim} />}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, color: timerColor, lineHeight: 1 }}>
            {isInfinite ? `${timeLeft}s` : fmt(timeLeft)}
          </div>
          <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isInfinite ? 'per domanda' : 'rimanenti'}
          </div>
        </div>
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
            <img
              src={currentQ.img}
              alt="Segnale stradale"
              style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8 }}
            />
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
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={showExp}
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

      {/* Explanation */}
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
        <button
          onClick={handleNext}
          className="popin"
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
    <button
      onClick={onExit}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Esci dal quiz"
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: hov ? '#2a0a0f' : '#1a0a0f', border: `1px solid ${hov ? C.red : '#3a1020'}`, borderRadius: 8, padding: '6px 12px', color: C.red, fontSize: 13, fontWeight: 700, transition: 'all 0.18s' }}
    >
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
function ResultsScreen({ results, mode, onRestart, onHome }) {
  const { correct, errors, totalAnswered, wrongList, passed, reason } = results;
  const pct = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;
  const isInfinite = mode.id === 'infinito';

  const bannerBg     = isInfinite ? `${mode.color}12` : passed ? '#091a0f' : '#18070e';
  const bannerBorder = isInfinite ? `${mode.color}50` : passed ? `${C.green}50` : `${C.red}50`;
  const titleColor   = isInfinite ? mode.color : passed ? C.green : C.red;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px 80px' }} className="fadeup">
      {/* Banner */}
      <div style={{ background: bannerBg, border: `1px solid ${bannerBorder}`, borderRadius: 20, padding: '32px 24px', textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 56, marginBottom: 14, lineHeight: 1 }}>
          {isInfinite ? '🏆' : passed ? '🎉' : '😞'}
        </div>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 34, fontWeight: 700, color: titleColor, marginBottom: 8 }}>
          {isInfinite
            ? 'SESSIONE COMPLETATA'
            : reason === 'exit'
            ? 'QUIZ INTERROTTO'
            : passed
            ? 'TEST SUPERATO!'
            : 'TEST NON SUPERATO'}
        </h2>
        {reason === 'timeout' && <p style={{ color: C.yellow, fontSize: 14, marginBottom: 10 }}>⏱ Tempo scaduto</p>}
        {reason === 'exit'    && <p style={{ color: C.dim,    fontSize: 14, marginBottom: 10 }}>Hai interrotto il quiz manualmente</p>}
        {reason === 'errors' && !isInfinite && <p style={{ color: C.red, fontSize: 14, marginBottom: 10 }}>Hai superato il limite di {mode.maxErr} errori</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 22, background: '#00000025', borderRadius: 14, overflow: 'hidden' }}>
          {[['✓', correct, C.green, 'Corrette'], ['✗', errors, C.red, 'Errori'], ['📝', totalAnswered, '#7090c0', 'Domande'], ['%', `${pct}%`, mode.color, 'Punteggio']].map(([ic, v, c, l], i) => (
            <div key={l} style={{ padding: '16px 8px', textAlign: 'center', borderRight: i < 3 ? '1px solid #ffffff0d' : 'none' }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

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
                <div style={{ fontSize: 11, color: mode.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {item.q.category}
                </div>
                {item.q.img && (
                  <div style={{ textAlign: 'center', marginBottom: 10 }}>
                    <img src={item.q.img} alt="Segnale" style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 6 }} />
                  </div>
                )}
                <p style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 12, color: '#fff', lineHeight: 1.55 }}>{item.q.text}</p>
                {item.timeout
                  ? <div style={{ background: '#2a1600', border: `1px solid ${C.yellow}40`, borderRadius: 8, padding: '9px 14px', marginBottom: 8, fontSize: 13, color: C.yellow }}>
                      ⏱ Tempo scaduto — risposta non data
                    </div>
                  : <div style={{ background: '#200b14', border: `1px solid ${C.red}40`, borderRadius: 8, padding: '9px 14px', marginBottom: 8, fontSize: 13, color: C.red }}>
                      ✗ Data: <strong>{item.q.options[item.selected]}</strong>
                    </div>
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
