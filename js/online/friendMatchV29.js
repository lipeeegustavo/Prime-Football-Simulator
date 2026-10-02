(function(Prime){
  'use strict';
  const PROJECT_URL='https://fpduwcrjqgvxnlhyuyag.supabase.co';
  const PUBLIC_KEY='sb_publishable_39B4RWNx9R4SlXROyBxdiQ_jF1hCXeL';
  const TURN_SECONDS=30;
  const S=Prime.GameStates;
  const qs=new URLSearchParams(location.search);
  const joinCode=(qs.get('play')||'').trim().toUpperCase();
  let client=null,channel=null,room=null,role=null,isHost=false,lastFrame=0,lastRecordedGame=0,timerHandle=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const clone=v=>JSON.parse(JSON.stringify(v));

  function makeCode(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const a=new Uint32Array(6);crypto.getRandomValues(a);
    return Array.from(a,n=>chars[n%chars.length]).join('');
  }
  function gameBase(){return location.protocol==='file:'?'https://pied-phi.vercel.app':`${location.origin}${location.pathname}`;}
  function inviteUrl(code){return `${gameBase()}?play=${encodeURIComponent(code)}`;}
  function defaultTeam(name,formation){return Prime.Store.blankTeam(name,formation);}
  function blankRoom(code,format){
    return {version:29,code,format,createdAt:Date.now(),connected:{A:true,B:false},turn:'A',phase:'starters',deadline:Date.now()+TURN_SECONDS*1000,complete:false,
      progress:{A:{starters:0,bench:0,coach:0,penalties:0},B:{starters:0,bench:0,coach:0,penalties:0}},
      teams:{A:defaultTeam('Jogador 1','4-3-3'),B:defaultTeam('Jogador 2','4-2-3-1')},
      series:{format,game:1,wins:{A:0,B:0},aggregate:{A:0,B:0},history:[],finished:false},baseSeed:`ONLINE-${code}`};
  }
  function phaseLimit(p){return p==='starters'?11:p==='bench'?7:p==='coach'?1:5;}
  function phaseLabel(p){return ({starters:'Titulares',bench:'Banco',coach:'Técnico',penalties:'Pênaltis'})[p]||p;}
  function formatLabel(f){return ({single:'Partida única','two-leg':'Ida e volta',bo3:'Melhor de 3',bo5:'Melhor de 5'})[f]||f;}
  function teamUsedIds(){
    const used=new Set();
    ['A','B'].forEach(k=>{const t=room.teams[k];[...(t.starters||[]),...(t.bench||[])].filter(Boolean).forEach(id=>used.add(String(id)));});
    return used;
  }
  function coachUsedIds(){const s=new Set();['A','B'].forEach(k=>{if(room.teams[k].coach)s.add(String(room.teams[k].coach));});return s;}
  function eligiblePlayer(p,pos){return !pos||Prime.Squad.eligibleForPosition(p,pos);}
  function candidatesFor(k){
    if(!room)return[];
    const t=room.teams[k],pr=room.progress[k],used=teamUsedIds();
    if(room.phase==='coach')return Prime.COACHES.filter(c=>!coachUsedIds().has(String(c.id))).map(c=>({id:String(c.id),name:c.name,meta:c.style,score:c.attack+c.defense,type:'coach'}));
    if(room.phase==='penalties'){
      const chosen=new Set((t.penalties||[]).filter(Boolean).map(String));
      return (t.starters||[]).filter(Boolean).map(Prime.Squad.playerById).filter(Boolean).filter(p=>!chosen.has(String(p.id))).map(p=>({id:String(p.id),name:p.name,meta:p.positions.join(' / '),score:p.overall,type:'penalty'}));
    }
    const pos=room.phase==='starters'?Prime.FORMATIONS[t.formation][Math.min(10,pr.starters)]:null;
    return Prime.PLAYERS.filter(p=>!used.has(String(p.id))&&eligiblePlayer(p,pos)).slice().sort((a,b)=>b.overall-a.overall).map(p=>({id:String(p.id),name:p.name,meta:`${p.positions.join(' / ')} · OVR ${p.overall}`,score:p.overall,type:'player'}));
  }
  function validatePick(k,id){return candidatesFor(k).some(x=>String(x.id)===String(id));}
  function applyPick(k,id){
    if(!room||room.complete||k!==room.turn||!validatePick(k,id))return false;
    const t=room.teams[k],pr=room.progress[k];
    if(room.phase==='starters'){t.starters[pr.starters]=String(id);pr.starters++;}
    else if(room.phase==='bench'){t.bench[pr.bench]=String(id);pr.bench++;}
    else if(room.phase==='coach'){t.coach=String(id);pr.coach=1;}
    else if(room.phase==='penalties'){t.penalties[pr.penalties]=String(id);pr.penalties++;}
    advanceTurn();return true;
  }
  function advanceTurn(){
    const p=room.phase,limit=phaseLimit(p),doneA=room.progress.A[p]>=limit,doneB=room.progress.B[p]>=limit;
    if(doneA&&doneB){
      const order=['starters','bench','coach','penalties'],i=order.indexOf(p);
      if(i===order.length-1){room.complete=true;room.turn=null;room.deadline=0;finalizeDraft();return;}
      room.phase=order[i+1];room.turn='A';
    }else{
      const other=room.turn==='A'?'B':'A';
      room.turn=room.progress[other][p]<limit?other:room.turn;
      if(room.progress[room.turn][p]>=limit)room.turn=room.turn==='A'?'B':'A';
    }
    room.deadline=Date.now()+TURN_SECONDS*1000;
    broadcastSync();renderDraft();
  }
  function autoPick(){
    if(!isHost||!room||room.complete||Date.now()<room.deadline)return;
    const c=candidatesFor(room.turn)[0];if(c){applyPick(room.turn,c.id);broadcastSync();}
  }
  function send(payload){if(channel)channel.send({type:'broadcast',event:'friend',payload}).catch(()=>{});}
  function broadcastSync(){if(isHost&&room)send({type:'sync',room:clone(room)});}

  function connect(code,host){
    if(channel)return;
    if(!window.supabase?.createClient){Prime.UI?.showToast?.('Supabase não carregou.','error','Jogo online');return;}
    client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    channel=client.channel(`prime-friend-${code}`,{config:{broadcast:{self:false,ack:false},presence:{key:host?'host':'guest'}}});
    channel.on('broadcast',{event:'friend'},({payload})=>onMessage(payload));
    channel.on('presence',{event:'sync'},()=>{if(isHost&&room){const st=channel.presenceState();room.connected.B=Object.keys(st).some(k=>k==='guest');broadcastSync();renderDraft();}});
    channel.subscribe(status=>{if(status==='SUBSCRIBED'){channel.track({joinedAt:Date.now(),role:host?'A':'B'});if(!host)send({type:'hello'});}});
  }
  function onMessage(p){
    if(!p)return;
    if(isHost){
      if(p.type==='hello'){room.connected.B=true;broadcastSync();renderDraft();return;}
      if(p.type==='pick'&&p.team==='B'){if(room.turn==='B'&&applyPick('B',p.id))broadcastSync();return;}
      if(p.type==='remote-sub'&&Prime.Store.state.screen===S.MATCH){const res=Prime.MatchEngine.manualSub(Prime.Store.state,'B',Number(p.outIndex),Number(p.benchIndex));send({type:'remote-sub-result',ok:!!res?.ok,error:res?.error||''});return;}
      return;
    }
    if(p.type==='sync'&&p.room){room=p.room;role='B';renderDraftOrWaiting();return;}
    if(p.type==='match-start'){room=p.room||room;renderGuestMatch();return;}
    if(p.type==='frame'){receiveFrame(p.snapshot);return;}
    if(p.type==='series-update'){if(room)room.series=p.series;renderFriendSeriesPanel();return;}
    if(p.type==='remote-sub-result')Prime.UI?.showToast?.(p.ok?'Substituição realizada.':p.error||'Não foi possível substituir.',p.ok?'success':'error','Jogo online');
  }

  function createHostRoom(format){
    const code=makeCode();isHost=true;role='A';room=blankRoom(code,format);connect(code,true);renderDraft();startTimer();
  }
  function joinRoom(code){isHost=false;role='B';connect(code,false);renderConnecting();startTimer();}
  function startTimer(){if(timerHandle)return;timerHandle=setInterval(()=>{autoPick();updateTimerText();if(isHost&&Prime.Store?.state?.screen===S.MATCH)sendHostFrame();if(isHost)recordSeriesIfNeeded();},200);}

  function renderConnecting(){
    const app=document.getElementById('app');if(!app)return;
    document.body.classList.add('friend-online-mode');
    app.innerHTML=`<section class="friend-shell"><div class="panel friend-wait"><span class="eyebrow">Jogo online</span><h2>Entrando na sala ${esc(joinCode)}</h2><p class="muted">Conectando ao anfitrião...</p><div class="friend-spinner"></div></div></section>`;
  }
  function formatCards(){return `<div class="friend-format-grid">${[['single','⚽','Partida única','Um jogo, vencedor definido no fim.'],['two-leg','↔️','Ida e volta','Duas partidas, placar agregado.'],['bo3','3️⃣','Melhor de 3','Primeiro a vencer duas partidas.'],['bo5','5️⃣','Melhor de 5','Primeiro a vencer três partidas.']].map(x=>`<button class="friend-format" data-format="${x[0]}"><span>${x[1]}</span><strong>${x[2]}</strong><small>${x[3]}</small></button>`).join('')}</div>`;}
  function openCreateDialog(){
    let d=document.getElementById('friendCreateDialog');if(!d){d=document.createElement('dialog');d.id='friendCreateDialog';d.className='game-dialog';document.body.appendChild(d);}
    d.innerHTML=`<div class="dialog-card friend-create"><div class="dialog-heading"><div><span class="eyebrow">Jogar com amigo</span><h3>Escolha o formato</h3></div><button class="icon-btn" id="friendClose">×</button></div>${formatCards()}<p class="muted small">Cada escolha terá ${TURN_SECONDS}s. O draft alterna jogador por jogador, incluindo titulares, banco, técnico e cobradores.</p></div>`;
    d.querySelector('#friendClose').onclick=()=>d.close();d.querySelectorAll('.friend-format').forEach(b=>b.onclick=()=>{const f=b.dataset.format;d.close();createHostRoom(f);});d.showModal();
  }
  function injectModeCard(){
    if(joinCode||room)return;
    const grid=document.querySelector('.mode-grid');if(!grid||document.getElementById('friendModeCard'))return;
    const card=document.createElement('article');card.id='friendModeCard';card.className='panel mode-card friend-mode-card';
    card.innerHTML=`<div><span class="mode-icon">🌐</span><h3>Jogar com um amigo</h3><p>Crie uma sala, envie o link e façam o draft alternado em tempo real.</p></div><button class="btn btn-primary" id="friendModeBtn">Criar partida online</button>`;
    grid.insertBefore(card,grid.children[2]||null);card.querySelector('#friendModeBtn').onclick=openCreateDialog;
  }

  function currentRequirement(k){
    if(!room)return'';const pr=room.progress[k],t=room.teams[k];
    if(room.phase==='starters')return Prime.FORMATIONS[t.formation][Math.min(10,pr.starters)]||'—';
    if(room.phase==='bench')return `Reserva ${Math.min(7,pr.bench+1)}`;
    if(room.phase==='coach')return'Técnico';
    return `Cobrador ${Math.min(5,pr.penalties+1)}`;
  }
  function pickedList(k){
    const t=room.teams[k];
    if(room.phase==='coach')return t.coach?Prime.Squad.coachById(t.coach)?.name||'Técnico escolhido':'—';
    if(room.phase==='penalties')return (t.penalties||[]).filter(Boolean).map(id=>Prime.Squad.surname(Prime.Squad.playerById(id)?.name||'')).join(' · ')||'—';
    const ids=room.phase==='starters'?t.starters:t.bench;return ids.filter(Boolean).map(id=>Prime.Squad.surname(Prime.Squad.playerById(id)?.name||'')).join(' · ')||'—';
  }
  function renderDraft(){
    if(!room)return;const app=document.getElementById('app');if(!app)return;
    document.body.classList.add('friend-online-mode');
    if(room.complete){renderDraftOrWaiting();return;}
    const myTurn=room.turn===role,cands=candidatesFor(room.turn);
    app.innerHTML=`<section class="friend-shell"><div class="friend-top panel"><div><span class="eyebrow">Sala ${esc(room.code)} · ${esc(formatLabel(room.format))}</span><h2>Draft online</h2><p class="muted">Um por vez. O mesmo jogador não pode aparecer nos dois times.</p></div><div class="friend-invite"><span class="friend-status ${room.connected.B?'online':''}">${room.connected.B?'● Amigo conectado':'○ Aguardando amigo'}</span>${isHost?`<button class="btn btn-ghost btn-small" id="copyFriendLink">🔗 Copiar convite</button>`:''}</div></div><div class="friend-draft-score"><div class="friend-team ${room.turn==='A'?'active':''}"><span>Time A</span><strong>${esc(room.teams.A.name)}</strong><small>${esc(pickedList('A'))}</small></div><div class="friend-turn"><span>${esc(phaseLabel(room.phase))}</span><strong>${esc(currentRequirement(room.turn))}</strong><div class="friend-timer"><i id="friendTimerBar"></i></div><b id="friendTimerText">${TURN_SECONDS}s</b></div><div class="friend-team b ${room.turn==='B'?'active':''}"><span>Time B</span><strong>${esc(room.teams.B.name)}</strong><small>${esc(pickedList('B'))}</small></div></div><div class="panel friend-pick-panel"><div class="friend-pick-head"><div><span class="eyebrow">${myTurn?'Sua vez':'Vez do adversário'}</span><h3>${esc(room.turn==='A'?room.teams.A.name:room.teams.B.name)} escolhe ${esc(currentRequirement(room.turn))}</h3></div><input id="friendSearch" placeholder="Buscar..." ${myTurn?'':'disabled'}></div><div class="friend-candidates" id="friendCandidates">${cands.map(c=>`<button class="friend-candidate" data-id="${esc(c.id)}" ${myTurn?'':'disabled'}><span class="friend-ovr">${esc(c.score)}</span><span><strong>${esc(c.name)}</strong><small>${esc(c.meta)}</small></span></button>`).join('')}</div></div><div class="friend-progress panel">${['starters','bench','coach','penalties'].map(p=>`<div><span>${phaseLabel(p)}</span><strong>${room.progress.A[p]}/${phaseLimit(p)} · ${room.progress.B[p]}/${phaseLimit(p)}</strong></div>`).join('')}</div></section>`;
    if(isHost){const b=document.getElementById('copyFriendLink');if(b)b.onclick=copyInvite;}
    const search=document.getElementById('friendSearch');if(search)search.oninput=()=>filterCandidates(search.value);
    document.querySelectorAll('.friend-candidate').forEach(b=>b.onclick=()=>submitPick(b.dataset.id));updateTimerText();
  }
  function filterCandidates(q){q=String(q||'').toLowerCase();document.querySelectorAll('.friend-candidate').forEach(el=>{el.hidden=!el.textContent.toLowerCase().includes(q);});}
  async function copyInvite(){const url=inviteUrl(room.code);try{await navigator.clipboard.writeText(url);Prime.UI?.showToast?.('Link para jogar com seu amigo copiado.','success','Jogo online');}catch(_e){prompt('Copie o link:',url);}}
  function submitPick(id){if(!room||room.turn!==role)return;if(isHost){if(applyPick('A',id))broadcastSync();}else send({type:'pick',team:'B',id:String(id)});}
  function updateTimerText(){
    if(!room||room.complete)return;const left=Math.max(0,(room.deadline-Date.now())/1000),txt=document.getElementById('friendTimerText'),bar=document.getElementById('friendTimerBar');if(txt)txt.textContent=`${Math.ceil(left)}s`;if(bar)bar.style.width=`${Math.max(0,Math.min(100,left/TURN_SECONDS*100))}%`;
  }
  function renderDraftOrWaiting(){
    if(!room)return;if(!room.complete){renderDraft();return;}if(isHost){applyDraftToHost();return;}
    const app=document.getElementById('app');if(!app)return;app.innerHTML=`<section class="friend-shell"><div class="panel friend-wait"><span class="eyebrow">Draft concluído</span><h2>Times prontos ⚽</h2><p class="muted">Aguardando o anfitrião iniciar a partida.</p><div class="friend-series-summary">${esc(formatLabel(room.format))} · Jogo ${room.series.game}</div></div></section>`;
  }
  function applyDraftToHost(){
    if(!isHost||!room?.complete)return;const st=Prime.Store.state;
    st.mode='friend';st.teams=clone(room.teams);st.settings.seed=`${room.baseSeed}-G${room.series.game}`;st.settings.friendSeries=clone(room.series);st.match=null;st.lastResult=null;st.screen=S.PRE_GAME;Prime.Store.resetBuilderUi();Prime.Store.notify('screen');broadcastSync();
  }
  function finalizeDraft(){broadcastSync();renderDraftOrWaiting();}

  function snapshot(){
    const st=Prime.Store.state,m=st.match,s=Prime.Pitch?.getScene?.();if(!m||!s)return null;
    return {gameSeconds:m.gameSeconds,minute:m.minute,score:clone(m.score),secondHalf:!!m.secondHalf,waitingHalfTime:!!m.waitingHalfTime,finished:!!m.finished,stats:Prime.MatchEngine?.getStats?.(st)||null,events:(m.events||[]).slice(-12),teams:clone(st.teams),players:(s.players||[]).map(p=>({k:p.key,i:String(p.id),x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,f:p.facing||0})),ball:s.ball?{x:s.ball.x,y:s.ball.y,z:s.ball.z||0,r:s.ball.rotation||0,state:s.ball.state}:null,referee:s.referee?{x:s.referee.x,y:s.referee.y}:null};
  }
  function sendHostFrame(){
    const now=performance.now();if(now-lastFrame<100)return;lastFrame=now;const st=Prime.Store.state;if(st.mode!=='friend'||st.screen!==S.MATCH)return;const snap=snapshot();if(snap)send({type:'frame',snapshot:snap});
  }
  function notifyMatchStart(){if(isHost&&room){send({type:'match-start',room:clone(room)});}}
  function renderGuestMatch(){
    if(isHost||!room)return;const app=document.getElementById('app');if(!app)return;document.body.classList.add('friend-match-guest');
    Prime.Store.state.mode='friend';Prime.Store.state.teams=clone(room.teams);Prime.Store.state.match={score:{A:0,B:0},gameSeconds:0,minute:0,secondHalf:false,stats:{}};
    app.innerHTML=`<section class="friend-guest-match"><div class="scoreboard"><div class="score-team"><span class="team-dot"></span><span>${esc(room.teams.A.name)}</span></div><div class="score-center"><div class="score-value" id="friendGuestScore">0 – 0</div><div class="match-clock" id="friendGuestClock">00:00</div><div class="half-label" id="friendGuestHalf">1º tempo</div></div><div class="score-team b"><span>${esc(room.teams.B.name)}</span><span class="team-dot"></span></div></div><div class="stadium-card"><div class="pitch-stage"><canvas id="friendGuestCanvas" class="pitch-canvas"></canvas><div class="friend-live-badge">● ONLINE · você é o Time B</div></div><div class="match-controls"><button id="friendRemoteSub" class="btn btn-ghost">🔁 Substituição</button><span class="muted small">A simulação é comandada pelo anfitrião; seu time e suas decisões ficam sincronizados.</span></div><div class="stat-strip"><div class="mini-stat"><strong id="friendPoss">50% – 50%</strong><small>posse</small></div><div class="mini-stat"><strong id="friendShots">0 – 0</strong><small>chutes</small></div><div class="mini-stat"><strong id="friendTarget">0 – 0</strong><small>no gol</small></div></div></div></section>`;
    Prime.Pitch.mount(document.getElementById('friendGuestCanvas'),Prime.Store.state,{cameraMode:'full'});document.getElementById('friendRemoteSub').onclick=openRemoteSub;
  }
  function receiveFrame(snap){
    if(isHost||!snap)return;if(!document.getElementById('friendGuestCanvas'))renderGuestMatch();const st=Prime.Store.state;st.teams=clone(snap.teams||st.teams);st.match=Object.assign(st.match||{},snap);
    const sc=Prime.Pitch?.getScene?.();if(sc){
      for(const p of sc.players||[]){const x=snap.players?.find(z=>z.k===p.key&&String(z.i)===String(p.id));if(x){p.x=x.x;p.y=x.y;p.tx=x.x;p.ty=x.y;p.vx=x.vx;p.vy=x.vy;p.facing=x.f;}}
      if(sc.ball&&snap.ball)Object.assign(sc.ball,{x:snap.ball.x,y:snap.ball.y,z:snap.ball.z,rotation:snap.ball.r,state:snap.ball.state,vx:0,vy:0,vz:0});if(sc.referee&&snap.referee)Object.assign(sc.referee,snap.referee);Prime.Pitch.draw?.(sc);
    }
    const score=document.getElementById('friendGuestScore');if(score)score.textContent=`${snap.score?.A||0} – ${snap.score?.B||0}`;const sec=Math.max(0,Number(snap.gameSeconds||0)),clock=document.getElementById('friendGuestClock');if(clock)clock.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(Math.floor(sec%60)).padStart(2,'0')}`;const half=document.getElementById('friendGuestHalf');if(half)half.textContent=snap.secondHalf?'2º tempo':'1º tempo';const stt=snap.stats||{};if(document.getElementById('friendPoss'))document.getElementById('friendPoss').textContent=`${stt.possession?.A??50}% – ${stt.possession?.B??50}%`;if(document.getElementById('friendShots'))document.getElementById('friendShots').textContent=`${stt.shots?.A??0} – ${stt.shots?.B??0}`;if(document.getElementById('friendTarget'))document.getElementById('friendTarget').textContent=`${stt.onTarget?.A??0} – ${stt.onTarget?.B??0}`;
    if(snap.finished)renderGuestFinished(snap);
  }
  function openRemoteSub(){
    const t=Prime.Store.state.teams.B,moves=Prime.Squad.compatibleBenchMoves('B');if(!moves.length){Prime.UI?.showToast?.('Sem substituições compatíveis.','error');return;}
    let d=document.getElementById('friendSubDialog');if(!d){d=document.createElement('dialog');d.id='friendSubDialog';d.className='game-dialog';document.body.appendChild(d);}
    d.innerHTML=`<div class="dialog-card"><div class="dialog-heading"><div><span class="eyebrow">Seu time</span><h3>Substituição online</h3></div><button class="icon-btn" id="friendSubClose">×</button></div><div class="friend-sub-list">${moves.map((mv,i)=>{const out=Prime.Squad.playerById(t.starters[mv.outIndex]),inn=Prime.Squad.playerById(t.bench[mv.benchIndex]);return `<button class="friend-sub-choice" data-o="${mv.outIndex}" data-b="${mv.benchIndex}"><span>Sai <strong>${esc(out?.name||'')}</strong></span><span>Entra <strong>${esc(inn?.name||'')}</strong></span></button>`;}).join('')}</div></div>`;d.querySelector('#friendSubClose').onclick=()=>d.close();d.querySelectorAll('.friend-sub-choice').forEach(b=>b.onclick=()=>{send({type:'remote-sub',outIndex:Number(b.dataset.o),benchIndex:Number(b.dataset.b)});d.close();});d.showModal();
  }
  function renderGuestFinished(snap){const app=document.getElementById('app');if(!app)return;app.innerHTML=`<section class="friend-shell"><div class="panel friend-wait"><span class="eyebrow">Fim da partida online</span><h2>${esc(room.teams.A.name)} ${snap.score.A} – ${snap.score.B} ${esc(room.teams.B.name)}</h2><p class="muted">Aguardando o anfitrião confirmar o próximo passo da série.</p></div></section>`;}

  function regulationDecision(state){
    if(!isHost||state.mode!=='friend'||!room||room.series.format!=='two-leg')return null;
    if(room.series.game===1)return {finishNoShootout:true};
    if(room.series.game===2){const a=room.series.aggregate.A+Number(state.match?.score?.A||0),b=room.series.aggregate.B+Number(state.match?.score?.B||0);return a===b?{forceShootout:true}:{finishNoShootout:true};}
    return null;
  }
  function winnerOfResult(r){if(r?.shootout&&r.shootout.A!==r.shootout.B)return r.shootout.A>r.shootout.B?'A':'B';if(r?.score?.A!==r?.score?.B)return r.score.A>r.score.B?'A':'B';return null;}
  function seriesDone(){if(!room)return false;const s=room.series;if(s.format==='single')return s.game>=1&&s.history.length>=1;if(s.format==='two-leg')return s.history.length>=2;if(s.format==='bo3')return s.wins.A>=2||s.wins.B>=2;if(s.format==='bo5')return s.wins.A>=3||s.wins.B>=3;return false;}
  function recordSeriesIfNeeded(){
    if(!isHost||!room||Prime.Store.state.mode!=='friend'||Prime.Store.state.screen!==S.END||!Prime.Store.state.lastResult)return;if(lastRecordedGame===room.series.game)return;
    const r=Prime.Store.state.lastResult,w=winnerOfResult(r);room.series.history.push({game:room.series.game,score:clone(r.score),shootout:r.shootout?clone(r.shootout):null,winner:w});room.series.aggregate.A+=Number(r.score.A||0);room.series.aggregate.B+=Number(r.score.B||0);if(w)room.series.wins[w]++;room.series.finished=seriesDone();lastRecordedGame=room.series.game;Prime.Store.state.settings.friendSeries=clone(room.series);send({type:'series-update',series:clone(room.series)});renderFriendSeriesPanel();
  }
  function seriesWinner(){const s=room.series;if(s.format==='two-leg'){if(s.aggregate.A!==s.aggregate.B)return s.aggregate.A>s.aggregate.B?'A':'B';const last=s.history[s.history.length-1];return last?.winner||null;}return s.wins.A===s.wins.B?null:(s.wins.A>s.wins.B?'A':'B');}
  function renderFriendSeriesPanel(){
    if(!isHost||!room||Prime.Store.state.screen!==S.END)return;const target=document.querySelector('.result-card .action-row');if(!target||document.getElementById('friendSeriesPanel'))return;const s=room.series,w=seriesWinner();const box=document.createElement('div');box.id='friendSeriesPanel';box.className='friend-series-panel';box.innerHTML=`<span class="eyebrow">${esc(formatLabel(s.format))}</span><h3>${s.finished?(w?`${esc(room.teams[w].name)} vence a série`:'Série encerrada'):`Jogo ${s.game} concluído`}</h3><div class="friend-series-numbers"><span>Vitórias ${s.wins.A} – ${s.wins.B}</span>${s.format==='two-leg'?`<span>Agregado ${s.aggregate.A} – ${s.aggregate.B}</span>`:''}</div>${!s.finished?'<button id="friendNextGame" class="btn btn-primary">Próxima partida →</button>':''}`;target.parentElement.insertBefore(box,target);const n=document.getElementById('friendNextGame');if(n)n.onclick=nextSeriesGame;
  }
  function nextSeriesGame(){
    if(!room||room.series.finished)return;room.series.game++;lastRecordedGame=0;Prime.Store.state.settings.seed=`${room.baseSeed}-G${room.series.game}`;Prime.Store.state.settings.friendSeries=clone(room.series);Prime.Store.prepareRematch();send({type:'series-update',series:clone(room.series)});send({type:'sync',room:clone(room)});
  }

  function observe(){
    const mo=new MutationObserver(()=>{injectModeCard();if(isHost&&room&&Prime.Store.state.screen===S.END)renderFriendSeriesPanel();});mo.observe(document.documentElement,{childList:true,subtree:true});injectModeCard();
    Prime.Store.subscribe((st,reason)=>{if(!isHost||!room)return;if(st.mode==='friend'&&st.screen===S.MATCH&&reason==='screen')notifyMatchStart();if(st.mode==='friend'&&st.screen===S.END)setTimeout(recordSeriesIfNeeded,30);});
  }
  function init(){observe();startTimer();if(joinCode)joinRoom(joinCode);}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  Prime.FriendMatchV29=Object.freeze({enabled:true,getRoom:()=>room,isHost:()=>isHost,regulationDecision,inviteUrl:()=>room?inviteUrl(room.code):'',formatLabel});
})(window.Prime=window.Prime||{});
