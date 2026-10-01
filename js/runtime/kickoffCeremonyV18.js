(function(Prime){
  const S=Prime.GameStates;
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  if(!S||!F)return;

  const OPENING_MS=2800;
  const GOAL_RESTART_MS=1900;
  let active=null;
  let watchedMatch=null;
  let lastScore={A:0,B:0};
  const doneKeys=new WeakMap();

  function doneSet(match){
    let set=doneKeys.get(match);
    if(!set){set=new Set();doneKeys.set(match,set);}
    return set;
  }

  function attacksTop(key,state){
    return (key==='A')!==Boolean(state?.match?.secondHalf);
  }

  function ownHalfY(p,state){
    const half=F.length/2;
    const base=Number.isFinite(p.baseY)?p.baseY:p.y;
    const distance=Math.max(5,Math.min(half-4,Math.abs(base-half)));
    return attacksTop(p.key,state)?half+distance:half-distance;
  }

  function placeTeams(scene,state){
    const half=F.length/2;
    const kickoffTeam=state.match?.poss||'A';

    for(const p of scene.players||[]){
      p.x=Number.isFinite(p.baseX)?p.baseX:p.x;
      p.y=ownHalfY(p,state);
      p.tx=p.x;p.ty=p.y;p.vx=0;p.vy=0;
      p.actionState=null;p.actionTime=0;
    }

    const teamPlayers=(scene.players||[]).filter(p=>p.key===kickoffTeam&&!p.isKeeper);
    const kicker=teamPlayers.slice().sort((a,b)=>Math.abs(a.y-half)-Math.abs(b.y-half))[0]||teamPlayers[0];
    if(kicker){
      kicker.x=F.width/2;
      kicker.y=half;
      kicker.tx=kicker.x;kicker.ty=kicker.y;kicker.vx=0;kicker.vy=0;
    }

    // O adversário precisa respeitar a distância do círculo central.
    const safeRadius=F.centerCircleRadius+1.2;
    for(const p of scene.players||[]){
      if(p.key===kickoffTeam||p.isKeeper)continue;
      const dx=p.x-F.width/2,dy=p.y-half,d=Math.hypot(dx,dy);
      if(d<safeRadius){
        const sign=attacksTop(p.key,state)?1:-1;
        p.y=half+sign*safeRadius;
        p.tx=p.x;p.ty=p.y;
      }
    }

    if(scene.ball){
      scene.ball.x=F.width/2;scene.ball.y=half;scene.ball.z=0;
      scene.ball.vx=0;scene.ball.vy=0;scene.ball.vz=0;
      scene.ball.state='dead';scene.ball.ownerKey=null;scene.ball.ownerIndex=-1;
    }
    scene.carrier=null;scene.target=null;

    if(scene.referee){
      scene.referee.x=F.width/2+5.5;
      scene.referee.y=half+1.2;
      scene.referee.tx=scene.referee.x;scene.referee.ty=scene.referee.y;
      scene.referee.vx=0;scene.referee.vy=0;
    }

    const receiver=teamPlayers
      .filter(p=>p!==kicker)
      .sort((a,b)=>Math.hypot(a.x-F.width/2,a.y-half)-Math.hypot(b.x-F.width/2,b.y-half))[0]||null;
    return {kicker,receiver,kickoffTeam};
  }

  function ensureBanner(label,sub){
    let el=document.getElementById('kickoffCeremonyBanner');
    if(!el){
      el=document.createElement('div');
      el.id='kickoffCeremonyBanner';
      el.className='kickoff-ceremony-banner';
      document.body.appendChild(el);
    }
    el.innerHTML=`<span class="kickoff-whistle">●</span><strong>${label}</strong><small>${sub||'O árbitro autoriza o início'}</small>`;
    el.classList.add('show');
    return el;
  }

  function hideBanner(){document.getElementById('kickoffCeremonyBanner')?.classList.remove('show');}

  function startCeremony(state,scene,key,now,reason){
    Prime.Pitch?.cancelAction?.();
    const setup=placeTeams(scene,state);
    const wasPaused=Boolean(Prime.GameLoop?.getState?.().paused);
    Prime.GameLoop?.setPaused?.(true);
    const isGoal=reason==='goal';
    const label=key==='H2'?'RECOMEÇA O JOGO':isGoal?'BOLA AO CENTRO':'APITO INICIAL';
    const sub=isGoal?'Os times retomam suas posições para a saída':'O árbitro autoriza o início';
    ensureBanner(label,sub);
    active={match:state.match,key,start:now,reason,setup,wasPaused,refBaseX:scene.referee?.x||0,refBaseY:scene.referee?.y||0,duration:isGoal?GOAL_RESTART_MS:OPENING_MS};
    if(state.match){
      state.match.attackPhase='KICKOFF';
      state.match.possessionActions=0;
    }
    Prime.Pitch?.draw?.(scene);
  }

  function beginKickoffPass(state,scene,info){
    const {kicker,receiver,kickoffTeam}=info.setup||{};
    if(!kicker)return;

    // A bola permanece EXATAMENTE no ponto central até o primeiro toque.
    kicker.x=F.width/2;kicker.y=F.length/2;kicker.tx=kicker.x;kicker.ty=kicker.y;
    if(scene.ball){
      scene.ball.x=F.width/2;scene.ball.y=F.length/2;scene.ball.z=0;
      scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';
    }
    Prime.Pitch?.setCarrier?.(kickoffTeam,kicker.id);
    if(scene.ball){scene.ball.x=F.width/2;scene.ball.y=F.length/2;scene.ball.z=0;}
    state.match.carrierId=kicker.id;
    state.match.poss=kickoffTeam;
    state.match.attackPhase='KICKOFF';
    state.match.possessionActions=0;

    if(receiver&&Prime.Pitch?.playEvent){
      const minute=Math.floor((state.match.gameSeconds||0)/60);
      Prime.Pitch.playEvent({type:'PASS',team:kickoffTeam,fromId:kicker.id,toId:receiver.id,minute,speed:13,loft:0},()=>{
        if(state.match!==info.match)return;
        state.match.carrierId=receiver.id;
        state.match.attackPhase='BUILDUP';
        state.match.possessionActions=1;
        state.match.nextEventAt=(state.match.gameSeconds||0)+28+(state.match.rng?state.match.rng()*10:0);
      });
    }else{
      state.match.nextEventAt=(state.match.gameSeconds||0)+30;
    }
  }

  function finishCeremony(state,scene){
    if(!active)return;
    const info=active;
    doneSet(info.match).add(info.key);
    hideBanner();
    beginKickoffPass(state,scene,info);
    active=null;
    if(!info.wasPaused)Prime.GameLoop?.setPaused?.(false);
    Prime.Pitch?.draw?.(scene);
  }

  function syncMatchWatch(state){
    if(watchedMatch===state.match)return;
    watchedMatch=state.match;
    lastScore={A:Number(state.match?.score?.A||0),B:Number(state.match?.score?.B||0)};
  }

  function scoreChanged(state){
    const a=Number(state.match?.score?.A||0),b=Number(state.match?.score?.B||0);
    const changed=a!==lastScore.A||b!==lastScore.B;
    lastScore={A:a,B:b};
    return changed;
  }

  function tick(now){
    try{
      const state=Prime.Store?.state;
      const scene=Prime.Pitch?.getScene?.();
      if(state?.screen===S.MATCH&&state.match&&scene&&!scene.preview){
        syncMatchWatch(state);
        const set=doneSet(state.match);
        const halfKey=state.match.secondHalf?'H2':'H1';
        const firstWindow=halfKey==='H1'&&(state.match.gameSeconds||0)<3;
        const secondWindow=halfKey==='H2'&&(state.match.gameSeconds||0)<2704;

        if(!active&&!set.has(halfKey)&&(firstWindow||secondWindow)){
          startCeremony(state,scene,halfKey,now,'half');
        }else if(!active&&scoreChanged(state)){
          const goalKey=`G${state.match.score.A}-${state.match.score.B}`;
          startCeremony(state,scene,goalKey,now,'goal');
        }

        if(active&&active.match===state.match){
          const t=Math.max(0,now-active.start);
          const q=Math.min(1,t/active.duration);
          if(scene.referee){
            const wave=Math.sin(q*Math.PI*2.4);
            scene.referee.x=active.refBaseX+wave*.45;
            scene.referee.y=active.refBaseY-Math.sin(Math.min(1,q*1.8)*Math.PI)*.55;
          }
          if(scene.ball){
            scene.ball.x=F.width/2;scene.ball.y=F.length/2;scene.ball.z=0;
            scene.ball.vx=scene.ball.vy=scene.ball.vz=0;
          }
          Prime.Pitch?.draw?.(scene);
          if(t>=active.duration)finishCeremony(state,scene);
        }
      }else if(active){
        hideBanner();active=null;
      }
    }catch(_e){}
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  Prime.KickoffCeremonyV18=Object.freeze({isActive:()=>Boolean(active)});
})(window.Prime=window.Prime||{});
