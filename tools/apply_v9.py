from pathlib import Path
import re

# --- match engine ---
p=Path('js/simulation/matchEngine.js')
s=p.read_text()

for old,new in [
("case'FOUL':text=`${evt.minute}' — falta marcada por ${p(evt.playerId)}.`;break;","case'FOUL':text=`${evt.minute}' — falta de ${p(evt.playerId)}${evt.reason?` por ${evt.reason}`:''}.`;break;"),
("case'YELLOW_CARD':text=`${evt.minute}' — 🟨 amarelo para ${p(evt.playerId)}.`;break;","case'YELLOW_CARD':text=`${evt.minute}' — 🟨 amarelo para ${p(evt.playerId)}${evt.reason?` por ${evt.reason}`:''}.`;break;"),
("case'RED_CARD':text=`${evt.minute}' — 🟥 ${p(evt.playerId)} expulso.`;cls='danger';break;","case'RED_CARD':text=evt.secondYellow?`${evt.minute}' — 🟥 ${p(evt.playerId)} expulso: segundo amarelo${evt.reason?` por ${evt.reason}`:''}.`:`${evt.minute}' — 🟥 vermelho direto para ${p(evt.playerId)}${evt.reason?` por ${evt.reason}`:''}.`;cls='danger';break;")
]:
    if old not in s: raise SystemExit('narration marker missing')
    s=s.replace(old,new,1)

anchor='  function disciplineAfterFoul(state,team,playerId,minute){'
helper="""  function pickFoulReason(m,severity){
    const normal=['carrinho atrasado','puxão de camisa','entrada imprudente','parar um contra-ataque','chegada fora do tempo','calço por trás'];
    const serious=['entrada por trás com força excessiva','carrinho com sola alta','impedir uma chance clara de gol','entrada violenta sem disputar a bola'];
    const list=severity==='red'?serious:normal;
    return list[Math.floor(m.rng()*list.length)];
  }

"""
if anchor not in s: raise SystemExit('discipline anchor missing')
s=s.replace(anchor,helper+anchor,1)

pat=r"  function disciplineAfterFoul\(state,team,playerId,minute\)\{.*?\n  \}\n  function announceSub"
repl="""  function disciplineAfterFoul(state,team,playerId,minute,reason){
    const m=state.match;if(!m||!playerId)return;
    const p=playerById(playerId);if(!p||p.group==='GOL')return;
    const r=m.rng,n=r();
    let card=null,directRed=false,secondYellow=false,cardReason=reason||pickFoulReason(m,'normal');
    if(n<.035){card='RED_CARD';directRed=true;cardReason=pickFoulReason(m,'red');}
    else if(n<.29)card='YELLOW_CARD';
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
  function announceSub"""
s,n=re.subn(pat,repl,s,flags=re.S)
if n!=1: raise SystemExit('discipline replace failed')

old="const defender=chooseDefenderNearCarrier(state,def,r);\n      const evt={type:'FOUL',team:def,playerId:defender?.id,minute};"
new="const defender=chooseDefenderNearCarrier(state,def,r),reason=pickFoulReason(m,'normal');\n      const evt={type:'FOUL',team:def,playerId:defender?.id,minute,reason};"
if old not in s: raise SystemExit('normal foul marker missing')
s=s.replace(old,new,1)
s=s.replace("disciplineAfterFoul(state,def,defender?.id,minute);autoCoachSubs","disciplineAfterFoul(state,def,defender?.id,minute,reason);autoCoachSubs",1)

old="const evt={type:foul?'FOUL':'TACKLE',team:def,playerId:defender?.id,minute};\n      logEvent(state,evt);"
new="const reason=foul?pickFoulReason(m,'normal'):null;\n      const evt={type:foul?'FOUL':'TACKLE',team:def,playerId:defender?.id,minute,reason};\n      logEvent(state,evt);"
if old not in s: raise SystemExit('turnover foul marker missing')
s=s.replace(old,new,1)
s=s.replace("if(foul){disciplineAfterFoul(state,def,defender?.id,minute);autoCoachSubs","if(foul){disciplineAfterFoul(state,def,defender?.id,minute,reason);autoCoachSubs",1)

