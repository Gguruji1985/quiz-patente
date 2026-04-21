import { useState, useEffect, useRef } from "react";
import './index.css';
import questionsRaw from '../QuizPatenteB-main/quizPatenteB2023.json';

function formatCat(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
const ALL_Q = (() => {
  const out = []; let id = 1;
  for (const [cat, subs] of Object.entries(questionsRaw)) {
    const category = formatCat(cat);
    for (const items of Object.values(subs))
      for (const item of items)
        out.push({ id: id++, text: item.q, options: ['Vero', 'Falso'], correct: item.a ? 0 : 1, category, img: item.img || null });
  }
  return out;
})();
const Q_BY_ID  = Object.fromEntries(ALL_Q.map(q => [String(q.id), q]));
const ALL_CATS = [...new Set(ALL_Q.map(q => q.category))];

const HISTORY_KEY = 'quiz_patente_history';
const QSTATS_KEY  = 'quiz_patente_qstats';
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } };
const loadQStats  = () => { try { return JSON.parse(localStorage.getItem(QSTATS_KEY))  || {}; } catch { return {}; } };
const saveHistory = h => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {} };
const saveQStats  = s => { try { localStorage.setItem(QSTATS_KEY,  JSON.stringify(s)); } catch {} };

function calcReadiness(history, qStats) {
  if (!history.length) return 0;
  const exams  = history.filter(s => !['infinito','errori','normale'].includes(s.mode));
  const recent = (exams.length ? exams : history).slice(-5);
  const accScore  = recent.reduce((s,h) => s + h.correct / Math.max(h.totalAnswered,1), 0) / recent.length;
  const passScore = exams.length ? exams.slice(-5).filter(s => s.passed).length / Math.min(exams.length,5) : 0;
  const catAcc = {};
  for (const [qid,st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid]; if (!q || st.seen < 3) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen:0, correct:0 };
    catAcc[q.category].seen += st.seen; catAcc[q.category].correct += st.correct;
  }
  const catsD = ALL_CATS.filter(c => catAcc[c]);
  const catScore = catsD.length ? catsD.filter(c => catAcc[c].correct/catAcc[c].seen >= 0.70).length / ALL_CATS.length : 0;
  const seen = Object.values(qStats).filter(s => s.seen > 0).length;
  return Math.round((accScore*0.40 + passScore*0.30 + catScore*0.20 + Math.min(seen/150,1)*0.10) * 100);
}
function getWeakCategories(qStats) {
  const catAcc = {};
  for (const [qid,st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid]; if (!q || st.seen < 3) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen:0, correct:0 };
    catAcc[q.category].seen += st.seen; catAcc[q.category].correct += st.correct;
  }
  return Object.entries(catAcc).map(([cat,s]) => ({ cat, acc:s.correct/s.seen, seen:s.seen }))
    .filter(x => x.acc < 0.80).sort((a,b) => a.acc - b.acc).slice(0,6);
}
function getAllCategoryStats(qStats) {
  const catAcc = {};
  for (const [qid,st] of Object.entries(qStats)) {
    const q = Q_BY_ID[qid]; if (!q || st.seen === 0) continue;
    if (!catAcc[q.category]) catAcc[q.category] = { seen:0, correct:0 };
    catAcc[q.category].seen += st.seen; catAcc[q.category].correct += st.correct;
  }
  return Object.entries(catAcc).map(([cat,s]) => ({ cat, acc:s.correct/s.seen, seen:s.seen })).sort((a,b) => a.acc - b.acc);
}

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; }
  return arr;
}
const fmt     = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const fmtDate = ts => new Date(ts).toLocaleDateString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

const C = { green:'#4ade80', red:'#f87171', yellow:'#fbbf24', dim:'#6b7280' };

