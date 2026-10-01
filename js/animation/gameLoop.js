(function (Prime) {
  let raf=0,last=0,running=false,paused=false,speed=1,handlers={update:null,render:null};

  function frame(now){
    if(!running)return;
    if(!last)last=now;
    let dt=(now-last)/1000;last=now;
    if(dt>.05)dt=.05;
    if(!paused&&handlers.update)handlers.update(dt*speed,dt);
    if(handlers.render)handlers.render(paused?0:dt*speed,dt);
    // Durante a disputa de pênaltis o relógio da partida fica pausado,
    // mas a animação visual precisa continuar em tempo real.
    if(paused&&Prime.Pitch&&Prime.Pitch.getScene){
      const scene=Prime.Pitch.getScene();
      if(scene&&scene.action&&scene.action.type==='penalty')Prime.Pitch.frame(0,dt);
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
