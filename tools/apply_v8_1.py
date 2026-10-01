from pathlib import Path

p=Path('js/render/pitchRenderer.js')
s=p.read_text()

old="""    scene={
      canvas,ctx,state,orientation:'vertical',players:createPlayers(state),ball:Prime.Ball.createBall(F.width/2,F.length/2),"""
new="""    scene={
      canvas,ctx,state,secondHalfSnapshot:Boolean(state.match?.secondHalf),orientation:'vertical',players:createPlayers(state),ball:Prime.Ball.createBall(F.width/2,F.length/2),"""
if old not in s: raise SystemExit('mount marker missing')
s=s.replace(old,new,1)

old="""  function refresh(state){
    if(!scene)return;
    const oldBall=scene.ball,oldCamera=scene.camera,oldAction=scene.action;
    const carrierRef=scene.carrier?{key:scene.carrier.key,id:scene.carrier.id,index:scene.carrier.index}:null;
    const targetRef=scene.target?{key:scene.target.key,id:scene.target.id,index:scene.target.index}:null;
    scene.state=state;scene.players=createPlayers(state);
    scene.ball=oldBall||Prime.Ball.createBall(F.width/2,F.length/2);scene.camera=oldCamera||createCamera('follow');scene.action=oldAction||null;"""
new="""  function refresh(state){
    if(!scene)return;
    const oldBall=scene.ball,oldCamera=scene.camera,oldAction=scene.action;
    const sideChanged=Boolean(scene.secondHalfSnapshot)!==Boolean(state.match?.secondHalf);
    const oldById=new Map(scene.players.map(p=>[`${p.key}:${p.id}`,p]));
    const oldBySlot=new Map(scene.players.map(p=>[`${p.key}:${p.index}`,p]));
    const carrierRef=scene.carrier?{key:scene.carrier.key,id:scene.carrier.id,index:scene.carrier.index}:null;
    const targetRef=scene.target?{key:scene.target.key,id:scene.target.id,index:scene.target.index}:null;
    scene.state=state;scene.players=createPlayers(state);scene.secondHalfSnapshot=Boolean(state.match?.secondHalf);
    if(!sideChanged){
      scene.players.forEach(np=>{const op=oldById.get(`${np.key}:${np.id}`)||oldBySlot.get(`${np.key}:${np.index}`);if(!op)return;np.x=op.x;np.y=op.y;np.tx=op.tx;np.ty=op.ty;np.vx=op.vx;np.vy=op.vy;np.facing=op.facing;np.animPhase=op.animPhase;});
    }
    scene.ball=oldBall||Prime.Ball.createBall(F.width/2,F.length/2);scene.camera=oldCamera||createCamera('follow');scene.action=oldAction||null;"""
if old not in s: raise SystemExit('refresh marker missing')
s=s.replace(old,new,1)

old="function getBall(){return scene&&scene.ball;}function getScene(){return scene;}function isMounted(){return Boolean(scene&&scene.canvas&&scene.ctx);}"
new="function getBall(){return scene&&scene.ball;}function getScene(){return scene;}function isMounted(){return Boolean(scene&&scene.canvas&&scene.ctx);}function isActionActive(){return Boolean(scene&&scene.action);}"
if old not in s: raise SystemExit('getters marker missing')
s=s.replace(old,new,1)
old="getBall,getScene,isMounted,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,playPenalty,restartToCarrier"
new="getBall,getScene,isMounted,isActionActive,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,playPenalty,restartToCarrier"
if old not in s: raise SystemExit('export marker missing')
p.write_text(s.replace(old,new,1))

p=Path('js/simulation/matchEngine.js')
s=p.read_text()
old="if(m.gameSeconds>=m.nextEventAt&&m.gameSeconds<TOTAL&&!m.visualBusy&&!m.visualQueue.length){"
new="if(m.gameSeconds>=m.nextEventAt&&m.gameSeconds<TOTAL&&!m.visualBusy&&!m.visualQueue.length&&!(Prime.Pitch?.isActionActive?.())){"
if old not in s: raise SystemExit('event gate marker missing')
p.write_text(s.replace(old,new,1))
