(function (Prime) {
  const {FORMATIONS}=Prime;
  const {playerById,eligibleForPosition}=Prime.Squad;

  function duplicates(values){
    const seen=new Set(), dup=new Set();
    values.filter(Boolean).map(String).forEach(v=>seen.has(v)?dup.add(v):seen.add(v));
    return [...dup];
  }

  function validateTeam(team,key,options){
    const opts=Object.assign({requireBench:true,requirePenalties:true},options||{}), errors=[];
    const positions=FORMATIONS[team.formation];
    if (!positions) return [`${team.name}: formação inválida.`];
    if (!team.name.trim()) errors.push(`Time ${key}: informe um nome.`);
    if (team.starters.length!==11 || team.starters.some(v=>!v)) errors.push(`${team.name}: escolha os 11 titulares.`);
    const starterDup=duplicates(team.starters); if(starterDup.length) errors.push(`${team.name}: há jogador repetido entre titulares.`);
    team.starters.forEach((id,i)=>{
      if(!id)return; const p=playerById(id); if(!p) errors.push(`${team.name}: jogador titular inválido.`);
      else if(!eligibleForPosition(p,positions[i])) errors.push(`${team.name}: ${p.name} não pode atuar como ${positions[i]}.`);
    });
    if (team.starters[0] && playerById(team.starters[0])?.group!=='GOL') errors.push(`${team.name}: a vaga GOL precisa de um goleiro.`);

    if (opts.requireBench) {
      if (team.bench.length!==7 || team.bench.some(v=>!v)) errors.push(`${team.name}: escolha os 7 reservas.`);
      const benchDup=duplicates(team.bench); if(benchDup.length) errors.push(`${team.name}: há jogador repetido no banco.`);
      const starters=new Set(team.starters.filter(Boolean).map(String));
      team.bench.filter(Boolean).forEach(id=>{if(starters.has(String(id))) errors.push(`${team.name}: um jogador aparece como titular e reserva.`);});
    }

    if (opts.requirePenalties) {
      if (team.penalties.length!==5 || team.penalties.some(v=>!v)) errors.push(`${team.name}: escolha os 5 cobradores de pênalti.`);
      const penDup=duplicates(team.penalties); if(penDup.length) errors.push(`${team.name}: os 5 cobradores precisam ser diferentes.`);
      const starters=new Set(team.starters.filter(Boolean).map(String));
      team.penalties.filter(Boolean).forEach(id=>{if(!starters.has(String(id))) errors.push(`${team.name}: cobrador de pênalti precisa estar entre os titulares no início.`);});
    }
    return [...new Set(errors)];
  }

  function validateAcrossTeams(teamA,teamB){
    const errors=[], a=[...teamA.starters,...teamA.bench].filter(Boolean).map(String), b=new Set([...teamB.starters,...teamB.bench].filter(Boolean).map(String));
    a.forEach(id=>{if(b.has(id)){const p=playerById(id);errors.push(`${p?p.name:'Um jogador'} foi escolhido pelos dois times.`);}});
    if(teamA.coach&&teamB.coach&&String(teamA.coach)===String(teamB.coach))errors.push('Os dois times não podem usar o mesmo técnico.');
    return [...new Set(errors)];
  }

  function validateFullState(state){
    return [
      ...validateTeam(state.teams.A,'A'),
      ...validateTeam(state.teams.B,'B'),
      ...validateAcrossTeams(state.teams.A,state.teams.B)
    ];
  }

  function validateBuilderTeam(state,key){
    return validateTeam(state.teams[key],key,{requireBench:true,requirePenalties:true});
  }

  Prime.Validation=Object.freeze({validateTeam,validateAcrossTeams,validateFullState,validateBuilderTeam});
})(window.Prime = window.Prime || {});
