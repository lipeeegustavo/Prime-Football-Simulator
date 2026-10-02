(function(Prime){
  if(!Prime.Pitch||!Prime.MatchEngine)return;
  const pitch=Prime.Pitch,engine=Prime.MatchEngine;
  const originalPlayEvent=pitch.playEvent?.bind(pitch);
  const originalPlayPenalty=pitch.playPenalty?.bind(pitch);
  const originalSubmit=engine.submitPenaltyChoice?.bind(engine);

  function scene(){return pitch.getScene?.();}
  function hash01(text){const h=Prime.Rng?.hashString?Prime.Rng.hashString(String(text)):2166136261;return (h>>>0)/4294967295;}
  function playerName(id){return Prime.Squad?.playerById?.(id)?.name||'Jogador';}

  function normalizeDirectRed(evt){
    if(!evt?.directRed||evt.secondYellow)return evt;
    const s=scene(),state=s?.state,m=state?.match;if(!m)return evt;
    const seed=state.settings?.seed||'PRIME';
    const keepRed=hash01(`${seed}|${m.gameSeconds||0}|${evt.team}|${evt.playerId}|direct-red`)<.13;
    if(keepRed)return evt;
    const id=String(evt.playerId);
    m.sentOff[evt.team]=(m.sentOff[evt.team]||[]).filter(x=>String(x)!==id);
    m.stats.red[evt.team]=Math.max(0,(m.stats.red[evt.team]||0)-1);
    m.cards[evt.team][id]=(m.cards[evt.team][id]||0)+1;
    m.stats.yellow[evt.team]=(m.stats.yellow[evt.team]||0)+1;
    for(let i=m.events.length-1;i>=0;i--){
      const e=m.events[i];
      if(e.type==='RED_CARD'&&String(e.data?.playerId)===id&&e.data?.team===evt.team){
        e.type='YELLOW_CARD';e.cls='event';e.text=`${e.minute}' — 🟨 amarelo para ${playerName(id)}${evt.reason?` por ${evt.reason}`:''}.`;
        e.data=Object.assign({},evt,{type:'YELLOW_CARD',directRed:false,downgradedV24:true});break;
      }
    }
    Prime.UI?.updateMatchHud?.();
    return Object.assign({},evt,{type:'YELLOW_CARD',directRed:false,downgradedV24:true});
  }

  function normalizeSecondYellow(evt){
    if(!evt?.secondYellow)return;
    const s=scene(),m=s?.state?.match;if(!m||evt._v24SecondYellowNormalized)return;
    evt._v24SecondYellowNormalized=true;
    m.stats.yellow[evt.team]=(m.stats.yellow[evt.team]||0)+1;
    const id=String(evt.playerId);
    for(let i=m.events.length-1;i>=0;i--){
      const e=m.events[i];
      if(e.type==='RED_CARD'&&e.data?.secondYellow&&String(e.data?.playerId)===id){
        m.events.splice(i,0,{minute:e.minute,text:`${e.minute}' — 🟨 segundo amarelo para ${playerName(id)}${evt.reason?` por ${evt.reason}`:''}.`,cls:'event',type:'YELLOW_CARD',data:{type:'YELLOW_CARD',team:evt.team,playerId:id,reason:evt.reason,secondYellow:true}});break;
      }
    }
  }

  function playEvent(evt,done){
    let mapped=evt;
    if(evt?.type==='RED_CARD'){
      normalizeSecondYellow(evt);
      mapped=normalizeDirectRed(evt);
    }
    return originalPlayEvent?originalPlayEvent(mapped,done):done&&done();
  }

  function eligiblePenaltyTaker(state,team){
    const m=state?.match,t=state?.teams?.[team];if(!m||!t)return null;
    const sent=new Set((m.sentOff?.[team]||[]).map(String));
    const current=new Set((t.starters||[]).filter(Boolean).map(String));
    const order=(t.penalties||[]).concat(t.starters||[]);
    for(const id of order){if(id&&current.has(String(id))&&!sent.has(String(id)))return String(id);}
    return null;
  }

  function submitPenaltyChoice(state,zone){
    const pn=state?.match?.pendingPenalty;
    if(pn){
      const t=state.teams[pn.team],sent=new Set((state.match.sentOff?.[pn.team]||[]).map(String)),current=new Set((t.starters||[]).map(String));
      if(!current.has(String(pn.shooterId))||sent.has(String(pn.shooterId))){
        const replacement=eligiblePenaltyTaker(state,pn.team);if(replacement)pn.shooterId=replacement;
      }
    }
    return originalSubmit?originalSubmit(state,zone):{ok:false,error:'Motor de pênaltis indisponível.'};
  }

  function shootoutClinched(state){
    const s=state?.match?.shootout;if(!s)return false;
    const kicks=s.kicks||[],a=kicks.filter(k=>k.team==='A').length,b=kicks.filter(k=>k.team==='B').length;
    if(a>=5&&b>=5)return false;
    const remA=Math.max(0,5-a),remB=Math.max(0,5-b);
    return s.A>s.B+remB||s.B>s.A+remA;
  }

  function playPenalty(teamKey,shooterId,shotZone,diveZone,scored,done,meta){
    const wrapped=()=>{
      const state=scene()?.state;
      if(shootoutClinched(state)&&state?.match?.shootout){
        // O callback original incrementará o índice uma vez; 9 faz o próximo request cair em 10 e encerrar imediatamente.
        state.match.shootout.index=9;
      }
      done&&done();
    };
    return originalPlayPenalty?originalPlayPenalty(teamKey,shooterId,shotZone,diveZone,scored,wrapped,meta):wrapped();
  }

  Prime.Pitch=Object.freeze(Object.assign({},pitch,{playEvent,playPenalty}));
  Prime.MatchEngine=Object.freeze(Object.assign({},engine,{submitPenaltyChoice}));
  Prime.RulesStabilityV24=Object.freeze({enabled:true,directRedTarget:'~0.45% por falta',shootoutEligibility:true,earlyShootoutFinish:true});
})(window.Prime=window.Prime||{});
