(function(Prime){
'use strict';
let stuckSince=0,lastBall=null,lastProgressAt=0;
function reset(ball){stuckSince=0;lastProgressAt=performance.now();lastBall=ball?{x:ball.x,y:ball.y}:null;}
function sentOff(state,p){return new Set((state.match?.sentOff?.[p.key]||[]).map(String)).has(String(p.id));}
function dist(a,b){return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));}
function releaseStaleAction(m,scene,now){
  if(!(scene.action||m.visualBusy)||now-lastProgressAt<1250)return false;
  try{Prime.Pitch?.cancelAction?.();}catch(_e){}
  if(typeof m.forceVisualDone==='function'){try{m.forceVisualDone({flowRecovery:true});}catch(_e){}}
  m.visualBusy=false;m.visualBusyElapsed=0;m.activeVisual=null;m.forceVisualDone=null;
  return true;
}
function separateCrowd(scene,ball,chaser){
  const close=(scene.players||[]).filter(p=>p!==chaser&&!p.isKeeper&&dist(p,ball)<4.6);
  close.forEach((p,i)=>{
    let dx=p.x-ball.x,dy=p.y-ball.y,mag=Math.hypot(dx,dy);
    if(mag<.2){const a=(i+1)*2.399;dx=Math.cos(a);dy=Math.sin(a);mag=1;}
    const radius=3.6+Math.min(2.2,i*.35);
    p.tx=ball.x+dx/mag*radius;p.ty=ball.y+dy/mag*radius;
    p.maxSpeed=Math.max(Number(p.maxSpeed)||0,5.7);
  });
}
function chooseChaser(state,scene,ball){
  const all=(scene.players||[]).filter(p=>!p.isKeeper&&!sentOff(state,p));if(!all.length)return null;
  const poss=state.match?.poss;
  const preferred=poss?all.filter(p=>p.key===poss):[];
  const pool=preferred.length?preferred:all;
  pool.sort((a,b)=>dist(a,ball)-dist(b,ball));
  const best=pool[0];
  if(preferred.length&&dist(best,ball)>8){all.sort((a,b)=>dist(a,ball)-dist(b,ball));return all[0];}
  return best;
}
function tick(){
  const state=Prime.Store?.state,m=state?.match,scene=Prime.Pitch?.getScene?.(),ball=scene?.ball;
  if(!state||!m||!scene||!ball||state.screen!==Prime.GameStates.MATCH||m.finished||m.waitingHalfTime||m.stoppageWindow||scene.preview){reset(ball);return;}
  const loop=Prime.GameLoop?.getState?.();if(loop?.paused||m.pendingPenalty){reset(ball);return;}
  const now=performance.now();if(!lastBall){reset(ball);return;}

  const moved=Math.hypot(ball.x-lastBall.x,ball.y-lastBall.y),speed=Math.hypot(ball.vx||0,ball.vy||0,ball.vz||0);
  const carrier=scene.carrier,carrierNear=carrier&&dist(carrier,ball)<2.35;
  const validCarrier=carrier&&ball.state==='controlled'&&carrierNear&&String(carrier.key)===String(ball.ownerKey||carrier.key);
  if(validCarrier){reset(ball);return;}

  if(moved>.08||speed>.24){lastBall={x:ball.x,y:ball.y};lastProgressAt=now;stuckSince=0;return;}
  releaseStaleAction(m,scene,now);
  if(scene.action||m.visualBusy){if(now-lastProgressAt<1500)return;}

  if(!stuckSince)stuckSince=now;
  if(now-stuckSince<260)return;

  if(ball.state==='controlled'&&!carrierNear){scene.carrier=null;ball.state='dead';ball.ownerKey=null;ball.ownerIndex=-1;}
  if(ball.state!=='controlled'){
    ball.state='dead';ball.vx=0;ball.vy=0;
    if((ball.z||0)<.55){ball.z=0;ball.vz=0;}
    ball.ownerKey=null;ball.ownerIndex=-1;
  }

  const chaser=chooseChaser(state,scene,ball);if(!chaser){reset(ball);return;}
  const d=dist(chaser,ball);separateCrowd(scene,ball,chaser);
  chaser.tx=ball.x;chaser.ty=ball.y;chaser.maxSpeed=Math.max(Number(chaser.maxSpeed)||0,8.6);chaser.accel=Math.max(Number(chaser.accel)||0,16.5);

  if(d<2.05&&(!ball.z||ball.z<.75)){
    Prime.Pitch?.setCarrier?.(chaser.key,chaser.id);m.poss=chaser.key;m.carrierId=String(chaser.id);m.attackPhase='TRANSITION';reset(ball);return;
  }

  if(now-stuckSince>1700&&d<3.1&&(!ball.z||ball.z<.85)){
    Prime.Pitch?.setCarrier?.(chaser.key,chaser.id);m.poss=chaser.key;m.carrierId=String(chaser.id);m.attackPhase='TRANSITION';reset(ball);
  }
}
setInterval(tick,50);
Prime.FlowRecoveryV31=Object.freeze({enabled:true});
})(window.Prime=window.Prime||{});