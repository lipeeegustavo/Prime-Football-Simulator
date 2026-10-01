from pathlib import Path
import re

# pitch renderer
p=Path('js/render/pitchRenderer.js')
s=p.read_text()
old="actionTime:0,celebrateTime:0,isKeeper:positions[i]==='GOL'"
new="actionTime:0,celebrateTime:0,isKeeper:positions[i]==='GOL',yellowCards:Number(state.match?.cards?.[key]?.[String(pid)]||0),cardFlash:null"
if old not in s: raise SystemExit('createPlayers marker not found')
s=s.replace(old,new)

marker="ctx.fillStyle='#F2F7F3';ctx.fillText(label,bodyX,bodyY+r+5+Math.max(13,r*.76)/2);"
repl=marker+"\n    if(p.yellowCards>0){const cw=Math.max(6,r*.42),ch=Math.max(9,r*.62);ctx.save();ctx.translate(bodyX+r*.72,bodyY-r*.76);ctx.rotate(.12);ctx.fillStyle='#FFC93C';ctx.fillRect(-cw/2,-ch/2,cw,ch);ctx.strokeStyle='rgba(7,21,13,.8)';ctx.lineWidth=1;ctx.strokeRect(-cw/2,-ch/2,cw,ch);ctx.restore();}\n    if(p.cardFlash==='red'){ctx.strokeStyle='#FF5A5F';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bodyX,bodyY,r+7,0,Math.PI*2);ctx.stroke();}"
if marker not in s: raise SystemExit('player label marker not found')
s=s.replace(marker,repl)

old="if(type==='YELLOW_CARD'){showRefereeCard('yellow');scene.action={type:'delay',done,elapsed:0,duration:1.1};return;}\n    if(type==='RED_CARD'){showRefereeCard('red');scene.action={type:'delay',done,elapsed:0,duration:1.25};return;}"
new="if(type==='YELLOW_CARD'){const cp=findPlayerById(evt.team,evt.playerId);if(cp)cp.yellowCards=Math.max(1,Number(scene.state?.match?.cards?.[evt.team]?.[String(evt.playerId)]||cp.yellowCards||1));showRefereeCard('yellow');scene.action={type:'delay',done,elapsed:0,duration:1.1};return;}\n    if(type==='RED_CARD'){const cp=findPlayerById(evt.team,evt.playerId);if(cp)cp.cardFlash='red';showRefereeCard('red');scene.action={type:'delay',done,elapsed:0,duration:1.25};return;}"
if old not in s: raise SystemExit('card event block not found')
s=s.replace(old,new)

setc="function setCarrier(key,id){\n    if(!scene)return;const p=findPlayerById(key,id);scene.carrier=p||null;scene.target=null;\n    if(p){Prime.Ball.setControlled(scene.ball,p.x,p.y,key,p.index);setAnim(p,'control',.35);}\n  }"
restart="""function setCarrier(key,id){
    if(!scene)return;const p=findPlayerById(key,id);scene.carrier=p||null;scene.target=null;
    if(p){Prime.Ball.setControlled(scene.ball,p.x,p.y,key,p.index);setAnim(p,'control',.35);}
  }
  function restartToCarrier(key,id,kind){
    if(!scene)return;const p=findPlayerById(key,id);if(!p)return;
    const dx=p.x-scene.ball.x,dy=p.y-scene.ball.y,dist=Math.hypot(dx,dy);
    if(dist<2.25){setCarrier(key,id);return;}
    scene.carrier=null;scene.target=p;scene.ball.state='dead';scene.ball.vx=scene.ball.vy=scene.ball.vz=0;
    scene.action={type:'restart',team:key,targetId:String(id),kind:kind||'restart',elapsed:0,duration:Math.max(.42,Math.min(.9,.38+dist/120)),fromX:scene.ball.x,fromY:scene.ball.y,fromZ:scene.ball.z||0};
  }"""
if setc not in s: raise SystemExit('setCarrier block not found')
s=s.replace(setc,restart)

needle="    }else if(a.type==='delay'){"
repl="""    }else if(a.type==='restart'){
      const t=findPlayerById(a.team,a.targetId);if(!t){scene.action=null;return;}
      const q=Math.max(0,Math.min(1,a.elapsed/a.duration)),e=q*q*(3-2*q);
      scene.ball.x=a.fromX+(t.x-a.fromX)*e;scene.ball.y=a.fromY+(t.y-a.fromY)*e;scene.ball.z=Math.max(0,a.fromZ*(1-e)+Math.sin(Math.PI*q)*.18);scene.ball.vx=scene.ball.vy=scene.ball.vz=0;
      if(q>=1){scene.action=null;setCarrier(a.team,a.targetId);}
    }else if(a.type==='delay'){"""
