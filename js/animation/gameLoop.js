(function (Prime) {
  let raf=0,last=0,running=false,paused=false,speed=1,handlers={update:null,render:null};

  function frame(now){
    if(!running)return;
    if(!last)last=now;
    let dt=(now-last)/1000;last=now;
    if(dt>.05)dt=.05;
    if(!paused&&handlers.update)handlers.update(dt*speed,dt);
    if(handlers.render)handlers.render(paused?0:dt*speed,dt);

    // O relógio fica pausado durante a disputa de pênaltis, mas a animação
    // visual precisa continuar em tempo real. Mantemos também um watchdog:
    // se uma cobrança ficar presa por qualquer motivo visual, o callback é
    // liberado e a disputa segue para a próxima cobrança.
    if(paused&&Prime.Pitch&&Prime.Pitch.getScene){
      const scene=Prime.Pitch.getScene();
      if(scene&&scene.action&&scene.action.type==='penalty'){
        scene.__penaltyWatch=(scene.__penaltyWatch||0)+dt;
        if(scene.__penaltyWatch>4.25&&scene.action&&scene.action.type==='penalty'){
          const action=scene.action;
          scene.action=null;
          scene.__penaltyWatch=0;
          if(typeof action.done==='function'){
            action.done({scored:Boolean(action.scored),resultKind:action.resultKind||null,watchdog:true});
          }
        }
      }else if(scene){
        scene.__penaltyWatch=0;
      }
    }
    raf=requestAnimationFrame(frame);
  }

  function start(config){
    stop();handlers=Object.assign({update:null,render:null},config||{});running=true;paused=false;last=0;raf=requestAnimationFrame(frame);
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;running=false;last=0;}
  function setPaused(v){paused=Boolean(v);}
  function togglePaused(){paused=!paused;return paused;}
  function setSpeed(v){const n=Number(v);speed=[1,2,4].includes(n)?n:1;return speed;}
  function getState(){return {running,paused,speed};}

  Prime.GameLoop=Object.freeze({start,stop,setPaused,togglePaused,setSpeed,getState});
})(window.Prime = window.Prime || {});
