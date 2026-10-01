(function(Prime){
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  const GOAL_HEIGHT=2.44;
  if(!Prime.Pitch||!F)return;

  const base=Prime.Pitch;
  const originalPlayEvent=base.playEvent&&base.playEvent.bind(base);
  const originalFrame=base.frame&&base.frame.bind(base);
  const originalSetCarrier=base.setCarrier&&base.setCarrier.bind(base);
  const originalRestart=base.restartToCarrier&&base.restartToCarrier.bind(base);
  const originalDraw=base.draw&&base.draw.bind(base);

  let queuedVisual=null;
  let allowJumpOnce=false;
  let lastBall=null;

  function scene(){return base.getScene&&base.getScene();}
  function player(key,id){
    const s=scene();
    return s&&s.players&&s.players.find(p=>p.key===key&&String(p.id)===String(id));
  }
  function dist(a,b){return a&&b?Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0)):Infinity;}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function mouth(){
    const half=F.goalWidth/2;
    return {left:F.width/2-half,right:F.width/2+half};
  }
  function sourceId(evt){return evt&&(evt.playerId||evt.fromId||evt.shooterId||null);}
  function needsSourceBridge(evt){
    return evt&&['POSSESSION','RECEIVE','PASS','CROSS','DRIBBLE','CUT_INSIDE','SHOT'].includes(evt.type);
  }

  function normalizeShot(evt){
    if(!evt||evt.type!=='SHOT')return evt;
    const out=Object.assign({},evt);
    if(!['GOAL','SAVE','OUT'].includes(out.outcome))out.outcome='OUT';
    return out;
  }

  // O chute para gol já nasce apontado para DENTRO da baliza. Assim não
  // precisamos puxar a bola para dentro no último instante, o que parecia
  // uma curva impossível/teleporte.
  const baseBall=Prime.Ball;
  if(baseBall&&typeof baseBall.kickToward==='function'){
    const originalKickToward=baseBall.kickToward.bind(baseBall);
    function kickToward(ball,x,y,speed,state,options){
      const o=Object.assign({},options||{});
      const g=mouth();
      if(state==='shot-goal'){
        x=clamp(Number(x)||F.width/2,g.left+.7,g.right-.7);
        o.spin=clamp(Number(o.spin)||0,-1.6,1.6);
        o.loft=Math.min(.10,Math.max(0,Number(o.loft)||0));
        if(Number.isFinite(o.vz))o.vz=Math.min(o.vz,4.2);
      }else if(state==='shot'){
        // Chutes que não são gol não recebem correção artificial para dentro.
        o.spin=clamp(Number(o.spin)||0,-8,8);
      }
      return originalKickToward(ball,x,y,speed,state,o);
    }
    Prime.Ball=Object.freeze(Object.assign({},baseBall,{kickToward}));
  }

  function smoothToPlayer(key,id){
    const s=scene(),p=player(key,id);
    if(!s||!p||!s.ball)return false;
    if(dist(s.ball,p)<=2.15)return false;
    if(base.isActionActive&&base.isActionActive())return false;
    if(originalRestart){originalRestart(key,id,'continuity');return true;}
    return false;
  }

  function dispatchQueued(){
    if(!queuedVisual||!originalPlayEvent)return;
    if(base.isActionActive&&base.isActionActive())return;
    const item=queuedVisual;queuedVisual=null;
    originalPlayEvent(item.evt,item.done);
  }

  function playEvent(evt,done){
    if(!originalPlayEvent){done&&done({missing:true});return;}
    const visualEvt=normalizeShot(evt);
    const id=sourceId(visualEvt);
    if(needsSourceBridge(visualEvt)&&id){
      const p=player(visualEvt.team,id),s=scene();
      if(p&&s&&s.ball&&dist(s.ball,p)>2.15&&!base.isActionActive?.()){
        queuedVisual={evt:visualEvt,done};
        if(smoothToPlayer(visualEvt.team,id))return;
        queuedVisual=null;
      }
    }
    originalPlayEvent(visualEvt,done);
  }

  function setCarrier(key,id){
    const s=scene(),p=player(key,id);
    if(!s||!p||!s.ball||!originalSetCarrier)return originalSetCarrier&&originalSetCarrier(key,id);
    if(allowJumpOnce){allowJumpOnce=false;return originalSetCarrier(key,id);}
    if(dist(s.ball,p)>2.15&&!base.isActionActive?.()&&originalRestart){
      originalRestart(key,id,'continuity');return;
    }
    return originalSetCarrier(key,id);
  }

  function restartToCarrier(key,id,kind){
    if(kind==='kickoff')allowJumpOnce=true;
    return originalRestart?originalRestart(key,id,kind):originalSetCarrier&&originalSetCarrier(key,id);
  }

  function steerShotBeforeLine(s){
    const a=s?.action,b=s?.ball;
    if(!a||a.type!=='shot'||!b)return false;
    const g=mouth();
    const attacksTop=(a.teamKey==='A')!==Boolean(s.state?.match?.secondHalf);
    const distanceToLine=attacksTop?b.y:(F.length-b.y);
    if(distanceToLine>10||distanceToLine<-.8)return false;

    if(a.outcome==='GOAL'){
      const desiredX=clamp(b.x,g.left+.65,g.right-.65);
      const error=desiredX-b.x;
      b.vx+=error*.75;
      b.spin=clamp(b.spin||0,-1.3,1.3);
      // Mantém a trajetória abaixo do travessão sem mudar x/y instantaneamente.
      if((b.z||0)>GOAL_HEIGHT-.22&&b.vz>0)b.vz=-Math.max(1.2,Math.abs(b.vz)*.35);
      return true;
    }

    if(a.outcome==='OUT'&&b.x>=g.left-.2&&b.x<=g.right+.2){
      const side=b.x<F.width/2?-1:1;
      const targetX=side<0?g.left-.9:g.right+.9;
      b.vx+=(targetX-b.x)*1.15;
      return true;
    }
    return false;
  }

  function protectGoalVolume(s){
    if(!s||!s.ball)return false;
    const a=s.action;
    if(!a||a.type!=='shot')return false;
    const b=s.ball,g=mouth();
    const attacksTop=(a.teamKey==='A')!==Boolean(s.state?.match?.secondHalf);
    const crossed=attacksTop?b.y<=0:b.y>=F.length;
    if(!crossed)return false;

    const insideWidth=b.x>=g.left&&b.x<=g.right;
    const belowBar=(b.z||0)<GOAL_HEIGHT;

    if(a.outcome==='GOAL'){
      // Se o motor marcou gol, a trajetória precisa ter chegado fisicamente
      // dentro do volume. Não fazemos snap lateral aqui.
      if(!insideWidth||!belowBar){
        const targetX=clamp(b.x,g.left+.7,g.right-.7);
        b.vx+=(targetX-b.x)*2.2;
        if(!belowBar){b.z=GOAL_HEIGHT-.12;b.vz=-Math.abs(b.vz||1);}
      }
      return true;
    }

    if(a.outcome==='SAVE'&&insideWidth&&belowBar){
      b.y=attacksTop?.18:F.length-.18;
      b.vy=0;b.vz=Math.min(0,b.vz||0);b.state='dead';
      return true;
    }

    if(a.outcome==='OUT'&&insideWidth&&belowBar){
      const side=b.x<F.width/2?-1:1;
      b.x=side<0?g.left-.36:g.right+.36;
      b.vx=side*Math.max(5.5,Math.abs(b.vx||0));
      return true;
    }
    return false;
  }

  function preventImpossibleJump(s){
    if(!s||!s.ball)return false;
    const b=s.ball;
    if(!lastBall){lastBall={x:b.x,y:b.y,z:b.z||0};return false;}
    const d=Math.hypot(b.x-lastBall.x,b.y-lastBall.y);
    const legitimateKick=s.action&&['shot','receive','penalty','restart'].includes(s.action.type);
    if(!allowJumpOnce&&!legitimateKick&&d>4.2){
      b.x=lastBall.x;b.y=lastBall.y;b.z=Math.min(b.z||0,lastBall.z+.5);
      if(s.carrier&&Prime.Ball&&Prime.Ball.setControlled){Prime.Ball.setControlled(b,s.carrier.x,s.carrier.y,s.carrier.key,s.carrier.index);}
      return true;
    }
    return false;
  }

  function rememberBall(s){
    if(!s||!s.ball){lastBall=null;return;}
    lastBall={x:s.ball.x,y:s.ball.y,z:s.ball.z||0};
  }

  function frame(dt){
    const s0=scene();if(s0&&s0.ball&&!lastBall)rememberBall(s0);
    const result=originalFrame&&originalFrame(dt);
    const s=scene();
    if(s&&s.ball){
      const corrected=preventImpossibleJump(s)|steerShotBeforeLine(s)|protectGoalVolume(s);
      if(corrected&&originalDraw)originalDraw(s);
      rememberBall(s);
    }
    dispatchQueued();
    return result;
  }

  Prime.Pitch=Object.freeze(Object.assign({},base,{playEvent,frame,setCarrier,restartToCarrier}));
  Prime.BallAuthorityV17=Object.freeze({GOAL_HEIGHT});
})(window.Prime=window.Prime||{});
