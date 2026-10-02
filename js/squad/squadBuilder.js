(function (Prime) {
  const {PLAYERS,COACHES,FORMATIONS}=Prime;
  const state=Prime.Store.state;

  function playerById(id){ return PLAYERS.find(p=>p.id===Number(id)); }
  function coachById(id){ return COACHES.find(c=>c.id===Number(id)); }
  function eligibleForPosition(player,pos){ return Boolean(player && player.positions.includes(pos)); }
  function rosterIds(team){ return [...team.starters,...team.bench].filter(Boolean).map(String); }
  function ensureShirtNumbers(team){
    // Numeração de futebol: titulares recebem números coerentes por posição.
    const positional={
      GOL:[1,12,23],LD:[2,22,14],LE:[3,6,16],ZAG:[4,5,13,15],VOL:[5,6,8,14],
      MC:[8,6,7,10],MEI:[10,8,7,11],PD:[7,11,17],PE:[11,7,17],CA:[9,10,19],SA:[10,9,11],ALA:[2,3,6,7]
    };
    const numbers={},used=new Set(),positions=FORMATIONS[team.formation]||[];
    const take=(prefs)=>{const n=(prefs||[]).find(v=>!used.has(v))||Array.from({length:99},(_,i)=>i+1).find(v=>!used.has(v));used.add(n);return n;};
    (team.starters||[]).forEach((id,i)=>{
      if(!id)return;
      const pos=positions[i]||playerById(id)?.positions?.[0]||'MC';
      numbers[String(id)]=take(positional[pos]||[]);
    });
    (team.bench||[]).forEach(id=>{
      if(!id||numbers[String(id)])return;
      numbers[String(id)]=take(Array.from({length:88},(_,i)=>i+12));
    });
    team.numbers=numbers;
    team.numberingVersion='football-v2';
    return team.numbers;
  }
  function shirtNumber(team,id){ensureShirtNumbers(team);return team.numbers[String(id)]||'?';}

  function globallyUsedIds(exceptTeamKey, exceptSelected){
    const used=new Set();
    ['A','B'].forEach(key=>{
      rosterIds(state.teams[key]).forEach(id=>{
        if (!(key===exceptTeamKey && String(id)===String(exceptSelected))) used.add(String(id));
      });
    });
    return used;
  }

  function sanitizeFormationPlayers(team){
    const positions=FORMATIONS[team.formation];
    team.starters=positions.map((pos,i)=>{
      const id=team.starters[i];
      return eligibleForPosition(playerById(id),pos)?String(id):'';
    });
    const validStarters=new Set(team.starters.filter(Boolean).map(String));
    team.penalties=team.penalties.map(id=>validStarters.has(String(id))?String(id):'');
  }

  function positionOptions(pos,selected,teamKey){
    const used=globallyUsedIds(teamKey,selected);
    return PLAYERS.filter(p=>eligibleForPosition(p,pos)).map(p=>({
      id:String(p.id),label:`${p.name} · ${p.positions.join('/')} · OVR ${p.overall}`,
      disabled:used.has(String(p.id)) && String(p.id)!==String(selected)
    }));
  }

  function reserveOptions(selected,teamKey){
    const used=globallyUsedIds(teamKey,selected);
    return PLAYERS.map(p=>({
      id:String(p.id),label:`${p.name} · ${p.positions.join('/')} · OVR ${p.overall}`,
      disabled:used.has(String(p.id)) && String(p.id)!==String(selected)
    }));
  }

  function penaltyOptions(team,slotIndex){
    const already=new Set(team.penalties.map((id,i)=>i===slotIndex?'':String(id)).filter(Boolean));
    return team.starters.filter(Boolean).map(id=>{
      const p=playerById(id);
      return {id:String(id),label:p?p.name:'Jogador',disabled:already.has(String(id))};
    });
  }

  function setStarter(teamKey,index,id){
    const t=state.teams[teamKey];
    const old=t.starters[index];
    t.starters[index]=id?String(id):'';
    if(old && String(old)!==String(id)){
      t.penalties=t.penalties.map(x=>String(x)===String(old)?'':x);
    }
  }
  function setBench(teamKey,index,id){ state.teams[teamKey].bench[index]=id?String(id):''; }
  function setPenalty(teamKey,index,id){
    const t=state.teams[teamKey];
    const value=id?String(id):'';
    if(value) t.penalties=t.penalties.map((x,i)=>i!==index&&String(x)===value?'':x);
    t.penalties[index]=value;
  }

  function playerScoreForPenalty(p){
    if(!p)return 0;
    const a=p.attributes||{};
    return (a.finishing||p.overall)*.62+(a.positioning||p.overall)*.22+(a.physical||p.overall)*.06+p.overall*.1;
  }

  function randomizePenalties(teamKey){
    const t=state.teams[teamKey];
    const valid=t.starters.filter(Boolean);
    if(valid.length<5)return false;
    const rng=Prime.Rng.createSeededRng(`${state.settings.seed}|PENALTIES|${teamKey}|${valid.join('-')}`);
    const strong=valid.slice().sort((a,b)=>playerScoreForPenalty(playerById(b))-playerScoreForPenalty(playerById(a)));
    const pool=Prime.Rng.shuffle(strong.slice(0,Math.min(9,strong.length)),rng);
    t.penalties=pool.slice(0,5);
    return true;
  }

  function autoFill(teamKey){
    const t=state.teams[teamKey],positions=FORMATIONS[t.formation];
    const used=globallyUsedIds(teamKey,null);
    const chosen=new Set();
    const rng=Prime.Rng.createSeededRng(`${state.settings.seed}|AUTOFILL|${teamKey}|${t.formation}`);
    t.starters=positions.map(pos=>{
      let pool=PLAYERS.filter(p=>eligibleForPosition(p,pos)&&!used.has(String(p.id))&&!chosen.has(String(p.id)));
      pool=pool.sort((a,b)=>b.overall-a.overall);
      const top=pool.slice(0,Math.min(5,pool.length));
      const p=top.length?top[Math.floor(rng()*top.length)]:pool[0];
      if(p)chosen.add(String(p.id));
      return p?String(p.id):'';
    });
    let remaining=PLAYERS.filter(p=>!used.has(String(p.id))&&!chosen.has(String(p.id))).sort((a,b)=>b.overall-a.overall);
    const shuffled=Prime.Rng.shuffle(remaining.slice(0,30),rng);
    t.bench=shuffled.slice(0,7).map(p=>String(p.id));
    if(!t.coach)t.coach=String(COACHES[Math.floor(rng()*COACHES.length)].id);
    randomizePenalties(teamKey);
    ensureShirtNumbers(t);
  }

  function clearTeam(teamKey){
    const t=state.teams[teamKey];
    t.coach='';
    t.starters=Array(11).fill('');
    t.bench=Array(7).fill('');
    t.penalties=Array(5).fill('');
    t.numbers={};
  }

  function validBenchForPosition(teamKey,outIndex){
    const t=state.teams[teamKey], positions=FORMATIONS[t.formation], required=positions&&positions[outIndex];
    if(!required)return [];
    const alreadyOut=new Set((state.match?.subbedOut?.[teamKey]||[]).map(String));
    return t.bench.map((id,benchIndex)=>({id,benchIndex,player:playerById(id)})).filter(item=>{
      const p=item.player;if(!p||alreadyOut.has(String(item.id)))return false;
      if(required==='GOL')return p.group==='GOL'&&eligibleForPosition(p,'GOL');
      return p.group!=='GOL';
    });
  }

  function compatibleBenchMoves(teamKey){
    const t=state.teams[teamKey], positions=FORMATIONS[t.formation], moves=[];
    t.starters.forEach((outId,outIndex)=>{
      const required=positions[outIndex];
      validBenchForPosition(teamKey,outIndex).forEach(({id:inId,benchIndex})=>moves.push({outIndex,benchIndex,required,outId,inId}));
    });
    return moves;
  }

  function swapPlayers(teamKey,outIndex,benchIndex){
    const t=state.teams[teamKey], required=FORMATIONS[t.formation][outIndex], incoming=playerById(t.bench[benchIndex]);
    const validIncoming=validBenchForPosition(teamKey,outIndex).some(item=>item.benchIndex===benchIndex);
    if(!incoming||!validIncoming)return {ok:false,error:required==='GOL'?'O goleiro só pode ser substituído por outro goleiro.':'Escolha um jogador de linha para esta substituição.'};
    const outgoing=t.starters[outIndex];
    t.starters[outIndex]=t.bench[benchIndex];
    t.bench[benchIndex]=outgoing;
    return {ok:true,incoming,outgoing:playerById(outgoing),required};
  }

  function topAttributes(player){
    if(!player)return [];
    const labels={pace:'VEL',passing:'PAS',vision:'VIS',dribbling:'DRI',finishing:'FIN',defending:'DEF',physical:'FIS',positioning:'POS',heading:'CAB',goalkeeping:'GOL'};
    return Object.entries(player.attributes||{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([key,value])=>({key,label:labels[key]||key.toUpperCase(),value}));
  }

  function surname(name){
    const special={'Cristiano Ronaldo':'C. Ronaldo','Ronaldo Fenomeno':'Ronaldo','Ronaldinho Gaucho':'Ronaldinho','Roberto Carlos':'R. Carlos','Alfredo Di Stefano':'Di Stefano','Juan Roman Riquelme':'Riquelme','Edwin van der Sar':'Van der Sar'};
    if(special[name])return special[name];
    const parts=String(name||'').trim().split(/\s+/);
    return parts.length?parts[parts.length-1]:name;
  }

  Prime.Squad=Object.freeze({
    playerById,coachById,eligibleForPosition,rosterIds,globallyUsedIds,sanitizeFormationPlayers,
    positionOptions,reserveOptions,penaltyOptions,setStarter,setBench,setPenalty,randomizePenalties,
    autoFill,clearTeam,validBenchForPosition,compatibleBenchMoves,swapPlayers,topAttributes,surname,ensureShirtNumbers,shirtNumber
  });
})(window.Prime = window.Prime || {});
