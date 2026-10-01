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
    // O motor só trabalha com estes três resultados visuais. Qualquer
    // outra classificação de finalização vira "para fora" na animação.
    if(!['GOAL','SAVE','OUT'].includes(out.outcome))out.outcome='OUT';
    return out;
  }

  function smoothToPlayer(key,id){
    const s=scene(),p=player(key,id);
    if(!s||!p||!s.ball)return false;
    if(dist(s.ball,p)<=2.15)return false;
    if(base.isActionActive&&base.isActionActive())return false;
    if(originalRestart){
      originalRestart(key,id,'continuity');
      return true;
    }
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
      const p=player(visualEvt.team,id);
      const s=scene();
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
      originalRestart(key,id,'continuity');
      return;
    }
    return originalSetCarrier(key,id);
  }

  function restartToCarrier(key,id,kind){
    if(kind==='kickoff')allowJumpOnce=true;
    return originalRestart?originalRestart(key,id,kind):originalSetCarrier&&originalSetCarrier(key,id);
  }

  function protectGoalVolume(s){
    if(!s||!s.ball)return false;
    const a=s.action;
    if(!a||a.type!=='shot')return false;
    const b=s.ball,g=mouth();
    const attacksTop=(a.teamKey==='A')!==Boolean(s.state&&s.state.match&&s.state.match.secondHalf);
    const nearLine=attacksTop?b.y<1.15:b.y>F.length-1.15;
    if(!nearLine)return false;

    if(a.outcome==='GOAL'){
      // Gol decidido pelo motor deve cruzar fisicamente entre as traves
      // e abaixo do travessão. A animação nunca contradiz o resultado.
      b.x=clamp(b.x,g.left+.28,g.right-.28);
      if(b.z>GOAL_HEIGHT-.18){b.z=GOAL_HEIGHT-.18;b.vz=Math.min(0,b.vz||0);}
      return true;
    }

    const insideWidth=b.x>=g.left&&b.x<=g.right;
    const belowBar=(b.z||0)<=GOAL_HEIGHT;
    if(!insideWidth||!belowBar)return false;

    if(a.outcome==='SAVE'){
      // Defesa termina antes da linha; não deixa a bola atravessar a rede.
      b.y=attacksTop?.18:F.length-.18;
      b.vy=0;b.vz=Math.min(0,b.vz||0);b.state='dead';
      return true;
    }

    // Finalização para fora: desvia pelo lado da trave mais próximo.
    const leftGap=Math.abs(b.x-g.left),rightGap=Math.abs(g.right-b.x);
    const side=leftGap<rightGap?-1:1;
    b.x=side<0?g.left-.34:g.right+.34;
    b.vx=side*Math.max(5.5,Math.abs(b.vx||0));
    return true;
  }

  function preventImpossibleJump(s){
    if(!s||!s.ball)return false;
    const b=s.ball;
    if(!lastBall){lastBall={x:b.x,y:b.y,z:b.z||0};return false;}
    const d=Math.hypot(b.x-lastBall.x,b.y-lastBall.y);
    const legitimateKick=s.action&&['shot','receive','penalty','restart'].includes(s.action.type);
    if(!allowJumpOnce&&!legitimateKick&&d>4.2){
      // Um frame físico nunca deveria percorrer vários metros de uma vez.
      // Se algum código externo reposicionar a bola, restaura a posição
      // anterior e deixa o controle/passe levá-la até o destino.
      b.x=lastBall.x;b.y=lastBall.y;b.z=Math.min(b.z||0,lastBall.z+.5);
      if(s.carrier&&Prime.Ball&&Prime.Ball.setControlled){
        Prime.Ball.setControlled(b,s.carrier.x,s.carrier.y,s.carrier.key,s.carrier.index);
      }
      return true;
    }
    return false;
  }

  function rememberBall(s){
    if(!s||!s.ball){lastBall=null;return;}
    lastBall={x:s.ball.x,y:s.ball.y,z:s.ball.z||0};
  }

  function frame(dt){
    const s0=scene();
    if(s0&&s0.ball&&!lastBall)rememberBall(s0);
    const result=originalFrame&&originalFrame(dt);
    const s=scene();
    if(s&&s.ball){
      const corrected=preventImpossibleJump(s)|protectGoalVolume(s);
      if(corrected&&originalDraw)originalDraw(s);
      rememberBall(s);
    }
    dispatchQueued();
    return result;
  }

  Prime.Pitch=Object.freeze(Object.assign({},base,{
    playEvent,frame,setCarrier,restartToCarrier
  }));

  Prime.BallAuthorityV17=Object.freeze({GOAL_HEIGHT});
})(window.Prime=window.Prime||{});
