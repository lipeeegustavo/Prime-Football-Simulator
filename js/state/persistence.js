(function (Prime) {
  const KEY='prime-football-simulator-v6';
  const HISTORY_KEY='prime-football-simulator-history-v1';
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function storage(){try{return window.localStorage||null;}catch(_){return null;}}
  function safeState(state){
    return {
      mode:state.mode,
      settings:clone(state.settings),
      teams:clone(state.teams),
      lastResult:state.lastResult?clone(state.lastResult):null
    };
  }
  function save(state){const st=storage();if(!st)return false;try{st.setItem(KEY,JSON.stringify(safeState(state)));return true;}catch(_){return false;}}
  function restore(state){const st=storage();if(!st)return false;try{
    const raw=JSON.parse(st.getItem(KEY)||'null');if(!raw||!raw.settings||!raw.teams)return false;
    state.mode=raw.mode||null;Object.assign(state.settings,raw.settings||{});
    ['A','B'].forEach(k=>{if(raw.teams[k])state.teams[k]=Object.assign(Prime.Store.blankTeam(k==='A'?'Jogador 1':'Jogador 2','4-3-3'),raw.teams[k]);});
    state.lastResult=raw.lastResult||null;state.match=null;return true;
  }catch(_){return false;}}
  function addHistory(entry){const st=storage();if(!st)return;try{const h=JSON.parse(st.getItem(HISTORY_KEY)||'[]');h.unshift(clone(entry));st.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,20)));}catch(_){}}
  function history(){const st=storage();if(!st)return[];try{return JSON.parse(st.getItem(HISTORY_KEY)||'[]');}catch(_){return[];}}
  function clear(){const st=storage();if(!st)return;try{st.removeItem(KEY);}catch(_){}}
  Prime.Persistence=Object.freeze({save,restore,addHistory,history,clear});
})(window.Prime=window.Prime||{});
