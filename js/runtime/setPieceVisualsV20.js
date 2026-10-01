(function(Prime){
  if(!Prime.Pitch)return;
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  if(!F)return;
  const base=Prime.Pitch;
  const originalPlayEvent=base.playEvent&&base.playEvent.bind(base);
  const originalDraw=base.draw&&base.draw.bind(base);

  function scene(){return base.getScene&&base.getScene();}
  function player(key,id){const s=scene();return s?.players?.find(p=>p.key===key&&String(p.id)===String(id))||null;}
  function teamPlayers(key){const s=scene();return (s?.players||[]).filter(p=>p.key===key&&!p.isKeeper);}
  function attacksTop(key,s){return (key==='A')!==Boolean(s?.state?.match?.secondHalf);}
  function nearestMate(key,from){
    return teamPlayers(key).filter(p=>p!==from).sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y))[0]||null;
  }
  function lerp(a,b,t){return a+(b-a)*t;}
  function ease(t){return 1-Math.pow(1-Math.max(0,Math.min(1,t)),2.2);}

  function animateBall(points,duration,done){
    const s=scene(); if(!s?.ball){done&&done();return;}
    const started=performance.now();
    s.carrier=null;s.target=null;s.ball.state='dead';s.ball.ownerKey=null;s.ball.ownerIndex=-1;
    function tick(now){
      const q=Math.max(0,Math.min(1,(now-started)/duration));
      const e=ease(q);
      const p0=points[0],p1=points[1];
      s.ball.x=lerp(p0.x,p1.x,e);s.ball.y=lerp(p0.y,p1.y,e);
      s.ball.z=(p0.z||0)+(p1.z||0-(p0.z||0))*e+Math.sin(Math.PI*q)*(p1.arc||0);
      s.ball.vx=s.ball.vy=s.ball.vz=0;
      originalDraw&&originalDraw(s);
      if(q<1)requestAnimationFrame(tick);else done&&done();
    }
    requestAnimationFrame(tick);
  }

  function throwIn(evt,done){
    const s=scene(); if(!s?.ball){originalPlayEvent?.(evt,done);return;}
    const candidates=teamPlayers(evt.team); if(!candidates.length){done&&done({setPiece:true});return;}
    const thrower=candidates.slice().sort((a,b)=>Math.abs(a.x-s.ball.x)-Math.abs(b.x-s.ball.x))[0];
    const side=thrower.x<F.width/2?0:F.width;
    const y=Math.max(8,Math.min(F.length-8,thrower.y));
    const mate=nearestMate(evt.team,thrower)||thrower;
    const inX=side===0?Math.min(F.width-2,6):Math.max(2,F.width-6);
    thrower.x=side===0?1.2:F.width-1.2;thrower.y=y;thrower.tx=thrower.x;thrower.ty=thrower.y;
    const start={x:s.ball.x,y:s.ball.y,z:s.ball.z||0};
    animateBall([start,{x:side,y,z:0,arc:.4}],260,()=>{
      s.ball.x=side;s.ball.y=y;s.ball.z=1.7;
      setTimeout(()=>animateBall([{x:side,y,z:1.7},{x:inX,y:mate.y,z:0,arc:1.2}],620,()=>{
        done&&done({setPiece:true,kind:'throw-in'});
      }),160);
    });
  }

  function corner(evt,done){
    const s=scene(); if(!s?.ball){originalPlayEvent?.(evt,done);return;}
    const top=attacksTop(evt.team,s);
    const goalY=top?0:F.length;
    const side=s.ball.x<F.width/2?0:F.width;
    const kickX=side===0?1.1:F.width-1.1;
    const targetX=F.width/2+(side===0?3.5:-3.5);
    const targetY=top?F.penaltyAreaDepth*.72:F.length-F.penaltyAreaDepth*.72;
    const kicker=teamPlayers(evt.team).slice().sort((a,b)=>Math.hypot(a.x-kickX,a.y-goalY)-Math.hypot(b.x-kickX,b.y-goalY))[0];
    if(kicker){kicker.x=kickX;kicker.y=top?1.2:F.length-1.2;kicker.tx=kicker.x;kicker.ty=kicker.y;}
    const start={x:s.ball.x,y:s.ball.y,z:s.ball.z||0};
    animateBall([start,{x:side,y:goalY,z:0,arc:.55}],300,()=>{
      s.ball.x=side;s.ball.y=goalY;s.ball.z=0;
      setTimeout(()=>animateBall([{x:side,y:goalY,z:0},{x:targetX,y:targetY,z:.35,arc:4.2}],900,()=>{
        done&&done({setPiece:true,kind:'corner'});
      }),180);
    });
  }

  function playEvent(evt,done){
    if(evt?.type==='THROW_IN')return throwIn(evt,done);
    if(evt?.type==='CORNER')return corner(evt,done);
    return originalPlayEvent?originalPlayEvent(evt,done):done&&done({missing:true});
  }

  Prime.Pitch=Object.freeze(Object.assign({},base,{playEvent}));
  Prime.SetPieceVisualsV20=Object.freeze({});
})(window.Prime=window.Prime||{});