if needle not in s: raise SystemExit('updateAction delay branch not found')
s=s.replace(needle,repl,1)

pattern=r"  function drawGoal\(s,side,pulse\)\{.*?\n  \}\n\n  function updateAnimationState"
goal="""  function drawGoal(s,side,pulse){
    const ctx=s.ctx,m=G.goalMouthX(),lineY=side==='top'?0:F.length,backY=side==='top'?-F.goalDepth:F.length+F.goalDepth;
    const p1=cameraWorldToCanvas(s,m.left,lineY),p2=cameraWorldToCanvas(s,m.right,lineY),b1=cameraWorldToCanvas(s,m.left,backY),b2=cameraWorldToCanvas(s,m.right,backY);
    const glow=(pulse||0)*.24;
    ctx.save();
    ctx.fillStyle=`rgba(235,245,238,${.055+glow})`;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(b2.x,b2.y);ctx.lineTo(b1.x,b1.y);ctx.closePath();ctx.fill();
    ctx.strokeStyle=`rgba(255,255,255,${.92+Math.min(.08,glow)})`;ctx.lineWidth=Math.max(2,p1.scale*.2);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(b1.x,b1.y);ctx.lineTo(b2.x,b2.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.34)';ctx.lineWidth=Math.max(1,p1.scale*.065);
    for(let i=1;i<7;i++){const t=i/7;ctx.beginPath();ctx.moveTo(p1.x+(p2.x-p1.x)*t,p1.y+(p2.y-p1.y)*t);ctx.lineTo(b1.x+(b2.x-b1.x)*t,b1.y+(b2.y-b1.y)*t);ctx.stroke();}
    for(let i=1;i<5;i++){const t=i/5;ctx.beginPath();ctx.moveTo(p1.x+(b1.x-p1.x)*t,p1.y+(b1.y-p1.y)*t);ctx.lineTo(p2.x+(b2.x-p2.x)*t,p2.y+(b2.y-p2.y)*t);ctx.stroke();}
    ctx.strokeStyle='#FFFFFF';ctx.lineWidth=Math.max(3,p1.scale*.26);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    ctx.fillStyle='rgba(182,242,58,.16)';ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(b2.x,b2.y);ctx.lineTo(b1.x,b1.y);ctx.closePath();ctx.fill();
    ctx.restore();
  }

  function updateAnimationState"""
s,n=re.subn(pattern,goal,s,flags=re.S)
if n!=1: raise SystemExit(f'drawGoal replace failed {n}')
oldexp="getBall,getScene,isMounted,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,playPenalty"
newexp="getBall,getScene,isMounted,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,playPenalty,restartToCarrier"
if oldexp not in s: raise SystemExit('pitch export marker not found')
p.write_text(s.replace(oldexp,newexp))

# substitution compatibility
p=Path('js/squad/squadBuilder.js'); s=p.read_text()
old="""      if(required==='GOL')return p.group==='GOL'&&eligibleForPosition(p,'GOL');
      return p.group!=='GOL'&&eligibleForPosition(p,required);"""
new="""      if(required==='GOL')return p.group==='GOL'&&eligibleForPosition(p,'GOL');
      return p.group!=='GOL';"""
if old not in s: raise SystemExit('sub compatibility rule not found')
s=s.replace(old,new)
old="if(!incoming||!validIncoming)return {ok:false,error:`${incoming?incoming.name:'Reserva'} não pode jogar como ${required}.`};"
new="if(!incoming||!validIncoming)return {ok:false,error:required==='GOL'?'O goleiro só pode ser substituído por outro goleiro.':'Escolha um jogador de linha para esta substituição.'};"
if old not in s: raise SystemExit('sub error marker not found')
p.write_text(s.replace(old,new))

# match engine
p=Path('js/simulation/matchEngine.js'); s=p.read_text()
old="""    if(shouldCompressVisual(m,evt)){
      if(evt.type==='PASS'&&evt.toId)Prime.Pitch.setCarrier(evt.team,evt.toId);
      onDone&&onDone({compressed:true});
      return;
    }"""
new="""    if(shouldCompressVisual(m,evt)){
      onDone&&onDone({compressed:true});
      return;
    }"""
