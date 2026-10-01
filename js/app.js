(function (Prime) {
  function boot(){
    if(Prime.Persistence)Prime.Persistence.restore(Prime.Store.state);
    let renderedScreen=null;
    Prime.Store.subscribe((state,reason)=>{
      if(Prime.Persistence&&reason!=='match-frame')Prime.Persistence.save(state);
      if(state.screen===Prime.GameStates.MATCH&&renderedScreen===Prime.GameStates.MATCH){
        Prime.UI.updateMatchHud();Prime.UI.renderStepper();return;
      }
      renderedScreen=state.screen;Prime.UI.render();
    });
    Prime.UI.bindDialog();
    const goHome=async()=>{
      const state=Prime.Store.state;
      if(state.screen===Prime.GameStates.MATCH&&state.match&&!state.match.finished){
        const ok=await Prime.UI.confirmAction('Abandonar a partida?','A partida em andamento será encerrada e você voltará ao menu.');if(!ok)return;
      }
      Prime.MatchEngine&&Prime.MatchEngine.stop&&Prime.MatchEngine.stop();Prime.Store.returnToMenu();
    };
    document.querySelector('#homeBtn').onclick=goHome;
    document.querySelector('#brandHome').onclick=e=>{e.preventDefault();goHome();};
    renderedScreen=Prime.Store.state.screen;Prime.UI.render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window.Prime = window.Prime || {});
