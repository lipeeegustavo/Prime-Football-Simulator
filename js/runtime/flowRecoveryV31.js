(function(Prime){
'use strict';
let stuckSince=0,lastBall=null,lastProgressAt=0;
function reset(ball){stuckSince=0;lastProgressAt=performance.now();lastBall=ball?{x:ball.x,y:ball.y}:null;}
function sentOff(state,p){return new Set((state.match?.sentOff?.[p.key]||[]).map(String)).has(String(p.id));}
function tick(){
  const state=Prime.Store?.state,m=state?.match,scene=Prime.Pitch?.getScene?.(),ball=scene?.ball;
  if(!state||!m||!scene||!ball||state.screen!==Prime.GameStates.MATCH||m.finished||m.waitingHalfTime||m.stoppageWindow||scene.preview){reset(ball);return;}
  const loop=Prime.GameLoop?.getState?.();if(loop?.paused){reset(ball);return;}
  const now=performance.now();
  if(!lastBall){reset(ball);return;}
  const moved=Math.hypot(ball.x-lastBall.x,ball.y-lastBall.y),speed=Math.hypot(ball.vx||0,ball.vy||0,ball.vz||0);
  if(moved>.12||speed>.35){lastBall={x:ball.x,y:ball.y};lastProgressAt=now;stuckSince=0;return;}
  const validCarrier=scene.carrier&&ball.state==='controlled'&&String(scene.carrier.key)===String(ball.ownerKey||scene.carrier.key);
  if(validCarrier){reset(ball);return;}
  if(scene.action||m.visualBusy){if(now-lastProgressAt<2600)return;}
  if(!stuckSince)stuckSince=now;
  if(now-stuckSince<850)return;
  const candidates=(scene.players||[]).filter(p=>!p.isKeeper&&!sentOff(state,p));if(!candidates.length){reset(ball);return;}
  candidates.sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y));
  const chaser=candidates[0],dist=Math.hypot(chaser.x-ball.x,chaser.y-ball.y);
  if(ball.state!=='controlled'){ball.state='dead';ball.vx=0;ball.vy=0;if((ball.z||0)<.35){ball.z=0;ball.vz=0;}ball.ownerKey=null;ball.ownerIndex=-1;}
  chaser.tx=ball.x;chaser.ty=ball.y;chaser.maxSpeed=Math.max(Number(chaser.maxSpeed)||0,7.1);chaser.accel=Math.max(Number(chaser.accel)||0,12.5);
  if(dist<1.45&&(!ball.z||ball.z<.55)){
    Prime.Pitch?.setCarrier?.(chaser.key,chaser.id);m.poss=chaser.key;m.carrierId=String(chaser.id);stuckSince=0;lastProgressAt=now;lastBall={x:ball.x,y:ball.y};
  }
}
setInterval(tick,70);
Prime.FlowRecoveryV31=Object.freeze({enabled:true});
})(window.Prime=window.Prime||{});
