(function(Prime){
  if(!Prime.Pitch||!Prime.FieldGeometry)return;
  const F=Prime.FieldGeometry.FIELD;
  const base=Prime.Pitch;
  const originalFrame=base.frame?.bind(base);
  const originalPlayEvent=base.playEvent?.bind(base);
  const originalSetCarrier=base.setCarrier?.bind(base);
  const originalRestart=base.restartToCarrier?.bind(base);
  const originalIsActionActive=base.isActionActive?.bind(base);
  let boundaryBusy=false,lastTouchTeam=null,lastTouchPlayerId=null,cooldownUntil=0;

  function scene(){return base.getScene?.();}
  function other(key){return key==='A'?'B':'A';}
  function minute(m){return Math.floor(Number(m?.gameSeconds||0)/60);}
  function addEvent(state,type,team,text,data){
    const m=state?.match;if(!m)return;
    const evt={minute:minute(m),text,cls:'event',type,data:data||null};
    m.events=m.events||[];m.events.push(evt);if(m.events.length>180)m.events.splice(0,m.events.length-180);
    Prime.UI?.updateMatchHud?.();
  }
  function markTouch(evt){
    if(!evt?.team)return;
    if(['PASS','CROSS','DRIBBLE','CUT_INSIDE','SHOT','TACKLE','POSSESSION','RECEIVE'].includes(evt.type)){
      lastTouchTeam=evt.team;
      lastTouchPlayerId=evt.playerId||evt.fromId||evt.toId||null;
    }
  }
  function playEvent(evt,done){markTouch(evt);return originalPlayEvent?originalPlayEvent(evt,done):done&&done({missing:true});}
  function setCarrier(key,id){lastTouchTeam=key;lastTouchPlayerId=id||null;return originalSetCarrier?.(key,id);}
  function restartToCarrier(key,id,kind){lastTouchTeam=key;lastTouchPlayerId=id||null;return originalRestart?originalRestart(key,id,kind):originalSetCarrier?.(key,id);}
  function isActionActive(){return boundaryBusy||Boolean(originalIsActionActive&&originalIsActionActive());}

  function freezeAt(x,y){
    const s=scene();if(!s?.ball)return;
    s.carrier=null;s.target=null;s.ball.x=x;s.ball.y=y;s.ball.z=0;s.ball.vx=s.ball.vy=s.ball.vz=0;s.ball.state='dead';
  }
  function finishBoundary(){boundaryBusy=false;cooldownUntil=performance.now()+500;}
  function handleTouchline(s,state){
    const m=state.match,b=s.ball;if(!m||boundaryBusy)return;
    boundaryBusy=true;
    if(s.action&&base.cancelAction)base.cancelAction();
    const side=b.x<0?'left':'right',outY=Math.max(3,Math.min(F.length-3,b.y));
    const restartTeam=other(lastTouchTeam||m.poss||'A');
    freezeAt(side==='left'?0:F.width,outY);
    m.stats.throwIns[restartTeam]=(m.stats.throwIns[restartTeam]||0)+1;
    m.stoppageWindow=true;m.poss=restartTeam;m.possessionActions=0;m.attackPhase='BUILDUP';
    addEvent(state,'THROW_IN',restartTeam,`${minute(m)}' — lateral para ${state.teams[restartTeam].name}.`,{physical:true,side,outY,lastTouchTeam,lastTouchPlayerId});
    originalPlayEvent?.({type:'THROW_IN',team:restartTeam,side,outY,physicalOut:true},res=>{
      const rid=res?.receiverId;
      m.carrierId=rid||m.carrierId;
      if(rid)originalSetCarrier?.(restartTeam,rid);
      finishBoundary();
    });
  }
  function goalOwnerForSide(state,top){
    const aAttacksTop=!Boolean(state.match?.secondHalf);
    if(top)return aAttacksTop?'B':'A';
    return aAttacksTop?'A':'B';
  }
  function handleGoalLine(s,state){
    const m=state.match,b=s.ball;if(!m||boundaryBusy)return;
    const top=b.y<0,defTeam=goalOwnerForSide(state,top),atkTeam=other(defTeam);
    const g=Prime.FieldGeometry.goalMouthX();
    const insideMouth=b.x>=g.left&&b.x<=g.right&&Number(b.z||0)<2.44;
    if(insideMouth)return;
    boundaryBusy=true;
    if(s.action&&base.cancelAction)base.cancelAction();
    const x=Math.max(1,Math.min(F.width-1,b.x));
    freezeAt(x,top?0:F.length);
    m.stoppageWindow=true;m.possessionActions=0;
    if(lastTouchTeam===defTeam){
      m.stats.corners[atkTeam]=(m.stats.corners[atkTeam]||0)+1;m.poss=atkTeam;m.attackPhase='FINAL_THIRD';
      addEvent(state,'CORNER',atkTeam,`${minute(m)}' — escanteio para ${state.teams[atkTeam].name}.`,{physical:true,top,side:x<F.width/2?'left':'right',lastTouchTeam,lastTouchPlayerId});
      originalPlayEvent?.({type:'CORNER',team:atkTeam,side:x<F.width/2?'left':'right',physicalOut:true},res=>{
        const rid=res?.receiverId;m.carrierId=rid||m.carrierId;if(rid)originalSetCarrier?.(atkTeam,rid);finishBoundary();
      });
    }else{
      m.poss=defTeam;m.attackPhase='BUILDUP';
      const keeperId=state.teams?.[defTeam]?.starters?.[0];m.carrierId=keeperId||null;
      addEvent(state,'GOAL_KICK',defTeam,`${minute(m)}' — tiro de meta para ${state.teams[defTeam].name}.`,{physical:true,top,lastTouchTeam,lastTouchPlayerId});
      if(keeperId)originalRestart?.(defTeam,keeperId,'goal-kick');
      finishBoundary();
    }
  }
  function detect(){
    const s=scene(),state=s?.state,m=state?.match;
    if(!s?.ball||!m||m.finished||m.waitingHalfTime||boundaryBusy||s.v24ShotActive||performance.now()<cooldownUntil)return;
    const a=s.action?.type;
    if(['shot','penalty','restart'].includes(a))return;
    const b=s.ball;
    if(b.state==='controlled')return;
    if(b.x<0||b.x>F.width){handleTouchline(s,state);return;}
    if(b.y<0||b.y>F.length)handleGoalLine(s,state);
  }
  function frame(dt,realDt){const out=originalFrame?.(dt,realDt);detect();return out;}

  Prime.Pitch=Object.freeze(Object.assign({},base,{frame,playEvent,setCarrier,restartToCarrier,isActionActive}));
  Prime.PhysicalBoundaryV23=Object.freeze({enabled:true});
})(window.Prime=window.Prime||{});
