(function (Prime) {
  const {PLAYERS,COACHES,FORMATIONS,Rng}=Prime;
  const {eligibleForPosition,playerById}=Prime.Squad;

  function stableTeamFingerprint(team){
    return [team.formation,team.coach,team.name,...team.starters,...team.bench,...team.penalties].join('|');
  }

  function buildCpuTeam(state){
    if(state.mode!=='cpu') return;
    const difficulty=state.settings.cpuDifficulty;
    const cpuSeed=`${state.settings.seed}|CPU|${difficulty}|${stableTeamFingerprint(state.teams.A)}`;
    const rng=Rng.createSeededRng(cpuSeed);
    const t=state.teams.B;
    const forms=Object.keys(FORMATIONS);
    t.formation=forms[Math.floor(rng()*forms.length)];
    t.name='Máquina';

    const blocked=new Set([...state.teams.A.starters,...state.teams.A.bench].filter(Boolean).map(String));
    const chosen=new Set();

    t.starters=FORMATIONS[t.formation].map(pos=>{
      let pool=PLAYERS.filter(p=>eligibleForPosition(p,pos)&&!blocked.has(String(p.id))&&!chosen.has(String(p.id)));
      if(difficulty==='elite') pool=pool.slice().sort((a,b)=>b.overall-a.overall);
      else if(difficulty==='balanced') {
        const strong=pool.filter(p=>p.overall>=94);
        if(strong.length) pool=strong;
      }
      if(!pool.length) return '';
      const topCount=difficulty==='elite'?Math.min(3,pool.length):pool.length;
      const pick=pool[Math.floor(rng()*topCount)];
      chosen.add(String(pick.id));
      return String(pick.id);
    });

    let remaining=PLAYERS.filter(p=>!blocked.has(String(p.id))&&!chosen.has(String(p.id)));
    if(difficulty==='elite') remaining=remaining.slice().sort((a,b)=>b.overall-a.overall).slice(0,24);
    else if(difficulty==='balanced') {
      const strong=remaining.filter(p=>p.overall>=93);
      if(strong.length>=7) remaining=strong;
    }
    const shuffled=Rng.shuffle(remaining,rng);
    t.bench=shuffled.slice(0,7).map(p=>{chosen.add(String(p.id));return String(p.id);});
    const blockedCoach=String(state.teams.A.coach||'');
    const coachPool=COACHES.filter(c=>String(c.id)!==blockedCoach);
    t.coach=coachPool.length?String(coachPool[Math.floor(rng()*coachPool.length)].id):'';

    const takers=t.starters.slice().sort((a,b)=>{
      const pa=playerById(a),pb=playerById(b);
      const sa=(pa?.attributes.finishing||pa?.overall||0)+(pa?.attributes.positioning||0)*.15;
      const sb=(pb?.attributes.finishing||pb?.overall||0)+(pb?.attributes.positioning||0)*.15;
      return sb-sa;
    });
    t.penalties=takers.slice(0,5);
    Prime.Squad.ensureShirtNumbers(t);
  }

  Prime.Cpu=Object.freeze({buildCpuTeam});
})(window.Prime = window.Prime || {});