if old not in s: raise SystemExit('queue compression marker not found')
s=s.replace(old,new)
old="const shooter=(phase==='FINAL_THIRD'?carrier:(chooseShooter(state,atk,r)||carrier));"
new="const shooter=carrier; // only the actual ball carrier shoots; avoids cross-field visual teleport"
if old not in s: raise SystemExit('shooter marker not found')
s=s.replace(old,new)
helper="""  function visualRestart(key,id,kind){
    if(!id)return;
    if(Prime.Pitch?.restartToCarrier)Prime.Pitch.restartToCarrier(key,id,kind);
    else Prime.Pitch.setCarrier(key,id);
  }
"""
anchor="  function livePlayer(key,id){"
if anchor not in s: raise SystemExit('restart helper anchor missing')
s=s.replace(anchor,helper+anchor,1)
s=s.replace("if(c)Prime.Pitch.setCarrier(restartTeam,c.id);autoCoachSubs", "if(c)visualRestart(restartTeam,c.id,'throw-in');autoCoachSubs")
s=s.replace("if(c)Prime.Pitch.setCarrier(atk,c.id);autoCoachSubs", "if(c)visualRestart(atk,c.id,'corner');autoCoachSubs")
old="m.poss=def;m.carrierId=keeper(state,def)?.id;m.possessionActions=0;m.attackPhase='KICKOFF';\n          Prime.Pitch.celebrate&&Prime.Pitch.celebrate(atk,shooter.id);\n          Prime.Pitch.setCarrier(def,m.carrierId);m.stoppageWindow=true;autoCoachSubs"
new="m.poss=def;const restartPlayer=chooseCarrier(state,def,r);m.carrierId=restartPlayer?.id||null;m.possessionActions=0;m.attackPhase='KICKOFF';\n          Prime.Pitch.celebrate&&Prime.Pitch.celebrate(atk,shooter.id);\n          visualRestart(def,m.carrierId,'kickoff');m.stoppageWindow=true;autoCoachSubs"
if old not in s: raise SystemExit('goal restart marker not found')
s=s.replace(old,new)
s=s.replace("if(c)Prime.Pitch.setCarrier(atk,c.id);\n          }else{", "if(c)visualRestart(atk,c.id,'corner');\n          }else{")
s=s.replace("m.attackPhase='BUILDUP';Prime.Pitch.setCarrier(def,m.carrierId);", "m.attackPhase='BUILDUP';visualRestart(def,m.carrierId,'goal-kick');")
s=s.replace("if(m.carrierId)Prime.Pitch.setCarrier(key,m.carrierId);\n    emit(state,\"46'", "if(m.carrierId)visualRestart(key,m.carrierId,'kickoff');\n    emit(state,\"46'")
old="""    const outId=state.teams[key].starters[outIndex];
    if((m.subbedOut?.[key]||[]).includes(String(state.teams[key].bench[benchIndex])))return {ok:false,error:'Esse jogador já saiu da partida e não pode retornar.'};"""
new="""    const outId=state.teams[key].starters[outIndex];
    if((m.sentOff?.[key]||[]).includes(String(outId)))return {ok:false,error:'Jogador expulso não pode ser substituído.'};
    if((m.subbedOut?.[key]||[]).includes(String(state.teams[key].bench[benchIndex])))return {ok:false,error:'Esse jogador já saiu da partida e não pode retornar.'};"""
if old not in s: raise SystemExit('manualSub marker not found')
p.write_text(s.replace(old,new))

# substitution UI
p=Path('js/ui/screens.js'); s=p.read_text()
old="""  function refreshSubOut(){
    const key=$('#subTeam').value,t=state.teams[key],positions=FORMATIONS[t.formation];$('#subOut').innerHTML=t.starters.map((id,i)=>{const p=Squad.playerById(id);return `<option value=\"${i}\">${esc(p?.name||'—')} (${positions[i]})</option>`;}).join('');refreshSubIn();
  }"""
new="""  function refreshSubOut(){
    const key=$('#subTeam').value,t=state.teams[key],positions=FORMATIONS[t.formation],sent=new Set((state.match?.sentOff?.[key]||[]).map(String)),cards=state.match?.cards?.[key]||{};
    $('#subOut').innerHTML=t.starters.map((id,i)=>{const p=Squad.playerById(id),red=sent.has(String(id)),yellow=Number(cards[String(id)]||0)>0;return `<option value=\"${i}\" ${red?'disabled':''}>${red?'🟥 ':yellow?'🟨 ':''}${esc(p?.name||'—')} (${positions[i]})${red?' · expulso':''}</option>`;}).join('');
    const first=Array.from($('#subOut').options).find(o=>!o.disabled);if(first)$('#subOut').value=first.value;refreshSubIn();
  }"""
if old not in s: raise SystemExit('refreshSubOut marker not found')
p.write_text(s.replace(old,new))
