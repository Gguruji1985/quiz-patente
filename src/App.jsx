import { useState, useEffect, useRef } from "react";
import './index.css';
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
        out.push({ id: id++, text: item.q, options: ['Vero', 'Falso'], correct: item.a ? 0 : 1, category, img: item.img || null });
      }
    }
  }
  return out;
})();

const Q_BY_ID  = Object.fromEntries(ALL_Q.map(q => [String(q.id), q]));
const ALL_CATS = [...new Set(ALL_Q.map(q => q.category))];

// ─────────────────────────────────────────────
// HISTORY & STATS PERSISTENCE
// ─────────────────────────────────────────────
const HISTORY_KEY = 'quiz_patente_history';
const QSTATS_KEY  = 'quiz_patente_qstats';
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function loadQStats()  { try { return JSON.parse(localStorage.getItem(QSTATS_KEY))  || {}; } catch { return {}; } }
function saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {} }
function saveQStats(s)  { try { localStorage.setItem(QSTATS_KEY,  JSON.stringify(s)); } catch {} }

// ─────────────────────────────────────────────
// READINESS ALGORITHM
// ─────────────────────────────────────────────
function calcReadiness(history, qStats) {
  if (history.length === 0) return 0;
  const exams  = history.filter(s => s.mode !== 'infinito' && s.mode !== 'errori' && s.mode !== 'normale');
  const recent = (exams.length > 0 ? exams : history).slice(-5);
  const accScore  = recent.reduce((s, h) => s + h.correct / Math.max(h.totalAnswered, 1), 0) / recent.length;
  const passScore = exams.length > 0 ? exams.slice(-5).filter(s => s.passed).length / Math.min(exams.length, 5) : 0;
  const catAcc = {};
  for (const [qid, st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid];
    if (!q || st.seen < 3) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen: 0, correct: 0 };
    catAcc[q.category].seen += st.seen; catAcc[q.category].correct += st.correct;
  }
  const catsWithData = ALL_CATS.filter(c => catAcc[c]);
  const catScore = catsWithData.length === 0 ? 0
    : catsWithData.filter(c => catAcc[c].correct / catAcc[c].seen >= 0.70).length / ALL_CATS.length;
  const seen = Object.values(qStats).filter(s => s.seen > 0).length;
  return Math.round((accScore * 0.40 + passScore * 0.30 + catScore * 0.20 + Math.min(seen / 150, 1) * 0.10) * 100);
}

function getWeakCategories(qStats) {
  const catAcc = {};
  for (const [qid, st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid]; if (!q || st.seen < 3) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen: 0, correct: 0 };
    catAcc[q.category].seen += st.seen; catAcc[q.category].correct += st.correct;
  }
  return Object.entries(catAcc).map(([cat, s]) => ({ cat, acc: s.correct / s.seen, seen: s.seen }))
    .filter(x => x.acc < 0.80).sort((a, b) => a.acc - b.acc).slice(0, 6);
}

function getAllCategoryStats(qStats) {
  const catAcc = {};
  for (const [qid, st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid]; if (!q || st.seen === 0) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen: 0, correct: 0 };
    catAcc[q.category].seen += st.seen; catAcc[q.category].correct += st.correct;
  }
  return Object.entries(catAcc).map(([cat, s]) => ({ cat, acc: s.correct / s.seen, seen: s.seen }))
    .sort((a, b) => a.acc - b.acc);
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const fmt     = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
const fmtDate = ts => new Date(ts).toLocaleDateString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

