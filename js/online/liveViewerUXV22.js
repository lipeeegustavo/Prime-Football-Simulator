(function(Prime){
  const params=new URLSearchParams(location.search);
  const watchCode=(params.get('watch')||'').trim();
  if(!watchCode)return;

  let mode='full';
  let mountedStage=null;

  function scene(){return Prime.Pitch?.getScene?.()||null;}

  function applyMode(next){
    mode=next==='follow'?'follow':'full';
    const sc=scene();
    if(sc){
      Prime.Pitch?.setCameraMode?.(mode);
      // O minimapa só faz sentido quando a câmera acompanha a jogada.
      // O renderer já não desenha minimapa em cenas marcadas como preview,
      // então usamos essa flag apenas como controle visual do espectador.
      sc.preview=mode==='full';
      sc.camera.mode=mode;
      sc.camera.zoom=mode==='full'?1:(Prime.Balance?.camera?.followZoom||2.05);
      Prime.Pitch?.draw?.(sc);
    }
    document.querySelectorAll('.watch-camera-btn').forEach(btn=>{
      const active=btn.dataset.camera===mode;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
    });
    const stage=document.querySelector('.watch-stage');
    if(stage){stage.classList.toggle('camera-full',mode==='full');stage.classList.toggle('camera-follow',mode==='follow');}
  }

  function mountControls(){
    const stage=document.querySelector('.watch-stage');
    if(!stage||stage===mountedStage)return;
    mountedStage=stage;
    const controls=document.createElement('div');
    controls.className='watch-camera-controls';
    controls.setAttribute('aria-label','Câmera da transmissão');
    controls.innerHTML='<button type="button" class="watch-camera-btn active" data-camera="full" aria-pressed="true">Campo inteiro</button><button type="button" class="watch-camera-btn" data-camera="follow" aria-pressed="false">Jogada</button>';
    stage.appendChild(controls);
    controls.querySelectorAll('.watch-camera-btn').forEach(btn=>btn.addEventListener('click',()=>applyMode(btn.dataset.camera)));
    applyMode(mode);
  }

  function tick(){
    mountControls();
    const sc=scene();
    if(sc){
      const shouldPreview=mode==='full';
      if(sc.preview!==shouldPreview)sc.preview=shouldPreview;
      if(sc.camera?.mode!==mode)Prime.Pitch?.setCameraMode?.(mode);
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  Prime.LiveViewerUXV22=Object.freeze({getMode:()=>mode,setMode:applyMode});
})(window.Prime=window.Prime||{});