const MODES = {
  ministeriale: { id:'ministeriale', name:'Simulazione Esame',  icon:'🏛', subtitle:'30 dom · 20 min · max 3 errori', desc:"Riproduce l'esame ministeriale di Stato. 30 domande, 20 minuti, massimo 3 errori.", totalQ:30, qTimer:null, totalTimer:1200, maxErr:3, color:'#e8b84b', tag:'UFFICIALE' },
  normale:      { id:'normale',      name:'Allenamento Libero', icon:'✏', subtitle:'30 dom · senza timer',           desc:'30 domande casuali senza limite di tempo. Ideale per ripassare con calma.',             totalQ:30, qTimer:null, totalTimer:null, maxErr:null, color:'#818cf8', tag:'TRAINING' },
  infinito:     { id:'infinito',     name:'Modalità Infinita',  icon:'∞',  subtitle:'Domande senza limite',           desc:'Domande casuali continue dal database ufficiale. Nessun limite di tempo.',                totalQ:null, qTimer:null, totalTimer:null, maxErr:null, color:'#38bdf8', tag:'INFINITO' },
  errori:       { id:'errori',       name:'Ripassa Errori',     icon:'⟳',  subtitle:'Solo domande sbagliate',         desc:'Ripassa solo le domande che hai risposto male. Concentrati sulle lacune.',                totalQ:null, qTimer:null, totalTimer:null, maxErr:null, color:'#f87171', tag:'REVIEW' },
};

