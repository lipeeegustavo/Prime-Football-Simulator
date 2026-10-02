(function(Prime){
  if(!Prime.Pitch||!Prime.Ball||!Prime.FieldGeometry)return;
  const base=Prime.Pitch;
  const F=Prime.FieldGeometry.FIELD;
  const G=Prime.FieldGeometry;
  const originalPlayEvent=base.playEvent?.bind(base);

  function scene(){return base.getScene?.();}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function other(k){return k==='A'?'B':'A';}
  function findPlayer(key,id){return scene()?.players?.find(p=>p.key===key&&String(p.id)===String(id))||null;}
  function playerData(id){return Prime.Squad?.playerById?.(id)||null;}
  function attrs(id){return playerData(id)?.attributes||{};}
  function hash01(text){
    const h=Prime.Rng?.hashString?Prime.Rng.hashString(String(text)):2166136261;
    return (h>>>0)/4294967295;
  }
  function attacksTop(key,s){return (key==='A')!==Boolean(s?.state?.match?.secondHalf);}
  function goalAngle(shooter,top){
    if(!shooter)return 0;
    const y=top?0:F.length,g=G.goalMouthX();
    const a={x:g.left-shooter.x,y:y-shooter.y},b={x:g.right-shooter.x,y:y-shooter.y};
    const la=Math.hypot(a.x,a.y)||1,lb=Math.hypot(b.x,b.y)||1;
    const c=clamp((a.x*b.x+a.y*b.y)/(la*lb),-1,1);
    return Math.acos(c);
  }
  function plausibleGoal(evt,s,shooter){
    if(evt.outcome!=='GOAL')return false;
    const top=attacksTop(evt.team,s),gy=top?0:F.length;
    const distance=Math.hypot(shooter.x-F.width/2,shooter.y-gy);
    if(distance>48)return false;
    const angle=goalAngle(shooter,top);
    const a=attrs(shooter.id),fin=(a.finishing||70)/100,pos=(a.positioning||70)/100;
    const distFactor=clamp(1-(distance-12)/48,.18,1);
    const angleFactor=clamp(angle/.52,.18,1);
    const acceptance=clamp(.18+.82*distFactor*angleFactor*(.58+.28*fin+.14*pos),.08,.98);
    const state=s.state,seed=state?.settings?.seed||'PRIME';
    const u=hash01(`${seed}|${state?.match?.gameSeconds||0}|${evt.team}|${shooter.id}|goal-accept`);
    return u<acceptance;
  }

  function passEvent(evt,done){
    const s=scene();
    const fromId=evt.playerId||evt.fromId,toId=evt.targetId||evt.toId;
    const from=findPlayer(evt.team,fromId),to=findPlayer(evt.team,toId);
    if(!from||!to){done&&done({missing:true,fromId,toId});return;}
    const dist=Math.hypot(to.x-from.x,to.y-from.y);
    const cross=evt.type==='CROSS';
    const speed=cross?clamp(23+dist*.22,24,33):clamp(17+dist*.42,18,32);
    const mapped=Object.assign({},evt,{playerId:String(fromId),targetId:String(toId),fromId:String(fromId),toId:String(toId),speed});
    return originalPlayEvent?originalPlayEvent(mapped,done):done&&done({missing:true});
  }

  function stopBallAt(ball,x,y,z){
    ball.x=x;ball.y=y;ball.z=Math.max(0,z||0);ball.vx=ball.vy=ball.vz=0;ball.spin=0;ball.state='dead';
  }

  function normalizeShotOut(s,evt,before,doneResult){
    const state=s.state,m=state?.match;if(!m)return;
    const atk=evt.team,def=other(atk);
    if(evt.outcome==='GOAL')m.stats.onTarget[atk]=Math.max(0,(m.stats.onTarget[atk]||0)-1);
    if((m.stats.corners?.[atk]||0)>before.corners)m.stats.corners[atk]=before.corners;
    const fresh=(m.events||[]).slice(before.eventsLen);
    if(fresh.some(e=>e.type==='CORNER'&&e.data?.team===atk)){
      m.events=m.events.filter((e,i)=>i<before.eventsLen||!(e.type==='CORNER'&&e.data?.team===atk));
    }
    const keeperId=state.teams?.[def]?.starters?.[0]||null;
    m.poss=def;m.carrierId=keeperId;m.possessionActions=0;m.attackPhase='BUILDUP';m.stoppageWindow=true;
    const hasGoalKick=(m.events||[]).slice(-5).some(e=>e.type==='GOAL_KICK'&&e.data?.team===def&&e.minute===Math.floor((m.gameSeconds||0)/60));
    if(!hasGoalKick){
      const minute=Math.floor((m.gameSeconds||0)/60);
      m.events.push({minute,text:`${minute}' — tiro de meta para ${state.teams[def].name}.`,cls:'event',type:'GOAL_KICK',data:{type:'GOAL_KICK',team:def,minute,physical:true,v24:true}});
      if(m.events.length>180)m.events.splice(0,m.events.length-180);
    }
    if(keeperId)base.restartToCarrier?.(def,keeperId,'goal-kick');
    Prime.UI?.updateMatchHud?.();
  }

  function physicalShot(evt,done){
    const s=scene();if(!s?.ball){done&&done({missing:true});return;}
    const shooter=findPlayer(evt.team,evt.playerId)||s.carrier;
    if(!shooter){done&&done({missing:true});return;}
    const state=s.state,m=state?.match;
    const before={corners:m?.stats?.corners?.[evt.team]||0,eventsLen:m?.events?.length||0};
    const top=attacksTop(evt.team,s),mouth=G.goalMouthX(),goalY=top?-1.05:F.length+1.05;
    const seed=state?.settings?.seed||'PRIME',u=hash01(`${seed}|${m?.gameSeconds||0}|${shooter.id}|shot-target`);
    const acceptedGoal=plausibleGoal(evt,s,shooter);
    let effective=evt.outcome;
    if(evt.outcome==='GOAL'&&!acceptedGoal)effective='OUT';

    if(Math.hypot(s.ball.x-shooter.x,s.ball.y-shooter.y)<2.8){
      s.ball.x=shooter.x;s.ball.y=shooter.y;s.ball.z=Math.min(.25,s.ball.z||0);
    }
    s.carrier=null;s.target=null;s.v24ShotActive=true;
    shooter.actionState='shot';shooter.actionTime=.58;shooter.animTime=0;

    const gk=s.players.find(p=>p.key!==evt.team&&p.isKeeper)||null;
    let tx=F.width/2,loft=.04,spin=(u-.5)*3.2;
    if(effective==='GOAL'){
      tx=mouth.left+(mouth.right-mouth.left)*(.18+.64*u);loft=.01+.055*(1-u);
    }else if(effective==='SAVE'){
      tx=gk?clamp(gk.x,mouth.left+.2,mouth.right-.2):F.width/2;loft=.035+.04*u;spin*=.45;
      if(gk){gk.tx=tx;gk.ty=top?.7:F.length-.7;gk.actionState='dive';gk.actionTime=.85;gk.animTime=0;}
    }else{
      const left=u<.5;tx=left?mouth.left-(1.2+u*3):mouth.right+(1.2+(1-u)*3);loft=.035+.08*u;spin*=.6;
    }
    const distance=Math.hypot(tx-s.ball.x,goalY-s.ball.y);
    const speed=clamp(27+distance*.24,29,43);
    Prime.Ball.kickToward(s.ball,tx,goalY,speed,'shot-v24',{loft,spin});

    let finished=false,last={x:s.ball.x,y:s.ball.y},started=performance.now();
    function finish(result,asOut){
      if(finished)return;finished=true;s.v24ShotActive=false;
      done&&done(result||{});
    }
    function tick(){
      if(finished)return;
      const b=s.ball,elapsed=performance.now()-started;
      if(effective==='SAVE'&&gk){
        const d=Math.hypot(b.x-gk.x,b.y-gk.y);
        if(d<1.45&&b.z<2.7){stopBallAt(b,gk.x,gk.y,.22);finish({goalCrossed:false,saved:true,outcome:'SAVE'},false);return;}
      }
      const crossedTop=last.y>=0&&b.y<0,crossedBottom=last.y<=F.length&&b.y>F.length;
      if(crossedTop||crossedBottom){
        const inside=b.x>=mouth.left&&b.x<=mouth.right&&Number(b.z||0)<=2.44;
        if(effective==='GOAL'&&inside){
          if(top)s.netPulseTop=1;else s.netPulseBottom=1;
          stopBallAt(b,b.x,top?-.75:F.length+.75,Math.min(2.2,b.z||0));
          finish({goalCrossed:true,physicalGoal:true},false);return;
        }
        stopBallAt(b,clamp(b.x,-2,F.width+2),top?-.35:F.length+.35,Math.max(0,b.z||0));
        finish({goalCrossed:false,outcome:'OUT',physicalOut:true},true);return;
      }
      if(b.x<-.5||b.x>F.width+.5){
        stopBallAt(b,clamp(b.x,0,F.width),clamp(b.y,0,F.length),0);
        finish({goalCrossed:false,outcome:'OUT',physicalOut:true},true);return;
      }
      if(elapsed>(Prime.Balance?.ball?.shotMaxVisualSeconds||3.2)*1000||b.state==='dead'){
        stopBallAt(b,clamp(b.x,0,F.width),clamp(b.y,0,F.length),0);
        finish({goalCrossed:false,outcome:effective,timeout:true},effective!=='SAVE');return;
      }
      last={x:b.x,y:b.y};requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function foulVisual(evt,done){
    const s=scene();if(!s){done&&done();return;}
    const offender=findPlayer(evt.team,evt.playerId);
    if(offender){offender.actionState='tackle';offender.actionTime=.6;offender.animTime=0;}
    if(s.carrier){s.carrier.actionState='fall';s.carrier.actionTime=.75;s.carrier.animTime=0;}
    if(s.referee){s.referee.tx=s.ball.x;s.referee.ty=clamp(s.ball.y+2,2,F.length-2);}
    const started=performance.now();
    function tick(){if(performance.now()-started>720){done&&done({freeKick:true});return;}requestAnimationFrame(tick);}requestAnimationFrame(tick);
  }

  function playEvent(evt,done){
    if(!evt)return originalPlayEvent?originalPlayEvent(evt,done):done&&done();
    if(evt.type==='PASS'||evt.type==='CROSS')return passEvent(evt,done);
    if(evt.type==='SHOT')return physicalShot(evt,done);
    if(evt.type==='FOUL')return foulVisual(evt,done);
    return originalPlayEvent?originalPlayEvent(evt,done):done&&done();
  }

  Prime.Pitch=Object.freeze(Object.assign({},base,{playEvent}));
  Prime.CoreStabilityV24=Object.freeze({enabled:true,version:'24.0',passIdsNormalized:true,physicalShots:true,forcedGoals:false});
})(window.Prime=window.Prime||{});
