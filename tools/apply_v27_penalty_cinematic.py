from pathlib import Path


def rep(path, old, new, label):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'pattern missing: {label}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')
    print('patched:', label)

# 1) A cobrança estava avançando duas vezes por frame quando o GameLoop estava pausado.
# O render handler já chama Prime.Pitch.frame(0, rawDt), então removemos a segunda chamada.
rep(
    'js/animation/gameLoop.js',
    "      if(scene&&scene.action&&scene.action.type==='penalty'){\n        Prime.Pitch.frame(0,dt);\n        scene.__penaltyWatch=(scene.__penaltyWatch||0)+dt;",
    "      if(scene&&scene.action&&scene.action.type==='penalty'){\n        scene.__penaltyWatch=(scene.__penaltyWatch||0)+dt;",
    'avoid double penalty animation tick'
)

# 2) Permite montar a cena limpa de pênalti ANTES de o usuário escolher a zona.
rep(
    'js/render/pitchRenderer.js',
    "  function drawPenaltyCinematic(s){\n    const a=s.action;if(!a||a.type!=='penalty')return;",
    "  function drawPenaltyCinematic(s){\n    const a=s.action?.type==='penalty'?s.action:s.penaltySetup;if(!a)return;",
    'penalty cinematic accepts waiting setup'
)

rep(
    'js/render/pitchRenderer.js',
    "    if(s.action?.type==='penalty'){drawPenaltyCinematic(s);return;}",
    "    if(s.action?.type==='penalty'||s.penaltySetup){drawPenaltyCinematic(s);return;}",
    'hide regular players during entire shootout view'
)

marker = "  function playPenalty(teamKey,shooterId,shotZone,diveZone,scored,done,meta){\n"
insert = r'''  function preparePenalty(teamKey,shooterId,goalkeeperId,meta){
    if(!scene)return false;
    const top=visualAttacksTop(teamKey),spotY=top?F.penaltySpot:F.length-F.penaltySpot;
    const shooter=findPlayerById(teamKey,shooterId)||scene.players.find(p=>p.key===teamKey&&!p.isKeeper);
    const gk=findPlayerById(teamKey==='A'?'B':'A',goalkeeperId)||scene.players.find(p=>p.key!==teamKey&&p.isKeeper);
    const startX=F.width/2,startY=spotY+(top?6.2:-6.2),strikeX=F.width/2,strikeY=spotY+(top?.65:-.65);
    if(shooter){shooter.x=startX;shooter.y=startY;shooter.tx=startX;shooter.ty=startY;}
    if(gk){gk.x=F.width/2;gk.y=top?.45:F.length-.45;gk.tx=gk.x;gk.ty=gk.y;}
    scene.carrier=null;scene.target=null;
    scene.ball.x=F.width/2;scene.ball.y=spotY;scene.ball.z=0;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';
    scene.penaltySetup={type:'penalty',phase:'waiting',elapsed:0,impactAt:.92,flightElapsed:0,flightDuration:.92,scored:false,resultKind:null,interactiveRole:meta?.interactiveRole||'auto',teamKey,shooterId:String(shooterId),shooterLabel:shooter?.label||shooter?.name||'Cobrador',shotZone:4,diveZone:4,top,startX,startY,strikeX,strikeY};
    draw(scene);
    return true;
  }

'''
p = Path('js/render/pitchRenderer.js')
s = p.read_text(encoding='utf-8')
if marker not in s:
    raise SystemExit('pattern missing: insert preparePenalty')
s = s.replace(marker, insert + marker, 1)
p.write_text(s, encoding='utf-8')
print('patched: prepare clean penalty scene')

rep(
    'js/render/pitchRenderer.js',
    "  function playPenalty(teamKey,shooterId,shotZone,diveZone,scored,done,meta){\n    if(!scene){done&&done();return;}\n    const top=visualAttacksTop(teamKey),spotY=top?F.penaltySpot:F.length-F.penaltySpot;",
    "  function playPenalty(teamKey,shooterId,shotZone,diveZone,scored,done,meta){\n    if(!scene){done&&done();return;}\n    if(!scene.penaltySetup)preparePenalty(teamKey,shooterId,null,meta);\n    const top=visualAttacksTop(teamKey),spotY=top?F.penaltySpot:F.length-F.penaltySpot;",
    'ensure penalty setup before kick'
)

rep(
    'js/render/pitchRenderer.js',
    "    scene.carrier=null;scene.target=null;scene.ball.x=F.width/2;scene.ball.y=spotY;scene.ball.z=0;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';\n    scene.action={type:'penalty',phase:'runup',elapsed:0,impactAt:.72,flightElapsed:0,flightDuration:.78,done,scored,resultKind,interactiveRole:meta?.interactiveRole||'auto',teamKey,shooterId:String(shooterId),shooterLabel:shooter?.label||shooter?.name||'Cobrador',shotZone,diveZone,top,startX,startY,strikeX,strikeY};",
    "    scene.carrier=null;scene.target=null;scene.ball.x=F.width/2;scene.ball.y=spotY;scene.ball.z=0;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';\n    scene.penaltySetup=null;\n    scene.action={type:'penalty',phase:'runup',elapsed:0,impactAt:.92,flightElapsed:0,flightDuration:.92,done,scored,resultKind,interactiveRole:meta?.interactiveRole||'auto',teamKey,shooterId:String(shooterId),shooterLabel:shooter?.label||shooter?.name||'Cobrador',shotZone,diveZone,top,startX,startY,strikeX,strikeY};",
    'make penalty runup readable and clear waiting setup'
)

