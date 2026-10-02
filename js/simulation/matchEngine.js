(function (Prime) {
  const {Rng}=Prime;
  const {playerById,coachById,compatibleBenchMoves,swapPlayers}=Prime.Squad;
  const TOTAL=90*60;
  const FIRST_HALF_BASE=45*60;
  const MAX_QUEUE=Prime.Balance?.visualQueueMax||5;
  const FULL_TIME_VISUAL_WAIT=Prime.Balance?.visualFlushAtFullTime||3;
  let hooks={onUpdate:null,onEvent:null,onFinish:null,onPitchRefresh:null,onFrame:null,onError:null,onHalfTime:null,onSubstitution:null,onPenaltyRequest:null};

  function emit(state,text,cls,type,data){
    const m=state.match;
    if(!m)return null;
    const evt={
      minute:Math.floor((m.gameSeconds||0)/60),
      text,cls:cls||'event',type:type||'INFO',data:data||null
    };
    m.events.push(evt);
    if(m.events.length>180)m.events.splice(0,m.events.length-180);
    hooks.onEvent&&hooks.onEvent(evt,state);
    return evt;
  }
  function update(state){hooks.onUpdate&&hooks.onUpdate(state);}
  function refreshPitch(state){hooks.onPitchRefresh&&hooks.onPitchRefresh(state);}
  function attrs(p){return p?.attributes||{};}
  function weightedPick(list,weightFn,r){
    if(!list.length)return null;
    let total=0;
    const ws=list.map(x=>{const w=Math.max(.01,weightFn(x));total+=w;return w;});
    let n=r()*total;
    for(let i=0;i<list.length;i++){n-=ws[i];if(n<=0)return list[i];}
    return list[list.length-1];
  }
  function teamStrength(state,key){
    const t=state.teams[key],ps=t.starters.map(playerById).filter(Boolean);
    const avg=ps.length?ps.reduce((a,p)=>a+p.overall,0)/ps.length:0,c=coachById(t.coach);
    return avg+(c?(c.attack+c.defense)/8:0);
  }
  function outfield(state,key){const sent=new Set((state.match?.sentOff?.[key]||[]).map(String));return state.teams[key].starters.map(playerById).filter(p=>p&&p.group!=='GOL'&&!sent.has(String(p.id)));}
  function chooseCarrier(state,key,r){
    const list=outfield(state,key);
    return weightedPick(list,p=>(attrs(p).dribbling||70)+(attrs(p).passing||70)*.5+(p.group==='ATA'?15:0),r);
  }
  function nearestLooseBallPlayer(state,key){
    const scene=Prime.Pitch?.getScene?.(),m=state.match,b=scene?.ball;
    if(!scene||!m||!b||b.state!=='dead'||m.stoppageWindow||scene.action)return null;
    const sent=new Set((m.sentOff?.[key]||[]).map(String));
    const list=(scene.players||[]).filter(p=>p.key===key&&!p.isKeeper&&!sent.has(String(p.id)));
    if(!list.length)return null;
    return list.map(p=>({p,d:Math.hypot(p.x-b.x,p.y-b.y)})).sort((a,b)=>a.d-b.d)[0]||null;
  }
  function chooseReceiver(state,key,from,r){
    const list=outfield(state,key).filter(p=>p.id!==from.id);
    return weightedPick(list,p=>(attrs(p).positioning||70)+(attrs(p).pace||70)*.25+(p.group==='ATA'?18:0),r);
  }
  function chooseShooter(state,key,r){
    const list=outfield(state,key);
    return weightedPick(list,p=>(attrs(p).finishing||60)*1.5+(attrs(p).positioning||60)+(p.positions.includes('CA')?25:0),r);
  }
  function keeper(state,key){return playerById(state.teams[key].starters[0]);}
  function tactics(state,key){
    const c=coachById(state.teams[key].coach);
    return c?.tactics||{lineHeight:58,pressing:60,tempo:65,width:65,passRisk:55,transitionSpeed:68};
  }
  function decideOutcome(state,atk,shooter,r){
    const def=atk==='A'?'B':'A',gk=keeper(state,def),a=attrs(shooter),ga=attrs(gk),coach=tactics(state,atk),defCoach=tactics(state,def);
    const live=livePlayer(atk,shooter.id),F=Prime.FieldGeometry.FIELD,mouth=Prime.FieldGeometry.goalMouthX(),top=attacksTop(atk,state),goalY=top?0:F.length;
    const sx=live?.x??F.width/2,sy=live?.y??F.length/2;
    const distance=Math.hypot(sx-F.width/2,sy-goalY);
    const va={x:mouth.left-sx,y:goalY-sy},vb={x:mouth.right-sx,y:goalY-sy};
    const la=Math.hypot(va.x,va.y)||1,lb=Math.hypot(vb.x,vb.y)||1;
    const angle=Math.acos(Math.max(-1,Math.min(1,(va.x*vb.x+va.y*vb.y)/(la*lb))));
    const distanceFactor=Math.max(.05,Math.min(1,1-(distance-10)/52));
    const angleFactor=Math.max(.12,Math.min(1,angle/.52));
    const quality=(a.finishing||70)*.46+(a.positioning||70)*.22+(a.dribbling||70)*.08+coach.passRisk*.05;
    const resistance=(ga.goalkeeping||gk?.overall||75)*.5+(ga.positioning||75)*.18+defCoach.pressing*.05;
    const x=quality-resistance;
    const goal=Math.max(.012,Math.min(.42,(.165+x*.0058)*distanceFactor*angleFactor));
    const save=Math.max(.18,Math.min(.62,.42-x*.003+(1-distanceFactor)*.075));
    const n=r();
    if(n<goal)return'GOAL';
    if(n<goal+save)return'SAVE';
    return'OUT';
  }

  function shouldCompressVisual(m,evt){
    if(m.visualQueue.length<(Prime.Balance?.shortPassBacklogThreshold||3))return false;
    return evt.type==='PASS'||evt.type==='RECEIVE'||evt.type==='POSSESSION';
  }
  function queueVisual(state,evt,onDone){
    const m=state.match;
    if(!m||m.finished){onDone&&onDone({skipped:true});return;}
    if(shouldCompressVisual(m,evt)){
      onDone&&onDone({compressed:true});
      return;
    }
    while(m.visualQueue.length>=MAX_QUEUE){
      const dropped=m.visualQueue.shift();
      if(dropped&&dropped.onDone)dropped.onDone({dropped:true});
    }
    m.visualQueue.push({evt,onDone});
    m.maxVisualQueue=Math.max(m.maxVisualQueue,m.visualQueue.length);
    pumpVisual(state);
  }
  function pumpVisual(state){
    const m=state.match;
    if(!m||m.finished||m.visualBusy||!m.visualQueue.length)return;
    const item=m.visualQueue.shift();
    m.visualBusy=true;m.visualBusyElapsed=0;m.activeVisual=item;
    let completed=false;
    const finish=(result)=>{
      if(completed)return;completed=true;
      if(!state.match||state.match!==m)return;
      m.visualBusy=false;m.visualBusyElapsed=0;m.activeVisual=null;m.forceVisualDone=null;
      if(item.onDone)item.onDone(result||{});
      pumpVisual(state);
    };
    m.forceVisualDone=finish;
    try{Prime.Pitch.playEvent(item.evt,finish);}catch(error){finish({error:true,message:error?.message||'visual error'});}
  }
  function flushVisuals(state){
    const m=state.match;if(!m)return;
    m.visualQueue.splice(0).forEach(item=>item.onDone&&item.onDone({flushed:true}));
    m.visualBusy=false;
    if(Prime.Pitch&&Prime.Pitch.cancelAction)Prime.Pitch.cancelAction();
  }

  function logEvent(state,evt){
    const p=id=>playerById(id)?.name||'Jogador';let text='',cls='event';
    switch(evt.type){
      case'PASS':text=evt.throughBall?`${evt.minute}' — ${p(evt.fromId)} enfia a bola para ${p(evt.toId)}!`:`${evt.minute}' — ${p(evt.fromId)} toca para ${p(evt.toId)}.`;break;
      case'RECEIVE':text=`${evt.minute}' — ${p(evt.playerId)} domina.`;break;
      case'DRIBBLE':text=`${evt.minute}' — ${p(evt.playerId)} parte para o drible.`;break;
      case'CUT_INSIDE':text=`${evt.minute}' — ${p(evt.playerId)} corta para dentro.`;break;
      case'CROSS':text=`${evt.minute}' — ${p(evt.fromId)} cruza para ${p(evt.toId)}.`;break;
      case'TACKLE':text=`${evt.minute}' — ${p(evt.playerId)} ganha no desarme.`;break;
      case'FOUL':text=`${evt.minute}' — falta de ${p(evt.playerId)}${evt.reason?` por ${evt.reason}`:''}.`;break;
      case'YELLOW_CARD':text=`${evt.minute}' — 🟨 amarelo para ${p(evt.playerId)}${evt.reason?` por ${evt.reason}`:''}.`;break;
      case'RED_CARD':text=evt.secondYellow?`${evt.minute}' — 🟥 ${p(evt.playerId)} expulso: segundo amarelo${evt.reason?` por ${evt.reason}`:''}.`:`${evt.minute}' — 🟥 vermelho direto para ${p(evt.playerId)}${evt.reason?` por ${evt.reason}`:''}.`;cls='danger';break;
      case'CORNER':text=`${evt.minute}' — escanteio para ${state.teams[evt.team].name}.`;break;
      case'THROW_IN':text=`${evt.minute}' — lateral para ${state.teams[evt.team].name}.`;break;
      case'GOAL_KICK':text=`${evt.minute}' — tiro de meta para ${state.teams[evt.team].name}.`;break;
      case'SHOT':text=`${evt.minute}' — ${p(evt.playerId)} finaliza!`;break;
      case'SAVE':text=`${evt.minute}' — ${p(evt.keeperId)} faz a defesa.`;break;
      case'GOAL':text=`${evt.minute}' — GOL! ${p(evt.playerId)} marca para ${state.teams[evt.team].name}!`;cls='goal';break;
      case'SUBSTITUTION':{const c=coachById(state.teams[evt.team].coach);text=`${evt.minute}' — ${c?c.name:'Comando manual'}: sai ${p(evt.outId)}, entra ${p(evt.inId)}.`;break;}
      default:return null;
    }
    return emit(state,text,cls,evt.type,evt);
  }

  function addPossession(m,dt){
    if(!m.stats)return;
    m.stats.possession[m.poss]=(m.stats.possession[m.poss]||0)+dt;
  }

  function visualRestart(key,id,kind){
    if(!id)return;
    if(Prime.Pitch?.restartToCarrier)Prime.Pitch.restartToCarrier(key,id,kind);
    else Prime.Pitch.setCarrier(key,id);
  }
  function livePlayer(key,id){
    const scene=Prime.Pitch&&Prime.Pitch.getScene?Prime.Pitch.getScene():null;
    return scene?.players?.find(p=>p.key===key&&String(p.id)===String(id))||null;
  }
  function liveOutfield(key){
    const scene=Prime.Pitch&&Prime.Pitch.getScene?Prime.Pitch.getScene():null;
    return scene?.players?.filter(p=>p.key===key&&!p.isKeeper)||[];
  }
  function attackDirection(key,state){let d=key==='A'?-1:1;if(state?.match?.secondHalf)d=-d;return d;}
  function attacksTop(key,state){return attackDirection(key,state)<0;}
  function zoneFor(key,y,state){
    const F=Prime.FieldGeometry.FIELD,dir=attackDirection(key,state),own=dir<0?F.length:0;
    const progress=Math.max(0,Math.min(1,Math.abs(y-own)/F.length));
    if(progress<.33)return 'BUILDUP';
    if(progress<.68)return 'PROGRESSION';
    return 'FINAL_THIRD';
  }
  function chooseSpatialReceiver(state,key,from,r,phase){
    const liveFrom=livePlayer(key,from.id);
    const live=liveOutfield(key).filter(p=>String(p.id)!==String(from.id));
    if(!live.length)return chooseReceiver(state,key,from,r);
    const dir=attackDirection(key,state);
    return weightedPick(live,p=>{
      const data=playerById(p.id),a=attrs(data);
      const dx=liveFrom?p.x-liveFrom.x:0,dy=liveFrom?p.y-liveFrom.y:0;
      const forward=dy*dir;
      const dist=Math.hypot(dx,dy);
      let w=(a.positioning||70)*.8+(a.passing||70)*.22;
      if(phase==='BUILDUP'){
        w+=Math.max(0,8-Math.abs(forward))*5;
        w+=dist<18?34:0;
      }else if(phase==='PROGRESSION'){
        w+=Math.max(-12,forward)*3.2;
        w+=dist>6&&dist<25?28:0;
        if(['MC','MEI','PE','PD','SA'].some(x=>data.positions.includes(x)))w+=20;
      }else{
        w+=Math.max(-8,forward)*4.2;
        if(['CA','SA','PE','PD'].some(x=>data.positions.includes(x)))w+=34;
        w+=dist<23?18:0;
      }
      if(Math.abs(dx)>26)w-=18;
      return Math.max(2,w);
    },r);
  }
  function chooseDefenderNearCarrier(state,key,r){
    const m=state.match,atk=key==='A'?'B':'A',carrier=livePlayer(atk,m.carrierId);
    const live=liveOutfield(key);
    if(!carrier||!live.length)return chooseCarrier(state,key,r);
    return weightedPick(live,p=>{
      const d=Math.hypot(p.x-carrier.x,p.y-carrier.y);
      const a=attrs(playerById(p.id));
      return Math.max(1,90-d*5+(a.defending||70)*.55+(a.physical||70)*.25);
    },r);
  }

  function pickFoulReason(m,severity){
    const normal=['carrinho atrasado','puxão de camisa','entrada imprudente','parar um contra-ataque','chegada fora do tempo','calço por trás'];
    const serious=['entrada por trás com força excessiva','carrinho com sola alta','impedir uma chance clara de gol','entrada violenta sem disputar a bola'];
    const list=severity==='red'?serious:normal;
    return list[Math.floor(m.rng()*list.length)];
  }

  function disciplineAfterFoul(state,team,playerId,minute,reason){
    const m=state.match;if(!m||!playerId)return;
    const p=playerById(playerId);if(!p||p.group==='GOL')return;
    const r=m.rng,n=r();
    let card=null,directRed=false,secondYellow=false,cardReason=reason||pickFoulReason(m,'normal');
    if(n<.006){card='RED_CARD';directRed=true;cardReason=pickFoulReason(m,'red');}
    else if(n<.37)card='YELLOW_CARD';
    if(!card)return;
    const key=String(playerId),count=(m.cards[team][key]||0);
    if(card==='YELLOW_CARD'){
      m.cards[team][key]=count+1;m.stats.yellow[team]++;
      if(count+1>=2){card='RED_CARD';secondYellow=true;m.stats.yellow[team]=Math.max(0,m.stats.yellow[team]-1);}
    }
    if(card==='RED_CARD'&&!m.sentOff[team].includes(key)){m.sentOff[team].push(key);m.stats.red[team]++;}
    const evt={type:card,team,playerId,minute,reason:cardReason,directRed,secondYellow};
    logEvent(state,evt);queueVisual(state,evt,()=>{if(card==='RED_CARD')refreshPitch(state);});
  }
  function announceSub(state,key,outId,inId,minute){
    const evt={type:'SUBSTITUTION',team:key,outId,inId,minute};
    logEvent(state,evt);
    hooks.onSubstitution&&hooks.onSubstitution(evt,state);
  }

  function generateEvent(state){
    const m=state.match,r=m.rng;
    const atk=m.poss,def=atk==='A'?'B':'A';
    const tac=tactics(state,atk),defTac=tactics(state,def);
    let carrier=playerById(m.carrierId);
    if(!carrier||carrier.group==='GOL')carrier=chooseCarrier(state,atk,r);
    const loose=nearestLooseBallPlayer(state,atk);
    const currentLive=carrier?livePlayer(atk,carrier.id):null;
    if(loose&&(!currentLive||loose.d+2.2<Math.hypot(currentLive.x-Prime.Pitch.getBall().x,currentLive.y-Prime.Pitch.getBall().y)))carrier=playerById(loose.p.id)||carrier;
    if(!carrier)return;
    m.carrierId=carrier.id;

    const live=livePlayer(atk,carrier.id);
    const phase=zoneFor(atk,live?live.y:(attacksTop(atk,state)?70:35),state);
    m.attackPhase=phase;
    const minute=Math.floor(m.gameSeconds/60);
    const pressure=defTac.pressing/100;
    const ca=attrs(carrier);
    const dr=ca.dribbling||70,pass=ca.passing||70,fin=ca.finishing||60;
    const actions=m.possessionActions||0;
    const evCfg=Prime.Balance?.event||{};

    // Bola parada e saídas de campo dão ritmo e variedade à partida.
    if(r()<(evCfg.foulChance ?? 0.09)){
      const defender=chooseDefenderNearCarrier(state,def,r),reason=pickFoulReason(m,'normal');
      const evt={type:'FOUL',team:def,playerId:defender?.id,minute,reason};
      m.stats.fouls[def]++;m.stoppageWindow=true;logEvent(state,evt);
      queueVisual(state,evt,()=>{if(state.match!==m||m.finished)return;disciplineAfterFoul(state,def,defender?.id,minute,reason);autoCoachSubs(state,minute,true);});
      return;
    }
    if(r()<(evCfg.throwInChance ?? 0)){
      const restartTeam=r()<.72?atk:def;
      m.stats.throwIns[restartTeam]++;m.stoppageWindow=true;logEvent(state,{type:'THROW_IN',team:restartTeam,minute});
      queueVisual(state,{type:'THROW_IN',team:restartTeam,minute},()=>{if(state.match!==m||m.finished)return;m.poss=restartTeam;const c=chooseCarrier(state,restartTeam,r);m.carrierId=c?.id||null;m.possessionActions=0;if(c)visualRestart(restartTeam,c.id,'throw-in');autoCoachSubs(state,minute,true);});
      return;
    }
    if(phase==='FINAL_THIRD'&&r()<(evCfg.cornerChanceFinalThird ?? 0)){
      m.stats.corners[atk]++;m.stoppageWindow=true;logEvent(state,{type:'CORNER',team:atk,minute});
      queueVisual(state,{type:'CORNER',team:atk,minute},()=>{if(state.match!==m||m.finished)return;const c=chooseCarrier(state,atk,r);m.poss=atk;m.carrierId=c?.id||null;m.possessionActions=Math.max(2,m.possessionActions);if(c)visualRestart(atk,c.id,'corner');autoCoachSubs(state,minute,true);});
      return;
    }

    // Desarmes acontecem espacialmente durante uma posse, não por uma troca aleatória antes de cada lance.
    const turnoverBase=.025+.035*pressure+Math.max(0,actions-5)*.012;
    const protection=(dr+(ca.physical||70))*.00018;
    if(r()<Math.max(.018,turnoverBase-protection)){
      const defender=chooseDefenderNearCarrier(state,def,r);
      const foul=r()<(.10+.08*pressure);
      const reason=foul?pickFoulReason(m,'normal'):null;
      const evt={type:foul?'FOUL':'TACKLE',team:def,playerId:defender?.id,minute,reason};
      logEvent(state,evt);
      if(foul){m.stoppageWindow=true;m.stats.fouls[def]++;}
      queueVisual(state,evt,()=>{
        if(!state.match||state.match!==m||m.finished)return;
        if(foul){disciplineAfterFoul(state,def,defender?.id,minute,reason);autoCoachSubs(state,minute,true);}
        else{
          m.poss=def;m.carrierId=defender?.id||chooseCarrier(state,def,r)?.id;m.possessionActions=0;m.attackPhase='TRANSITION';m.stats.tackles[def]++;
          if(m.carrierId)Prime.Pitch.setCarrier(def,m.carrierId);
        }
      });
      return;
    }

    // Finalização cresce apenas quando a posse chegou ao terço final ou a jogada já foi construída.
    let shootBias=.012;
    if(phase==='PROGRESSION')shootBias=.025+(fin/100)*.018;
    if(phase==='FINAL_THIRD')shootBias=.075+(fin/100)*.09+(carrier.positions.includes('CA')?.045:0);
    if(actions>=7)shootBias+=.045;
    if(minute>75)shootBias+=.012;
    const liveCarrier=livePlayer(atk,carrier.id),goalY=attacksTop(atk,state)?0:Prime.FieldGeometry.FIELD.length;
    const distanceToGoal=liveCarrier?Math.hypot(liveCarrier.x-Prime.FieldGeometry.FIELD.width/2,liveCarrier.y-goalY):99;
    const isStriker=carrier.positions.includes('CA')||carrier.positions.includes('SA');
    shootBias=Math.min(.50,shootBias*(evCfg.shotBoost||1.75));
    if(isStriker&&phase==='FINAL_THIRD'&&distanceToGoal<30)shootBias=Math.max(shootBias,.58);
    if(isStriker&&distanceToGoal<20)shootBias=Math.max(shootBias,.72);

    if(r()<shootBias){
      const shooter=carrier; // only the actual ball carrier shoots; avoids cross-field visual teleport
      const outcome=decideOutcome(state,atk,shooter,r);
      const evt={type:'SHOT',team:atk,playerId:shooter.id,outcome,minute};
      m.stats.shots[atk]++;
      if(outcome==='GOAL'||outcome==='SAVE')m.stats.onTarget[atk]++;
      logEvent(state,evt);
      queueVisual(state,evt,(res)=>{
        if(!state.match||state.match!==m||m.finished)return;
        if(outcome==='GOAL'&&(res.goalCrossed||res.forcedGoal)){
          m.score[atk]++;
          logEvent(state,{type:'GOAL',team:atk,playerId:shooter.id,minute:Math.floor(m.gameSeconds/60)});
          m.poss=def;const restartPlayer=chooseCarrier(state,def,r);m.carrierId=restartPlayer?.id||null;m.possessionActions=0;m.attackPhase='KICKOFF';
          Prime.Pitch.celebrate&&Prime.Pitch.celebrate(atk,shooter.id);
          visualRestart(def,m.carrierId,'kickoff');m.stoppageWindow=true;autoCoachSubs(state,m.minute,true);
        }else if(outcome==='SAVE'){
          logEvent(state,{type:'SAVE',team:def,keeperId:keeper(state,def)?.id,minute:Math.floor(m.gameSeconds/60)});m.stats.saves[def]++;
          m.poss=def;m.carrierId=keeper(state,def)?.id;m.possessionActions=0;m.attackPhase='TRANSITION';
          Prime.Pitch.setCarrier(def,m.carrierId);
        }else{
          const nowMinute=Math.floor(m.gameSeconds/60);
          if(r()<.28){
            const cornerEvt={type:'CORNER',team:atk,minute:nowMinute,physicalOut:true};
            m.stats.corners[atk]++;logEvent(state,cornerEvt);
            m.poss=atk;m.possessionActions=Math.max(2,m.possessionActions);m.attackPhase='FINAL_THIRD';
            queueVisual(state,cornerEvt,(cornerRes)=>{
              if(state.match!==m||m.finished)return;
              const rid=cornerRes?.receiverId||chooseCarrier(state,atk,r)?.id||null;
              m.poss=atk;m.carrierId=rid;m.possessionActions=Math.max(2,m.possessionActions);m.attackPhase='FINAL_THIRD';
              if(rid&&!cornerRes?.receiverId)Prime.Pitch.setCarrier(atk,rid);
            });
          }else{
            logEvent(state,{type:'GOAL_KICK',team:def,minute:nowMinute});
            m.poss=def;m.carrierId=keeper(state,def)?.id;m.possessionActions=0;m.attackPhase='BUILDUP';visualRestart(def,m.carrierId,'goal-kick');
          }
          m.stoppageWindow=true;autoCoachSubs(state,m.minute,true);
        }
        update(state);
      });
      return;
    }

    // Jogadores habilidosos carregam a bola sobretudo na progressão e no terço final.
    const dribbleBias=phase==='BUILDUP'?.035:phase==='PROGRESSION'?.09:.13;
    const styleBonus=Math.max(-.02,Math.min(.09,(dr-pass)*.0028));
    if(r()<dribbleBias+styleBonus){
      const cut=phase==='FINAL_THIRD'&&r()<.56,dir=attackDirection(atk,state);
      const evt={type:cut?'CUT_INSIDE':'DRIBBLE',team:atk,playerId:carrier.id,dx:(r()-.5)*(phase==='FINAL_THIRD'?8:5),dy:dir*(2.4+r()*4.2),minute};
      m.possessionActions++;
      logEvent(state,evt);queueVisual(state,evt);return;
    }

    const receiver=chooseSpatialReceiver(state,atk,carrier,r,phase);if(!receiver)return;
    const receiverData=playerById(receiver.id)||receiver;
    const wide=carrier.positions.some(x=>['PE','PD','ALA','LD','LE'].includes(x));
    const targetStriker=receiverData.positions?.some(x=>['CA','SA'].includes(x));
    const cross=phase==='FINAL_THIRD'&&wide&&targetStriker&&r()<.42;
    const fromLive=livePlayer(atk,carrier.id),toLive=livePlayer(atk,receiver.id),dir=attackDirection(atk,state);
    const forwardGain=fromLive&&toLive?(toLive.y-fromLive.y)*dir:0;
    const throughBall=!cross&&phase!=='BUILDUP'&&forwardGain>5&&targetStriker&&r()<(phase==='FINAL_THIRD'?.34:.22);
    const evt={type:cross?'CROSS':'PASS',team:atk,fromId:carrier.id,toId:receiver.id,minute,throughBall};
    m.stats.passes[atk]++;m.possessionActions++;
    logEvent(state,evt);
    queueVisual(state,evt,()=>{
      if(state.match!==m||m.finished)return;
      m.poss=atk;m.carrierId=receiver.id;
    });
  }

  function start(state,config){
    stop();
    hooks=Object.assign({onUpdate:null,onEvent:null,onFinish:null,onPitchRefresh:null,onFrame:null,onError:null,onHalfTime:null,onSubstitution:null,onPenaltyRequest:null},config||{});
    state.match=null;
    try{
      if(!Rng||typeof Rng.createSeededRng!=='function'||typeof Rng.hashString!=='function')throw new Error('RNG não foi carregado corretamente.');
      if(!Prime.Pitch||typeof Prime.Pitch.isMounted!=='function'||!Prime.Pitch.isMounted())throw new Error('O campo ainda não foi montado.');
      if(!Prime.GameLoop||typeof Prime.GameLoop.start!=='function')throw new Error('Game loop não disponível.');
      const startErrors=Prime.MatchRules?.validateStart?Prime.MatchRules.validateStart(state):(Prime.Validation?.validateFullState?.(state)||[]);
      if(startErrors.length)throw new Error(startErrors[0]);
      const initialTeams=Prime.MatchRules?.snapshotTeams?Prime.MatchRules.snapshotTeams(state):JSON.parse(JSON.stringify(state.teams));
      const seed=state.settings.seed||'PRIME-001';
      const speed=[1,2,4].includes(Number(state.settings.speedFactor))?Number(state.settings.speedFactor):1;
      const seedHash=Rng.hashString(seed);
      const stoppageRng=Rng.createSeededRng(`${seed}|STOPPAGE`);
      const firstHalfStoppage=1+Math.floor(stoppageRng()*10);
      const secondHalfStoppage=1+Math.floor(stoppageRng()*10);
      const match={
        minute:0,gameSeconds:0,score:{A:0,B:0},paused:false,rng:Rng.createSeededRng(seed),poss:'A',finished:false,
        subs:{A:0,B:0},subbedOut:{A:[],B:[]},events:[],shootout:null,halfEmitted:false,waitingHalfTime:false,secondHalf:false,speedFactor:speed,
        cards:{A:{},B:{}},sentOff:{A:[],B:[]},stoppageWindow:false,pendingPenalty:null,
        firstHalfStoppage,secondHalfStoppage,firstHalfStoppageAnnounced:false,secondHalfStoppageAnnounced:false,
        realMatchSeconds:Number(state.settings.realMatchSeconds)||180,
        nextEventAt:16+seedHash%24,visualQueue:[],visualBusy:false,visualBusyElapsed:0,activeVisual:null,forceVisualDone:null,maxVisualQueue:0,
        carrierId:null,possessionActions:0,attackPhase:'BUILDUP',
        fullTimeRequested:false,fullTimeWait:0,stamina:{A:1,B:1},
        initialTeams,stats:Prime.MatchRules?.initialStats?Prime.MatchRules.initialStats():{possession:{A:0,B:0},shots:{A:0,B:0},onTarget:{A:0,B:0},passes:{A:0,B:0},tackles:{A:0,B:0},corners:{A:0,B:0},throwIns:{A:0,B:0},fouls:{A:0,B:0},yellow:{A:0,B:0},red:{A:0,B:0},saves:{A:0,B:0}}
      };
      state.match=match;
      const firstCarrier=chooseCarrier(state,'A',match.rng);
      match.carrierId=firstCarrier?.id||null;
      Prime.Pitch.setCarrier('A',firstCarrier?.id);
      emit(state,'Apita o árbitro! Começa a partida.','event','KICKOFF');
      update(state);
      Prime.GameLoop.start({
        update:(scaledDt,rawDt)=>step(state,scaledDt,rawDt),
        render:(scaledDt,rawDt)=>{Prime.Pitch.frame(scaledDt,rawDt);hooks.onFrame&&hooks.onFrame(state,rawDt);}
      });
      Prime.GameLoop.setSpeed(speed);
      return {ok:true};
    }catch(error){
      stop();state.match=null;
      const message=`Não foi possível iniciar a partida: ${error&&error.message?error.message:'erro desconhecido'}`;
      hooks.onError&&hooks.onError(message,error,state);
      return {ok:false,error:message};
    }
  }

  function stop(){Prime.GameLoop&&Prime.GameLoop.stop&&Prime.GameLoop.stop();}

  function step(state,dt,rawDt){
    const m=state.match;if(!m||m.finished||m.paused)return;
    if(m.visualBusy){
      m.visualBusyElapsed=(m.visualBusyElapsed||0)+(rawDt||dt||0);
      if(m.visualBusyElapsed>6.5&&typeof m.forceVisualDone==='function'){
        const rescue=m.forceVisualDone;
        try{Prime.Pitch?.cancelAction?.();}catch(_e){}
        if(m.visualBusy)rescue({watchdog:true});
      }
    }
    const compression=TOTAL/Math.max(45,m.realMatchSeconds);
    const firstHalfEnd=FIRST_HALF_BASE+(m.firstHalfStoppage||1)*60;
    const fullTimeEnd=TOTAL+(m.secondHalfStoppage||1)*60;
    if(!m.fullTimeRequested){
      const visualClockScale=(m.visualBusy||Prime.Pitch?.isActionActive?.()) ? .30 : 1;
      const gameDelta=dt*compression*visualClockScale;
      const periodEnd=m.secondHalf?fullTimeEnd:firstHalfEnd;
      m.gameSeconds=Math.min(periodEnd,m.gameSeconds+gameDelta);
      m.minute=Math.floor(m.gameSeconds/60);
      addPossession(m,gameDelta);
      m.stamina.A=Math.max(.72,1-Math.min(TOTAL,m.gameSeconds)/TOTAL*.26);m.stamina.B=Math.max(.72,1-Math.min(TOTAL,m.gameSeconds)/TOTAL*.26);

      if(!m.secondHalf&&!m.firstHalfStoppageAnnounced&&m.gameSeconds>=FIRST_HALF_BASE){
        m.firstHalfStoppageAnnounced=true;
        emit(state,`45' — ⏱️ o árbitro indica +${m.firstHalfStoppage} minuto${m.firstHalfStoppage===1?'':'s'} de acréscimo.`,'event','STOPPAGE_TIME',{half:1,minutes:m.firstHalfStoppage});
      }
      if(!m.halfEmitted&&!m.secondHalf&&m.gameSeconds>=firstHalfEnd){
        m.halfEmitted=true;m.gameSeconds=firstHalfEnd;m.minute=45+(m.firstHalfStoppage||1);m.waitingHalfTime=true;m.paused=true;m.stoppageWindow=true;Prime.GameLoop.setPaused(true);
        emit(state,`${m.minute}' — Intervalo.`,'event','HALF_TIME');hooks.onEvent&&hooks.onEvent({type:'OVERLAY',data:{kind:'half'}},state);autoCoachSubs(state,45,true);hooks.onHalfTime&&hooks.onHalfTime(state);update(state);return;
      }
      if(m.secondHalf&&!m.secondHalfStoppageAnnounced&&m.gameSeconds>=TOTAL){
        m.secondHalfStoppageAnnounced=true;
        emit(state,`90' — ⏱️ o árbitro indica +${m.secondHalfStoppage} minuto${m.secondHalfStoppage===1?'':'s'} de acréscimo.`,'event','STOPPAGE_TIME',{half:2,minutes:m.secondHalfStoppage});
      }

      // Uma nova etapa tática só nasce quando a etapa visual anterior terminou.
      if(m.gameSeconds>=m.nextEventAt&&m.gameSeconds<periodEnd&&!m.visualBusy&&!m.visualQueue.length&&!(Prime.Pitch?.isActionActive?.())){
        generateEvent(state);
        const tempo=(tactics(state,m.poss).tempo||65);
        const base=Math.max(Prime.Balance?.event?.baseGapMin||34,(Prime.Balance?.event?.baseGapMax||64)-tempo*.22);
        m.nextEventAt=m.gameSeconds+base+m.rng()*20;
      }
      if(m.secondHalf&&m.gameSeconds>=fullTimeEnd){m.fullTimeRequested=true;m.fullTimeWait=0;emit(state,`${90+(m.secondHalfStoppage||1)}' — fim da partida.`,'event','FULL_TIME_WAIT');}
    }else{
      m.fullTimeWait+=(rawDt||dt||0);
      if((!m.visualBusy&&!m.visualQueue.length)||m.fullTimeWait>=FULL_TIME_VISUAL_WAIT){flushVisuals(state);finishRegulation(state);return;}
    }
    update(state);
  }

  function autoCoachSubs(state,minute,atStoppage){
    const m=state.match;if(!m||!atStoppage||minute<45||minute>86)return;
    ['A','B'].forEach(key=>{
      const t=state.teams[key];
      if(!t.coach||m.subs[key]>=5)return;
      const chance=minute===45?.34:(minute>=58?.23:.08);
      if(m.rng()>chance)return;
      const moves=compatibleBenchMoves(key).filter(move=>!(m.sentOff[key]||[]).includes(String(move.outId)));
      if(!moves.length)return;
      const move=moves[Math.floor(m.rng()*moves.length)],before=t.starters[move.outIndex];
      const result=swapPlayers(key,move.outIndex,move.benchIndex);
      if(result.ok){
        m.subs[key]++;m.subbedOut[key].push(String(before));announceSub(state,key,before,result.incoming.id,minute);refreshPitch(state);
      }
    });
    m.stoppageWindow=false;
  }
  function startSecondHalf(state){
    const m=state.match;if(!m||!m.waitingHalfTime)return {ok:false,error:'A partida não está no intervalo.'};
    flushVisuals(state);m.waitingHalfTime=false;m.secondHalf=true;m.paused=false;m.stoppageWindow=false;m.attackPhase='KICKOFF';m.gameSeconds=FIRST_HALF_BASE;m.minute=45;m.secondHalfStoppageAnnounced=false;m.nextEventAt=FIRST_HALF_BASE+12+m.rng()*10;
    refreshPitch(state);const key='B',carrier=chooseCarrier(state,key,m.rng);m.poss=key;m.carrierId=carrier?.id||null;if(m.carrierId)visualRestart(key,m.carrierId,'kickoff');
    emit(state,"46' — começa o segundo tempo. Os times trocaram de lado.",'event','SECOND_HALF');Prime.GameLoop.setPaused(false);update(state);return {ok:true};
  }

  function penaltyChance(player,keeperPlayer){
    const pa=attrs(player),ka=attrs(keeperPlayer);
    return Math.max(.68,Math.min(.94,.80+((pa.finishing||75)-(ka.goalkeeping||78))*.0035));
  }
  function penaltyTaker(state,key,index){const m=state.match,t=state.teams[key],sent=new Set((m.sentOff?.[key]||[]).map(String)),current=new Set((t.starters||[]).filter(Boolean).map(String));const ids=(t.penalties||[]).filter(id=>id&&current.has(String(id))&&!sent.has(String(id)));const fallback=(t.starters||[]).filter(id=>id&&!sent.has(String(id)));const pool=ids.length?ids:fallback;return pool[index%Math.max(1,pool.length)]||null;}
  function startShootout(state){
    const m=state.match;m.shootout={A:0,B:0,kicks:[],index:0,finished:false};m.paused=true;Prime.GameLoop.setPaused(true);
    requestNextPenalty(state);
  }
  function requestNextPenalty(state){
    const m=state.match,s=m.shootout;if(!m||!s||s.finished)return;
    const idx=s.index,team=idx%2===0?'A':'B',round=Math.floor(idx/2),opp=team==='A'?'B':'A';
    const aTaken=s.kicks.filter(k=>k.team==='A').length,bTaken=s.kicks.filter(k=>k.team==='B').length;
    if((aTaken<5||bTaken<5)&&(s.A>s.B+Math.max(0,5-bTaken)||s.B>s.A+Math.max(0,5-aTaken))){s.finished=true;finishAfterShootout(state);return;}
    if(idx>=10){const maxKicks=Prime.Balance?.event?.maxShootoutKicks||30;if(idx%2===0&&s.A!==s.B){s.finished=true;finishAfterShootout(state);return;}if(idx>=maxKicks){if(s.A===s.B){const winner=m.rng()<0.5?'A':'B';s[winner]++;emit(state,`Limite de cobranças atingido: ${state.teams[winner].name} vence o desempate final.`, 'goal','SHOOTOUT_SAFETY',{winner});}s.finished=true;finishAfterShootout(state);return;}}
    const shooterId=penaltyTaker(state,team,round),goalkeeperId=keeper(state,opp)?.id;
    const humanShooter=state.mode==='cpu'?team==='A':false;
    const humanKeeper=state.mode==='cpu'?team==='B':false;
    m.pendingPenalty={team,opp,round,shooterId,goalkeeperId,humanShooter,humanKeeper};
    Prime.Pitch?.preparePenalty?.(team,shooterId,goalkeeperId,{interactiveRole:humanShooter?'shooter':humanKeeper?'keeper':'auto'});
    hooks.onPenaltyRequest&&hooks.onPenaltyRequest({...m.pendingPenalty,score:{A:s.A,B:s.B}},state);
    if(state.mode!=='cpu'){
      const zone=Math.floor(m.rng()*9);submitPenaltyChoice(state,zone);
    }
  }
  function submitPenaltyChoice(state,zone){
    const m=state.match,pn=m?.pendingPenalty,s=m?.shootout;if(!m||!pn||!s)return {ok:false,error:'Não há cobrança pendente.'};
    zone=Math.max(0,Math.min(8,Number(zone)||0));const shooter=playerById(pn.shooterId),gk=playerById(pn.goalkeeperId);
    let shotZone,diveZone;
    if(pn.humanShooter){shotZone=zone;diveZone=Math.floor(m.rng()*9);}
    else if(pn.humanKeeper){diveZone=zone;shotZone=Math.floor(m.rng()*9);}
    else{shotZone=Math.floor(m.rng()*9);diveZone=Math.floor(m.rng()*9);}
    const base=penaltyChance(shooter,gk),same=shotZone===diveZone,near=Math.abs((shotZone%3)-(diveZone%3))<=1&&Math.floor(shotZone/3)===Math.floor(diveZone/3);
    const scoreChance=Math.max(.18,Math.min(.96,base-(same?.47:near?.16:0)));const scored=m.rng()<scoreChance;
    const row=Math.floor(shotZone/3),resultKind=scored?'GOAL':((same||near)?'SAVE':(row===0?'OVER':'WIDE'));
    if(scored)s[pn.team]++;s.kicks.push({team:pn.team,playerId:pn.shooterId,scored,shotZone,diveZone,resultKind});
    const resultText=resultKind==='GOAL'?'marca':resultKind==='SAVE'?'tem a cobrança defendida':resultKind==='OVER'?'manda por cima do gol':'manda para fora';
    emit(state,`${state.teams[pn.team].name}: ${playerById(pn.shooterId)?.name||'Jogador'} ${resultText}.`,scored?'goal':'event','PENALTY_KICK',{...pn,scored,shotZone,diveZone,resultKind});
    const next=()=>{m.pendingPenalty=null;s.index++;requestNextPenalty(state);};
    if(Prime.Pitch?.playPenalty)Prime.Pitch.playPenalty(pn.team,pn.shooterId,shotZone,diveZone,scored,next,{resultKind,interactiveRole:pn.humanShooter?'shooter':pn.humanKeeper?'keeper':'auto'});else next();
    return {ok:true,scored};
  }
  function finishAfterShootout(state){
    const m=state.match;if(!m)return;const ps=Prime.Pitch?.getScene?.();if(ps)ps.penaltySetup=null;emit(state,`Pênaltis: ${state.teams.A.name} ${m.shootout.A} x ${m.shootout.B} ${state.teams.B.name}.`,'goal','SHOOTOUT',m.shootout);m.finished=true;m.gameSeconds=TOTAL+(m.secondHalfStoppage||1)*60;m.minute=90+(m.secondHalfStoppage||1);Prime.GameLoop.setPaused(true);emit(state,'Fim de jogo.','event','FULL_TIME');update(state);hooks.onFinish&&hooks.onFinish(state);
  }
  function finishRegulation(state){
    const m=state.match;if(!m||m.finished)return;
    flushVisuals(state);m.gameSeconds=TOTAL+(m.secondHalfStoppage||1)*60;m.minute=90+(m.secondHalfStoppage||1);Prime.GameLoop.setPaused(true);
    if(m.score.A===m.score.B){emit(state,'Fim do tempo regulamentar. Vamos aos pênaltis.','event','PENALTY_SHOOTOUT');startShootout(state);update(state);return;}
    m.finished=true;emit(state,'Fim de jogo.','event','FULL_TIME');update(state);hooks.onFinish&&hooks.onFinish(state);
  }

  function setPaused(state,value){const m=state.match;if(!m||m.finished)return false;if((m.waitingHalfTime||m.pendingPenalty)&&value===false)return false;m.paused=Boolean(value);Prime.GameLoop.setPaused(m.paused);update(state);return true;}
  function togglePause(state){const m=state.match;if(!m||m.finished)return false;return setPaused(state,!m.paused);}
  function setSpeed(state,value){const m=state.match;if(!m)return false;const n=[1,2,4].includes(Number(value))?Number(value):1;m.speedFactor=n;state.settings.speedFactor=n;Prime.GameLoop.setSpeed(n);update(state);return true;}
  function manualSub(state,key,outIndex,benchIndex){
    const m=state.match;if(!m||m.finished)return {ok:false,error:'A partida não está ativa.'};
    if(m.subs[key]>=5)return {ok:false,error:'Limite de 5 substituições atingido.'};
    const outId=state.teams[key].starters[outIndex];
    if((m.sentOff?.[key]||[]).includes(String(outId)))return {ok:false,error:'Jogador expulso não pode ser substituído.'};
    if((m.subbedOut?.[key]||[]).includes(String(state.teams[key].bench[benchIndex])))return {ok:false,error:'Esse jogador já saiu da partida e não pode retornar.'};
    const res=swapPlayers(key,outIndex,benchIndex);
    if(!res.ok)return res;
    m.subs[key]++;m.subbedOut[key].push(String(outId));
    announceSub(state,key,outId,res.incoming.id,m.minute);
    refreshPitch(state);update(state);
    return {ok:true};
  }
  function getStats(state){
    const m=state.match;if(!m)return null;
    const total=(m.stats.possession.A+m.stats.possession.B)||1;
    return {
      possession:{A:Math.round(m.stats.possession.A/total*100),B:Math.round(m.stats.possession.B/total*100)},
      shots:{...m.stats.shots},onTarget:{...m.stats.onTarget},passes:{...m.stats.passes},tackles:{...m.stats.tackles},corners:{...m.stats.corners},
      throwIns:{...m.stats.throwIns},fouls:{...m.stats.fouls},yellow:{...m.stats.yellow},red:{...m.stats.red},saves:{...m.stats.saves}
    };
  }

  Prime.MatchEngine=Object.freeze({start,stop,setPaused,togglePause,setSpeed,manualSub,getStats,finishRegulation,flushVisuals,startSecondHalf,submitPenaltyChoice});
})(window.Prime=window.Prime||{});
