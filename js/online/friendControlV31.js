(function(Prime){
'use strict';
const PROJECT_URL='https://fpduwcrjqgvxnlhyuyag.supabase.co';
const PUBLIC_KEY='sb_publishable_39B4RWNx9R4SlXROyBxdiQ_jF1hCXeL';
const TURN_SECONDS=30;
const WAITING_DEADLINE=Number.MAX_SAFE_INTEGER;
const HALF_WAIT_MS=20000;
const STYLES={balanced:'Equilibrado',possession:'Posse de bola',counter:'Contra-ataque',press:'Pressão alta'};
let client=null,channel=null,activeCode='',smoothTarget=null,lastSmoothSent=0;
let halfState={active:false,A:false,B:false,firstReadyAt:0};
let raf=0,drawGuardInstalled=false;
const displayPlayers=new Map();
let displayBall=null,displayRef=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function room(){return Prime.FriendMatchV29?.getRoom?.()||null;}
function isHost(){return !!Prime.FriendMatchV29?.isHost?.();}
function myTeam(){return isHost()?'A':'B';}
function send(payload){if(channel)channel.send({type:'broadcast',event:'v31',payload}).catch(()=>{});}
function noDraftPicks(r){if(!r?.progress)return false;return ['A','B'].every(k=>Object.values(r.progress[k]||{}).every(v=>Number(v||0)===0));}
function styleOf(team){return team?.playStyle&&STYLES[team.playStyle]?team.playStyle:'balanced';}
function ensureSetup(r){
  if(!r.v31Setup)r.v31Setup={started:false,A:{ready:false,name:r.teams.A.name,formation:r.teams.A.formation,style:styleOf(r.teams.A)},B:{ready:false,name:r.teams.B.name,formation:r.teams.B.formation,style:styleOf(r.teams.B)}};
  return r.v31Setup;
}
function setupPending(r){return !!(r&&r.connected?.B&&!r.complete&&noDraftPicks(r)&&!ensureSetup(r).started);}
function formationOptions(selected){return Object.keys(Prime.FORMATIONS||{}).map(f=>`<option value="${esc(f)}" ${f===selected?'selected':''}>${esc(f)}</option>`).join('');}
function styleOptions(selected){return Object.entries(STYLES).map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');}
function connectV31(){
  const r=room();if(!r||activeCode===r.code||!window.supabase?.createClient)return;
  activeCode=r.code;client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  channel=client.channel(`prime-friend-v31-${r.code}`,{config:{broadcast:{self:false,ack:false}}});
  channel.on('broadcast',{event:'v31'},({payload})=>onMessage(payload));
  channel.subscribe(status=>{if(status==='SUBSCRIBED'&&!isHost())send({type:'v31-hello'});});
}
function broadcastSetup(){const r=room();if(isHost()&&r)send({type:'setup-state',setup:r.v31Setup,teams:r.teams,deadline:r.deadline});}
function applyTeamSetup(team,name,formation,style){
  const r=room(),s=ensureSetup(r);style=STYLES[style]?style:'balanced';
  s[team]={ready:true,name,formation,style};r.teams[team].name=name;r.teams[team].formation=formation;r.teams[team].playStyle=style;
}
function submitSetup(team,name,formation,style){
  const r=room();if(!r||!Prime.FORMATIONS?.[formation])return;
  name=String(name||'').trim().slice(0,28)||`Jogador ${team==='A'?1:2}`;style=STYLES[style]?style:'balanced';
  if(isHost()){applyTeamSetup(team,name,formation,style);maybeStartDraft();broadcastSetup();renderSetup();}
  else send({type:'setup-submit',team:'B',name,formation,style});
}
function maybeStartDraft(){
  const r=room();if(!isHost()||!r)return;const s=ensureSetup(r);
  if(s.A.ready&&s.B.ready&&!s.started){s.started=true;r.deadline=Date.now()+TURN_SECONDS*1000;broadcastSetup();Prime.UI?.showToast?.('Os dois times estão prontos. Começou o draft!','success','Jogo online');}
}
function hostControlState(){
  const st=Prime.Store?.state,m=st?.match;return {paused:!!m?.paused,speed:Number(m?.speedFactor||st?.settings?.speedFactor||1)};
}
function broadcastControlState(){if(isHost())send({type:'control-state',state:hostControlState()});}
function onMessage(p){
  if(!p)return;const r=room();
  if(isHost()){
    if(p.type==='v31-hello'){broadcastSetup();broadcastControlState();if(halfState.active)broadcastHalf();return;}
    if(p.type==='setup-submit'&&p.team==='B'&&r){const s=ensureSetup(r);if(!s.started&&Prime.FORMATIONS?.[p.formation]){const name=String(p.name||'Jogador 2').trim().slice(0,28)||'Jogador 2';applyTeamSetup('B',name,p.formation,p.style);maybeStartDraft();broadcastSetup();renderSetup();}return;}
    if(p.type==='half-ready'&&p.team==='B'){markHalfReady('B');return;}
    if(p.type==='remote-pause'){
      const st=Prime.Store?.state;if(st?.mode==='friend'&&st.screen===Prime.GameStates.MATCH&&st.match&&!st.match.waitingHalfTime&&!st.match.pendingPenalty){Prime.MatchEngine?.togglePause?.(st);broadcastControlState();}
      return;
    }
    if(p.type==='remote-speed'){
      const st=Prime.Store?.state,n=Number(p.speed);if(st?.mode==='friend'&&st.screen===Prime.GameStates.MATCH&&[1,2,4].includes(n)){Prime.MatchEngine?.setSpeed?.(st,n);broadcastControlState();}
      return;
    }
    return;
  }
  if(p.type==='setup-state'&&r){r.v31Setup=p.setup;r.deadline=p.deadline;if(p.teams){for(const k of ['A','B']){r.teams[k].name=p.teams[k].name;r.teams[k].formation=p.teams[k].formation;r.teams[k].playStyle=p.teams[k].playStyle||'balanced';}}renderSetup();return;}
  if(p.type==='smooth-frame'){smoothTarget=p.snapshot||null;updateGuestControls({paused:!!p.snapshot?.paused,speed:Number(p.snapshot?.speed||1)});return;}
  if(p.type==='pause-state'){updateGuestControls({paused:!!p.paused});return;}
  if(p.type==='control-state'){updateGuestControls(p.state||{});return;}
  if(p.type==='half-state'){halfState=p.half||halfState;renderGuestHalfTime();return;}
  if(p.type==='half-start'){halfState={active:false,A:false,B:false,firstReadyAt:0};removeGuestHalfTime();return;}
}
function renderSetup(){
  const r=room();if(!r||!r.connected?.B||!noDraftPicks(r))return;
  const s=ensureSetup(r);if(s.started){document.getElementById('friendV31Setup')?.remove();return;}
  r.deadline=WAITING_DEADLINE;
  let box=document.getElementById('friendV31Setup');
  if(!box){box=document.createElement('section');box.id='friendV31Setup';box.className='friend-v31-setup';const anchor=document.querySelector('.friend-draft-score');if(anchor)anchor.insertAdjacentElement('afterend',box);else return;}
  const mine=s[myTeam()],other=s[myTeam()==='A'?'B':'A'];
  box.innerHTML=`<span class="eyebrow">Antes do draft</span><h3>Configure o seu time</h3><p class="muted small">Cada jogador escolhe o próprio nome, formação e estilo. O draft só começa quando os dois confirmarem.</p><div class="friend-v31-setup-grid"><label>Nome do time<input id="friendV31Name" maxlength="28" value="${esc(mine.name)}" ${mine.ready?'disabled':''}></label><label>Formação<select id="friendV31Formation" ${mine.ready?'disabled':''}>${formationOptions(mine.formation)}</select></label><label>Modo de jogo<select id="friendV31Style" ${mine.ready?'disabled':''}>${styleOptions(mine.style||'balanced')}</select></label><button id="friendV31Ready" class="btn btn-primary" ${mine.ready?'disabled':''}>${mine.ready?'✓ Pronto':'Confirmar time'}</button></div><div class="friend-v31-ready"><b class="${s.A.ready?'ready':''}">Time A ${s.A.ready?'✓':'…'}</b><span>•</span><b class="${s.B.ready?'ready':''}">Time B ${s.B.ready?'✓':'…'}</b>${mine.ready&&!other.ready?'<span class="friend-v31-waiting-note">Aguardando o outro jogador…</span>':''}</div>`;
  const btn=document.getElementById('friendV31Ready');if(btn&&!mine.ready)btn.onclick=()=>submitSetup(myTeam(),document.getElementById('friendV31Name').value,document.getElementById('friendV31Formation').value,document.getElementById('friendV31Style').value);
  document.querySelectorAll('.friend-candidate,#friendSearch').forEach(el=>{el.disabled=true;el.classList.add('friend-v31-locked');});
  const t=document.getElementById('friendTimerText');if(t)t.textContent='CONFIGURAÇÃO';const bar=document.getElementById('friendTimerBar');if(bar)bar.style.width='100%';
}
function enforceSetupGate(){const r=room();if(!r)return;connectV31();if(setupPending(r)){r.deadline=WAITING_DEADLINE;renderSetup();}else if(r.v31Setup?.started)document.getElementById('friendV31Setup')?.remove();}
function snapshotSmooth(){
  const st=Prime.Store?.state,s=Prime.Pitch?.getScene?.();if(!st||st.mode!=='friend'||st.screen!==Prime.GameStates.MATCH||!s)return null;
  return {players:(s.players||[]).map(p=>({k:p.key,i:String(p.id),x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,f:p.facing||0})),ball:s.ball?{x:s.ball.x,y:s.ball.y,z:s.ball.z||0,r:s.ball.rotation||0,state:s.ball.state}:null,referee:s.referee?{x:s.referee.x,y:s.referee.y}:null,waitingHalfTime:!!st.match?.waitingHalfTime,paused:!!st.match?.paused,speed:Number(st.match?.speedFactor||st.settings?.speedFactor||1)};
}
function sendSmoothFrame(){if(!isHost()||!channel)return;const now=performance.now();if(now-lastSmoothSent<40)return;lastSmoothSent=now;const s=snapshotSmooth();if(s)send({type:'smooth-frame',snapshot:s});}
function applyDisplayState(sc){
  if(!sc)return;
  for(const p of sc.players||[]){const d=displayPlayers.get(`${p.key}:${p.id}`);if(d){p.x=d.x;p.y=d.y;}}
  if(sc.ball&&displayBall)Object.assign(sc.ball,{x:displayBall.x,y:displayBall.y,z:displayBall.z});
  if(sc.referee&&displayRef)Object.assign(sc.referee,{x:displayRef.x,y:displayRef.y});
}
function installGuestDrawGuard(){
  if(drawGuardInstalled||!Prime.Pitch?.draw)return;drawGuardInstalled=true;
  const rawDraw=Prime.Pitch.draw.bind(Prime.Pitch);
  Prime.Pitch.draw=function(sc){if(!isHost()&&document.body.classList.contains('friend-match-guest'))applyDisplayState(sc||Prime.Pitch?.getScene?.());return rawDraw(sc);};
}
function smoothGuest(){
  if(!isHost()&&smoothTarget&&document.body.classList.contains('friend-match-guest')){
    const sc=Prime.Pitch?.getScene?.();if(sc){
      const alpha=.18;
      for(const p of sc.players||[]){
        const target=smoothTarget.players?.find(x=>x.k===p.key&&String(x.i)===String(p.id));if(!target)continue;
        const id=`${p.key}:${p.id}`;let d=displayPlayers.get(id);if(!d){d={x:p.x,y:p.y};displayPlayers.set(id,d);}
        const dx=target.x-d.x,dy=target.y-d.y;if(Math.hypot(dx,dy)>13){d.x=target.x;d.y=target.y;}else{d.x+=dx*alpha;d.y+=dy*alpha;}
        p.x=d.x;p.y=d.y;p.tx=target.x;p.ty=target.y;p.vx=target.vx;p.vy=target.vy;p.facing=target.f;
      }
      if(sc.ball&&smoothTarget.ball){if(!displayBall)displayBall={x:sc.ball.x,y:sc.ball.y,z:sc.ball.z||0};const dx=smoothTarget.ball.x-displayBall.x,dy=smoothTarget.ball.y-displayBall.y;if(Math.hypot(dx,dy)>16){displayBall.x=smoothTarget.ball.x;displayBall.y=smoothTarget.ball.y;}else{displayBall.x+=dx*.22;displayBall.y+=dy*.22;}displayBall.z+=(smoothTarget.ball.z-displayBall.z)*.24;Object.assign(sc.ball,{x:displayBall.x,y:displayBall.y,z:displayBall.z,rotation:smoothTarget.ball.r,state:smoothTarget.ball.state});}
      if(sc.referee&&smoothTarget.referee){if(!displayRef)displayRef={x:sc.referee.x,y:sc.referee.y};displayRef.x+=(smoothTarget.referee.x-displayRef.x)*alpha;displayRef.y+=(smoothTarget.referee.y-displayRef.y)*alpha;sc.referee.x=displayRef.x;sc.referee.y=displayRef.y;}
      Prime.Pitch?.draw?.(sc);
    }
  }
  raf=requestAnimationFrame(smoothGuest);
}
function updateGuestControls(state){
  const pause=document.getElementById('friendV31Pause');if(pause&&typeof state.paused==='boolean')pause.textContent=state.paused?'▶ Continuar':'⏸ Pausar';
  if(state.speed){document.querySelectorAll('#friendV31GuestTools [data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===Number(state.speed)));}
}
function injectGuestControls(){
  if(isHost()||!document.body.classList.contains('friend-match-guest'))return;installGuestDrawGuard();const controls=document.querySelector('.friend-guest-match .match-controls');if(!controls||document.getElementById('friendV31GuestTools'))return;
  const tools=document.createElement('div');tools.id='friendV31GuestTools';tools.className='friend-v31-guest-tools';tools.innerHTML='<button id="friendV31Pause" class="btn btn-primary">⏸ Pausar</button><button class="btn btn-ghost active" data-speed="1">1x</button><button class="btn btn-ghost" data-speed="2">2x</button><button class="btn btn-ghost" data-speed="4">4x</button><button class="btn btn-ghost" data-cam="follow">Jogada</button><button class="btn btn-ghost active" data-cam="full">Campo inteiro</button>';
  controls.insertBefore(tools,controls.firstChild);
  document.getElementById('friendV31Pause').onclick=()=>send({type:'remote-pause'});
  tools.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>send({type:'remote-speed',speed:Number(b.dataset.speed)}));
  tools.querySelectorAll('[data-cam]').forEach(b=>b.onclick=()=>{Prime.Pitch?.setCameraMode?.(b.dataset.cam);tools.querySelectorAll('[data-cam]').forEach(x=>x.classList.toggle('active',x===b));});
}
function broadcastHalf(){if(isHost())send({type:'half-state',half:Object.assign({},halfState)});}
function markHalfReady(team){
  const st=Prime.Store?.state;if(!st?.match?.waitingHalfTime)return;halfState.active=true;halfState[team]=true;if(!halfState.firstReadyAt)halfState.firstReadyAt=Date.now();broadcastHalf();updateHostHalfButton();renderGuestHalfTime();if(halfState.A&&halfState.B)startSecondHalfTogether();
}
function startSecondHalfTogether(){
  if(!isHost())return;const st=Prime.Store.state;if(!st.match?.waitingHalfTime)return;const res=Prime.MatchEngine?.startSecondHalf?.(st);if(res&&!res.ok)return;document.getElementById('halfTimePanel')?.setAttribute('hidden','');halfState={active:false,A:false,B:false,firstReadyAt:0};send({type:'half-start'});broadcastControlState();Prime.UI?.showToast?.('Segundo tempo iniciado.','success','Jogo online');
}
function updateHostHalfButton(){
  if(!isHost())return;const b=document.getElementById('startSecondHalfBtn');if(!b)return;const left=halfState.firstReadyAt?Math.max(0,Math.ceil((HALF_WAIT_MS-(Date.now()-halfState.firstReadyAt))/1000)):20;
  if(halfState.A){b.textContent=halfState.B?'✓ Os dois prontos':`✓ Você está pronto · ${left}s`;b.disabled=true;}else{b.textContent='✓ Estou pronto para o 2º tempo';b.disabled=false;}
  let status=document.getElementById('friendV31HostHalfStatus');if(!status){status=document.createElement('div');status.id='friendV31HostHalfStatus';status.className='friend-v31-half-status';b.closest('.half-card')?.appendChild(status);}if(status)status.innerHTML=`<strong>Time A:</strong> ${halfState.A?'pronto':'aguardando'} · <strong>Time B:</strong> ${halfState.B?'pronto':'aguardando'}${halfState.firstReadyAt?` · início automático em ${left}s`:''}`;
}
function renderGuestHalfTime(){
  if(isHost())return;const st=Prime.Store?.state;if(!st?.match?.waitingHalfTime){removeGuestHalfTime();return;}let root=document.getElementById('friendV31Half');if(!root){root=document.createElement('div');root.id='friendV31Half';root.className='friend-v31-half';document.body.appendChild(root);}const mine=halfState.B;const left=halfState.firstReadyAt?Math.max(0,Math.ceil((HALF_WAIT_MS-(Date.now()-halfState.firstReadyAt))/1000)):20;
  root.innerHTML=`<div class="friend-v31-half-card"><span class="eyebrow">Intervalo · jogo online</span><h2>Fim do primeiro tempo</h2><p class="muted">Cada jogador pode mexer no próprio time. O 2º tempo começa quando os dois confirmarem; se somente um confirmar, começa automaticamente após ${HALF_WAIT_MS/1000}s.</p><div class="friend-v31-half-actions"><button id="friendV31HalfSub" class="btn btn-ghost">🔁 Fazer substituição</button><button id="friendV31HalfReady" class="btn btn-primary" ${mine?'disabled':''}>${mine?'✓ Você está pronto':'✓ Estou pronto'}</button></div><div class="friend-v31-half-status"><strong>Time A:</strong> ${halfState.A?'pronto':'aguardando'} · <strong>Time B:</strong> ${halfState.B?'pronto':'aguardando'}${halfState.firstReadyAt?` · início automático em ${left}s`:''}</div></div>`;
  document.getElementById('friendV31HalfSub').onclick=()=>document.getElementById('friendRemoteSub')?.click();document.getElementById('friendV31HalfReady').onclick=()=>{if(halfState.B)return;halfState.B=true;if(!halfState.firstReadyAt)halfState.firstReadyAt=Date.now();send({type:'half-ready',team:'B'});renderGuestHalfTime();};
}
function removeGuestHalfTime(){document.getElementById('friendV31Half')?.remove();}
function halfTick(){
  const st=Prime.Store?.state;if(!st||st.mode!=='friend')return;
  if(isHost()&&st.match?.waitingHalfTime){if(!halfState.active){halfState={active:true,A:false,B:false,firstReadyAt:0};broadcastHalf();}updateHostHalfButton();if(halfState.firstReadyAt&&Date.now()-halfState.firstReadyAt>=HALF_WAIT_MS)startSecondHalfTogether();}
  else if(!isHost())renderGuestHalfTime();
  if(!st.match?.waitingHalfTime&&halfState.active){halfState={active:false,A:false,B:false,firstReadyAt:0};removeGuestHalfTime();}
}
document.addEventListener('click',e=>{
  const r=room();if(r&&setupPending(r)&&e.target.closest('.friend-candidate')){e.preventDefault();e.stopImmediatePropagation();return;}
  const b=e.target.closest('#startSecondHalfBtn');if(b&&Prime.Store?.state?.mode==='friend'&&isHost()){e.preventDefault();e.stopImmediatePropagation();markHalfReady('A');}
},true);
setInterval(()=>{enforceSetupGate();injectGuestControls();halfTick();sendSmoothFrame();},80);
if(!raf)raf=requestAnimationFrame(smoothGuest);
Prime.FriendControlV31=Object.freeze({enabled:true,markHalfReady});
})(window.Prime=window.Prime||{});