old="""const scoreChance=Math.max(.18,Math.min(.96,base-(same?.47:near?.16:0)));const scored=m.rng()<scoreChance;
    if(scored)s[pn.team]++;s.kicks.push({team:pn.team,playerId:pn.shooterId,scored,shotZone,diveZone});
    emit(state,`${state.teams[pn.team].name}: ${playerById(pn.shooterId)?.name||'Jogador'} ${scored?'marca':'não converte'} o pênalti.` ,scored?'goal':'event','PENALTY_KICK',{...pn,scored,shotZone,diveZone});
    const next=()=>{m.pendingPenalty=null;s.index++;requestNextPenalty(state);};
    if(Prime.Pitch?.playPenalty)Prime.Pitch.playPenalty(pn.team,pn.shooterId,shotZone,diveZone,scored,next);else next();"""
new="""const scoreChance=Math.max(.18,Math.min(.96,base-(same?.47:near?.16:0)));const scored=m.rng()<scoreChance;
    const row=Math.floor(shotZone/3),resultKind=scored?'GOAL':((same||near)?'SAVE':(row===0?'OVER':'WIDE'));
    if(scored)s[pn.team]++;s.kicks.push({team:pn.team,playerId:pn.shooterId,scored,shotZone,diveZone,resultKind});
    const resultText=resultKind==='GOAL'?'marca':resultKind==='SAVE'?'tem a cobrança defendida':resultKind==='OVER'?'manda por cima do gol':'manda para fora';
    emit(state,`${state.teams[pn.team].name}: ${playerById(pn.shooterId)?.name||'Jogador'} ${resultText}.`,scored?'goal':'event','PENALTY_KICK',{...pn,scored,shotZone,diveZone,resultKind});
    const next=()=>{m.pendingPenalty=null;s.index++;requestNextPenalty(state);};
    if(Prime.Pitch?.playPenalty)Prime.Pitch.playPenalty(pn.team,pn.shooterId,shotZone,diveZone,scored,next,{resultKind});else next();"""
if old not in s: raise SystemExit('penalty result marker missing')
s=s.replace(old,new,1)
p.write_text(s)

# --- pitch renderer ---
p=Path('js/render/pitchRenderer.js')
s=p.read_text()

old="""ctx.fillStyle='rgba(182,242,58,.16)';ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(b2.x,b2.y);ctx.lineTo(b1.x,b1.y);ctx.closePath();ctx.fill();
    ctx.restore();"""
new="""ctx.fillStyle='rgba(182,242,58,.13)';ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(b2.x,b2.y);ctx.lineTo(b1.x,b1.y);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=Math.max(3,p1.scale*.22);ctx.beginPath();ctx.moveTo(b1.x+3,b1.y+4);ctx.lineTo(b2.x+3,b2.y+4);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=Math.max(1.5,p1.scale*.12);ctx.beginPath();ctx.moveTo(b1.x,b1.y);ctx.lineTo(b2.x,b2.y);ctx.stroke();
    ctx.restore();"""
if old not in s: raise SystemExit('goal depth marker missing')
s=s.replace(old,new,1)

