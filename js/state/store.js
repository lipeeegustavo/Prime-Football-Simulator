(function (Prime) {
  const S = Prime.GameStates;

  function blankTeam(name, formation) {
    return {
      name,
      formation,
      coach:'',
      starters:Array(11).fill(''),
      bench:Array(7).fill(''),
      penalties:Array(5).fill(''),
      numbers:{}
    };
  }

  const state = {
    screen:S.MENU,
    mode:null,
    activeBuilder:'A',
    settings:{
      seed:'PRIME-001',
      cpuDifficulty:'balanced',
      speedFactor:1,
      realMatchSeconds:180,
      cameraMode:'follow',
      challenge:null
    },
    ui:{
      builderTab:'titulares',
      selectedSlot:0,
      playerSearch:'',
      playerSort:'overall',
      overlay:null,
      overlayUntil:0
    },
    teams:{
      A:blankTeam('Jogador 1','4-3-3'),
      B:blankTeam('Jogador 2','4-2-3-1')
    },
    match:null,
    lastResult:null
  };

  const listeners=[];
  function notify(reason){ listeners.forEach(fn=>fn(state,reason||'state')); }
  function subscribe(fn){ listeners.push(fn); return ()=>{const i=listeners.indexOf(fn); if(i>=0) listeners.splice(i,1);}; }

  function transition(next) {
    const allowed = {
      [S.MENU]:[S.MODE],
      [S.MODE]:[S.MENU,S.BUILD_P1],
      [S.BUILD_P1]:[S.MODE,S.BUILD_P2,S.PRE_GAME],
      [S.BUILD_P2]:[S.BUILD_P1,S.PRE_GAME],
      [S.PRE_GAME]:[S.BUILD_P1,S.BUILD_P2,S.MATCH,S.MODE],
      [S.MATCH]:[S.END,S.PRE_GAME,S.MENU],
      [S.END]:[S.PRE_GAME,S.MODE,S.MENU]
    };
    if (!(allowed[state.screen]||[]).includes(next)) {
      throw new Error(`Transição inválida: ${state.screen} → ${next}`);
    }
    state.screen=next;
    state.ui.overlay=null;
    notify('screen');
  }

  function resetBuilderUi(){
    state.ui.builderTab='titulares';
    state.ui.selectedSlot=0;
    state.ui.playerSearch='';
    state.ui.playerSort='overall';
  }

  function resetForMode(mode){
    state.mode=mode;
    state.activeBuilder='A';
    state.teams.A=blankTeam('Jogador 1','4-3-3');
    state.teams.B=blankTeam(mode==='cpu'?'Máquina':'Jogador 2','4-2-3-1');
    state.match=null;
    state.lastResult=null;
    resetBuilderUi();
    notify('mode');
  }

  function prepareRematch(){
    const snap=state.lastResult&&state.lastResult.teamSnapshot;
    if(snap){state.teams=JSON.parse(JSON.stringify(snap));}
    state.match=null;
    state.lastResult=null;
    state.screen=S.PRE_GAME;
    state.ui.overlay=null;
    notify('screen');
  }

  function returnToMenu(){
    state.screen=S.MENU;
    state.mode=null;
    state.match=null;
    state.lastResult=null;
    resetBuilderUi();
    notify('screen');
  }

  Prime.Store=Object.freeze({
    state,subscribe,notify,transition,resetForMode,returnToMenu,prepareRematch,blankTeam,resetBuilderUi
  });
})(window.Prime = window.Prime || {});