// Dynamic color tokens (JS only — CSS variables handle static theming)
const C = { green:'#7aab72', red:'#c0614f', yellow:'#c8a03c', text:'#f0e8dd', dim:'#8a7060' };

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const MODES = {
  infinito:     { id:'infinito',     name:'Quiz Infinito',           icon:'∞',   subtitle:'domande infinite',       desc:'Domande casuali infinite dal database ufficiale 2023. Nessun limite di tempo.', totalQ:null, qTimer:null, totalTimer:null, maxErr:null, color:'#5c9faf' },
  normale:      { id:'normale',      name:'Quiz Normale',            icon:'✏',   subtitle:'30 dom · senza timer',   desc:'Allenamento libero. 30 domande casuali senza limite di tempo e senza penalità errori.', totalQ:30, qTimer:null, totalTimer:null, maxErr:null, color:'#9479be' },
  ministeriale: { id:'ministeriale', name:'Simulazione Ministeriale',icon:'🏛', subtitle:'20 min · max 3 errori', desc:"Riproduce l'esame ministeriale di Stato. 30 domande, 20 minuti, massimo 3 errori.", totalQ:30, qTimer:null, totalTimer:1200, maxErr:3, color:'#c8a03c' },
  errori:       { id:'errori',       name:'Ripassa Errori',          icon:'🔁', subtitle:'Solo domande sbagliate', desc:'Ripassa solo le domande che hai risposto male in precedenza. Ideale per colmare le lacune.', totalQ:null, qTimer:null, totalTimer:null, maxErr:null, color:'#c0614f' },
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
    const entry = { date:Date.now(), mode:data.mode.id, correct:data.correct, errors:data.errors, totalAnswered:data.totalAnswered, passed:data.passed, reason:data.reason };
    const newHistory = [...history, entry];
    setHistory(newHistory); saveHistory(newHistory);
    const newQStats = { ...qStats };
    for (const { id, correct } of (data.questionResults || [])) {
      const key = String(id);
      if (!newQStats[key]) newQStats[key] = { seen:0, correct:0 };
      newQStats[key].seen++; if (correct) newQStats[key].correct++;
    }
    setQStats(newQStats); saveQStats(newQStats);
    setResults(data); setScreen('results');
  };

  const clearStats = () => {
    if (!window.confirm('Cancellare tutto lo storico e le statistiche?')) return;
    setHistory([]); setQStats({}); saveHistory([]); saveQStats({});
  };

  return (
    <div className="app-root">
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
  const rColor    = readiness >= 85 ? C.green : readiness >= 55 ? C.yellow : C.red;
  const [ip, setIp] = useState(null);
  useEffect(() => { fetch('/api/ip').then(r=>r.json()).then(d=>setIp(d.ip)).catch(()=>{}); }, []);

  return (
    <div className="screen screen--home fadeup">
      {ip && ip !== 'localhost' && (
        <div className="net-hint"><div className="net-hint__inner">🌐 Connettiti da altri dispositivi: <strong>http://{ip}:5173</strong></div></div>
      )}

      <div className="home-hero">
        <div className="home-hero__pill">
          <div className="pill"><span>🇮🇹</span><span className="label-upper">Patente di Guida · Categoria B</span></div>
        </div>
        <h1 className="display-title">Quiz Patente</h1>
        <p className="home-hero__sub">Preparati con {ALL_Q.length.toLocaleString('it')} domande ufficiali aggiornate al 2023</p>
      </div>

      {history.length > 0 ? (
        <button className="readiness-btn" style={{'--r-color': rColor}} onClick={onStats}>
          <div className="readiness-circle"><span className="readiness-circle__pct">{readiness}%</span></div>
          <div>
            <div className="readiness-btn__title">{readiness >= 85 ? "🎉 Sei pronto per l'esame!" : readiness >= 55 ? '📚 Stai progredendo bene' : '💪 Continua ad allenarti'}</div>
            <div className="readiness-btn__sub">Clicca per vedere storico, statistiche e cosa ripassare →</div>
          </div>
        </button>
      ) : (
        <button className="readiness-btn--empty" onClick={onStats}>
          <span>📊</span><span>Storico &amp; Preparazione — inizia un quiz per tracciare i tuoi progressi</span>
        </button>
      )}

      <div className="modes-list">
        {Object.values(MODES).map((m, i) => {
          const wrongCount = m.id === 'errori' ? Object.values(qStats).filter(s => s.seen > 0 && s.correct < s.seen).length : null;
          return <ModeCard key={m.id} m={m} delay={i*60} onSelect={() => onStart(m.id)} disabled={m.id==='errori' && wrongCount===0} badge={m.id==='errori' && wrongCount>0 ? `${wrongCount} dom` : null} />;
        })}
      </div>

      <div className="stats-bar">
        {[[ALL_Q.length.toLocaleString('it'),'Domande'],['4','Modalità'],['Gratis','Sempre']].map(([v,l]) => (
          <div key={l} className="stats-bar__cell"><div className="stats-bar__val">{v}</div><div className="stats-bar__lbl">{l}</div></div>
        ))}
      </div>
    </div>
  );
}