# Desenha cobrador e goleiro dentro do quadro cinematográfico, sem os outros 20 atletas.
needle = "    const role=a.interactiveRole||'auto',flight=a.phase==='flight'||a.phase==='hold'?Math.max(0,Math.min(1,(a.flightElapsed||0)/(a.flightDuration||.78))):0;\n"
block = r'''    const role=a.interactiveRole||'auto',flight=a.phase==='flight'||a.phase==='hold'?Math.max(0,Math.min(1,(a.flightElapsed||0)/(a.flightDuration||.92))):0;
    const liveShooter=findPlayerById(a.teamKey,a.shooterId),liveKeeper=scene.players.find(p=>p.key!==a.teamKey&&p.isKeeper);
    const runQ=a.phase==='waiting'?0:a.phase==='runup'?Math.max(0,Math.min(1,(a.elapsed||0)/(a.impactAt||.92))):1;
    const strikerX=x+W*.5,strikerY=y+H*(.80-.085*runQ),sr=Math.max(15,W*.018);
    ctx.fillStyle=a.teamKey==='A'?'#3B82F6':'#FF6B35';ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(2,W*.0025);ctx.beginPath();ctx.arc(strikerX,strikerY,sr,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(12,W*.014)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(liveShooter?.number||'9'),strikerX,strikerY);
    ctx.font=`700 ${Math.max(11,W*.012)}px system-ui`;ctx.fillText(a.shooterLabel||liveShooter?.label||'Cobrador',strikerX,strikerY+sr+16);
    const keeperTeam=a.teamKey==='A'?'B':'A',keeperBaseX=gx+gw*.5,keeperBaseY=gy+gh*.70;
    let keeperX=keeperBaseX,keeperY=keeperBaseY;
    if(a.phase==='flight'||a.phase==='hold'){
      const dcol=(Number(a.diveZone)||4)%3,drow=Math.floor((Number(a.diveZone)||4)/3),dq=Math.max(0,Math.min(1,(a.flightElapsed||0)/.60));
      keeperX=gx+gw*(.5+([.18,.5,.82][dcol]-.5)*dq);keeperY=gy+gh*(.70+([.20,.50,.78][drow]-.70)*dq);
    }
    ctx.fillStyle=keeperTeam==='A'?'#3B82F6':'#FF6B35';ctx.strokeStyle='#DDFB77';ctx.lineWidth=Math.max(2,W*.0025);ctx.beginPath();ctx.arc(keeperX,keeperY,sr*.92,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(12,W*.014)}px system-ui`;ctx.fillText(String(liveKeeper?.number||'1'),keeperX,keeperY);
'''
p = Path('js/render/pitchRenderer.js')
s = p.read_text(encoding='utf-8')
if needle not in s:
    raise SystemExit('pattern missing: cinematic actors')
s = s.replace(needle, block, 1)
p.write_text(s, encoding='utf-8')
print('patched: visible kicker and keeper animation')

rep(
    'js/render/pitchRenderer.js',
    "    getBall,getScene,isMounted,isActionActive,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,playPenalty,restartToCarrier",
    "    getBall,getScene,isMounted,isActionActive,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,preparePenalty,playPenalty,restartToCarrier",
    'export preparePenalty'
)

# 3) Assim que a próxima cobrança é anunciada, já limpa o campo e abre o quadro de pênalti.
rep(
    'js/simulation/matchEngine.js',
    "    m.pendingPenalty={team,opp,round,shooterId,goalkeeperId,humanShooter,humanKeeper};\n    hooks.onPenaltyRequest&&hooks.onPenaltyRequest({...m.pendingPenalty,score:{A:s.A,B:s.B}},state);",
    "    m.pendingPenalty={team,opp,round,shooterId,goalkeeperId,humanShooter,humanKeeper};\n    Prime.Pitch?.preparePenalty?.(team,shooterId,goalkeeperId,{interactiveRole:humanShooter?'shooter':humanKeeper?'keeper':'auto'});\n    hooks.onPenaltyRequest&&hooks.onPenaltyRequest({...m.pendingPenalty,score:{A:s.A,B:s.B}},state);",
    'prepare penalty view before user choice'
)

# 4) Ao concluir a disputa, limpa qualquer setup remanescente.
rep(
    'js/simulation/matchEngine.js',
    "  function finishAfterShootout(state){\n    const m=state.match;if(!m)return;emit(state,`Pênaltis: ${state.teams.A.name} ${m.shootout.A} x ${m.shootout.B} ${state.teams.B.name}.`,'goal','SHOOTOUT',m.shootout);",
    "  function finishAfterShootout(state){\n    const m=state.match;if(!m)return;const ps=Prime.Pitch?.getScene?.();if(ps)ps.penaltySetup=null;emit(state,`Pênaltis: ${state.teams.A.name} ${m.shootout.A} x ${m.shootout.B} ${state.teams.B.name}.`,'goal','SHOOTOUT',m.shootout);",
    'clear penalty setup on finish'
)

print('v27 penalty cinematic patch complete')