anchor="  function draw(s){if(!s||!s.ctx)return;drawField(s);drawArrow(s);for(const p of s.players)drawPlayerCircle(s,p);drawReferee(s);drawBall(s);drawMiniMap(s);}"
cinematic="""  function drawPenaltyCinematic(s){
    const a=s.action;if(!a||a.type!=='penalty')return;
    const ctx=s.ctx,W=Math.min(s.canvas.width*.86,980),H=Math.min(s.canvas.height*.68,560),x=(s.canvas.width-W)/2,y=Math.max(14,(s.canvas.height-H)/2-8);
    ctx.save();ctx.fillStyle='rgba(2,10,6,.80)';roundRect(ctx,x,y,W,H,18);ctx.fill();ctx.strokeStyle='rgba(182,242,58,.28)';ctx.lineWidth=2;ctx.stroke();
    const gx=x+W*.13,gy=y+H*.10,gw=W*.74,gh=H*.55,depth=Math.max(16,H*.055),bgx=gx+gw*.045,bgy=gy-depth,bgw=gw*.91,bgh=gh*.93;
    ctx.fillStyle='rgba(240,248,242,.055)';ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+gw,gy);ctx.lineTo(gx+gw,gy+gh);ctx.lineTo(gx,gy+gh);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.30)';ctx.lineWidth=1;
    for(let i=1;i<8;i++){const xx=gx+gw*i/8;ctx.beginPath();ctx.moveTo(xx,gy);ctx.lineTo(bgx+bgw*i/8,bgy+bgh);ctx.stroke();}
    for(let i=1;i<5;i++){const yy=gy+gh*i/5;ctx.beginPath();ctx.moveTo(gx,yy);ctx.lineTo(gx+gw,yy);ctx.stroke();}
    ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(4,W*.004);ctx.strokeRect(gx,gy,gw,gh);ctx.strokeStyle='rgba(255,255,255,.62)';ctx.lineWidth=2;ctx.strokeRect(bgx,bgy,bgw,bgh);
    ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(bgx,bgy);ctx.moveTo(gx+gw,gy);ctx.lineTo(bgx+bgw,bgy);ctx.moveTo(gx,gy+gh);ctx.lineTo(bgx,bgy+bgh);ctx.moveTo(gx+gw,gy+gh);ctx.lineTo(bgx+bgw,bgy+bgh);ctx.stroke();
    const col=a.shotZone%3,row=Math.floor(a.shotZone/3),shotX=[.18,.5,.82][col],diveX=[.18,.5,.82][a.diveZone%3];
    const targetX=a.resultKind==='WIDE'?(col===0?-.07:1.07):shotX,targetY=a.resultKind==='OVER'?-.18:[.19,.48,.78][row];
    const flight=a.phase==='flight'||a.phase==='hold'?Math.max(0,Math.min(1,(a.flightElapsed||0)/(a.flightDuration||.72))):0,ease=1-Math.pow(1-flight,2.2);
    const bx=gx+gw*(.5+(targetX-.5)*ease),by=gy+gh*(1.10+(targetY-1.10)*ease)-Math.sin(Math.PI*flight)*gh*.09;
    const gkQ=a.phase==='runup'?0:Math.max(0,Math.min(1,(a.flightElapsed||0)/.56)),keeperX=gx+gw*(.5+(diveX-.5)*gkQ),keeperY=gy+gh*.72-Math.sin(Math.PI*Math.min(1,gkQ))*gh*.10;
    ctx.save();ctx.translate(keeperX,keeperY);ctx.rotate((diveX-.5)*-.55*gkQ);ctx.fillStyle='#FFC93C';ctx.strokeStyle='#07150D';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,Math.max(13,W*.015),Math.max(8,W*.009),0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    const runQ=a.phase==='runup'?Math.max(0,Math.min(1,a.elapsed/a.impactAt)):1,sy=y+H*.88-(H*.09*runQ);
    ctx.fillStyle=teamColor(a.teamKey);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+W*.5,sy,Math.max(12,W*.014),0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`800 ${Math.max(12,W*.015)}px system-ui`;ctx.textAlign='center';ctx.fillText(a.shooterLabel||'Cobrador',x+W*.5,sy+32);
    const br=Math.max(6,W*.007);ctx.fillStyle='#fff';ctx.strokeStyle='#152018';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(bx-br*.7,by);ctx.lineTo(bx+br*.7,by);ctx.moveTo(bx,by-br*.7);ctx.lineTo(bx,by+br*.7);ctx.stroke();
    if(a.phase==='hold'){const labels={GOAL:['GOL!','#B6F23A'],SAVE:['DEFESA!','#FFC93C'],OVER:['POR CIMA!','#FF5A5F'],WIDE:['PARA FORA!','#FF5A5F']},it=labels[a.resultKind]||['FIM','#fff'];ctx.font=`900 ${Math.max(24,W*.04)}px system-ui`;ctx.fillStyle=it[1];ctx.fillText(it[0],x+W*.5,y+H*.075);}
    ctx.restore();
  }

  function draw(s){if(!s||!s.ctx)return;drawField(s);drawArrow(s);for(const p of s.players)drawPlayerCircle(s,p);drawReferee(s);drawBall(s);drawMiniMap(s);if(s.action?.type==='penalty')drawPenaltyCinematic(s);}"
if anchor not in s: raise SystemExit('draw anchor missing')
s=s.replace(anchor,cinematic,1)

old="""    }else if(a.type==='penalty'){
      if(a.elapsed>=a.duration){scene.ball.vx=scene.ball.vy=0;scene.ball.vz=0;scene.ball.state='dead';const cb=a.done;scene.action=null;cb&&cb({scored:a.scored});}
    }else if(a.type==='shot'){"""
new="""    }else if(a.type==='penalty'){
      const shooter=findPlayerById(a.teamKey,a.shooterId),gk=scene.players.find(p=>p.key!==a.teamKey&&p.isKeeper);
      if(a.phase==='runup'){
        const q=Math.max(0,Math.min(1,a.elapsed/a.impactAt));
        if(shooter){const e=q*q*(3-2*q);shooter.x=a.startX+(a.strikeX-a.startX)*e;shooter.y=a.startY+(a.strikeY-a.startY)*e;shooter.tx=shooter.x;shooter.ty=shooter.y;setAnim(shooter,'run',.2);}
        if(a.elapsed>=a.impactAt){
          if(shooter)setAnim(shooter,'shot',.75);
          const mouth=G.goalMouthX(),col=a.shotZone%3,row=Math.floor(a.shotZone/3),frac=[.18,.5,.82][col];
          let tx=mouth.left+(mouth.right-mouth.left)*frac,targetY=a.top?-.6:F.length+.6,loft=[.48,.28,.08][row];
          if(a.resultKind==='OVER')loft=.95;
          if(a.resultKind==='WIDE'){tx=col===0?mouth.left-2.2:mouth.right+2.2;loft=.16;}
          Prime.Ball.kickToward(scene.ball,tx,targetY,31,'penalty',{loft,spin:(col-1)*4.5});
          a.phase='flight';a.elapsed=0;a.flightElapsed=0;
        }
      }else if(a.phase==='flight'){
        a.flightElapsed=(a.flightElapsed||0)+dt;
        if(gk){const dcol=a.diveZone%3,targetX=G.goalMouthX().left+(G.goalMouthX().right-G.goalMouthX().left)*[.18,.5,.82][dcol];gk.tx=targetX;gk.ty=a.top?1.25:F.length-1.25;setAnim(gk,'dive',.22);}
        if(a.resultKind==='SAVE'&&a.flightElapsed>.5&&gk){scene.ball.x=gk.x;scene.ball.y=gk.y;scene.ball.z=.35;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';a.phase='hold';a.elapsed=0;}
        else if(a.resultKind==='GOAL'&&a.flightElapsed>.66){if(a.top)scene.netPulseTop=1;else scene.netPulseBottom=1;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';a.phase='hold';a.elapsed=0;}
        else if((a.resultKind==='OVER'||a.resultKind==='WIDE')&&a.flightElapsed>.84){scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';a.phase='hold';a.elapsed=0;}
      }else if(a.phase==='hold'&&a.elapsed>.72){const cb=a.done,result={scored:a.scored,resultKind:a.resultKind};scene.action=null;cb&&cb(result);}
    }else if(a.type==='shot'){"""
if old not in s: raise SystemExit('penalty update marker missing')
s=s.replace(old,new,1)

pat=r"  function playPenalty\(teamKey,shooterId,shotZone,diveZone,scored,done\)\{.*?\n  \}\n\n  function frame"
repl="""  function playPenalty(teamKey,shooterId,shotZone,diveZone,scored,done,meta){
    if(!scene){done&&done();return;}
    const top=visualAttacksTop(teamKey),spotY=top?F.penaltySpot:F.length-F.penaltySpot;
    const shooter=findPlayerById(teamKey,shooterId)||scene.players.find(p=>p.key===teamKey&&!p.isKeeper);
    const gk=scene.players.find(p=>p.key!==teamKey&&p.isKeeper),resultKind=meta?.resultKind||(scored?'GOAL':'SAVE');
    const startX=F.width/2,startY=spotY+(top?6.2:-6.2),strikeX=F.width/2,strikeY=spotY+(top?.65:-.65);
    if(shooter){shooter.x=startX;shooter.y=startY;shooter.tx=strikeX;shooter.ty=strikeY;setAnim(shooter,'run',.65);}
    if(gk){gk.x=F.width/2;gk.y=top?.45:F.length-.45;gk.tx=gk.x;gk.ty=gk.y;}
    scene.carrier=null;scene.target=null;scene.ball.x=F.width/2;scene.ball.y=spotY;scene.ball.z=0;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';
    scene.action={type:'penalty',phase:'runup',elapsed:0,impactAt:.72,flightElapsed:0,flightDuration:.78,done,scored,resultKind,teamKey,shooterId:String(shooterId),shooterLabel:shooter?.label||shooter?.name||'Cobrador',shotZone,diveZone,top,startX,startY,strikeX,strikeY};
  }

  function frame"""
s,n=re.subn(pat,repl,s,flags=re.S)
if n!=1: raise SystemExit('playPenalty replace failed')
p.write_text(s)

for f in ['.github/workflows/apply-v9-penalty-cards.yml','.github/workflows/apply-v9-penalty-cards-v2.yml','.github/workflows/apply-v8-gameplay.yml','.github/workflows/apply-v8-gameplay-v2.yml','.github/workflows/apply-v8-1-continuity.yml','.github/workflows/upgrade-v7-broadcast-wasm-v2.yml','.github/workflows/apply-v7.yml','tools/apply_v9.py']:
    Path(f).unlink(missing_ok=True)