export default function App() {
  const [screen, setScreen]   = useState('home');
  const [mode, setMode]       = useState(null);
  const [results, setResults] = useState(null);
  const [quizKey, setQuizKey] = useState(0);
  const [history, setHistory] = useState(loadHistory);
  const [qStats,  setQStats]  = useState(loadQStats);

  const start   = id => { setMode(MODES[id]); setScreen('quiz'); setQuizKey(k => k+1); };
  const restart = ()  => { setScreen('quiz'); setQuizKey(k => k+1); };

  const finish = data => {
    const entry = { date:Date.now(), mode:data.mode.id, correct:data.correct, errors:data.errors, totalAnswered:data.totalAnswered, passed:data.passed, reason:data.reason };
    const nh = [...history, entry]; setHistory(nh); saveHistory(nh);
    const nq = { ...qStats };
    for (const { id, correct } of (data.questionResults || [])) {
      const k = String(id);
      if (!nq[k]) nq[k] = { seen:0, correct:0 };
      nq[k].seen++; if (correct) nq[k].correct++;
    }
    setQStats(nq); saveQStats(nq);
    setResults(data); setScreen('results');
  };

  const clearStats = () => {
    if (!window.confirm('Cancellare tutto lo storico e le statistiche?')) return;
    setHistory([]); setQStats({}); saveHistory([]); saveQStats({});
  };

  return (
    <div className="app">
      {screen === 'home'    && <HomeScreen onStart={start} onStats={() => setScreen('stats')} history={history} qStats={qStats} />}
      {screen === 'quiz'    && mode && <QuizScreen key={quizKey} mode={mode} qStats={qStats} onDone={finish} />}
      {screen === 'results' && results && <ResultsScreen results={results} mode={mode} onRestart={restart} onHome={() => setScreen('home')} />}
      {screen === 'stats'   && <StatsScreen history={history} qStats={qStats} onHome={() => setScreen('home')} onClear={clearStats} />}
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomeScreen({ onStart, onStats, history, qStats }) {
  const readiness = calcReadiness(history, qStats);
  const rColor = readiness >= 85 ? C.green : readiness >= 55 ? C.yellow : C.red;

  return (
    <div className="screen home">
      <div className="home-hero">
        <div className="hero-eyebrow"><span className="flag">🇮🇹</span> Patente di Guida · Categoria B</div>
        <h1 className="hero-title">Quiz<br /><span className="hero-accent">Patente</span></h1>
        <p className="hero-sub">{ALL_Q.length.toLocaleString('it')} domande ministeriali ufficiali</p>
      </div>

      {history.length > 0 ? (
        <button className="readiness-pill" style={{'--rc':rColor}} onClick={onStats}>
          <div className="rp-ring">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3"/>
              <circle cx="24" cy="24" r="20" fill="none" stroke={rColor} strokeWidth="3"
                strokeDasharray={`${readiness*1.257} 125.7`} strokeLinecap="round"
                style={{transform:'rotate(-90deg)',transformOrigin:'50% 50%'}}/>
            </svg>
            <span className="rp-num">{readiness}%</span>
          </div>
          <div>
            <div className="rp-title">{readiness>=85?"🎉 Pronto per l'esame!":readiness>=55?'📈 Progressi in corso':'💪 Continua ad allenarti'}</div>
            <div className="rp-sub">Storico &amp; statistiche →</div>
          </div>
        </button>
      ) : (
        <button className="readiness-pill rp-empty" onClick={onStats}>
          <span className="rp-icon">📊</span>
          <div>
            <div className="rp-title">Storico &amp; Statistiche</div>
            <div className="rp-sub">Inizia un quiz per tracciare i progressi</div>
          </div>
        </button>
      )}

      <div className="modes">
        {Object.values(MODES).map((m, i) => {
          const wrongCount = m.id==='errori' ? Object.values(qStats).filter(s=>s.seen>0&&s.correct<s.seen).length : null;
          const off = m.id==='errori' && wrongCount===0;
          return (
            <button key={m.id} className={`mc ${off?'mc--off':''}`}
              style={{'--c':m.color,'--delay':`${i*60}ms`}}
              onClick={off ? undefined : ()=>onStart(m.id)}>
              <span className="mc-tag">{m.tag}</span>
              {m.id==='errori'&&wrongCount>0 && <span className="mc-badge">{wrongCount}</span>}
              <div className="mc-icon">{m.icon}</div>
              <div className="mc-name">{m.name}</div>
              <div className="mc-meta">{m.subtitle}</div>
              <p className="mc-desc">{off?'Completa almeno un quiz per sbloccare.':m.desc}</p>
              <span className="mc-arr">→</span>
            </button>
          );
        })}
      </div>

      <div className="home-footer">
        {[[ALL_Q.length.toLocaleString('it'),'domande ufficiali'],['4','modalità di studio'],['100%','gratuito']].map(([v,l])=>(
          <div key={l} className="hf-cell"><span className="hf-v">{v}</span><span className="hf-l">{l}</span></div>
        ))}
      </div>
    </div>
  );
}

// ── QUIZ ──────────────────────────────────────────────────────────────────────
function QuizScreen({ mode, qStats, onDone }) {
  const isInf    = mode.id === 'infinito';
  const hasTimer = !isInf && mode.totalTimer !== null;

  const buildPool = () => {
    if (mode.id === 'errori') {
      const wids = new Set(Object.entries(qStats).filter(([,s])=>s.seen>0&&s.correct<s.seen).map(([id])=>id));
      const w = ALL_Q.filter(q=>wids.has(String(q.id)));
      return shuffle(w.length ? w : ALL_Q);
    }
    return shuffle(ALL_Q);
  };

  const [pool,setPool]     = useState(()=>buildPool());
  const [pidx,setPidx]     = useState(0);
  const [correct,setCorr]  = useState(0);
  const [errors,setErrors] = useState(0);
  const [answered,setAns]  = useState(0);
  const [wrongList,setWL]  = useState([]);
  const [qResults,setQR]   = useState([]);
  const [sel,setSel]       = useState(null);
  const [showFB,setFB]     = useState(false);
  const [timeLeft,setTL]   = useState(hasTimer ? mode.totalTimer : null);

  const lat = useRef({}); lat.current = {correct,errors,answered,wrongList,pool,pidx,qResults};
  const cq  = pool[pidx % pool.length];
  const fbRef = useRef(false); fbRef.current = showFB;
  const doneRef = useRef(onDone); doneRef.current = onDone;

  const failed   = mode.maxErr !== null && errors > mode.maxErr;
  const complete = mode.totalQ !== null && answered >= mode.totalQ;

  useEffect(()=>{
    if(!hasTimer||timeLeft<=0||showFB||failed||complete) return;
    const id=setTimeout(()=>setTL(t=>t-1),1000); return ()=>clearTimeout(id);
  },[timeLeft,showFB,failed,complete,hasTimer]);

  useEffect(()=>{
    if(timeLeft===null||timeLeft>0||fbRef.current||!hasTimer) return;
    const r=lat.current;
    doneRef.current({mode,correct:r.correct,errors:r.errors,totalAnswered:r.answered,wrongList:r.wrongList,questionResults:r.qResults,passed:false,reason:'timeout'});
  },[timeLeft,hasTimer,mode]);

  const autoRef = useRef(null);
  useEffect(()=>()=>clearTimeout(autoRef.current),[]);

  const nextRef = useRef(null);
  const next = ()=>{
    const r=lat.current;
    const nf=mode.maxErr!==null&&r.errors>mode.maxErr;
    const nc=mode.totalQ!==null&&r.answered>=mode.totalQ;
    if(nf||nc){
      clearTimeout(autoRef.current);
      onDone({mode,correct:r.correct,errors:r.errors,totalAnswered:r.answered,wrongList:r.wrongList,questionResults:r.qResults,passed:nc&&!nf,reason:nf?'errors':'complete'});
      return;
    }
    setSel(null); setFB(false);
    const ni=r.pidx+1;
    if(isInf&&ni>=r.pool.length){setPool(shuffle(ALL_Q));setPidx(0);}else{setPidx(ni);}
  };
  nextRef.current=next;

  const answer = idx=>{
    if(showFB) return;
    const ok=idx===cq.correct;
    setCorr(c=>c+(ok?1:0)); setErrors(e=>e+(ok?0:1)); setAns(a=>a+1);
    setSel(idx); setFB(true);
    setQR(r=>[...r,{id:cq.id,correct:ok}]);
    if(!ok) setWL(w=>[...w,{q:cq,selected:idx}]);
    if(isInf){clearTimeout(autoRef.current); autoRef.current=setTimeout(()=>nextRef.current(),600);}
  };

  useEffect(()=>{
    const h=e=>{
      if(e.key==='ArrowRight'||e.key==='v'||e.key==='V') answer(0);
      if(e.key==='ArrowLeft'||e.key==='f'||e.key==='F') answer(1);
    };
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
  },[showFB,cq]);

  const timerPct   = hasTimer?(timeLeft/mode.totalTimer)*100:100;
  const timerColor = !hasTimer?C.dim:timeLeft<300?C.red:timeLeft<600?C.yellow:C.green;
  const progress   = mode.totalQ?(answered/mode.totalQ)*100:null;
  const nf2        = mode.maxErr!==null&&errors>mode.maxErr;
  const nc2        = mode.totalQ!==null&&answered>=mode.totalQ;
  const isRight    = sel!==null&&sel===cq.correct;

  return (
    <div className="screen quiz" style={{'--c':mode.color}}>
      <div className="quiz-bar">
        <button className="q-exit" onClick={()=>{
          if(window.confirm('Uscire? Il progresso andrà perso.')){
            const r=lat.current;
            onDone({mode,correct,errors,totalAnswered:answered,wrongList,questionResults:r.qResults,passed:false,reason:'exit'});
          }
        }}>✕ Esci</button>
        {!isInf&&(
          <div className="q-chips">
            <span className="qc qc--ok">✓{correct}</span>
            <span className="qc qc--err">✗{errors}</span>
            {mode.totalQ&&<span className="qc">{answered}/{mode.totalQ}</span>}
          </div>
        )}
        {hasTimer&&(
          <div className="q-timer" style={{color:timerColor}}>
            <b>{fmt(timeLeft)}</b><small>rimasti</small>
          </div>
        )}
      </div>

      <div className="q-bars">
        {hasTimer&&<div className="qb"><div className="qb-f" style={{width:`${timerPct}%`,background:timerColor}}/></div>}
        {progress!==null&&<div className="qb"><div className="qb-f" style={{width:`${progress}%`,background:mode.color}}/></div>}
      </div>

      <div className="q-cat">{cq.category}</div>

      <div className={`q-card${showFB?(isRight?' q-card--ok':' q-card--err'):''}`}>
        {cq.img&&<div className="q-img-wrap"><img src={import.meta.env.BASE_URL+cq.img.replace(/^\//,'')} alt="Segnale" className="q-img"/></div>}
        <p className="q-text">{cq.text}</p>
      </div>

      <div className="vf">
        {[{l:'Vero',k:'V',i:0,cls:'vf-v'},{l:'Falso',k:'F',i:1,cls:'vf-f'}].map(({l,k,i,cls})=>{
          let extra='';
          if(showFB){
            if(i===cq.correct) extra=' vf--ok';
            else if(i===sel)   extra=' vf--bad';
            else               extra=' vf--dim';
          }
          return(
            <button key={i} onClick={()=>answer(i)} disabled={showFB} className={cls+extra}>
              <span className="vf-k">{k}</span>
              <span className="vf-l">{l}</span>
            </button>
          );
        })}
      </div>

      {showFB&&!isInf&&(
        <div className={`fb${isRight?' fb--ok':' fb--err'}`}>
          {isRight?'✅ Corretto!':`❌ Sbagliato — Risposta: ${cq.options[cq.correct]}`}
        </div>
      )}

      {showFB&&!isInf&&(
        <button className={`btn-next${nf2||nc2?' btn-next--end':''}`} onClick={next}>
          {nf2?'❌ Vedi risultati':nc2?'🎯 Vedi risultati':'Prossima →'}
        </button>
      )}
    </div>
  );
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
function ResultsScreen({ results, mode, onRestart, onHome }) {
  const {correct,errors,totalAnswered,wrongList,passed,reason} = results;
  const pct = totalAnswered>0?Math.round(correct/totalAnswered*100):0;
  const isInf = mode.id==='infinito';
  const bc = isInf?mode.color:passed?C.green:C.red;
  const catErr = {};
  for(const item of wrongList) if(!item.timeout) catErr[item.q.category]=(catErr[item.q.category]||0)+1;
  const topErr = Object.entries(catErr).sort((a,b)=>b[1]-a[1]).slice(0,4);

  return (
    <div className="screen results" style={{'--c':mode.color}}>
      <div className="res-banner" style={{'--bc':bc}}>
        <div className="res-emoji">{isInf?'🏆':passed?'🎉':'😞'}</div>
        <h2 className="res-title" style={{color:bc}}>
          {isInf?'SESSIONE INFINITA':reason==='exit'?'QUIZ INTERROTTO':passed?'TEST SUPERATO!':'TEST NON SUPERATO'}
        </h2>
        {reason==='timeout'&&<p style={{color:C.yellow,margin:'4px 0'}}>⏱ Tempo scaduto</p>}
        {reason==='errors'&&!isInf&&<p style={{color:C.red,margin:'4px 0'}}>Superato il limite di {mode.maxErr} errori</p>}
        <div className="res-grid">
          {[[correct,C.green,'Corrette'],[errors,C.red,'Errori'],[totalAnswered,C.dim,'Domande'],[`${pct}%`,bc,'Punteggio']].map(([v,c,l])=>(
            <div key={l} className="rg-cell"><span className="rg-v" style={{color:c}}>{v}</span><span className="rg-l">{l}</span></div>
          ))}
        </div>
      </div>

      {topErr.length>0&&(
        <div className="res-card">
          <div className="rc-h">⚠️ Aree critiche</div>
          {topErr.map(([cat,n])=>(
            <div key={cat} className="rc-row"><span>{cat}</span><span style={{color:C.red}}>{n} {n===1?'errore':'errori'}</span></div>
          ))}
          <p className="rc-hint">💡 Usa <b>Ripassa Errori</b> per colmare le lacune.</p>
        </div>
      )}

      <div className="res-btns">
        <button className="btn-sec" onClick={onHome}>← Home</button>
        <button className="btn-pri" style={{'--c':mode.color}} onClick={onRestart}>🔄 Riprova</button>
      </div>

      {wrongList.length>0&&(
        <div className="wrong-sec">
          <h3 className="wrong-h">Domande errate <span>({wrongList.length})</span></h3>
          {wrongList.map((item,i)=>(
            <div key={i} className="wi">
              <div className="wi-cat" style={{color:mode.color}}>{item.q.category}</div>
              {item.q.img&&<img src={import.meta.env.BASE_URL+item.q.img.replace(/^\//,'')} alt="" className="wi-img"/>}
              <p className="wi-text">{item.q.text}</p>
              {item.timeout
                ?<span className="wi-t wi-t--to">⏱ Tempo scaduto</span>
                :<span className="wi-t wi-t--wrong">✗ {item.q.options[item.selected]}</span>}
              <span className="wi-t wi-t--ok">✓ {item.q.options[item.q.correct]}</span>
            </div>
          ))}
        </div>
      )}
      {!wrongList.length&&totalAnswered>0&&(
        <div className="perfect"><div>⭐</div><div>Perfetto! Nessun errore!</div></div>
      )}
    </div>
  );
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function StatsScreen({ history, qStats, onHome, onClear }) {
  const readiness = calcReadiness(history,qStats);
  const weakCats  = getWeakCategories(qStats);
  const allCatSt  = getAllCategoryStats(qStats);
  const recent15  = [...history].reverse().slice(0,15);
  const rColor    = readiness>=85?C.green:readiness>=55?C.yellow:C.red;
  const rMsg      = readiness>=85?"Sei pronto per l'esame! 🎉":readiness>=70?'Quasi pronto!':readiness>=55?'Buoni progressi.':readiness>=30?'Stai migliorando':'Inizia un quiz per tracciare i progressi';

  const totalSeen   = Object.values(qStats).filter(s=>s.seen>0).length;
  const totalAns    = history.reduce((s,h)=>s+h.totalAnswered,0);
  const totalCorr   = history.reduce((s,h)=>s+h.correct,0);
  const examsDone   = history.filter(h=>h.mode!=='infinito');
  const examsPassed = examsDone.filter(h=>h.passed);
  const exams       = history.filter(s=>!['infinito','errori','normale'].includes(s.mode));
  const rec5        = (exams.length?exams:history).slice(-5);
  const accScore    = rec5.length?Math.round(rec5.reduce((s,h)=>s+h.correct/Math.max(h.totalAnswered,1),0)/rec5.length*100):0;
  const passScore   = exams.length?Math.round(exams.slice(-5).filter(s=>s.passed).length/Math.min(exams.length,5)*100):0;
  const catsD       = getAllCategoryStats(qStats).filter(x=>x.seen>=3);
  const goodCats    = catsD.filter(x=>x.acc>=0.70).length;
  const catScore    = catsD.length?Math.round(goodCats/ALL_CATS.length*100):0;
  const covScore    = Math.round(Math.min(totalSeen/150,1)*100);

  return (
    <div className="screen stats">
      <div className="st-nav">
        <button className="btn-back" onClick={onHome}>← Home</button>
        <h1 className="st-title">Statistiche</h1>
        {history.length>0&&<button className="btn-reset" onClick={onClear}>Reset</button>}
      </div>

      {!history.length?(
        <div className="empty">
          <div>📊</div><div>Nessuna sessione ancora</div>
          <p>Fai il primo quiz per iniziare a tracciare i progressi.</p>
        </div>
      ):(<>

        <div className="r-card" style={{'--rc':rColor}}>
          <div className="r-card-top">
            <div>
              <div className="r-label">Prontezza per l'esame</div>
              <p className="r-msg">{rMsg}</p>
            </div>
            <div className="r-big" style={{color:rColor}}>{readiness}%</div>
          </div>
          <div className="r-bars">
            {[['Accuratezza recente',accScore,'40%'],['Tasso di superamento',passScore,'30%'],['Copertura categorie',catScore,'20%'],['Domande viste',covScore,'10%']].map(([l,v,w])=>{
              const c=v>=70?C.green:v>=40?C.yellow:C.red;
              return(
                <div key={l} className="rb-row">
                  <div className="rb-head"><span>{l}</span><span className="rb-w">×{w}</span><span style={{color:c}}>{v}%</span></div>
                  <div className="rb-track"><div className="rb-fill" style={{width:`${v}%`,background:c}}/></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ov-grid">
          {[[history.length,'🎯','Sessioni'],
            [`${examsPassed.length}/${examsDone.length}`,'✅','Esami sup.'],
            [totalAns.toLocaleString('it'),'📝','Risposte'],
            [totalAns?`${Math.round(totalCorr/totalAns*100)}%`:'—','📊','Accuratezza']
          ].map(([v,ic,l])=>(
            <div key={l} className="ov-c"><span className="ov-ic">{ic}</span><span className="ov-v">{v}</span><span className="ov-l">{l}</span></div>
          ))}
        </div>

        {weakCats.length>0&&(
          <div className="st-card st-card--warn">
            <div className="sc-t" style={{color:C.red}}>📚 Da ripassare</div>
            {weakCats.map(({cat,acc,seen})=>{
              const p=Math.round(acc*100),c=p>=60?C.yellow:C.red;
              return(<div key={cat} className="sc-row"><div className="sc-rh"><span>{cat}</span><span style={{color:c}}>{p}% · {seen}</span></div>
                <div className="rb-track"><div className="rb-fill" style={{width:`${p}%`,background:c}}/></div></div>);
            })}
          </div>
        )}

        {allCatSt.length>0&&(
          <div className="st-card">
            <div className="sc-t">📂 Per categoria</div>
            {allCatSt.map(({cat,acc,seen})=>{
              const p=Math.round(acc*100),c=p>=80?C.green:p>=60?C.yellow:C.red;
              return(<div key={cat} className="sc-row"><div className="sc-rh"><span>{cat}</span><span style={{color:c}}>{p}% ({seen})</span></div>
                <div className="rb-track"><div className="rb-fill" style={{width:`${p}%`,background:c}}/></div></div>);
            })}
          </div>
        )}

        <div className="st-card">
          <div className="sc-t">🕐 Sessioni recenti</div>
          {recent15.map((s,i)=>{
            const m=MODES[s.mode];
            const acc=s.totalAnswered?Math.round(s.correct/s.totalAnswered*100):0;
            const sc=s.mode==='infinito'?m.color:s.passed?C.green:C.red;
            return(
              <div key={i} className="sess-row">
                <div className="sess-dot" style={{background:sc}}/>
                <div className="sess-info">
                  <span>{m?.name||s.mode}</span>
                  <span className="sess-date">{fmtDate(s.date)}</span>
                </div>
                <div className="sess-right">
                  <span style={{color:sc}}>{s.mode==='infinito'?'Infinito':s.passed?'Superato':'Non sup.'}</span>
                  <span className="sess-score">{s.correct}/{s.totalAnswered} · {acc}%</span>
                </div>
              </div>
            );
          })}
        </div>

      </>)}
    </div>
  );
}