function ModeCard({ m, onSelect, delay, disabled, badge }) {
  return (
    <button onClick={disabled ? undefined : onSelect} className={`mode-card fadeup${disabled ? ' mode-card--disabled' : ''}`} style={{'--mode-color': m.color, animationDelay:`${delay}ms`}}>
      <div className={`mode-icon${m.id==='infinito' ? ' mode-icon--text' : ''}`}>{m.icon}</div>
      <div className="mode-card__body">
        <div className="mode-card__row">
          <span className="mode-card__name">{m.name}</span>
          <span className="badge badge--mode">{m.subtitle}</span>
          {badge && <span className="badge badge--solid">{badge}</span>}
        </div>
        <p className="mode-card__desc">{disabled ? 'Completa almeno un quiz per sbloccare questa modalità.' : m.desc}</p>
      </div>
      <div className="mode-card__arrow">›</div>
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
      const wrongIds = new Set(Object.entries(qStats).filter(([,s]) => s.seen > 0 && s.correct < s.seen).map(([id]) => id));
      const wrong = ALL_Q.filter(q => wrongIds.has(String(q.id)));
      return shuffle(wrong.length > 0 ? wrong : ALL_Q);
    }
    return shuffle(ALL_Q);
  };

  const [pool, setPool]           = useState(() => buildPool());
  const [pidx, setPidx]           = useState(0);
  const [correct, setCorrect]     = useState(0);
  const [errors, setErrors]       = useState(0);
  const [answered, setAnswered]   = useState(0);
  const [wrongList, setWrongList] = useState([]);
  const [questionResults, setQR]  = useState([]);
  const [selected, setSelected]   = useState(null);
  const [showExp, setShowExp]     = useState(false);
  const [isTO, setIsTO]           = useState(false);
  const [timeLeft, setTimeLeft]   = useState(isInfinite ? (mode.qTimer ?? null) : (mode.totalTimer ?? null));

  const latestRef = useRef({});
  latestRef.current = { correct, errors, answered, wrongList, pool, pidx, questionResults };
  const currentQRef = useRef(pool[pidx % pool.length]);
  currentQRef.current = pool[pidx % pool.length];
  const currentQ = currentQRef.current;
  const showExpRef = useRef(false); showExpRef.current = showExp;
  const onDoneRef  = useRef(onDone); onDoneRef.current = onDone;

  const isFailed   = mode.maxErr !== null && errors > mode.maxErr;
  const isComplete = mode.totalQ !== null && answered >= mode.totalQ;

  useEffect(() => {
    if (timeLeft <= 0 || (isInfinite && showExp) || isFailed || isComplete) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, showExp, isFailed, isComplete]);

  useEffect(() => {
    if (timeLeft === null || timeLeft > 0 || showExpRef.current) return;
    if (isInfinite) {
      const q = currentQRef.current;
      setErrors(e=>e+1); setAnswered(a=>a+1);
      setWrongList(w=>[...w,{q,selected:-1,timeout:true}]);
      setQR(r=>[...r,{id:q.id,correct:false}]);
      setSelected(-1); setShowExp(true); setIsTO(true);
    } else {
      const r = latestRef.current;
      onDoneRef.current({ mode, correct:r.correct, errors:r.errors, totalAnswered:r.answered, wrongList:r.wrongList, questionResults:r.questionResults, passed:false, reason:'timeout' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const autoNextTimer = useRef(null);
  useEffect(() => () => clearTimeout(autoNextTimer.current), []);
  useEffect(() => { if (isFailed || isComplete) clearTimeout(autoNextTimer.current); }, [isFailed, isComplete]);

  const handleNextRef = useRef(null);
  const handleNext = () => {
    const r = latestRef.current;
    const nowFailed   = mode.maxErr !== null && r.errors > mode.maxErr;
    const nowComplete = mode.totalQ !== null && r.answered >= mode.totalQ;
    if (nowFailed || nowComplete) {
      clearTimeout(autoNextTimer.current);
      onDone({ mode, correct:r.correct, errors:r.errors, totalAnswered:r.answered, wrongList:r.wrongList, questionResults:r.questionResults, passed:nowComplete && !nowFailed, reason:nowFailed?'errors':'complete' });
      return;
    }
    setSelected(null); setShowExp(false); setIsTO(false);
    const nextIdx = r.pidx + 1;
    if (isInfinite && nextIdx >= r.pool.length) { setPool(shuffle(ALL_Q)); setPidx(0); } else { setPidx(nextIdx); }
    if (isInfinite && mode.qTimer !== null) setTimeLeft(mode.qTimer);
  };
  handleNextRef.current = handleNext;

  const handleAnswerRef = useRef(null);
  const handleAnswer = (idx) => {
    if (showExp) return;
    const q = currentQ; const ok = idx === q.correct;
    setCorrect(c=>c+(ok?1:0)); setErrors(e=>e+(ok?0:1)); setAnswered(a=>a+1);
    setSelected(idx); setShowExp(true); setIsTO(false);
    setQR(r=>[...r,{id:q.id,correct:ok}]);
    if (!ok) setWrongList(w=>[...w,{q,selected:idx}]);
    // Infinite: always auto-advance (right or wrong) after brief flash
    if (isInfinite) { clearTimeout(autoNextTimer.current); autoNextTimer.current = setTimeout(()=>handleNextRef.current(), 500); }
  };
  handleAnswerRef.current = handleAnswer;

  // Keyboard: → = Vero (idx 0), ← = Falso (idx 1)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') handleAnswerRef.current?.(1);
      if (e.key === 'ArrowLeft')  handleAnswerRef.current?.(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const timerPct   = !hasTimer ? 100 : isInfinite ? (timeLeft/mode.qTimer)*100 : (timeLeft/mode.totalTimer)*100;
  const timerColor = !hasTimer ? C.dim : isInfinite ? (timeLeft<10?C.red:timeLeft<20?C.yellow:C.green) : (timeLeft<300?C.red:timeLeft<600?C.yellow:C.green);
  const progress    = mode.totalQ ? (answered/mode.totalQ)*100 : null;
  const isWrong     = selected !== null && selected !== -1 && selected !== currentQ.correct;
  const isRight     = selected !== null && selected !== -1 && selected === currentQ.correct;
  const r           = latestRef.current;
  const nowFailed   = mode.maxErr !== null && r.errors > mode.maxErr;
  const nowComplete = mode.totalQ !== null && r.answered >= mode.totalQ;
  const endBtnLabel = nowFailed ? '❌ Test non superato — Vedi risultati' : nowComplete ? '🎯 Quiz completato — Vedi risultati' : 'Prossima domanda →';

  return (
    <div className="screen screen--quiz" style={{'--mode-color': mode.color}}>

      <div className="quiz-topbar">
        <div className="quiz-topbar__left">
          <ExitButton onExit={() => { if (window.confirm('Uscire? I progressi andranno persi.')) { const r=latestRef.current; onDone({mode,correct,errors,totalAnswered:answered,wrongList,questionResults:r.questionResults,passed:false,reason:'exit'}); }}} />
          {!isInfinite && <Chip icon="✓" val={correct} color={C.green} />}
          {!isInfinite && <Chip icon="✗" val={errors}  color={C.red} />}
          {!isInfinite && mode.totalQ && <Chip icon="#" val={`${answered}/${mode.totalQ}`} color={C.dim} />}
        </div>
        {hasTimer && (
          <div className="timer-label" style={{'--timer-color': timerColor}}>
            <div className="timer-label__val">{isInfinite ? `${timeLeft}s` : fmt(timeLeft)}</div>
            <div className="timer-label__sub">{isInfinite ? 'per domanda' : 'rimanenti'}</div>
          </div>
        )}
      </div>

      <div className="bar-track bar-track--timer">
        <div className="bar-fill bar-fill--timer" style={{width:`${timerPct}%`, backgroundColor:timerColor}} />
      </div>

      {progress !== null && (
        <div className="progress-wrap">
          <div className="progress-header"><span>Progresso</span><span>{Math.round(progress)}%</span></div>
          <div className="bar-track bar-track--prog">
            <div className="bar-fill" style={{width:`${progress}%`, backgroundColor:mode.color}} />
          </div>
        </div>
      )}

      <div className="question-card fadeup">
        {currentQ.img && <div className="question-card__img"><img src={import.meta.env.BASE_URL + currentQ.img.replace(/^\//,'')} alt="Segnale stradale" /></div>}
        <p className="question-card__text">{currentQ.text}</p>
      </div>

      {/* V / F Buttons — Falso (←) left, Vero (→) right */}
      <div className="vf-buttons">
        {[
          { label:'Vero',  letter:'V', idx:0, base:'vf-btn vf-btn--vero',  key:'←' },
          { label:'Falso', letter:'F', idx:1, base:'vf-btn vf-btn--falso', key:'→' },
        ].map(({ label, letter, idx, base, key }) => {
          const isCorrect  = idx === currentQ.correct;
          const isSelected = idx === selected;
          let extra = '';
          if (showExp) {
            if (isCorrect)           extra = ' vf-btn--confirmed';
            else if (isSelected)     extra = ' vf-btn--wrong-pick';
            else                     extra = ' vf-btn--faded';
          }
          return (
            <button key={idx} onClick={() => handleAnswer(idx)} disabled={showExp}
              className={base + extra}>
              <span className="vf-btn__letter">{letter}</span>
              <span className="vf-btn__label">{label}</span>
              <span className="vf-btn__key">{key}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback & Next — hidden in infinite (auto-advance handles it) */}
      {showExp && !isInfinite && (
        <div className={`feedback popin ${isTO||isWrong ? 'feedback--wrong' : 'feedback--correct'}`}>
          <div className="feedback__header">
            <span>{isTO?'⏱️':isRight?'✅':'❌'}</span>
            <span className="feedback__title" style={{color: isTO?C.yellow:isRight?C.green:C.red}}>
              {isTO?'Tempo scaduto!':isRight?'Risposta corretta!':'Risposta errata'}
            </span>
          </div>
          <p className="feedback__detail">💡 La risposta corretta è: <strong style={{color:C.green}}>{currentQ.options[currentQ.correct]}</strong></p>
        </div>
      )}

      {showExp && !isInfinite && (
        <button onClick={handleNext} className={`btn-next popin${nowFailed||nowComplete?' btn-next--end':''}`}>{endBtnLabel}</button>
      )}
    </div>
  );
}

function ExitButton({ onExit }) {
  return <button onClick={onExit} className="exit-btn">✕ Esci</button>;
}

function Chip({ icon, val, color }) {
  return (
    <div className="chip" style={{'--chip-color': color}}>
      <span className="chip__icon">{icon}</span>
      <span className="chip__val">{val}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// RESULTS SCREEN
// ─────────────────────────────────────────────
function ResultsScreen({ results, mode, qStats, onRestart, onHome }) {
  const { correct, errors, totalAnswered, wrongList, passed, reason } = results;
  const pct        = totalAnswered > 0 ? Math.round((correct/totalAnswered)*100) : 0;
  const isInfinite = mode.id === 'infinito';
  const bannerClass = `results-banner ${isInfinite ? 'results-banner--neutral' : passed ? 'results-banner--pass' : 'results-banner--fail'}`;
  const titleColor  = isInfinite ? mode.color : passed ? C.green : C.red;

  const sessionCatErrors = {};
  for (const item of wrongList) { if (!item.timeout) sessionCatErrors[item.q.category] = (sessionCatErrors[item.q.category]||0)+1; }
  const topErrors = Object.entries(sessionCatErrors).sort((a,b)=>b[1]-a[1]).slice(0,4);

  return (
    <div className="screen screen--results fadeup" style={{'--mode-color': mode.color}}>

      <div className={bannerClass}>
        <div className="results-banner__emoji">{isInfinite?'🏆':passed?'🎉':'😞'}</div>
        <h2 className="results-banner__title" style={{color:titleColor}}>
          {isInfinite?'SESSIONE COMPLETATA':reason==='exit'?'QUIZ INTERROTTO':passed?'TEST SUPERATO!':'TEST NON SUPERATO'}
        </h2>
        {reason==='timeout' && <p className="results-banner__note" style={{color:C.yellow}}>⏱ Tempo scaduto</p>}
        {reason==='exit'    && <p className="results-banner__note" style={{color:C.dim}}>Hai interrotto il quiz manualmente</p>}
        {reason==='errors'&&!isInfinite && <p className="results-banner__note" style={{color:C.red}}>Hai superato il limite di {mode.maxErr} errori</p>}
        <div className="results-grid">
          {[['✓',correct,C.green,'Corrette'],['✗',errors,C.red,'Errori'],['📝',totalAnswered,C.dim,'Domande'],['%',`${pct}%`,mode.color,'Punteggio']].map(([ic,v,c,l])=>(
            <div key={l} className="results-grid__cell">
              <div className="results-grid__val" style={{color:c}}>{v}</div>
              <div className="results-grid__lbl">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {topErrors.length > 0 && (
        <div className="error-areas">
          <div className="error-areas__title">⚠️ Aree critiche in questa sessione</div>
          {topErrors.map(([cat,count])=>(
            <div key={cat} className="error-areas__row">
              <span className="error-areas__cat">{cat}</span>
              <span className="error-areas__count">{count} {count===1?'errore':'errori'}</span>
            </div>
          ))}
          <p className="error-areas__hint">💡 Rivedi queste categorie nella schermata <strong style={{color:C.yellow}}>Storico &amp; Preparazione</strong>.</p>
        </div>
      )}

      <div className="results-actions">
        <button onClick={onHome}    className="btn-secondary">← Home</button>
        <button onClick={onRestart} className="btn-primary-mode">🔄 Riprova</button>
      </div>

      {wrongList.length > 0 && (
        <div>
          <h3 className="wrong-header">
            <span style={{color:C.red}}>✗</span> Domande errate <span className="wrong-header__dim">({wrongList.length})</span>
          </h3>
          <div className="wrong-list">
            {wrongList.map((item,i)=>(
              <div key={i} className="wrong-item">
                <div className="wrong-item__cat" style={{color:mode.color}}>{item.q.category}</div>
                {item.q.img && <div className="wrong-item__img"><img src={import.meta.env.BASE_URL+item.q.img.replace(/^\//,'')} alt="Segnale" /></div>}
                <p className="wrong-item__text">{item.q.text}</p>
                {item.timeout
                  ? <div className="answer-tag answer-tag--timeout">⏱ Tempo scaduto</div>
                  : <div className="answer-tag answer-tag--wrong">✗ Data: <strong>{item.q.options[item.selected]}</strong></div>
                }
                <div className="answer-tag answer-tag--correct">✓ Corretta: <strong>{item.q.options[item.q.correct]}</strong></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {wrongList.length===0 && totalAnswered>0 && (
        <div className="perfect-box">
          <div className="perfect-box__icon">⭐</div>
          <div className="perfect-box__title">Perfetto! Nessun errore!</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// STATS SCREEN
// ─────────────────────────────────────────────
function StatsScreen({ history, qStats, onHome, onClear }) {
  const readiness  = calcReadiness(history, qStats);
  const weakCats   = getWeakCategories(qStats);
  const allCatSt   = getAllCategoryStats(qStats);
  const recentSess = [...history].reverse().slice(0,15);
  const rColor     = readiness>=85?C.green:readiness>=55?C.yellow:C.red;
  const rMsg       = readiness>=85?"Sei pronto per l'esame! 🎉":readiness>=70?'Quasi pronto, continua così!':readiness>=55?'Buoni progressi, ma devi ancora esercitarti':readiness>=30?'Continua ad allenarti, stai migliorando':'Inizia a fare quiz per tracciare i tuoi progressi';

  const totalSeen   = Object.values(qStats).filter(s=>s.seen>0).length;
  const totalAns    = history.reduce((s,h)=>s+h.totalAnswered,0);
  const totalCorr   = history.reduce((s,h)=>s+h.correct,0);
  const examsDone   = history.filter(h=>h.mode!=='infinito');
  const examsPassed = examsDone.filter(h=>h.passed);

  const exams  = history.filter(s=>s.mode!=='infinito');
  const recent = (exams.length>0?exams:history).slice(-5);
  const accScore      = recent.length>0 ? Math.round(recent.reduce((s,h)=>s+h.correct/Math.max(h.totalAnswered,1),0)/recent.length*100) : 0;
  const passScore     = exams.length>0  ? Math.round(exams.slice(-5).filter(s=>s.passed).length/Math.min(exams.length,5)*100) : 0;
  const catsWithData  = allCatSt.filter(x=>x.seen>=3);
  const goodCats      = catsWithData.filter(x=>x.acc>=0.70).length;
  const catScore      = catsWithData.length>0 ? Math.round(goodCats/ALL_CATS.length*100) : 0;
  const coverageScore = Math.round(Math.min(totalSeen/150,1)*100);

  return (
    <div className="screen screen--stats fadeup">

      <div className="stats-header">
        <div className="stats-header__left">
          <button onClick={onHome} className="btn-back">← Home</button>
          <h1 className="stats-header__title">Storico &amp; Preparazione</h1>
        </div>
        {history.length>0 && <button onClick={onClear} className="btn-reset">Reset</button>}
      </div>

      {history.length===0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📊</div>
          <div className="empty-state__title">Nessuna sessione ancora</div>
          <p className="empty-state__text">Fai il primo quiz per iniziare a tracciare i tuoi progressi.</p>
        </div>
      ) : (<>

        <div className="readiness-card" style={{'--r-color': rColor}}>
          <div className="readiness-card__label">Prontezza per l'esame</div>
          <div className="readiness-card__circle"><span className="readiness-card__pct">{readiness}%</span></div>
          <p className="readiness-card__msg">{rMsg}</p>
          <div className="score-grid">
            {[
              {label:'Accuratezza recente',  val:accScore,      weight:'40%', desc:'Media ultime 5 sessioni'},
              {label:'Tasso di superamento', val:passScore,     weight:'30%', desc:'Esami passati su 5 recenti'},
              {label:'Copertura categorie',  val:catScore,      weight:'20%', desc:`${goodCats}/${ALL_CATS.length} categorie ≥ 70%`},
              {label:'Domande viste',        val:coverageScore, weight:'10%', desc:`${totalSeen} / 150 obiettivo`},
            ].map(({label,val,weight,desc})=>{
              const c = val>=70?C.green:val>=40?C.yellow:C.red;
              return (
                <div key={label} className="score-cell">
                  <div className="score-cell__header">
                    <span className="score-cell__label">{label}</span>
                    <span className="score-cell__weight">×{weight}</span>
                  </div>
                  <div className="score-cell__bar"><div className="bar-fill" style={{width:`${val}%`,backgroundColor:c,transition:'width 0.8s'}} /></div>
                  <div className="score-cell__footer">
                    <span className="score-cell__desc">{desc}</span>
                    <span className="score-cell__pct" style={{color:c}}>{val}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {weakCats.length>0 && (
          <div className="card card--mb card--warn">
            <div className="section-title" style={{color:C.red, marginBottom:6}}>📚 Cosa devi ripassare</div>
            <p style={{fontSize:13,color:C.dim,marginBottom:14,lineHeight:1.6}}>Queste categorie hanno accuratezza sotto l'80%. Concentrati su di esse.</p>
            {weakCats.map(({cat,acc,seen})=>{
              const pct=Math.round(acc*100), col=pct>=60?C.yellow:C.red;
              return (
                <div key={cat} className="cat-row">
                  <div className="cat-row__header">
                    <span className="cat-row__name">{cat}</span>
                    <span className="cat-row__stat" style={{color:col}}>{pct}% · {seen} risp.</span>
                  </div>
                  <div className="bar-track bar-track--prog" style={{marginBottom:0}}>
                    <div className="bar-fill" style={{width:`${pct}%`,backgroundColor:col,transition:'width 0.6s'}} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {allCatSt.length>0 && (
          <div className="card card--mb">
            <div className="section-title">📂 Andamento per categoria</div>
            {allCatSt.map(({cat,acc,seen})=>{
              const pct=Math.round(acc*100), col=pct>=80?C.green:pct>=60?C.yellow:C.red;
              return (
                <div key={cat} className="cat-row cat-row--sm">
                  <div className="cat-row__header">
                    <span className="cat-row__name">{cat}</span>
                    <span className="cat-row__stat" style={{color:col}}>{pct}% ({seen} risp.)</span>
                  </div>
                  <div className="bar-track" style={{marginBottom:6}}>
                    <div className="bar-fill" style={{width:`${pct}%`,backgroundColor:col}} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="stat-grid">
          {[
            {label:'Sessioni totali',  val:history.length,                                                     icon:'🎯'},
            {label:'Esami superati',   val:`${examsPassed.length} / ${examsDone.length}`,                      icon:'✅'},
            {label:'Risposte totali',  val:totalAns.toLocaleString('it'),                                       icon:'📝'},
            {label:'Accuratezza tot.', val:totalAns>0?`${Math.round(totalCorr/totalAns*100)}%`:'—',            icon:'📊'},
          ].map(({label,val,icon})=>(
            <div key={label} className="stat-cell">
              <div className="stat-cell__icon">{icon}</div>
              <div className="stat-cell__val">{val}</div>
              <div className="stat-cell__label">{label}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-title">🕐 Sessioni recenti</div>
          <div className="session-list">
            {recentSess.map((s,i)=>{
              const m=MODES[s.mode];
              const acc=s.totalAnswered>0?Math.round(s.correct/s.totalAnswered*100):0;
              const statusColor=s.mode==='infinito'?m.color:s.passed?C.green:C.red;
              const statusLabel=s.mode==='infinito'?'Infinito':s.passed?'Superato':'Non sup.';
              return (
                <div key={i} className="session-row">
                  <div className="session-row__dot" style={{background:statusColor}} />
                  <div className="session-row__info">
                    <div className="session-row__name">{m?.name||s.mode}</div>
                    <div className="session-row__date">{fmtDate(s.date)}</div>
                  </div>
                  <div className="session-row__right">
                    <div className="session-row__status" style={{color:statusColor}}>{statusLabel}</div>
                    <div className="session-row__score">{s.correct}/{s.totalAnswered} · {acc}%</div>
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
