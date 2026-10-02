(function(Prime){
'use strict';
let stuckSince=0,lastBall=null,lastProgressAt=0;
function reset(ball){stuckSince=0;lastProgressAt=performance.now();lastBall=ball?{x:ball.x,y:ball.y}:null;}
function sentOff(state,p){return new Set((state.match?.sentOff?.[p.key]||[]).map(String)).has(String(p.id));}
function dist(a,b){return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));}
function releaseStaleAction(m,scene,now){
  if(!(scene.action||m.visualBusy)||now-lastProgressAt<2400)return false;
  try{Prime.Pitch?.cancelAction?.();}catch(_e){}
  if(typeof m.forceVisualDone==='function'){try{m.forceVisualDone({flowRecovery:true});}catch(_e){}}
  m.visualBusy=false;m.visualBusyElapsed=0;m.activeVisual=null;m.forceVisualDone=null;
  return true;
}
function tick(){
  const state=Prime.Store?.state,m=state?.match,scene=Prime.Pitch?.getScene?.(),ball=scene?.ball;
  if(!state||!m||!scene||!ball||state.screen!==Prime.GameStates.MATCH||m.finished||m.waitingHalfTime||m.stoppageWindow||scene.preview){reset(ball);return;}
  const loop=Prime.GameLoop?.getState?.();if(loop?.paused||m.pendingPenalty){reset(ball);return;}
  const now=performance.now();
  if(!lastBall){reset(ball);return;}

  const moved=Math.hypot(ball.x-lastBall.x,ball.y-lastBall.y),speed=Math.hypot(ball.vx||0,ball.vy||0,ball.vz||0);
  const carrier=scene.carrier;
  const carrierNear=carrier&&dist(carrier,ball)<2.4;
  const validCarrier=carrier&&ball.state==='controlled'&&carrierNear&&String(carrier.key)===String(ball.ownerKey||carrier.key);
  if(validCarrier){reset(ball);return;}

  if(moved>.10||speed>.30){lastBall={x:ball.x,y:ball.y};lastProgressAt=now;stuckSince=0;return;}
  releaseStaleAction(m,scene,now);
  if(scene.action||m.visualBusy){if(now-lastProgressAt<2500)return;}

  if(!stuckSince)stuckSince=now;
  if(now-stuckSince<420)return;

  const candidates=(scene.players||[]).filter(p=>!p.isKeeper&&!sentOff(state,p));
  if(!candidates.length){reset(ball);return;}
  candidates.sort((a,b)=>dist(a,ball)-dist(b,ball));
  const chaser=candidates[0],support=candidates[1]||null,d=dist(chaser,ball);

  if(ball.state==='controlled'&&!carrierNear){
    scene.carrier=null;ball.state='dead';ball.ownerKey=null;ball.ownerIndex=-1;
  }
  if(ball.state!=='controlled'){
    ball.state='dead';ball.vx=0;ball.vy=0;
    if((ball.z||0)<.45){ball.z=0;ball.vz=0;}
    ball.ownerKey=null;ball.ownerIndex=-1;
  }

  chaser.tx=ball.x;chaser.ty=ball.y;chaser.maxSpeed=Math.max(Number(chaser.maxSpeed)||0,7.8);chaser.accel=Math.max(Number(chaser.accel)||0,14.0);
  if(support&&dist(support,ball)<8){
    const dx=support.x-ball.x,dy=support.y-ball.y,mag=Math.hypot(dx,dy)||1;
    support.tx=ball.x+dx/mag*2.4;support.ty=ball.y+dy/mag*2.4;support.maxSpeed=Math.max(Number(support.maxSpeed)||0,6.4);
  }

  if(d<1.75&&(!ball.z||ball.z<.65)){
    Prime.Pitch?.setCarrier?.(chaser.key,chaser.id);m.poss=chaser.key;m.carrierId=String(chaser.id);m.attackPhase='TRANSITION';stuckSince=0;lastProgressAt=now;lastBall={x:ball.x,y:ball.y};
  }
}
setInterval(tick,60);
Prime.FlowRecoveryV31=Object.freeze({enabled:true});
})(window.Prime=window.Prime||{});
