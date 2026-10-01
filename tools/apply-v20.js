const fs=require('fs');

function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}
function replaceOnce(s,from,to,label){if(!s.includes(from))throw new Error(`Patch não encontrado: ${label}`);return s.replace(from,to);}

// 1) Acréscimos reais e determinísticos no motor.
let eng=read('js/simulation/matchEngine.js');
eng=replaceOnce(eng,"const TOTAL=90*60;","const TOTAL=90*60;\n  const FIRST_HALF_BASE=45*60;","constantes de tempo");
eng=eng.replaceAll('Math.min(90,Math.floor((m.gameSeconds||0)/60))','Math.floor((m.gameSeconds||0)/60)');
eng=eng.replaceAll('Math.min(90,Math.floor(m.gameSeconds/60))','Math.floor(m.gameSeconds/60)');
eng=replaceOnce(eng,"const seedHash=Rng.hashString(seed);","const seedHash=Rng.hashString(seed);\n      const firstHalfStoppage=1+(seedHash%10);\n      const secondHalfStoppage=1+((seedHash>>>8)%10);","seed dos acréscimos");
eng=replaceOnce(eng,
"cards:{A:{},B:{}},sentOff:{A:[],B:[]},stoppageWindow:false,pendingPenalty:null,",
"cards:{A:{},B:{}},sentOff:{A:[],B:[]},stoppageWindow:false,pendingPenalty:null,\n        firstHalfStoppage,secondHalfStoppage,firstHalfStoppageAnnounced:false,secondHalfStoppageAnnounced:false,",
"campos de acréscimos");

