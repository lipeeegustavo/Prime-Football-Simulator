const fs=require('fs');
function patch(path,from,to,label){let s=fs.readFileSync(path,'utf8');if(!s.includes(from))throw new Error(`Patch ausente: ${label}`);fs.writeFileSync(path,s.replace(from,to));}
patch('js/simulation/matchEngine.js',
"flushVisuals(state);m.waitingHalfTime=false;m.secondHalf=true;m.paused=false;m.stoppageWindow=false;m.attackPhase='KICKOFF';m.gameSeconds=FIRST_HALF_BASE;m.minute=45;m.secondHalfStoppageAnnounced=false;",
"flushVisuals(state);m.waitingHalfTime=false;m.secondHalf=true;m.paused=false;m.stoppageWindow=false;m.attackPhase='KICKOFF';m.gameSeconds=FIRST_HALF_BASE;m.minute=45;m.secondHalfStoppageAnnounced=false;m.nextEventAt=FIRST_HALF_BASE+12+m.rng()*10;",
'segundo tempo deve gerar jogada logo após a saída');
let live=fs.readFileSync('js/online/liveMatchV20.js','utf8');
live=live.replace("id=(crypto.randomUUID?crypto.randomUUID():`viewer-${Date.now()}-${Math.floor(Math.random()*1e9)}`);","if(crypto.randomUUID)id=crypto.randomUUID();else{const b=crypto.getRandomValues(new Uint32Array(4));id=`viewer-${Array.from(b).map(x=>x.toString(16)).join('')}`;}");
fs.writeFileSync('js/online/liveMatchV20.js',live);
console.log('v20b aplicado');
