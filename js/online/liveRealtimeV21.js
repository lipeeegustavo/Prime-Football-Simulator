(function(Prime){
  const PROJECT_URL='https://fpduwcrjqgvxnlhyuyag.supabase.co';
  const PUBLIC_KEY='sb_publishable_39B4RWNx9R4SlXROyBxdiQ_jF1hCXeL';
  const watchCode=(new URLSearchParams(location.search).get('watch')||'').toUpperCase();
  const isViewer=Boolean(watchCode);
  let client=null,channel=null,roomCode='',lastSend=0,lastFrameAt=0,lastRaf=performance.now();
  const targets=new Map(),rendered=new Map();
  let ballTarget=null,ballRendered=null,refTarget=null,refRendered=null;

  function hostSession(){
    try{return JSON.parse(sessionStorage.getItem('prime_live_host_v20')||'null');}catch(_e){return null;}
  }
  function status(){
    const st=Prime.Store?.state,m=st?.match;
    if(m?.finished||st?.screen===Prime.GameStates?.END)return'finished';
    if(m?.waitingHalfTime)return'halftime';
    if(st?.screen===Prime.GameStates?.MATCH&&m)return'live';
    return'lobby';
  }
  function snapshot(){
    const st=Prime.Store?.state,m=st?.match,s=Prime.Pitch?.getScene?.();
    if(!m||!s)return null;
    return {
      sentAt:Date.now(),status:status(),gameSeconds:Number(m.gameSeconds||0),minute:Number(m.minute||0),score:{A:Number(m.score?.A||0),B:Number(m.score?.B||0)},secondHalf:Boolean(m.secondHalf),
      players:(s.players||[]).map(p=>({k:p.key,i:String(p.id),x:+p.x.toFixed(3),y:+p.y.toFixed(3),vx:+(p.vx||0).toFixed(3),vy:+(p.vy||0).toFixed(3),f:+(p.facing||0).toFixed(3)})),
      ball:s.ball?{x:+s.ball.x.toFixed(3),y:+s.ball.y.toFixed(3),z:+(s.ball.z||0).toFixed(3),r:+(s.ball.rotation||0).toFixed(3),state:s.ball.state||'dead'}:null,
      referee:s.referee?{x:+s.referee.x.toFixed(3),y:+s.referee.y.toFixed(3)}:null
    };
  }
  function connect(code){
    if(!code||channel||!window.supabase?.createClient)return;
    roomCode=code;
    client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    channel=client.channel(`prime-stream-${code}`,{config:{broadcast:{self:false,ack:false}}});
    if(isViewer){channel.on('broadcast',{event:'frame'},({payload})=>receive(payload));}
    channel.subscribe();
  }
  function sendFrame(now){
    if(isViewer||!channel||now-lastSend<110)return;
    const st=Prime.Store?.state,sess=hostSession();
    if(!sess?.code||st?.screen!==Prime.GameStates?.MATCH||!st.match)return;
    const snap=snapshot();if(!snap)return;
    lastSend=now;
    channel.send({type:'broadcast',event:'frame',payload:snap}).catch(()=>{});
  }
  function receive(p){
    if(!p||!Array.isArray(p.players))return;
    lastFrameAt=performance.now();
    for(const x of p.players)targets.set(`${x.k}:${x.i}`,x);
    ballTarget=p.ball||null;refTarget=p.referee||null;
    const score=document.getElementById('watchScore');if(score)score.textContent=`${Number(p.score?.A||0)} — ${Number(p.score?.B||0)}`;
    const clock=document.getElementById('watchClock');if(clock&&p.status==='live'){
      const sec=Math.max(0,Number(p.gameSeconds||0)),mm=Math.floor(sec/60),ss=Math.floor(sec%60).toString().padStart(2,'0');clock.textContent=`${String(mm).padStart(2,'0')}:${ss}`;
    }
    const badge=document.getElementById('watchStatus');if(badge&&p.status==='live'){badge.textContent='● TRANSMISSÃO AO VIVO';badge.dataset.status='live';}
  }
  function smooth(current,target,rate,dt){return current+(target-current)*(1-Math.exp(-rate*dt));}
  function interpolate(now){
    if(!isViewer)return;
    const dt=Math.min(.05,Math.max(.001,(now-lastRaf)/1000));lastRaf=now;
    if(now-lastFrameAt>1800)return;
    const sc=Prime.Pitch?.getScene?.();if(!sc)return;
    for(const p of sc.players||[]){
      const key=`${p.key}:${p.id}`,t=targets.get(key);if(!t)continue;
      let r=rendered.get(key);if(!r)r={x:p.x,y:p.y,vx:0,vy:0};
      r.x=smooth(r.x,t.x,14,dt);r.y=smooth(r.y,t.y,14,dt);r.vx=t.vx||0;r.vy=t.vy||0;rendered.set(key,r);
      p.x=r.x;p.y=r.y;p.tx=r.x;p.ty=r.y;p.vx=r.vx;p.vy=r.vy;p.facing=t.f||p.facing;
    }
    if(sc.ball&&ballTarget){
      if(!ballRendered)ballRendered={x:sc.ball.x,y:sc.ball.y,z:sc.ball.z||0,r:sc.ball.rotation||0};
      ballRendered.x=smooth(ballRendered.x,ballTarget.x,18,dt);ballRendered.y=smooth(ballRendered.y,ballTarget.y,18,dt);ballRendered.z=smooth(ballRendered.z,ballTarget.z||0,20,dt);ballRendered.r=smooth(ballRendered.r,ballTarget.r||0,18,dt);
      sc.ball.x=ballRendered.x;sc.ball.y=ballRendered.y;sc.ball.z=ballRendered.z;sc.ball.rotation=ballRendered.r;sc.ball.vx=sc.ball.vy=sc.ball.vz=0;
    }
    if(sc.referee&&refTarget){
      if(!refRendered)refRendered={x:sc.referee.x,y:sc.referee.y};
      refRendered.x=smooth(refRendered.x,refTarget.x,10,dt);refRendered.y=smooth(refRendered.y,refTarget.y,10,dt);sc.referee.x=refRendered.x;sc.referee.y=refRendered.y;
    }
    Prime.Pitch.draw?.(sc);
  }
  function loop(now){
    if(!channel){const code=isViewer?watchCode:hostSession()?.code;if(code)connect(code);}
    if(channel&&!isViewer)sendFrame(now);
    if(isViewer)interpolate(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  Prime.LiveRealtimeV21=Object.freeze({enabled:true,watchCode});
})(window.Prime=window.Prime||{});