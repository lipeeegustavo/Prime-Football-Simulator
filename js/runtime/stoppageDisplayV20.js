(function(Prime){
  let badge=null,styleAdded=false;
  function ensureStyle(){
    if(styleAdded)return;styleAdded=true;
    const style=document.createElement('style');
    style.textContent='.stoppage-float-v20{position:fixed;top:max(82px,calc(env(safe-area-inset-top) + 70px));left:50%;transform:translateX(-50%);z-index:9998;display:flex;align-items:center;gap:9px;padding:9px 13px;border-radius:999px;background:rgba(11,26,18,.94);border:1px solid rgba(255,201,60,.45);box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(10px);pointer-events:none}.stoppage-float-v20 span{font-size:.68rem;font-weight:900;letter-spacing:.08em;color:#9db5a6}.stoppage-float-v20 strong{font-size:.82rem;color:#ffc93c}@media(max-width:640px){.stoppage-float-v20{top:max(64px,calc(env(safe-area-inset-top) + 54px));padding:7px 10px;gap:7px}.stoppage-float-v20 span{font-size:.6rem}.stoppage-float-v20 strong{font-size:.72rem}}';
    document.head.appendChild(style);
  }
  function ensure(){
    ensureStyle();
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