const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ctx={console,setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},window:{}};ctx.window=ctx;vm.createContext(ctx);
function load(rel){vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),ctx,{filename:rel});}
['js/state/gameStates.js','js/data/players.js','js/data/coaches.js','js/data/formations.js','js/config/balance.js','js/simulation/rng.js','js/world/fieldGeometry.js','js/state/store.js','js/squad/squadBuilder.js','js/squad/validation.js','js/cpu/cpuManager.js','js/simulation/matchRules.js'].forEach(load);
const P=ctx.Prime;
function sceneFor(state){
 const players=[];['A','B'].forEach(k=>{const pos=P.FORMATIONS[state.teams[k].formation];state.teams[k].starters.forEach((id,i)=>{players.push({key:k,id:String(id),isKeeper:pos[i]==='GOL',x:10+(i%4)*14,y:k==='A'?78-(i*4):27+(i*4),vx:0,vy:0});});});
 return {players,ball:{x:34,y:52.5,state:'controlled'}};
}
let loop=null,scene=null;
P.GameLoop={start(h){loop=h;},stop(){loop=null;},setSpeed(){},setPaused(){}};
P.Pitch={
 isMounted(){return true;},getScene(){return scene;},getBall(){return scene?.ball||null;},
 setCarrier(key,id){if(!scene)return;scene.carrier=scene.players.find(p=>p.key===key&&String(p.id)===String(id))||null;if(scene.carrier){scene.ball.x=scene.carrier.x;scene.ball.y=scene.carrier.y;scene.ball.state='controlled';}},
 setTarget(){},refresh(){},frame(){},cancelAction(){},celebrate(){},showRefereeCard(){},
 playEvent(evt,cb){ if(evt.type==='SHOT')cb({goalCrossed:evt.outcome==='GOAL',forcedGoal:evt.outcome==='GOAL'}); else cb({}); },
 playPenalty(team,shooter,shot,dive,scored,cb){cb&&cb({scored});}
};
load('js/simulation/matchEngine.js');
function make(seed){
 const s=P.Store.state;P.Store.resetForMode('cpu');s.settings.seed=seed;s.settings.realMatchSeconds=45;s.settings.speedFactor=4;P.Squad.autoFill('A');P.Cpu.buildCpuTeam(s);if(s.teams.A.coach===s.teams.B.coach){const c=P.COACHES.find(x=>String(x.id)!==String(s.teams.A.coach));s.teams.B.coach=String(c.id);}scene=sceneFor(s);return s;
}
function run(seed){
 const s=make(seed);let finished=false;let penaltyGuard=0;
 const res=P.MatchEngine.start(s,{onHalfTime(){P.MatchEngine.startSecondHalf(s);},onPenaltyRequest(){if(penaltyGuard++<50)P.MatchEngine.submitPenaltyChoice(s,4);},onFinish(){finished=true;}});
 if(!res.ok)throw new Error(res.error);
 for(let i=0;i<2500&&!finished;i++){if(loop){loop.update(.18,.18);loop.render(.18,.18);} if(s.match?.waitingHalfTime)P.MatchEngine.startSecondHalf(s);}
 const st=P.MatchEngine.getStats(s);return {seed,finished,score:s.match.score,shootout:s.match.shootout?{A:s.match.shootout.A,B:s.match.shootout.B,kicks:s.match.shootout.kicks.length}:null,stats:st,maxQueue:s.match.maxVisualQueue,events:s.match.events.length};
}
const seeds=process.argv.slice(2);const list=seeds.length?seeds:Array.from({length:12},(_,i)=>`V6-${String(i+1).padStart(2,'0')}`);const out=list.map(run);console.log(JSON.stringify(out,null,2));
