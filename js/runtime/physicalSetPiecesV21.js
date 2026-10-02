(function(Prime){
  if(!Prime.Pitch||!Prime.Ball)return;
  const base=Prime.Pitch,F=Prime.FieldGeometry?.FIELD;if(!F)return;
  const originalPlayEvent=base.playEvent?.bind(base);

  function scene(){return base.getScene?.();}
  function players(key){return (scene()?.players||[]).filter(p=>p.key===key&&!p.isKeeper);}
  function find(key,id){return (scene()?.players||[]).find(p=>p.key===key&&String(p.id)===String(id))||null;}
  function attacksTop(key,s){return (key==='A')!==Boolean(s?.state?.match?.secondHalf);}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function nearest(list,x,y){return list.slice().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||null;}

  function waitUntil(test,timeout,done){
    const started=performance.now();
    function tick(){
      if(test()){done(true);return;}
      if(performance.now()-started>=timeout){done(false);return;}
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function releaseFrom(player,targetX,targetY,speed,loft,spin){
    const s=scene();if(!s?.ball)return false;
    if(player&&Math.hypot(s.ball.x-player.x,s.ball.y-player.y)<2.2){s.ball.x=player.x;s.ball.y=player.y;s.ball.z=Math.max(0,s.ball.z||0);}
    s.carrier=null;s.target=null;
    Prime.Ball.kickToward(s.ball,targetX,targetY,speed,'free',{loft:loft||0,spin:spin||0});
    return true;
  }
  function movePlayer(player,x,y,duration,done){
    if(!player){done&&done();return;}
    const sx=player.x,sy=player.y,dist=Math.hypot(x-sx,y-sy);
    const walkingMs=dist/5.4*1000;
    const ms=Math.max(320,Math.min(2400,duration||walkingMs));
    const start=performance.now();
    function tick(now){
      const q=clamp((now-start)/ms,0,1),e=q*q*(3-2*q);player.x=sx+(x-sx)*e;player.y=sy+(y-sy)*e;player.tx=player.x;player.ty=player.y;
      if(q<1)requestAnimationFrame(tick);else done&&done();
    }
    requestAnimationFrame(tick);
  }

  function settleToReceiver(s,mate,done,result){
    if(!s?.ball||!mate){done&&done(result||{});return;}
    s.ball.x=mate.x;s.ball.y=mate.y;s.ball.z=0;s.ball.vx=s.ball.vy=s.ball.vz=0;
    s.carrier=mate;s.target=null;
    Prime.Ball.setControlled(s.ball,mate.x,mate.y,mate.key,mate.index);
    done&&done(Object.assign({receiverId:String(mate.id)},result||{}));
  }

  function ballOutTouchline(evt,done){
    const s=scene(),carrier=find(evt.lastTouchTeam||evt.team,evt.playerId)||s?.carrier;if(!s?.ball||!carrier){done&&done({outOfPlay:false});return;}
    const left=carrier.x<F.width/2,targetX=left?-1.4:F.width+1.4;
    const dir=attacksTop(carrier.key,s)?-1:1,targetY=clamp(carrier.y+dir*(4+Math.abs(carrier.vy||0)*.35),5,F.length-5);
    releaseFrom(carrier,targetX,targetY,16.5,.04,left?-1.5:1.5);
    waitUntil(()=>s.ball.x<0||s.ball.x>F.width,1800,ok=>{
      s.ball.vx=s.ball.vy=s.ball.vz=0;s.ball.state='dead';s.ball.x=left?0:F.width;s.ball.y=clamp(s.ball.y,3,F.length-3);s.ball.z=0;
      done&&done({outOfPlay:ok!==false,side:left?'left':'right',y:s.ball.y});
    });
  }
  function ballOutGoalLine(evt,done){
    const s=scene(),carrier=find(evt.team,evt.playerId)||s?.carrier;if(!s?.ball||!carrier){done&&done({outOfPlay:false});return;}
    const top=attacksTop(evt.team,s),mouth=Prime.FieldGeometry.goalMouthX?.()||{left:F.width/2-3.66,right:F.width/2+3.66};
    let targetX=carrier.x<F.width/2?mouth.left-3.2:mouth.right+3.2;targetX=clamp(targetX,1.5,F.width-1.5);
    const targetY=top?-1.5:F.length+1.5;
    releaseFrom(carrier,targetX,targetY,22,.12,(carrier.x<F.width/2?-1:1)*2.2);
    waitUntil(()=>s.ball.y<0||s.ball.y>F.length,1900,ok=>{
      s.ball.vx=s.ball.vy=s.ball.vz=0;s.ball.state='dead';s.ball.y=top?0:F.length;s.ball.x=clamp(s.ball.x,1,F.width-1);s.ball.z=0;
      done&&done({outOfPlay:ok!==false,side:s.ball.x<F.width/2?'left':'right',x:s.ball.x,top});
    });
  }
  function throwIn(evt,done){
    const s=scene();if(!s?.ball){done&&done({setPiece:false});return;}
    const side=evt.side||((s.ball.x<F.width/2)?'left':'right'),x=side==='left'?0:F.width,y=clamp(Number(evt.outY??s.ball.y),3,F.length-3);
    const thrower=nearest(players(evt.team),x,y);if(!thrower){done&&done({setPiece:false});return;}
    const inX=side==='left'?5.5:F.width-5.5;
    const receivers=players(evt.team).filter(p=>p!==thrower),mate=nearest(receivers,inX,y)||thrower;
    s.ball.x=x;s.ball.y=y;s.ball.z=0;s.ball.state='dead';s.ball.vx=s.ball.vy=s.ball.vz=0;s.carrier=null;
    movePlayer(thrower,side==='left'?.9:F.width-.9,y,null,()=>{
      s.ball.x=x;s.ball.y=y;s.ball.z=1.75;
      releaseFrom(null,clamp(mate.x,4,F.width-4),clamp(mate.y,4,F.length-4),15.5,.27,side==='left'?1.6:-1.6);
      waitUntil(()=>Math.hypot(s.ball.x-mate.x,s.ball.y-mate.y)<1.8||(s.ball.state==='dead'&&s.ball.z===0),2100,()=>{
        settleToReceiver(s,mate,done,{setPiece:true,kind:'throw-in'});
      });
    });
  }
  function corner(evt,done){
    const s=scene();if(!s?.ball){done&&done({setPiece:false});return;}
    const top=attacksTop(evt.team,s),goalY=top?0:F.length;
    const side=evt.side||((s.ball.x<F.width/2)?'left':'right'),cornerX=side==='left'?0:F.width;
    const kicker=nearest(players(evt.team),cornerX,goalY);if(!kicker){done&&done({setPiece:false});return;}
    const targets=players(evt.team).filter(p=>p!==kicker),target=nearest(targets,F.width/2,top?F.penaltyAreaDepth*.72:F.length-F.penaltyAreaDepth*.72)||kicker;
    s.ball.x=cornerX;s.ball.y=goalY;s.ball.z=0;s.ball.state='dead';s.ball.vx=s.ball.vy=s.ball.vz=0;s.carrier=null;
    movePlayer(kicker,side==='left'?1:F.width-1,top?1:F.length-1,null,()=>{
      const tx=clamp(target.x,5,F.width-5),ty=clamp(target.y,4,F.length-4);
      releaseFrom(null,tx,ty,25.5,.68,side==='left'?3.8:-3.8);
      waitUntil(()=>Math.hypot(s.ball.x-target.x,s.ball.y-target.y)<2.2||(s.ball.state==='dead'&&s.ball.z===0),2400,()=>{
        settleToReceiver(s,target,done,{setPiece:true,kind:'corner'});
      });
    });
  }
  function playEvent(evt,done){
    if(evt?.type==='OUT_TOUCHLINE')return ballOutTouchline(evt,done);
    if(evt?.type==='OUT_GOAL_LINE')return ballOutGoalLine(evt,done);
    if(evt?.type==='THROW_IN'){
      const s=scene();if(!s?.ball)return done&&done({setPiece:false});
      const alreadyOut=s.ball.x<=0||s.ball.x>=F.width;
      if(alreadyOut)return throwIn(evt,done);
      const current=s.carrier||nearest((s.players||[]).filter(p=>!p.isKeeper),s.ball.x,s.ball.y);
      return ballOutTouchline({team:evt.team,lastTouchTeam:current?.key||((evt.team==='A')?'B':'A'),playerId:current?.id},res=>throwIn(Object.assign({},evt,{side:res.side,outY:res.y}),done));
    }
    if(evt?.type==='CORNER'){
      const s=scene();if(!s?.ball)return done&&done({setPiece:false});
      const alreadyOut=s.ball.y<=0||s.ball.y>=F.length;
      if(alreadyOut)return corner(evt,done);
      const current=s.carrier||nearest((s.players||[]).filter(p=>!p.isKeeper),s.ball.x,s.ball.y);
      return ballOutGoalLine({team:evt.team,playerId:current?.id},res=>corner(Object.assign({},evt,{side:res.side}),done));
    }
    return originalPlayEvent?originalPlayEvent(evt,done):done&&done();
  }
  Prime.Pitch=Object.freeze(Object.assign({},base,{playEvent}));
  Prime.PhysicalSetPiecesV21=Object.freeze({enabled:true});
})(window.Prime=window.Prime||{});
