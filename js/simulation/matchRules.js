(function (Prime) {
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function validateStart(state){
    const errors=Prime.Validation?.validateFullState?Prime.Validation.validateFullState(state):[];
    ['A','B'].forEach(key=>{
      Prime.Squad.ensureShirtNumbers(state.teams[key]);
      const nums=Object.values(state.teams[key].numbers||{}).map(Number);
      if(new Set(nums).size!==nums.length)errors.push(`${state.teams[key].name}: há números de camisa repetidos.`);
    });
    return [...new Set(errors)];
  }
  function initialStats(){return {possession:{A:0,B:0},shots:{A:0,B:0},onTarget:{A:0,B:0},passes:{A:0,B:0},tackles:{A:0,B:0},corners:{A:0,B:0},throwIns:{A:0,B:0},fouls:{A:0,B:0},yellow:{A:0,B:0},red:{A:0,B:0},saves:{A:0,B:0}};}
  function snapshotTeams(state){return clone(state.teams);}
  function manOfTheMatch(state){
    const m=state.match;if(!m)return null;const score=new Map();
    const add=(id,n)=>{if(!id)return;const k=String(id);score.set(k,(score.get(k)||0)+n);};
    m.events.forEach(e=>{if(e.type==='GOAL')add(e.data?.playerId,7);if(e.type==='SHOT')add(e.data?.playerId,1);if(e.type==='SAVE')add(e.data?.keeperId,2.2);if(e.type==='TACKLE')add(e.data?.playerId,1.4);if(e.type==='YELLOW_CARD')add(e.data?.playerId,-1);if(e.type==='RED_CARD')add(e.data?.playerId,-4);});
    let best=null,bestScore=-Infinity;for(const [id,val] of score){const p=Prime.Squad.playerById(id);if(p&&val>bestScore){best={id,name:p.name,score:Math.round(val*10)/10};bestScore=val;}}
    return best;
  }
  Prime.MatchRules=Object.freeze({validateStart,initialStats,snapshotTeams,manOfTheMatch});
})(window.Prime=window.Prime||{});
