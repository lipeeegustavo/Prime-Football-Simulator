(function(Prime){
  const S=Prime.GameStates;
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  if(!S||!F)return;

  const PERIOD_MS=2800;
  let active=null;
  const doneKeys=new WeakMap();

  function matchKey(state){
    if(!state?.match)return null;
    return state.match.secondHalf?'H2':'H1';
  }

  function doneSet(match){
    let set=doneKeys.get(match);
    if(!set){set=new Set();doneKeys.set(match,set);}
    return set;
  }

  function ownHalfY(p){
    const half=F.length/2;
    const by=Number.isFinite(p.baseY)?p.baseY:p.y;
    if(p.key==='A')return half+(by/F.length)*half;
    return (by/F.length)*half;
  }

  function placeTeams(scene,state){
    const half=F.length/2;
    const kickoffTeam=state.match?.poss||'A';
    const teamPlayers=(scene.players||[]).filter(p=>p.key===kickoffTeam&&!p.isKeeper);
    const kicker=teamPlayers.sort((a,b)=>Math.abs((a.baseY||a.y)-half)-Math.abs((b.baseY||b.y)-half))[0]||teamPlayers[0];

    for(const p of scene.players||[]){
      p.x=Number.isFinite(p.baseX)?p.baseX:p.x;
      p.y=ownHalfY(p);
      p.tx=p.x;p.ty=p.y;p.vx=0;p.vy=0;
      p.actionState=null;p.actionTime=0;
    }

    if(kicker){
      kicker.x=F.width/2;
      kicker.y=half+(kickoffTeam==='A'?1.15:-1.15);
      kicker.tx=kicker.x;kicker.ty=kicker.y;
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
      scene.referee.tx=scene.referee.x;
      scene.referee.ty=scene.referee.y;
      scene.referee.vx=0;scene.referee.vy=0;
    }
    return kicker;
  }

  function ensureBanner(label){
    let el=document.getElementById('kickoffCeremonyBanner');
    if(!el){
      el=document.createElement('div');
      el.id='kickoffCeremonyBanner';
      el.className='kickoff-ceremony-banner';
      document.body.appendChild(el);
    }
    el.innerHTML=`<span class="kickoff-whistle">●</span><strong>${label}</strong><small>O árbitro autoriza o início</small>`;
    el.classList.add('show');
    return el;
  }

  function hideBanner(){document.getElementById('kickoffCeremonyBanner')?.classList.remove('show');}

  function startCeremony(state,scene,key,now){
    const kicker=placeTeams(scene,state);
    const wasPaused=Boolean(Prime.GameLoop?.getState?.().paused);
    Prime.GameLoop?.setPaused?.(true);
    const label=key==='H2'?'RECOMEÇA O JOGO':'APITO INICIAL';
    ensureBanner(label);
    active={match:state.match,key,start:now,kicker,wasPaused,refBaseX:scene.referee?.x||0,refBaseY:scene.referee?.y||0};
    Prime.Pitch?.draw?.(scene);
  }

  function finishCeremony(state,scene){
    if(!active)return;
    const info=active;
    doneSet(info.match).add(info.key);
    hideBanner();
    if(info.kicker&&Prime.Pitch?.setCarrier)Prime.Pitch.setCarrier(info.kicker.key,info.kicker.id);
    active=null;
    if(!info.wasPaused)Prime.GameLoop?.setPaused?.(false);
    Prime.Pitch?.draw?.(scene);
  }

  function tick(now){
    try{
      const state=Prime.Store?.state;
      const scene=Prime.Pitch?.getScene?.();
      if(state?.screen===S.MATCH&&state.match&&scene&&!scene.preview){
        const key=matchKey(state);
        const set=doneSet(state.match);
        const firstWindow=key==='H1'&&(state.match.gameSeconds||0)<3;
        const secondWindow=key==='H2'&&(state.match.gameSeconds||0)<2704;
        if(!active&&!set.has(key)&&(firstWindow||secondWindow))startCeremony(state,scene,key,now);

        if(active&&active.match===state.match){
          const t=Math.max(0,now-active.start);
          const q=Math.min(1,t/PERIOD_MS);
          if(scene.referee){
            const wave=Math.sin(q*Math.PI*2.4);
            scene.referee.x=active.refBaseX+wave*.45;
            scene.referee.y=active.refBaseY-Math.sin(Math.min(1,q*1.8)*Math.PI)*.55;
          }
          Prime.Pitch?.draw?.(scene);
          if(t>=PERIOD_MS)finishCeremony(state,scene);
        }
      }else if(active){
        hideBanner();active=null;
      }
    }catch(_e){}
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  Prime.KickoffCeremonyV18=Object.freeze({});
})(window.Prime=window.Prime||{});
