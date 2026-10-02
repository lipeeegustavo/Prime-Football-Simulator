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
    const walkingMs=dist/7.8*1000;
    const ms=Math.max(280,Math.min(1650,duration||walkingMs));
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
  function other(key){return key==='A'?'B':'A';}
  function moveGroup(moves,duration,done){
    if(!moves.length){done&&done();return;}
    const start=performance.now(),ms=Math.max(360,Number(duration)||720);
    const snapshots=moves.map(m=>({p:m.p,sx:m.p.x,sy:m.p.y,x:m.x,y:m.y}));
    function tick(now){
      const q=clamp((now-start)/ms,0,1),e=q*q*(3-2*q);
      snapshots.forEach(m=>{m.p.x=m.sx+(m.x-m.sx)*e;m.p.y=m.sy+(m.y-m.sy)*e;m.p.tx=m.p.x;m.p.ty=m.p.y;});
      if(q<1)requestAnimationFrame(tick);else done&&done();
    }
    requestAnimationFrame(tick);
  }
  function corner(evt,done){
    const s=scene();if(!s?.ball){done&&done({setPiece:false});return;}
    const top=attacksTop(evt.team,s),goalY=top?0:F.length,defKey=other(evt.team);
    const side=evt.side||((s.ball.x<F.width/2)?'left':'right'),cornerX=side==='left'?0:F.width;
    const atk=players(evt.team),defs=players(defKey),kicker=nearest(atk,cornerX,goalY);
    if(!kicker){done&&done({setPiece:false});return;}
    const attackers=atk.filter(p=>p!==kicker),keeper=(s.players||[]).find(p=>p.key===defKey&&p.isKeeper)||null;
    const mirrorY=y=>top?y:F.length-y;
    const xs=[F.width*.36,F.width*.47,F.width*.57,F.width*.66,F.width*.43,F.width*.61];
    const ys=[7.2,9.2,11.5,13.8,15.8,17.0],moves=[];
    attackers.slice(0,6).forEach((p,i)=>moves.push({p,x:xs[i],y:mirrorY(ys[i])}));
    defs.filter(p=>!p.isKeeper).slice(0,6).forEach((p,i)=>moves.push({p,x:clamp(xs[i]+(i%2?1.4:-1.4),3,F.width-3),y:mirrorY(Math.max(4.8,ys[i]-1.5))}));
    if(keeper)moves.push({p:keeper,x:F.width/2,y:top?.75:F.length-.75});
    moves.push({p:kicker,x:side==='left'?.8:F.width-.8,y:top?.8:F.length-.8});
    s.ball.x=cornerX;s.ball.y=goalY;s.ball.z=0;s.ball.state='dead';s.ball.vx=s.ball.vy=s.ball.vz=0;s.carrier=null;s.target=null;
    moveGroup(moves,760,()=>{
      const seed=`${s.state?.settings?.seed||'PRIME'}|CORNER|${Math.floor(s.state?.match?.gameSeconds||0)}|${evt.team}|${side}`;
      const idx=(Prime.Rng?.hashString?Prime.Rng.hashString(seed):0)%Math.max(1,Math.min(5,attackers.length));
      const target=attackers[idx]||nearest(attackers,F.width/2,mirrorY(10))||kicker;
      if(target){target.targeted=true;target.actionState='receive';target.actionTime=.9;}
      const targetX=clamp(target?.x||F.width/2,4,F.width-4),targetY=clamp(target?.y||mirrorY(10.5),3,F.length-3);
      s.ball.x=cornerX;s.ball.y=goalY;s.ball.z=.15;
      releaseFrom(null,targetX,targetY,27.5,.58,side==='left'?4.2:-4.2);
      waitUntil(()=>Math.hypot(s.ball.x-targetX,s.ball.y-targetY)<2.4||(s.ball.state==='dead'&&s.ball.z===0),2300,()=>{
        settleToReceiver(s,target,done,{setPiece:true,kind:'corner',receiverId:String(target?.id||'')});
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
