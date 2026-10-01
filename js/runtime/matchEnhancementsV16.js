(function(Prime){
  const S=Prime.GameStates;
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  let lastTs=0;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  async function cancelCurrentMatch(){
    const state=Prime.Store?.state;
    if(!state||state.screen!==S.MATCH)return;
    let confirmed=true;
    if(Prime.UI?.confirmAction){
      confirmed=await Prime.UI.confirmAction('Cancelar a partida?','O jogo atual será encerrado. Sua escalação será mantida e você voltará ao pré-jogo.');
    }else{
      confirmed=window.confirm('Cancelar a partida atual?');
    }
    if(!confirmed)return;
    Prime.MatchEngine?.stop?.();
    Prime.Pitch?.cancelAction?.();
    state.match=null;
    try{Prime.Store.transition(S.PRE_GAME);}catch(_e){Prime.Store.returnToMenu?.();}
  }

  function ensureCancelButton(){
    const state=Prime.Store?.state;
    if(!state||state.screen!==S.MATCH)return;
    const controls=document.querySelector('.match-controls');
    if(!controls||document.getElementById('cancelMatchBtn'))return;
    const btn=document.createElement('button');
    btn.id='cancelMatchBtn';
    btn.type='button';
    btn.className='btn btn-danger';
    btn.textContent='✕ Cancelar partida';
    btn.addEventListener('click',cancelCurrentMatch);
    controls.appendChild(btn);
  }

  function separatePair(a,b,minDist,factor,carrier){
    let dx=b.x-a.x,dy=b.y-a.y;
    let d=Math.hypot(dx,dy);
    if(d>=minDist)return;
    if(d<0.001){
      const sign=((Number(a.id)||0)+(Number(b.id)||0))%2?1:-1;
      dx=sign;dy=.45;d=Math.hypot(dx,dy);
    }
    const ux=dx/d,uy=dy/d;
    const gap=minDist-d;
    const push=gap*factor;
    const aCarrier=carrier===a,bCarrier=carrier===b;

    if(aCarrier&&!bCarrier){
      b.x=clamp(b.x+ux*push,F?1.2:-Infinity,F?F.width-1.2:Infinity);
      b.y=clamp(b.y+uy*push,F?1.2:-Infinity,F?F.length-1.2:Infinity);
      return;
    }
    if(bCarrier&&!aCarrier){
      a.x=clamp(a.x-ux*push,F?1.2:-Infinity,F?F.width-1.2:Infinity);
      a.y=clamp(a.y-uy*push,F?1.2:-Infinity,F?F.length-1.2:Infinity);
      return;
    }
    const half=push*.5;
    a.x=clamp(a.x-ux*half,F?1.2:-Infinity,F?F.width-1.2:Infinity);
    a.y=clamp(a.y-uy*half,F?1.2:-Infinity,F?F.length-1.2:Infinity);
    b.x=clamp(b.x+ux*half,F?1.2:-Infinity,F?F.width-1.2:Infinity);
    b.y=clamp(b.y+uy*half,F?1.2:-Infinity,F?F.length-1.2:Infinity);
  }

  function keepTeammatesApart(ts){
    ensureCancelButton();
    const state=Prime.Store?.state;
    const scene=Prime.Pitch?.getScene?.();
    if(state?.screen===S.MATCH&&state.match&&scene&&!scene.preview&&F){
      const dt=lastTs?Math.min(.05,(ts-lastTs)/1000):.016;
      const phase=state.match.attackPhase||'';
      const poss=state.match.poss;
      const softFactor=Math.min(.28,.08+dt*5.2);
      for(const key of ['A','B']){
        const list=(scene.players||[]).filter(p=>p.key===key&&!p.isKeeper);
        const buildUp=key===poss&&['KICKOFF','BUILDUP','TRANSITION'].includes(phase);
        const minDist=buildUp?3.8:2.7;
        for(let pass=0;pass<2;pass++){
          for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
            separatePair(list[i],list[j],minDist,softFactor,scene.carrier);
          }
        }
      }
    }
    lastTs=ts;
    requestAnimationFrame(keepTeammatesApart);
  }

  const observer=new MutationObserver(ensureCancelButton);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  requestAnimationFrame(keepTeammatesApart);

  Prime.MatchEnhancementsV16=Object.freeze({ensureCancelButton,cancelCurrentMatch});
})(window.Prime=window.Prime||{});
