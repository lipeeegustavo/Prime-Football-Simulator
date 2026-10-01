(function(Prime){
  const PROJECT_URL='https://fpduwcrjqgvxnlhyuyag.supabase.co';
  const PUBLIC_KEY='sb_publishable_39B4RWNx9R4SlXROyBxdiQ_jF1hCXeL';
  const EDGE=`${PROJECT_URL}/functions/v1/prime-live`;
  const S=Prime.GameStates;
  const watchCode=(new URLSearchParams(location.search).get('watch')||'').toUpperCase();
  let liveSession=null,lastPush=0,pushing=false,lastLobbyPush=0,watchRow=null,watchState=null,watchMounted=false,channel=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function api(body){
    const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLIC_KEY,'Authorization':`Bearer ${PUBLIC_KEY}`},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Erro ${res.status}`);
    return data;
  }
  function teamCopy(t){return JSON.parse(JSON.stringify(t||{}));}
  function linkFor(code){
    const base=location.protocol==='file:'?'https://pied-phi.vercel.app':`${location.origin}${location.pathname}`;
    return `${base}?watch=${encodeURIComponent(code)}`;
  }
  function getStored(){try{return JSON.parse(sessionStorage.getItem('prime_live_host_v20')||'null');}catch(_e){return null;}}
  function storeSession(s){liveSession=s;try{sessionStorage.setItem('prime_live_host_v20',JSON.stringify(s));}catch(_e){}}
  function viewerId(){
    let id='';try{id=localStorage.getItem('prime_viewer_id_v20')||'';}catch(_e){}
    if(!id){if(crypto.randomUUID)id=crypto.randomUUID();else{const b=crypto.getRandomValues(new Uint32Array(4));id=`viewer-${Array.from(b).map(x=>x.toString(16)).join('')}`;}try{localStorage.setItem('prime_viewer_id_v20',id);}catch(_e){}}
    return id;
  }

  function hostSnapshot(){
    const state=Prime.Store?.state,m=state?.match,s=Prime.Pitch?.getScene?.();
    const snap={
      score:m?{...m.score}:{A:0,B:0},gameSeconds:Number(m?.gameSeconds||0),minute:Number(m?.minute||0),
      secondHalf:Boolean(m?.secondHalf),waitingHalfTime:Boolean(m?.waitingHalfTime),finished:Boolean(m?.finished),
      poss:m?.poss||'A',cards:m?.cards||{A:{},B:{}},sentOff:m?.sentOff||{A:[],B:[]},
      firstHalfStoppage:Number(m?.firstHalfStoppage||0),secondHalfStoppage:Number(m?.secondHalfStoppage||0),
      firstHalfStoppageAnnounced:Boolean(m?.firstHalfStoppageAnnounced),secondHalfStoppageAnnounced:Boolean(m?.secondHalfStoppageAnnounced),
      events:(m?.events||[]).slice(-35).map(e=>({minute:e.minute,text:e.text,cls:e.cls,type:e.type}))
    };
    if(s){
      snap.players=(s.players||[]).map(p=>({key:p.key,id:String(p.id),x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,number:p.number,label:p.label,isKeeper:Boolean(p.isKeeper),yellowCards:Number(p.yellowCards||0),facing:p.facing||0}));
      if(s.ball)snap.ball={x:s.ball.x,y:s.ball.y,z:s.ball.z||0,rotation:s.ball.rotation||0,state:s.ball.state||'dead'};
      if(s.referee)snap.referee={x:s.referee.x,y:s.referee.y,card:s.referee.card||null,cardTime:s.referee.cardTime||0};
    }
    return snap;
  }
  function hostStats(){try{return Prime.MatchEngine?.getStats?.(Prime.Store.state)||Prime.Store.state.match?.stats||{};}catch(_e){return {};}}
  function hostStatus(){
    const st=Prime.Store?.state,m=st?.match;
    if(st?.screen===S?.END||m?.finished)return'finished';
    if(m?.waitingHalfTime)return'halftime';
    if(st?.screen===S?.MATCH&&m)return'live';
    return'lobby';
  }

  function renderHostCard(){
    if(watchCode)return;
    const state=Prime.Store?.state;if(!state||state.screen!==S?.PRE_GAME)return;
    const split=document.querySelector('.split-actions');if(!split||document.getElementById('publicMatchCard'))return;
    const saved=getStored();if(saved&&!liveSession)liveSession=saved;
    const box=document.createElement('div');box.id='publicMatchCard';box.className='panel public-match-card';
    box.innerHTML=`<div class="public-match-head"><div><span class="eyebrow">Partida compartilhada</span><h3>👁️ Convide pessoas para assistir ao vivo</h3><p class="muted">Crie a sala antes do PLAY. Quem receber o link assiste sem poder pausar ou alterar a partida e pode enviar palpites enquanto ela não começou.</p></div><span class="live-pill">LIVE</span></div><div id="publicMatchBody"></div>`;
    split.parentElement.insertBefore(box,split);
    updateHostCard();
  }
  function updateHostCard(){
    const root=document.getElementById('publicMatchBody');if(!root)return;
    if(!liveSession?.code){
      root.innerHTML=`<button id="createPublicMatch" class="btn btn-primary">🔗 Criar partida pública</button><small class="muted public-help">O link é somente para espectadores. Seus controles continuam privados.</small>`;
      document.getElementById('createPublicMatch').onclick=createPublicMatch;
      return;
    }
    const url=linkFor(liveSession.code);
    root.innerHTML=`<div class="share-row"><div class="share-code"><small>Código da sala</small><strong>${esc(liveSession.code)}</strong></div><input class="share-link" id="publicMatchLink" readonly value="${esc(url)}"><button id="copyPublicLink" class="btn btn-primary">Copiar link</button><button id="newPublicRoom" class="btn btn-ghost">Nova sala</button></div><p class="muted small">Palpites fecham automaticamente quando você apertar PLAY.</p>`;
    document.getElementById('copyPublicLink').onclick=async()=>{try{await navigator.clipboard.writeText(url);Prime.UI?.showToast?.('Link da partida copiado.','success','Partida pública');}catch(_e){document.getElementById('publicMatchLink').select();document.execCommand('copy');}};
    document.getElementById('newPublicRoom').onclick=()=>{storeSession(null);try{sessionStorage.removeItem('prime_live_host_v20');}catch(_e){}liveSession=null;updateHostCard();};
  }
  async function createPublicMatch(){
    const state=Prime.Store.state,btn=document.getElementById('createPublicMatch');if(btn){btn.disabled=true;btn.textContent='Criando sala...';}
    try{
      const data=await api({action:'create',seed:state.settings.seed,mode:state.mode,teamA:teamCopy(state.teams.A),teamB:teamCopy(state.teams.B),snapshot:hostSnapshot(),stats:{}});
      storeSession({code:data.code,hostToken:data.hostToken,id:data.id,started:false,finished:false});updateHostCard();
      Prime.UI?.showToast?.('Sala pública criada. Agora copie o link antes de iniciar.','success','Ao vivo');
    }catch(e){Prime.UI?.showToast?.(e.message,'error','Não foi possível criar a sala');if(btn){btn.disabled=false;btn.textContent='🔗 Criar partida pública';}}
  }

  async function pushHost(force){
    const state=Prime.Store?.state;if(!liveSession?.code||watchCode||!state)return;
    const now=Date.now(),status=hostStatus();
    const inLobby=state.screen===S?.PRE_GAME;
    const cadence=inLobby?2600:700;if(!force&&now-(inLobby?lastLobbyPush:lastPush)<cadence)return;
    if(pushing)return;pushing=true;if(inLobby)lastLobbyPush=now;else lastPush=now;
    try{
      await api({action:'update',code:liveSession.code,hostToken:liveSession.hostToken,status,
        predictionsOpen:status==='lobby',snapshot:hostSnapshot(),stats:hostStats(),teamA:teamCopy(state.teams.A),teamB:teamCopy(state.teams.B),
        firstHalfStoppage:state.match?.firstHalfStoppage,secondHalfStoppage:state.match?.secondHalfStoppage});
      if(status==='live'||status==='halftime')liveSession.started=true;
      if(status==='finished')liveSession.finished=true;
      storeSession(liveSession);
    }catch(e){if(force)Prime.UI?.showToast?.(e.message,'error','Transmissão');}
    finally{pushing=false;}
  }

  function watchLayout(row){
    const app=document.getElementById('app');if(!app)return;
    document.body.classList.add('spectator-mode');
    const progress=document.getElementById('progressRoot');if(progress)progress.innerHTML='';
    const seed=document.getElementById('seedChip');if(seed)seed.style.display='none';
    const home=document.getElementById('homeBtn');if(home)home.style.display='none';
    const a=row.team_a?.name||'Time A',b=row.team_b?.name||'Time B';
    app.innerHTML=`<section class="watch-screen"><div class="watch-top"><div><span class="live-pill">● AO VIVO</span><h1>${esc(a)} <span>×</span> ${esc(b)}</h1><p class="muted">Modo espectador · você não pode pausar nem interferir na partida.</p></div><div class="watch-code">Sala <strong>${esc(row.code)}</strong></div></div><div class="watch-score"><strong id="watchTeamA">${esc(a)}</strong><span id="watchScore">0 — 0</span><strong id="watchTeamB">${esc(b)}</strong><small id="watchClock">Pré-jogo</small></div><div class="watch-grid"><div class="watch-stage"><canvas id="watchPitch"></canvas><div id="watchStatus" class="watch-status">Aguardando o anfitrião iniciar...</div></div><aside class="watch-side"><div id="predictionPanel" class="panel prediction-panel"></div><div class="panel watch-stats" id="watchStats"></div><div class="panel watch-feed"><div class="watch-feed-head"><strong>Narração</strong><span>ao vivo</span></div><div id="watchFeed"></div></div></aside></div></section>`;
    renderPrediction(row);renderWatchStats(row.stats||{});renderWatchFeed(row.snapshot?.events||[]);
  }

  function predictionFields(row){
    return `<form id="predictionForm" class="prediction-form"><label>Seu nome<input id="predName" maxlength="40" placeholder="Torcedor"></label><label>Quem vence?<select id="predWinner"><option value="A">${esc(row.team_a?.name||'Time A')}</option><option value="DRAW">Empate</option><option value="B">${esc(row.team_b?.name||'Time B')}</option></select></label><div class="prediction-score"><label>Placar A<input id="predScoreA" type="number" min="0" max="15" value="1"></label><span>×</span><label>Placar B<input id="predScoreB" type="number" min="0" max="15" value="1"></label></div><div class="prediction-numbers"><label>Gols<input id="predGoals" type="number" min="0" max="20" value="2"></label><label>Amarelos<input id="predYellow" type="number" min="0" max="20" value="4"></label><label>Vermelhos<input id="predRed" type="number" min="0" max="10" value="0"></label><label>Chutes no gol<input id="predOnTarget" type="number" min="0" max="50" value="8"></label><label>Escanteios<input id="predCorners" type="number" min="0" max="30" value="6"></label><label>Laterais<input id="predThrowIns" type="number" min="0" max="50" value="14"></label></div><button class="btn btn-primary" type="submit">Enviar palpites</button><small>Acertos rendem pontos do Prime. A utilidade desses pontos poderá evoluir depois.</small></form>`;
  }
  function renderPrediction(row){
    const panel=document.getElementById('predictionPanel');if(!panel)return;
    if(row.status==='lobby'&&row.predictions_open){
      panel.innerHTML=`<span class="eyebrow">Prime Predictions</span><h3>🔮 Seus palpites</h3><p class="muted small">Envie antes da bola rolar.</p>${predictionFields(row)}`;
      document.getElementById('predictionForm').onsubmit=submitPrediction;
    }else{
      panel.innerHTML=`<span class="eyebrow">Prime Predictions</span><h3>🔒 Palpites encerrados</h3><p class="muted">A partida já começou. Seus pontos aparecem aqui quando o jogo terminar.</p><div id="predictionResult"></div>`;
      loadPrediction();
    }
  }
  async function submitPrediction(e){
    e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
    const val=id=>Number(document.getElementById(id).value||0);
    try{
      await api({action:'predict',code:watchCode,viewerId:viewerId(),viewerName:document.getElementById('predName').value||'Torcedor',picks:{winner:document.getElementById('predWinner').value,goals:val('predGoals'),yellowCards:val('predYellow'),redCards:val('predRed'),shotsOnTarget:val('predOnTarget'),corners:val('predCorners'),throwIns:val('predThrowIns'),scoreA:val('predScoreA'),scoreB:val('predScoreB')}});
      btn.textContent='✓ Palpites enviados';
    }catch(e2){btn.disabled=false;btn.textContent='Enviar palpites';alert(e2.message);}
  }
  async function loadPrediction(){
    try{const d=await api({action:'prediction',code:watchCode,viewerId:viewerId()});const el=document.getElementById('predictionResult');if(!el)return;if(d.prediction){el.innerHTML=`<div class="prediction-result"><span>Seu placar</span><strong>${Number(d.prediction.score||0)} pts</strong></div>`;}}catch(_e){}
  }

  function sum(o){return Number(o?.A||0)+Number(o?.B||0);}
  function renderWatchStats(st){
    const el=document.getElementById('watchStats');if(!el)return;
    el.innerHTML=`<span class="eyebrow">Estatísticas</span><div class="watch-stat-grid"><div><small>Chutes no gol</small><strong>${sum(st.onTarget)}</strong></div><div><small>Escanteios</small><strong>${sum(st.corners)}</strong></div><div><small>Laterais</small><strong>${sum(st.throwIns)}</strong></div><div><small>Amarelos</small><strong>${sum(st.yellow)}</strong></div><div><small>Vermelhos</small><strong>${sum(st.red)}</strong></div><div><small>Faltas</small><strong>${sum(st.fouls)}</strong></div></div>`;
  }
  function renderWatchFeed(events){
    const el=document.getElementById('watchFeed');if(!el)return;
    const list=(events||[]).slice(-14).reverse();el.innerHTML=list.length?list.map(e=>`<div class="watch-event ${esc(e.cls||'')}"><span>${esc(e.minute)}'</span><p>${esc(e.text)}</p></div>`).join(''):'<p class="muted small">A narração aparece quando a partida começar.</p>';
  }
  function clockText(snap,row){
    if(row.status==='lobby')return'Pré-jogo';
    if(row.status==='halftime')return'Intervalo';
    if(row.status==='finished')return'Encerrada';
    const sec=Math.max(0,Number(snap?.gameSeconds||0)),m=Math.floor(sec/60),s=Math.floor(sec%60).toString().padStart(2,'0');
    let extra='';if(!snap?.secondHalf&&snap?.firstHalfStoppageAnnounced)extra=` +${snap.firstHalfStoppage||row.first_half_stoppage||0}`;if(snap?.secondHalf&&snap?.secondHalfStoppageAnnounced)extra=` +${snap.secondHalfStoppage||row.second_half_stoppage||0}`;
    return `${String(m).padStart(2,'0')}:${s}${extra}`;
  }

  function ensureWatchPitch(row){
    const canvas=document.getElementById('watchPitch');if(!canvas)return null;
    const snap=row.snapshot||{};
    watchState=watchState||{mode:row.mode||'cpu',teams:{A:teamCopy(row.team_a),B:teamCopy(row.team_b)},settings:{cameraMode:'full'},match:{secondHalf:false,cards:{A:{},B:{}},sentOff:{A:[],B:[]},poss:'A'}};
    watchState.teams.A=teamCopy(row.team_a);watchState.teams.B=teamCopy(row.team_b);
    watchState.match=Object.assign(watchState.match||{}, {secondHalf:Boolean(snap.secondHalf),cards:snap.cards||{A:{},B:{}},sentOff:snap.sentOff||{A:[],B:[]},poss:snap.poss||'A'});
    if(!watchMounted){Prime.Pitch.mount(canvas,watchState,{cameraMode:'full'});Prime.Pitch.setCameraMode?.('full');watchMounted=true;}
    let sc=Prime.Pitch.getScene?.();if(!sc)return null;
    const incoming=new Set((snap.players||[]).map(p=>`${p.key}:${p.id}`));
    const current=new Set((sc.players||[]).map(p=>`${p.key}:${p.id}`));
    if(snap.players?.length&&([...incoming].some(k=>!current.has(k))||[...current].some(k=>!incoming.has(k)))){Prime.Pitch.refresh?.(watchState);sc=Prime.Pitch.getScene?.();}
    return sc;
  }
  function applyWatchRow(row){
    watchRow=row;if(!document.querySelector('.watch-screen'))watchLayout(row);
    const snap=row.snapshot||{},sc=ensureWatchPitch(row);
    document.getElementById('watchScore').textContent=`${Number(snap.score?.A||0)} — ${Number(snap.score?.B||0)}`;
    document.getElementById('watchClock').textContent=clockText(snap,row);
    const status=document.getElementById('watchStatus');if(status){status.textContent=row.status==='lobby'?'Aguardando o anfitrião iniciar...':row.status==='halftime'?'INTERVALO — aguardando o 2º tempo':row.status==='finished'?'FIM DE JOGO':'● TRANSMISSÃO AO VIVO';status.dataset.status=row.status;}
    if(sc&&snap.players){
      const by=new Map(snap.players.map(p=>[`${p.key}:${p.id}`,p]));for(const p of sc.players||[]){const x=by.get(`${p.key}:${p.id}`);if(x){p.x=x.x;p.y=x.y;p.tx=x.x;p.ty=x.y;p.vx=x.vx||0;p.vy=x.vy||0;p.yellowCards=x.yellowCards||0;p.facing=x.facing||0;}}
      if(snap.ball&&sc.ball)Object.assign(sc.ball,snap.ball,{vx:0,vy:0,vz:0});if(snap.referee&&sc.referee)Object.assign(sc.referee,snap.referee);
      Prime.Pitch.draw?.(sc);
    }
    renderWatchStats(row.stats||{});renderWatchFeed(snap.events||[]);
    const panel=document.getElementById('predictionPanel');if(panel){const open=row.status==='lobby'&&row.predictions_open;if(open&&!document.getElementById('predictionForm'))renderPrediction(row);if(!open&&document.getElementById('predictionForm'))renderPrediction(row);if(row.status==='finished')loadPrediction();}
  }
  async function startWatch(){
    try{
      const data=await api({action:'get',code:watchCode});applyWatchRow(data.match);
      if(window.supabase?.createClient){
        const client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:false}});
        channel=client.channel(`prime-watch-${watchCode}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_matches',filter:`code=eq.${watchCode}`},payload=>applyWatchRow(payload.new)).subscribe();
      }
      setInterval(async()=>{try{const d=await api({action:'get',code:watchCode});if(!watchRow||d.match.updated_at!==watchRow.updated_at)applyWatchRow(d.match);}catch(_e){}},2500);
    }catch(e){const app=document.getElementById('app');if(app)app.innerHTML=`<section class="screen"><div class="panel empty-state"><h2>Partida não encontrada</h2><p>${esc(e.message)}</p><a class="btn btn-primary" href="${esc(location.pathname)}">Ir ao menu</a></div></section>`;}
  }

  function loop(){
    if(!watchCode){renderHostCard();if(liveSession||getStored()){if(!liveSession)liveSession=getStored();pushHost(false);}}
    requestAnimationFrame(loop);
  }
  if(watchCode)setTimeout(startWatch,0);else{liveSession=getStored();requestAnimationFrame(loop);}
  Prime.LiveMatchV20=Object.freeze({create:createPublicMatch,push:()=>pushHost(true),watchCode});
})(window.Prime=window.Prime||{});