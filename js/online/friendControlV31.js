(function(Prime){
'use strict';
const PROJECT_URL='https://fpduwcrjqgvxnlhyuyag.supabase.co';
const PUBLIC_KEY='sb_publishable_39B4RWNx9R4SlXROyBxdiQ_jF1hCXeL';
const TURN_SECONDS=30;
const WAITING_DEADLINE=Number.MAX_SAFE_INTEGER;
const HALF_WAIT_MS=20000;
let client=null,channel=null,activeCode='',smoothTarget=null,lastSmoothSent=0;
let halfState={active:false,A:false,B:false,firstReadyAt:0};
let raf=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function room(){return Prime.FriendMatchV29?.getRoom?.()||null;}
function isHost(){return !!Prime.FriendMatchV29?.isHost?.();}
function myTeam(){return isHost()?'A':'B';}
function send(payload){if(channel)channel.send({type:'broadcast',event:'v31',payload}).catch(()=>{});}
function noDraftPicks(r){if(!r?.progress)return false;return ['A','B'].every(k=>Object.values(r.progress[k]||{}).every(v=>Number(v||0)===0));}
function ensureSetup(r){
  if(!r.v31Setup)r.v31Setup={started:false,A:{ready:false,name:r.teams.A.name,formation:r.teams.A.formation},B:{ready:false,name:r.teams.B.name,formation:r.teams.B.formation}};
  return r.v31Setup;
}
function setupPending(r){return !!(r&&r.connected?.B&&!r.complete&&noDraftPicks(r)&&!ensureSetup(r).started);}
function formationOptions(selected){return Object.keys(Prime.FORMATIONS||{}).map(f=>`<option value="${esc(f)}" ${f===selected?'selected':''}>${esc(f)}</option>`).join('');}
function connectV31(){
  const r=room();if(!r||activeCode===r.code||!window.supabase?.createClient)return;
  activeCode=r.code;client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  channel=client.channel(`prime-friend-v31-${r.code}`,{config:{broadcast:{self:false,ack:false}}});
  channel.on('broadcast',{event:'v31'},({payload})=>onMessage(payload));
  channel.subscribe(status=>{if(status==='SUBSCRIBED'&&!isHost())send({type:'v31-hello'});});
}
function broadcastSetup(){const r=room();if(isHost()&&r)send({type:'setup-state',setup:r.v31Setup,teams:r.teams,deadline:r.deadline});}
function submitSetup(team,name,formation){
  const r=room();if(!r||!Prime.FORMATIONS?.[formation])return;
  name=String(name||'').trim().slice(0,28)||`Jogador ${team==='A'?1:2}`;
  if(isHost()){
    const s=ensureSetup(r);s[team]={ready:true,name,formation};r.teams[team].name=name;r.teams[team].formation=formation;maybeStartDraft();broadcastSetup();renderSetup();
  }else send({type:'setup-submit',team:'B',name,formation});
}
function maybeStartDraft(){
  const r=room();if(!isHost()||!r)return;const s=ensureSetup(r);
  if(s.A.ready&&s.B.ready&&!s.started){s.started=true;r.deadline=Date.now()+TURN_SECONDS*1000;broadcastSetup();Prime.UI?.showToast?.('Os dois times estão prontos. Começou o draft!','success','Jogo online');}
}
function onMessage(p){
  if(!p)return;const r=room();
  if(isHost()){
    if(p.type==='v31-hello'){broadcastSetup();return;}
    if(p.type==='setup-submit'&&p.team==='B'&&r){const s=ensureSetup(r);if(!s.started&&Prime.FORMATIONS?.[p.formation]){const name=String(p.name||'Jogador 2').trim().slice(0,28)||'Jogador 2';s.B={ready:true,name,formation:p.formation};r.teams.B.name=name;r.teams.B.formation=p.formation;maybeStartDraft();broadcastSetup();renderSetup();}return;}
    if(p.type==='half-ready'&&p.team==='B'){markHalfReady('B');return;}
    return;
  }
  if(p.type==='setup-state'&&r){r.v31Setup=p.setup;r.deadline=p.deadline;if(p.teams){r.teams.A.name=p.teams.A.name;r.teams.A.formation=p.teams.A.formation;r.teams.B.name=p.teams.B.name;r.teams.B.formation=p.teams.B.formation;}renderSetup();return;}
  if(p.type==='smooth-frame'){smoothTarget=p.snapshot||null;return;}
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
  box.innerHTML=`<span class="eyebrow">Antes do draft</span><h3>Configure o seu time</h3><p class="muted small">Cada jogador escolhe o próprio nome e formação. O cronômetro só começa quando os dois confirmarem.</p><div class="friend-v31-setup-grid"><label>Nome do time<input id="friendV31Name" maxlength="28" value="${esc(mine.name)}" ${mine.ready?'disabled':''}></label><label>Formação<select id="friendV31Formation" ${mine.ready?'disabled':''}>${formationOptions(mine.formation)}</select></label><button id="friendV31Ready" class="btn btn-primary" ${mine.ready?'disabled':''}>${mine.ready?'✓ Pronto':'Confirmar time'}</button></div><div class="friend-v31-ready"><b class="${s.A.ready?'ready':''}">Time A ${s.A.ready?'✓':'…'}</b><span>•</span><b class="${s.B.ready?'ready':''}">Time B ${s.B.ready?'✓':'…'}</b>${mine.ready&&!other.ready?'<span class="friend-v31-waiting-note">Aguardando o outro jogador…</span>':''}</div>`;
  const btn=document.getElementById('friendV31Ready');if(btn&&!mine.ready)btn.onclick=()=>submitSetup(myTeam(),document.getElementById('friendV31Name').value,document.getElementById('friendV31Formation').value);
  document.querySelectorAll('.friend-candidate,#friendSearch').forEach(el=>{el.disabled=true;el.classList.add('friend-v31-locked');});
  const t=document.getElementById('friendTimerText');if(t)t.textContent='CONFIGURAÇÃO';const bar=document.getElementById('friendTimerBar');if(bar)bar.style.width='100%';
}
function enforceSetupGate(){const r=room();if(!r)return;connectV31();if(setupPending(r)){r.deadline=WAITING_DEADLINE;renderSetup();}else if(r.v31Setup?.started)document.getElementById('friendV31Setup')?.remove();}
function snapshotSmooth(){
  const st=Prime.Store?.state,s=Prime.Pitch?.getScene?.();if(!st||st.mode!=='friend'||st.screen!==Prime.GameStates.MATCH||!s)return null;
  return {players:(s.players||[]).map(p=>({k:p.key,i:String(p.id),x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,f:p.facing||0})),ball:s.ball?{x:s.ball.x,y:s.ball.y,z:s.ball.z||0,r:s.ball.rotation||0,state:s.ball.state}:null,referee:s.referee?{x:s.referee.x,y:s.referee.y}:null,waitingHalfTime:!!st.match?.waitingHalfTime};
}
function sendSmoothFrame(){if(!isHost()||!channel)return;const now=performance.now();if(now-lastSmoothSent<50)return;lastSmoothSent=now;const s=snapshotSmooth();if(s)send({type:'smooth-frame',snapshot:s});}
function smoothGuest(){
  if(!isHost()&&smoothTarget&&document.body.classList.contains('friend-match-guest')){
    const sc=Prime.Pitch?.getScene?.();if(sc){const alpha=.32;for(const p of sc.players||[]){const t=smoothTarget.players?.find(x=>x.k===p.key&&String(x.i)===String(p.id));if(t){p.x+=(t.x-p.x)*alpha;p.y+=(t.y-p.y)*alpha;p.tx=p.x;p.ty=p.y;p.vx=t.vx;p.vy=t.vy;p.facing=t.f;}}if(sc.ball&&smoothTarget.ball){sc.ball.x+=(smoothTarget.ball.x-sc.ball.x)*.38;sc.ball.y+=(smoothTarget.ball.y-sc.ball.y)*.38;sc.ball.z+=(smoothTarget.ball.z-sc.ball.z)*.38;sc.ball.rotation=smoothTarget.ball.r;sc.ball.state=smoothTarget.ball.state;}if(sc.referee&&smoothTarget.referee){sc.referee.x+=(smoothTarget.referee.x-sc.referee.x)*alpha;sc.referee.y+=(smoothTarget.referee.y-sc.referee.y)*alpha;}Prime.Pitch?.draw?.(sc);}
  }
  raf=requestAnimationFrame(smoothGuest);
}
function injectGuestControls(){
  if(isHost()||!document.body.classList.contains('friend-match-guest'))return;const controls=document.querySelector('.friend-guest-match .match-controls');if(!controls||document.getElementById('friendV31GuestTools'))return;
  const tools=document.createElement('div');tools.id='friendV31GuestTools';tools.className='friend-v31-guest-tools';tools.innerHTML='<button class="btn btn-ghost" data-cam="follow">Jogada</button><button class="btn btn-primary active" data-cam="full">Campo inteiro</button>';
  controls.insertBefore(tools,controls.firstChild);tools.querySelectorAll('[data-cam]').forEach(b=>b.onclick=()=>{Prime.Pitch?.setCameraMode?.(b.dataset.cam);tools.querySelectorAll('[data-cam]').forEach(x=>x.classList.toggle('active',x===b));});
}
function broadcastHalf(){if(isHost())send({type:'half-state',half:Object.assign({},halfState)});}
function markHalfReady(team){
  const st=Prime.Store?.state;if(!st?.match?.waitingHalfTime)return;halfState.active=true;halfState[team]=true;if(!halfState.firstReadyAt)halfState.firstReadyAt=Date.now();broadcastHalf();updateHostHalfButton();renderGuestHalfTime();if(halfState.A&&halfState.B)startSecondHalfTogether();
}
function startSecondHalfTogether(){
  if(!isHost())return;const st=Prime.Store.state;if(!st.match?.waitingHalfTime)return;const res=Prime.MatchEngine?.startSecondHalf?.(st);if(res&&!res.ok)return;document.getElementById('halfTimePanel')?.setAttribute('hidden','');halfState={active:false,A:false,B:false,firstReadyAt:0};send({type:'half-start'});Prime.UI?.showToast?.('Segundo tempo iniciado.','success','Jogo online');
}
function updateHostHalfButton(){
  if(!isHost())return;const b=document.getElementById('startSecondHalfBtn');if(!b)return;if(halfState.A){const left=Math.max(0,Math.ceil((HALF_WAIT_MS-(Date.now()-halfState.firstReadyAt))/1000));b.textContent=halfState.B?'✓ Os dois prontos':`✓ Você está pronto · ${left}s`;b.disabled=true;}else b.textContent='✓ Estou pronto para o 2º tempo';
}
function renderGuestHalfTime(){
  if(isHost())return;const st=Prime.Store?.state;if(!st?.match?.waitingHalfTime){removeGuestHalfTime();return;}let root=document.getElementById('friendV31Half');if(!root){root=document.createElement('div');root.id='friendV31Half';root.className='friend-v31-half';document.body.appendChild(root);}const mine=halfState.B;const left=halfState.firstReadyAt?Math.max(0,Math.ceil((HALF_WAIT_MS-(Date.now()-halfState.firstReadyAt))/1000)):20;root.innerHTML=`<div class="friend-v31-half-card"><span class="eyebrow">Intervalo · jogo online</span><h2>Fim do primeiro tempo</h2><p class="muted">Faça suas substituições antes de confirmar. O segundo tempo começa quando os dois estiverem prontos ou ${HALF_WAIT_MS/1000}s depois da primeira confirmação.</p><div class="friend-v31-half-actions"><button id="friendV31HalfSub" class="btn btn-ghost">🔁 Fazer substituição</button><button id="friendV31HalfReady" class="btn btn-primary" ${mine?'disabled':''}>${mine?'✓ Você está pronto':'✓ Pronto para o 2º tempo'}</button></div><div class="friend-v31-half-status"><strong>Time A:</strong> ${halfState.A?'pronto':'aguardando'} · <strong>Time B:</strong> ${halfState.B?'pronto':'aguardando'}${halfState.firstReadyAt?` · início automático em ${left}s`:''}</div></div>`;
  document.getElementById('friendV31HalfSub').onclick=()=>document.getElementById('friendRemoteSub')?.click();document.getElementById('friendV31HalfReady').onclick=()=>{halfState.B=true;if(!halfState.firstReadyAt)halfState.firstReadyAt=Date.now();send({type:'half-ready',team:'B'});renderGuestHalfTime();};
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