const stepStart=eng.indexOf('  function step(state,dt,rawDt){');
const stepEnd=eng.indexOf('  function autoCoachSubs',stepStart);
if(stepStart<0||stepEnd<0)throw new Error('step() não localizado');
const newStep=`  function step(state,dt,rawDt){
    const m=state.match;if(!m||m.finished||m.paused)return;
    const compression=TOTAL/Math.max(45,m.realMatchSeconds);
    const firstHalfEnd=FIRST_HALF_BASE+(m.firstHalfStoppage||1)*60;
    const fullTimeEnd=TOTAL+(m.secondHalfStoppage||1)*60;
    if(!m.fullTimeRequested){
      const gameDelta=dt*compression;
      const periodEnd=m.secondHalf?fullTimeEnd:firstHalfEnd;
      m.gameSeconds=Math.min(periodEnd,m.gameSeconds+gameDelta);
      m.minute=Math.floor(m.gameSeconds/60);
      addPossession(m,gameDelta);
      m.stamina.A=Math.max(.72,1-Math.min(TOTAL,m.gameSeconds)/TOTAL*.26);m.stamina.B=Math.max(.72,1-Math.min(TOTAL,m.gameSeconds)/TOTAL*.26);

      if(!m.secondHalf&&!m.firstHalfStoppageAnnounced&&m.gameSeconds>=FIRST_HALF_BASE){
        m.firstHalfStoppageAnnounced=true;
        emit(state,\`45' — ⏱️ o árbitro indica +\${m.firstHalfStoppage} minuto\${m.firstHalfStoppage===1?'':'s'} de acréscimo.\`,'event','STOPPAGE_TIME',{half:1,minutes:m.firstHalfStoppage});
      }
      if(!m.halfEmitted&&!m.secondHalf&&m.gameSeconds>=firstHalfEnd){
        m.halfEmitted=true;m.gameSeconds=firstHalfEnd;m.minute=45+(m.firstHalfStoppage||1);m.waitingHalfTime=true;m.paused=true;m.stoppageWindow=true;Prime.GameLoop.setPaused(true);
        emit(state,\`\${m.minute}' — Intervalo.\`,'event','HALF_TIME');hooks.onEvent&&hooks.onEvent({type:'OVERLAY',data:{kind:'half'}},state);autoCoachSubs(state,45,true);hooks.onHalfTime&&hooks.onHalfTime(state);update(state);return;
      }
      if(m.secondHalf&&!m.secondHalfStoppageAnnounced&&m.gameSeconds>=TOTAL){
        m.secondHalfStoppageAnnounced=true;
        emit(state,\`90' — ⏱️ o árbitro indica +\${m.secondHalfStoppage} minuto\${m.secondHalfStoppage===1?'':'s'} de acréscimo.\`,'event','STOPPAGE_TIME',{half:2,minutes:m.secondHalfStoppage});
      }

      // Uma nova etapa tática só nasce quando a etapa visual anterior terminou.
      if(m.gameSeconds>=m.nextEventAt&&m.gameSeconds<periodEnd&&!m.visualBusy&&!m.visualQueue.length&&!(Prime.Pitch?.isActionActive?.())){
        generateEvent(state);
        const tempo=(tactics(state,m.poss).tempo||65);
        const base=Math.max(Prime.Balance?.event?.baseGapMin||34,(Prime.Balance?.event?.baseGapMax||64)-tempo*.22);
        m.nextEventAt=m.gameSeconds+base+m.rng()*20;
      }
      if(m.secondHalf&&m.gameSeconds>=fullTimeEnd){m.fullTimeRequested=true;m.fullTimeWait=0;emit(state,\`\${90+(m.secondHalfStoppage||1)}' — fim da partida.\`,'event','FULL_TIME_WAIT');}
    }else{
      m.fullTimeWait+=(rawDt||dt||0);
      if((!m.visualBusy&&!m.visualQueue.length)||m.fullTimeWait>=FULL_TIME_VISUAL_WAIT){flushVisuals(state);finishRegulation(state);return;}
    }
    update(state);
  }

`;
eng=eng.slice(0,stepStart)+newStep+eng.slice(stepEnd);
eng=replaceOnce(eng,
"flushVisuals(state);m.waitingHalfTime=false;m.secondHalf=true;m.paused=false;m.stoppageWindow=false;m.attackPhase='KICKOFF';",
"flushVisuals(state);m.waitingHalfTime=false;m.secondHalf=true;m.paused=false;m.stoppageWindow=false;m.attackPhase='KICKOFF';m.gameSeconds=FIRST_HALF_BASE;m.minute=45;m.secondHalfStoppageAnnounced=false;",
"reinício do segundo tempo");
eng=replaceOnce(eng,
"m.finished=true;m.gameSeconds=TOTAL;m.minute=90;Prime.GameLoop.setPaused(true);emit(state,'Fim de jogo.'",
"m.finished=true;m.gameSeconds=TOTAL+(m.secondHalfStoppage||1)*60;m.minute=90+(m.secondHalfStoppage||1);Prime.GameLoop.setPaused(true);emit(state,'Fim de jogo.'",
"fim após pênaltis");
eng=replaceOnce(eng,
"flushVisuals(state);m.gameSeconds=TOTAL;m.minute=90;Prime.GameLoop.setPaused(true);",
"flushVisuals(state);m.gameSeconds=TOTAL+(m.secondHalfStoppage||1)*60;m.minute=90+(m.secondHalfStoppage||1);Prime.GameLoop.setPaused(true);",
"fim regulamentar");
write('js/simulation/matchEngine.js',eng);

// 2) Index: assets de compartilhamento, bola parada e Supabase Realtime.
let idx=read('index.html');
if(!idx.includes('css/live-v20.css'))idx=idx.replace('</head>','  <link rel="stylesheet" href="css/live-v20.css" />\n</head>');
if(!idx.includes('@supabase/supabase-js'))idx=idx.replace('  <script src="js/state/gameStates.js"></script>','  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script src="js/state/gameStates.js"></script>');
if(!idx.includes('js/runtime/setPieceVisualsV20.js'))idx=idx.replace('  <script src="js/render/broadcastOverlay.js"></script>','  <script src="js/runtime/setPieceVisualsV20.js"></script>\n  <script src="js/render/broadcastOverlay.js"></script>');
if(!idx.includes('js/runtime/stoppageDisplayV20.js'))idx=idx.replace('  <script src="js/runtime/kickoffCeremonyV18.js"></script>','  <script src="js/runtime/kickoffCeremonyV18.js"></script>\n  <script src="js/runtime/stoppageDisplayV20.js"></script>\n  <script src="js/online/liveMatchV20.js"></script>');
write('index.html',idx);

// 3) Garantia simples de que os novos arquivos realmente foram adicionados.
for(const p of ['js/runtime/setPieceVisualsV20.js','js/runtime/stoppageDisplayV20.js','js/online/liveMatchV20.js','css/live-v20.css']){
  if(!fs.existsSync(p))throw new Error(`Arquivo v20 ausente: ${p}`);
}
console.log('Prime v20 aplicado com sucesso.');
