(function(Prime){
  if(!Prime.Pitch||!Prime.FieldGeometry)return;
  const F=Prime.FieldGeometry.FIELD;
  const base=Prime.Pitch;

  const originalSetCarrier=base.setCarrier.bind(base);
  const originalRestart=base.restartToCarrier&&base.restartToCarrier.bind(base);

  function scene(){return base.getScene&&base.getScene();}
  function findPlayer(key,id){
    const s=scene();
    return s&&s.players&&s.players.find(p=>p.key===key&&String(p.id)===String(id));
  }

  function restartKickoff(key,id){
    const s=scene(),p=findPlayer(key,id);
    if(!s||!p||!s.ball)return originalSetCarrier(key,id);

    // Em todo reinício de centro (início, segundo tempo ou após gol),
    // a bola nasce no ponto central. Como a bola está parada, também
    // posicionamos o cobrador no centro antes de devolver o controle.
    if(base.cancelAction)base.cancelAction();
    s.carrier=null;s.target=null;
    p.x=F.width/2;p.y=F.length/2;p.tx=p.x;p.ty=p.y;p.vx=0;p.vy=0;
    s.ball.x=F.width/2;s.ball.y=F.length/2;s.ball.z=0;
    s.ball.vx=0;s.ball.vy=0;s.ball.vz=0;s.ball.state='dead';
    originalSetCarrier(key,id);
  }

  function restartToCarrier(key,id,kind){
    if(kind==='kickoff')return restartKickoff(key,id);
    return originalRestart?originalRestart(key,id,kind):originalSetCarrier(key,id);
  }

  function setCarrier(key,id){
    const s=scene(),p=findPlayer(key,id);
    if(!s||!p||!s.ball)return originalSetCarrier(key,id);

    const match=s.state&&s.state.match;
    if((match?.gameSeconds||0)<1.5)return restartKickoff(key,id);

    const d=Math.hypot((s.ball.x||0)-p.x,(s.ball.y||0)-p.y);
    // Evita o efeito de teleporte em trocas de posse inesperadas.
    // Distâncias grandes viram uma transição visual curta e o motor só
    // volta a gerar eventos depois que Pitch.isActionActive() zerar.
    if(d>7.5&&!base.isActionActive?.()&&originalRestart){
      return originalRestart(key,id,'handoff');
    }
    return originalSetCarrier(key,id);
  }

  Prime.Pitch=Object.freeze(Object.assign({},base,{
    setCarrier,
    restartToCarrier,
    restartKickoff
  }));
})(window.Prime=window.Prime||{});
