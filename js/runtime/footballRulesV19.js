(function(Prime){
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  if(!F)return;

  function attacksTop(key,state){
    return (key==='A')!==Boolean(state?.match?.secondHalf);
  }

  function clampOwnHalf(player,state){
    const half=F.length/2;
    const baseY=Number.isFinite(player.baseY)?player.baseY:player.y;
    const bottomOwnHalf=attacksTop(player.key,state);
    if(player.isKeeper){
      // O goleiro deve iniciar sempre no próprio gol; createPlayers já
      // espelha baseY corretamente quando começa o segundo tempo.
      return baseY;
    }
    return bottomOwnHalf?Math.max(half+3.5,baseY):Math.min(half-3.5,baseY);
  }

  function enforceSecondHalfSides(state,scene){
    if(!Prime.KickoffCeremonyV18?.isActive?.())return;
    const half=F.length/2;
    const kickoffTeam=state.match?.poss||'A';
    const kicker=(scene.players||[])
      .filter(p=>p.key===kickoffTeam&&!p.isKeeper)
      .sort((a,b)=>Math.hypot(a.x-F.width/2,a.y-half)-Math.hypot(b.x-F.width/2,b.y-half))[0]||null;

    for(const p of scene.players||[]){
      if(kicker&&p===kicker&&Math.hypot(p.x-F.width/2,p.y-half)<2.5)continue;
      p.x=Number.isFinite(p.baseX)?p.baseX:p.x;
      p.y=clampOwnHalf(p,state);
      p.tx=p.x;p.ty=p.y;p.vx=0;p.vy=0;
    }

    if(scene.ball){
      scene.ball.x=F.width/2;scene.ball.y=half;scene.ball.z=0;
      scene.ball.vx=0;scene.ball.vy=0;scene.ball.vz=0;
      scene.ball.state='dead';scene.ball.ownerKey=null;scene.ball.ownerIndex=-1;
    }
  }

  function enforceDismissals(state,scene){
    const m=state.match;if(!m)return;
    ['A','B'].forEach(team=>{
      m.sentOff=m.sentOff||{A:[],B:[]};
      m.cards=m.cards||{A:{},B:{}};
      const sent=new Set((m.sentOff[team]||[]).map(String));
      for(const [id,count] of Object.entries(m.cards[team]||{})){
        if(Number(count)>=2&&!sent.has(String(id))){
          m.sentOff[team].push(String(id));
          sent.add(String(id));
          if(m.stats?.red) m.stats.red[team]=(m.stats.red[team]||0)+1;
        }
      }
      if(scene?.players){
        scene.players=scene.players.filter(p=>p.key!==team||!sent.has(String(p.id)));
      }
      if(scene?.carrier&&scene.carrier.key===team&&sent.has(String(scene.carrier.id)))scene.carrier=null;
      if(scene?.target&&scene.target.key===team&&sent.has(String(scene.target.id)))scene.target=null;
    });
  }

  function tick(){
    try{
      const state=Prime.Store?.state;
      const scene=Prime.Pitch?.getScene?.();
      if(state?.match&&scene&&!scene.preview){
        enforceDismissals(state,scene);
        enforceSecondHalfSides(state,scene);
      }
    }catch(_e){}
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  Prime.FootballRulesV19=Object.freeze({});
})(window.Prime=window.Prime||{});
