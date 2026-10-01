(function(Prime){
  let badge=null;
  function ensure(){
    if(badge&&badge.isConnected)return badge;
    badge=document.createElement('div');badge.className='stoppage-float-v20';document.body.appendChild(badge);return badge;
  }
  function hide(){if(badge)badge.hidden=true;}
  function tick(){
    try{
      const st=Prime.Store?.state,m=st?.match;
      if(!m||m.finished||st?.screen!==Prime.GameStates?.MATCH){hide();requestAnimationFrame(tick);return;}
      let mins=0,label='';
      if(!m.secondHalf&&m.firstHalfStoppageAnnounced&&!m.waitingHalfTime){mins=Number(m.firstHalfStoppage||0);label=`1º TEMPO · +${mins}`;}
      if(m.secondHalf&&m.secondHalfStoppageAnnounced){mins=Number(m.secondHalfStoppage||0);label=`2º TEMPO · +${mins}`;}
      if(mins>0){const el=ensure();el.hidden=false;el.innerHTML=`<span>⏱️ ACRÉSCIMOS</span><strong>${label}</strong>`;}else hide();
    }catch(_e){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})(window.Prime=window.Prime||{});