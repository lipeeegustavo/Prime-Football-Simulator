(function (Prime) {
  const {FORMATIONS}=Prime;
  const {playerById,surname}=Prime.Squad;
  const G=Prime.FieldGeometry,F=G.FIELD;
  const B=Prime.Balance||{};
  const BASE_PERCENT={GOL:[50,92],LD:[82,76],LE:[18,76],ZAG:[50,75],VOL:[50,61],MC:[50,55],MEI:[50,45],PD:[80,32],PE:[20,32],CA:[50,24],SA:[50,31],ALA:[18,53]};
  const SHIRT_BY_POS={GOL:1,LD:2,LE:3,ZAG:4,VOL:5,MC:8,MEI:10,PD:7,PE:11,CA:9,SA:10,ALA:6};
  let scene=null;

  const FORMATION_LAYOUTS={
    '4-3-3':[[50,92],[82,78],[62,76],[38,76],[18,78],[36,58],[64,58],[50,45],[82,30],[50,22],[18,30]],
    '4-2-3-1':[[50,92],[82,78],[62,76],[38,76],[18,78],[40,60],[60,60],[80,42],[50,44],[20,42],[50,23]],
    '4-4-2':[[50,92],[82,78],[62,76],[38,76],[18,78],[38,58],[62,58],[82,48],[18,48],[40,25],[60,25]],
    '3-5-2':[[50,92],[72,76],[50,78],[28,76],[88,52],[38,57],[50,64],[62,57],[12,52],[40,25],[60,25]],
    '4-1-2-1-2':[[50,92],[82,78],[62,76],[38,76],[18,78],[50,64],[34,54],[66,54],[50,42],[40,24],[60,24]]
  };
  function coordinatesForFormation(form,key){
    const layout=FORMATION_LAYOUTS[form]||FORMATION_LAYOUTS['4-3-3'];
    return layout.map(([px,py])=>{let x=px,y=py;if(key==='B'){x=100-x;y=100-y;}return [x/100*F.width,y/100*F.length];});
  }

  function fitCanvas(canvas){
    const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1);
    const w=Math.max(360,Math.round(rect.width*ratio)),h=Math.max(360,Math.round(rect.height*ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;return true;}return false;
  }

  function createPlayers(state){
    const out=[];
    ['A','B'].forEach(key=>{
      const t=state.teams[key],visualKey=state.match?.secondHalf?(key==='A'?'B':'A'):key,coords=coordinatesForFormation(t.formation,visualKey),positions=FORMATIONS[t.formation];
      const sentOff=new Set((state.match?.sentOff?.[key]||[]).map(String));
      Prime.Squad.ensureShirtNumbers(t);
      t.starters.forEach((pid,i)=>{
        if(sentOff.has(String(pid)))return;
        const p=playerById(pid);if(!p)return;const xy=coords[i];
        out.push({
          key,index:i,id:String(pid),name:p.name,label:surname(p.name),position:positions[i],number:Prime.Squad.shirtNumber(t,pid),
          x:xy[0],y:xy[1],tx:xy[0],ty:xy[1],baseX:xy[0],baseY:xy[1],vx:0,vy:0,maxSpeed:6,accel:9,
          targeted:false,facing:key==='A'?-Math.PI/2:Math.PI/2,animState:'idle',animTime:0,animPhase:0,actionState:null,
          actionTime:0,celebrateTime:0,isKeeper:positions[i]==='GOL',yellowCards:Number(state.match?.cards?.[key]?.[String(pid)]||0),cardFlash:null
        });
      });
    });
    return out;
  }

  function createCamera(mode){return {mode:mode||'follow',x:F.width/2,y:F.length/2,targetX:F.width/2,targetY:F.length/2,zoom:mode==='full'?1:(B.camera?.followZoom||2.05)};}

  function mount(canvas,state,opts){
    if(!canvas)return null;
    const ctx=canvas.getContext&&canvas.getContext('2d');if(!ctx)return null;
    fitCanvas(canvas);
    scene={
      canvas,ctx,state,secondHalfSnapshot:Boolean(state.match?.secondHalf),orientation:'vertical',players:createPlayers(state),ball:Prime.Ball.createBall(F.width/2,F.length/2),
      carrier:null,target:null,netPulseTop:0,netPulseBottom:0,preview:Boolean(opts&&opts.preview),action:null,
      camera:createCamera(opts?.cameraMode||state.settings?.cameraMode||'follow'),celebration:null,
      referee:{x:F.width/2+6,y:F.length/2+5,tx:F.width/2+6,ty:F.length/2+5,vx:0,vy:0,card:null,cardTime:0}
    };
    draw(scene);return scene;
  }
  function refresh(state){
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
    scene.ball=oldBall||Prime.Ball.createBall(F.width/2,F.length/2);scene.camera=oldCamera||createCamera('follow');scene.action=oldAction||null;
    scene.carrier=carrierRef?(findPlayerById(carrierRef.key,carrierRef.id)||scene.players.find(p=>p.key===carrierRef.key&&p.index===carrierRef.index)||null):null;
    scene.target=targetRef?(findPlayerById(targetRef.key,targetRef.id)||scene.players.find(p=>p.key===targetRef.key&&p.index===targetRef.index)||null):null;
    if(scene.carrier&&scene.ball.state==='controlled')Prime.Ball.setControlled(scene.ball,scene.carrier.x,scene.carrier.y,scene.carrier.key,scene.carrier.index);
    else if(scene.ball.state==='dead'&&!scene.action){const fallback=scene.players.find(p=>p.key===(state.match?.poss||'A')&&!p.isKeeper)||scene.players[0];if(fallback)setCarrier(fallback.key,fallback.id);}
    draw(scene);
  }
  function renderPreview(canvas,state){return mount(canvas,state,{preview:true,cameraMode:'full'});}
  function findPlayerById(key,id){return scene&&scene.players.find(p=>p.key===key&&String(p.id)===String(id));}

  function clearTargets(){if(!scene)return;scene.players.forEach(p=>p.targeted=false);}
  function setCarrier(key,id){
    if(!scene)return;clearTargets();const p=findPlayerById(key,id);scene.carrier=p||null;scene.target=null;
    if(p){Prime.Ball.setControlled(scene.ball,p.x,p.y,key,p.index);setAnim(p,'control',.35);}
  }
  function restartToCarrier(key,id,kind){
    if(!scene)return;const p=findPlayerById(key,id);if(!p)return;
    const dx=p.x-scene.ball.x,dy=p.y-scene.ball.y,dist=Math.hypot(dx,dy);
    if(dist<2.25){setCarrier(key,id);return;}
    scene.carrier=null;scene.target=p;scene.ball.state='dead';scene.ball.vx=scene.ball.vy=scene.ball.vz=0;
    scene.action={type:'restart',team:key,targetId:String(id),kind:kind||'restart',elapsed:0,duration:Math.max(.42,Math.min(.9,.38+dist/120)),fromX:scene.ball.x,fromY:scene.ball.y,fromZ:scene.ball.z||0};
  }
  function setTarget(key,id){if(!scene)return;clearTargets();scene.target=findPlayerById(key,id)||null;if(scene.target)scene.target.targeted=true;}
  function setAnim(player,stateName,duration){if(!player)return;player.actionState=stateName;player.actionTime=Math.max(0,duration||.35);player.animTime=0;}
  function celebrate(teamKey,playerId){
    if(!scene)return;const p=findPlayerById(teamKey,playerId);if(p){p.celebrateTime=B.animation?.celebrationSeconds||1.8;setAnim(p,'celebrate',p.celebrateTime);}scene.celebration={teamKey,elapsed:0,duration:1.8};
  }

  function setCameraMode(mode){
    if(!scene)return;scene.camera.mode=mode==='full'?'full':'follow';scene.state.settings.cameraMode=scene.camera.mode;
    scene.camera.zoom=scene.camera.mode==='full'?1:(B.camera?.followZoom||2.05);
  }
  function getCameraMode(){return scene?.camera?.mode||'follow';}
  function visualAttacksTop(key){return (key==='A')!==Boolean(scene?.state?.match?.secondHalf);}

  // Broadcast horizontal: comprimento do campo no eixo X da tela.
  function cameraWorldToCanvas(s,x,y){
    const c=s.camera,canvas=s.canvas;if(c.mode==='full')return fullWorldToCanvas(s,x,y);
    const margin=18*Math.min(2,window.devicePixelRatio||1),usableW=canvas.width-margin*2,usableH=canvas.height-margin*2;
    const fullScale=Math.min(usableW/(F.length+F.goalDepth*2),usableH/F.width),scale=fullScale*c.zoom;
    return {x:canvas.width/2+(y-c.y)*scale,y:canvas.height/2+(x-c.x)*scale,scale};
  }
  function fullWorldToCanvas(s,x,y){
    const canvas=s.canvas,margin=18*Math.min(2,window.devicePixelRatio||1),totalLen=F.length+F.goalDepth*2;
    const scale=Math.min((canvas.width-margin*2)/totalLen,(canvas.height-margin*2)/F.width),drawW=totalLen*scale,drawH=F.width*scale,ox=(canvas.width-drawW)/2,oy=(canvas.height-drawH)/2;
    return {x:ox+(y+F.goalDepth)*scale,y:oy+x*scale,scale};
  }
  function updateCamera(s,dt){
    const c=s.camera;if(c.mode==='full'){c.x=F.width/2;c.y=F.length/2;return;}
    const focus=s.ball||s.carrier||{x:F.width/2,y:F.length/2},poss=s.state?.match?.poss||s.carrier?.key||'A',dir=visualAttacksTop(poss)?-1:1;
    c.targetX=focus.x;c.targetY=focus.y+dir*(B.camera?.lookAhead||5.5);const smooth=1-Math.exp(-(B.camera?.smoothing||4.6)*Math.max(0,dt));c.x+=(c.targetX-c.x)*smooth;c.y+=(c.targetY-c.y)*smooth;
    const margin=18*Math.min(2,window.devicePixelRatio||1),usableW=s.canvas.width-margin*2,usableH=s.canvas.height-margin*2,fullScale=Math.min(usableW/(F.length+F.goalDepth*2),usableH/F.width),scale=fullScale*(c.zoom||2.05),halfLateral=Math.min(F.width/2,usableH/(2*scale)),halfLength=Math.min((F.length+F.goalDepth*2)/2,usableW/(2*scale));
    c.x=Math.max(halfLateral,Math.min(F.width-halfLateral,c.x));c.y=Math.max(-F.goalDepth+halfLength,Math.min(F.length+F.goalDepth-halfLength,c.y));
  }

  function pathField(ctx,s){
    const a=cameraWorldToCanvas(s,0,0),b=cameraWorldToCanvas(s,F.width,F.length);return {a,b,x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y),scale:a.scale};
  }
  function drawField(s){
    const {ctx,canvas}=s;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#07160D';ctx.fillRect(0,0,canvas.width,canvas.height);
    const box=pathField(ctx,s),stripeWorld=F.length/10;
    for(let i=0;i<10;i++){const p1=cameraWorldToCanvas(s,0,i*stripeWorld),p2=cameraWorldToCanvas(s,F.width,(i+1)*stripeWorld);ctx.fillStyle=i%2?'#1E7A43':'#176B3A';ctx.fillRect(Math.min(p1.x,p2.x),Math.min(p1.y,p2.y),Math.abs(p2.x-p1.x),Math.abs(p2.y-p1.y)+1);}
    ctx.save();ctx.strokeStyle='rgba(255,255,255,.94)';ctx.fillStyle='rgba(255,255,255,.94)';ctx.lineWidth=Math.max(1.5,box.scale*.16);
    ctx.strokeRect(box.x,box.y,box.w,box.h);
    const midA=cameraWorldToCanvas(s,0,F.length/2),midB=cameraWorldToCanvas(s,F.width,F.length/2);ctx.beginPath();ctx.moveTo(midA.x,midA.y);ctx.lineTo(midB.x,midB.y);ctx.stroke();
    const center=cameraWorldToCanvas(s,F.width/2,F.length/2),r=F.centerCircleRadius*box.scale;ctx.beginPath();ctx.arc(center.x,center.y,r,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(center.x,center.y,Math.max(2,box.scale*.16),0,Math.PI*2);ctx.fill();
    drawArea(s,'top',F.penaltyAreaWidth,F.penaltyAreaDepth);drawArea(s,'bottom',F.penaltyAreaWidth,F.penaltyAreaDepth);drawArea(s,'top',F.goalAreaWidth,F.goalAreaDepth);drawArea(s,'bottom',F.goalAreaWidth,F.goalAreaDepth);
    drawPenalty(s,'top');drawPenalty(s,'bottom');drawCorners(s);drawGoal(s,'top',s.netPulseTop);drawGoal(s,'bottom',s.netPulseBottom);ctx.restore();
  }
  function drawArea(s,side,width,depth){const ctx=s.ctx,left=(F.width-width)/2,right=left+width,y1=side==='top'?0:F.length-depth,y2=side==='top'?depth:F.length,a=cameraWorldToCanvas(s,left,y1),b=cameraWorldToCanvas(s,right,y2);ctx.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));}
  function drawPenalty(s,side){
  const ctx=s.ctx,sy=side==='top'?F.penaltySpot:F.length-F.penaltySpot,c=cameraWorldToCanvas(s,F.width/2,sy),scale=c.scale;
  ctx.beginPath();ctx.arc(c.x,c.y,Math.max(2,scale*.16),0,Math.PI*2);ctx.fill();
  const boundary=side==='top'?F.penaltyAreaDepth:F.length-F.penaltyAreaDepth;
  let drawing=false;ctx.beginPath();
  for(let i=0;i<=96;i++){
    const a=i/96*Math.PI*2,wx=F.width/2+Math.cos(a)*F.penaltyArcRadius,wy=sy+Math.sin(a)*F.penaltyArcRadius;
    const visible=side==='top'?wy>=boundary:wy<=boundary;
    if(!visible){drawing=false;continue;}
    const q=cameraWorldToCanvas(s,wx,wy);
    if(!drawing){ctx.moveTo(q.x,q.y);drawing=true;}else ctx.lineTo(q.x,q.y);
  }
  ctx.stroke();
}
  function drawCorners(s){const ctx=s.ctx;[[0,0,0],[F.width,0,Math.PI/2],[F.width,F.length,Math.PI],[0,F.length,Math.PI*1.5]].forEach(([x,y,a])=>{const c=cameraWorldToCanvas(s,x,y),r=F.cornerRadius*c.scale;ctx.beginPath();ctx.arc(c.x,c.y,r,a,a+Math.PI/2);ctx.stroke();});}
  function drawGoal(s,side,pulse){
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
    ctx.fillStyle='rgba(182,242,58,.13)';ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(b2.x,b2.y);ctx.lineTo(b1.x,b1.y);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=Math.max(3,p1.scale*.22);ctx.beginPath();ctx.moveTo(b1.x+3,b1.y+4);ctx.lineTo(b2.x+3,b2.y+4);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=Math.max(1.5,p1.scale*.12);ctx.beginPath();ctx.moveTo(b1.x,b1.y);ctx.lineTo(b2.x,b2.y);ctx.stroke();
  const postH=Math.max(12,2.44*p1.scale*.90),lean=side==='top'?-postH*.12:postH*.12;
  const up1={x:p1.x+lean,y:p1.y-postH},up2={x:p2.x+lean,y:p2.y-postH},ub1={x:b1.x+lean*.72,y:b1.y-postH*.86},ub2={x:b2.x+lean*.72,y:b2.y-postH*.86};
  ctx.strokeStyle='#FFFFFF';ctx.lineWidth=Math.max(3,p1.scale*.24);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(up1.x,up1.y);ctx.moveTo(p2.x,p2.y);ctx.lineTo(up2.x,up2.y);ctx.moveTo(up1.x,up1.y);ctx.lineTo(up2.x,up2.y);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.48)';ctx.lineWidth=Math.max(1,p1.scale*.08);ctx.beginPath();ctx.moveTo(up1.x,up1.y);ctx.lineTo(ub1.x,ub1.y);ctx.lineTo(ub2.x,ub2.y);ctx.lineTo(up2.x,up2.y);ctx.stroke();
  for(let i=1;i<5;i++){const t=i/5;ctx.beginPath();ctx.moveTo(up1.x+(up2.x-up1.x)*t,up1.y+(up2.y-up1.y)*t);ctx.lineTo(ub1.x+(ub2.x-ub1.x)*t,ub1.y+(ub2.y-ub1.y)*t);ctx.stroke();}
  ctx.restore();
}

  function updateAnimationState(pl,dt){
    pl.animTime+=dt;pl.animPhase+=dt;
    if(pl.actionState){pl.actionTime-=dt;if(pl.actionTime<=0){pl.actionState=null;pl.actionTime=0;}}
    const sp=Math.hypot(pl.vx,pl.vy);
    if(sp>.12)pl.facing=Math.atan2(pl.vy,pl.vx)+Math.PI/2;else if(scene&&scene.ball){const dx=scene.ball.x-pl.x,dy=scene.ball.y-pl.y;if(Math.hypot(dx,dy)>1)pl.facing=Math.atan2(dy,dx)+Math.PI/2;}
    pl.animState=pl.actionState||(sp>4.1?'run':sp>.35?'jog':'idle');
    if(pl.celebrateTime>0){pl.celebrateTime=Math.max(0,pl.celebrateTime-dt);pl.animState='celebrate';}
  }
  function teamColor(key){return key==='A'?'#3B82F6':'#FF6B35';}
  function drawPlayerCircle(s,p){
    const ctx=s.ctx,c=cameraWorldToCanvas(s,p.x,p.y),scale=c.scale,sp=Math.hypot(p.vx,p.vy),moving=sp>.32;
    const r=Math.max(9,Math.min(17,2.15*scale));
    // Passada procedural: usa a fase de animação do próprio jogador, não o relógio global.
    // Isso mantém a renderização determinística e dá peso visual ao marcador circular.
    const strideHz=p.animState==='run'?10.8:p.animState==='jog'?7.4:2.2;
    const stride=Math.sin(p.animPhase*strideHz);
    const bounce=moving?Math.abs(stride)*Math.min(2.5,r*.14):Math.sin(p.animPhase*2.4)*.35;
    const footSwing=moving?stride*Math.min(5.5,r*.34):0;
    const forwardAngle=(p.facing||0)-Math.PI/2;
    const forwardX=Math.cos(forwardAngle),forwardY=Math.sin(forwardAngle),sideX=-forwardY,sideY=forwardX;
    ctx.save();
    // sombra fixa no gramado; o corpo sobe/desce levemente sobre ela.
    ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(c.x+2,c.y+r*.55,r*.88,r*.4,0,0,Math.PI*2);ctx.fill();
    const bodyX=c.x,bodyY=c.y-bounce;
    // pés simplificados vistos de cima, alternando na direção da corrida.
    if(moving){
      ctx.fillStyle='rgba(8,15,11,.92)';
      for(const side of [-1,1]){
        const along=footSwing*side,lateral=r*.48*side;
        const fx=bodyX+forwardX*(r*.46+along)+sideX*lateral;
        const fy=bodyY+forwardY*(r*.46+along)+sideY*lateral;
        ctx.beginPath();ctx.ellipse(fx,fy,Math.max(2,r*.18),Math.max(2.6,r*.27),forwardAngle,0,Math.PI*2);ctx.fill();
      }
    }
    if(p.targeted){ctx.strokeStyle='#B6F23A';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bodyX,bodyY,r+7,0,Math.PI*2);ctx.stroke();}
    if(scene.carrier===p){ctx.strokeStyle='#FFC93C';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bodyX,bodyY,r+5,0,Math.PI*2);ctx.stroke();}
    const col=p.isKeeper?(p.key==='A'?'#F8D34D':'#B6F23A'):teamColor(p.key);
    ctx.fillStyle=col;ctx.strokeStyle='#F7FAF8';ctx.lineWidth=Math.max(2,r*.14);ctx.beginPath();ctx.arc(bodyX,bodyY,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    // direção corporal / ombros: pequena barra perpendicular ao movimento.
    ctx.strokeStyle='rgba(7,22,13,.72)';ctx.lineWidth=Math.max(2,r*.12);ctx.beginPath();ctx.moveTo(bodyX+sideX*r*.45,bodyY+sideY*r*.45);ctx.lineTo(bodyX-sideX*r*.45,bodyY-sideY*r*.45);ctx.stroke();
    const ar=r+8;ctx.strokeStyle=scene.carrier===p?'#FFC93C':'rgba(255,255,255,.92)';ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(bodyX+Math.cos(p.facing)*ar,bodyY+Math.sin(p.facing)*ar);ctx.lineTo(bodyX+Math.cos(p.facing-.45)*(ar-6),bodyY+Math.sin(p.facing-.45)*(ar-6));ctx.moveTo(bodyX+Math.cos(p.facing)*ar,bodyY+Math.sin(p.facing)*ar);ctx.lineTo(bodyX+Math.cos(p.facing+.45)*(ar-6),bodyY+Math.sin(p.facing+.45)*(ar-6));ctx.stroke();
    ctx.fillStyle='#07150D';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(9,r*.82)}px system-ui`;ctx.fillText(String(p.number||''),bodyX,bodyY+.5);
    const label=`${p.label}`;ctx.font=`800 ${Math.max(8,r*.55)}px system-ui`;const tw=ctx.measureText(label).width+8;ctx.fillStyle='rgba(4,14,9,.82)';roundRect(ctx,bodyX-tw/2,bodyY+r+5,tw,Math.max(13,r*.76),5);ctx.fill();ctx.fillStyle='#F2F7F3';ctx.fillText(label,bodyX,bodyY+r+5+Math.max(13,r*.76)/2);
    if(p.yellowCards>0){const cw=Math.max(6,r*.42),ch=Math.max(9,r*.62);ctx.save();ctx.translate(bodyX+r*.72,bodyY-r*.76);ctx.rotate(.12);ctx.fillStyle='#FFC93C';ctx.fillRect(-cw/2,-ch/2,cw,ch);ctx.strokeStyle='rgba(7,21,13,.8)';ctx.lineWidth=1;ctx.strokeRect(-cw/2,-ch/2,cw,ch);ctx.restore();}
    if(p.cardFlash==='red'){ctx.strokeStyle='#FF5A5F';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bodyX,bodyY,r+7,0,Math.PI*2);ctx.stroke();}
    if(p.animState==='celebrate'){ctx.strokeStyle='#FFC93C';ctx.lineWidth=2;ctx.beginPath();ctx.arc(bodyX,bodyY,r+10+Math.sin(p.animPhase*10)*2,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

  function drawReferee(s){
    if(!s.referee)return;const r=s.referee,c=cameraWorldToCanvas(s,r.x,r.y),rad=Math.max(6,1.45*c.scale);s.ctx.save();s.ctx.fillStyle='rgba(0,0,0,.24)';s.ctx.beginPath();s.ctx.ellipse(c.x+2,c.y+rad*.7,rad*.85,rad*.38,0,0,Math.PI*2);s.ctx.fill();s.ctx.fillStyle='#1A1E1B';s.ctx.strokeStyle='#E6EEE8';s.ctx.lineWidth=1.5;s.ctx.beginPath();s.ctx.arc(c.x,c.y,rad,0,Math.PI*2);s.ctx.fill();s.ctx.stroke();s.ctx.fillStyle='#F3F6FB';s.ctx.textAlign='center';s.ctx.font=`900 ${Math.max(7,rad*.75)}px system-ui`;s.ctx.fillText('R',c.x,c.y+2);
    if(r.card&&r.cardTime>0){const color=r.card==='red'?'#FF4148':'#FFD43B';s.ctx.fillStyle=color;s.ctx.fillRect(c.x+rad*.7,c.y-rad*1.8,rad*.65,rad*.95);}
    s.ctx.restore();
  }
  function updateReferee(s,dt){
    const r=s.referee;if(!r)return;const ball=s.ball||{x:F.width/2,y:F.length/2},side=ball.x<F.width/2?7:-7;r.tx=Math.max(4,Math.min(F.width-4,ball.x+side));r.ty=Math.max(8,Math.min(F.length-8,ball.y+5));const dx=r.tx-r.x,dy=r.ty-r.y,d=Math.hypot(dx,dy),max=5.8;if(d>.1){const v=Math.min(max,d*2);r.vx=dx/d*v;r.vy=dy/d*v;r.x+=r.vx*dt;r.y+=r.vy*dt;}if(r.cardTime>0){r.cardTime=Math.max(0,r.cardTime-dt);if(!r.cardTime)r.card=null;}}
  function showRefereeCard(kind){if(!scene?.referee)return;scene.referee.card=kind;scene.referee.cardTime=1.3;}

  function drawArrow(s){
    const a=s.action;if(!a||a.type!=='receive'||!a.targetId)return;const from=scene.carrier||scene.players.find(p=>p.key===a.team&&String(p.id)===String(a.fromId)),to=findPlayerById(a.team,a.targetId);if(!from||!to)return;
    const p1=cameraWorldToCanvas(s,from.x,from.y),p2=cameraWorldToCanvas(s,to.x,to.y),ctx=s.ctx;ctx.save();ctx.strokeStyle='rgba(182,242,58,.88)';ctx.fillStyle='#B6F23A';ctx.lineWidth=2.2;ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();ctx.setLineDash([]);const ang=Math.atan2(p2.y-p1.y,p2.x-p1.x);ctx.beginPath();ctx.moveTo(p2.x,p2.y);ctx.lineTo(p2.x-Math.cos(ang-.45)*12,p2.y-Math.sin(ang-.45)*12);ctx.lineTo(p2.x-Math.cos(ang+.45)*12,p2.y-Math.sin(ang+.45)*12);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawBall(s){
    if(!s.ball)return;const b=s.ball,c=cameraWorldToCanvas(s,b.x,b.y),r=Math.max(4,Math.min(8,0.54*c.scale)),heightPx=Math.min(r*9,(b.z||0)*c.scale*.90),ctx=s.ctx;ctx.save();ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(c.x+2,c.y+3,r*.95,r*.48,0,0,Math.PI*2);ctx.fill();const by=c.y-heightPx;ctx.translate(c.x,by);ctx.rotate(b.rotation||0);ctx.fillStyle='#FFFFFF';ctx.strokeStyle='#D9E2DC';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#152018';ctx.lineWidth=Math.max(1,r*.18);ctx.beginPath();ctx.moveTo(-r*.65,0);ctx.lineTo(r*.65,0);ctx.moveTo(0,-r*.65);ctx.lineTo(0,r*.65);ctx.stroke();ctx.fillStyle='#152018';ctx.beginPath();ctx.arc(0,0,r*.26,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawMiniMap(s){
    if(s.preview||s.camera?.mode==='full')return;const ctx=s.ctx,w=Math.min(190,s.canvas.width*.22),h=w*(F.width/F.length),x=(s.canvas.width-w)/2,y=s.canvas.height-h-12;ctx.save();ctx.fillStyle='rgba(5,20,10,.82)';roundRect(ctx,x,y,w,h,10);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.36)';ctx.stroke();const pad=8,fx=x+pad,fy=y+pad,fw=w-pad*2,fh=h-pad*2;ctx.strokeStyle='rgba(255,255,255,.7)';ctx.strokeRect(fx,fy,fw,fh);ctx.beginPath();ctx.moveTo(fx+fw/2,fy);ctx.lineTo(fx+fw/2,fy+fh);ctx.stroke();for(const pl of s.players){const px=fx+pl.y/F.length*fw,py=fy+pl.x/F.width*fh;ctx.fillStyle=pl.key==='A'?'#3B82F6':'#FF6B35';ctx.beginPath();ctx.arc(px,py,2.8,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(fx+s.ball.y/F.length*fw,fy+s.ball.x/F.width*fh,2.5,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawPenaltyCinematic(s){
    const a=s.action;if(!a||a.type!=='penalty')return;
    const ctx=s.ctx,W=Math.min(s.canvas.width*.88,980),H=Math.min(s.canvas.height*.72,570),x=(s.canvas.width-W)/2,y=(s.canvas.height-H)/2;
    ctx.save();ctx.fillStyle='rgba(2,10,6,.88)';roundRect(ctx,x,y,W,H,18);ctx.fill();ctx.strokeStyle='rgba(182,242,58,.32)';ctx.lineWidth=2;ctx.stroke();
    const gx=x+W*.12,gy=y+H*.12,gw=W*.76,gh=H*.55,depth=Math.max(18,H*.06),bgx=gx+gw*.045,bgy=gy-depth,bgw=gw*.91,bgh=gh*.93;
    ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(4,W*.004);ctx.strokeRect(gx,gy,gw,gh);ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=1.4;ctx.strokeRect(bgx,bgy,bgw,bgh);
    for(let i=1;i<8;i++){const xx=gx+gw*i/8;ctx.beginPath();ctx.moveTo(xx,gy);ctx.lineTo(bgx+bgw*i/8,bgy+bgh);ctx.stroke();}
    for(let i=1;i<5;i++){const yy=gy+gh*i/5;ctx.beginPath();ctx.moveTo(gx,yy);ctx.lineTo(gx+gw,yy);ctx.stroke();}
    const role=a.interactiveRole||'auto',flight=a.phase==='flight'||a.phase==='hold'?Math.max(0,Math.min(1,(a.flightElapsed||0)/(a.flightDuration||.78))):0;
    const ease=1-Math.pow(1-flight,2.2),col=a.shotZone%3,row=Math.floor(a.shotZone/3),shotX=[.18,.5,.82][col];
    const targetX=a.resultKind==='WIDE'?(col===0?-.07:1.07):shotX,targetY=a.resultKind==='OVER'?-.16:[.18,.48,.79][row];
    if(role!=='keeper'){
      const bx=gx+gw*(.5+(targetX-.5)*ease),by=gy+gh*(1.08+(targetY-1.08)*ease)-Math.sin(Math.PI*flight)*gh*.08,br=Math.max(7,W*.008);
      ctx.fillStyle='#fff';ctx.strokeStyle='#142018';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx-br*.7,by);ctx.lineTo(bx+br*.7,by);ctx.moveTo(bx,by-br*.7);ctx.lineTo(bx,by+br*.7);ctx.stroke();
    }else{
      const dcol=a.diveZone%3,drow=Math.floor(a.diveZone/3),dx=[.18,.5,.82][dcol],dy=[.20,.50,.78][drow],q=a.phase==='runup'?0:Math.max(0,Math.min(1,(a.flightElapsed||0)/.58));
      const hx=gx+gw*(.5+(dx-.5)*q),hy=gy+gh*(.72+(dy-.72)*q);
      ctx.font=`${Math.max(42,W*.055)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🧤',hx,hy);
    }
    ctx.fillStyle='#F2F7F3';ctx.textAlign='center';ctx.font=`800 ${Math.max(14,W*.017)}px system-ui`;
    ctx.fillText(role==='keeper'?'DEFESA · acompanhe a mão do goleiro':'COBRANÇA · acompanhe a bola',x+W*.5,y+H*.86);
    if(a.phase==='hold'){const labels={GOAL:['GOL!','#B6F23A'],SAVE:['DEFESA!','#FFC93C'],OVER:['POR CIMA!','#FF5A5F'],WIDE:['PARA FORA!','#FF5A5F']},it=labels[a.resultKind]||['FIM','#fff'];ctx.font=`900 ${Math.max(26,W*.045)}px system-ui`;ctx.fillStyle=it[1];ctx.fillText(it[0],x+W*.5,y+H*.075);}
    ctx.restore();
  }

  function draw(s){
    if(!s||!s.ctx)return;
    drawField(s);
    if(s.action?.type==='penalty'){drawPenaltyCinematic(s);return;}
    drawArrow(s);for(const p of s.players)drawPlayerCircle(s,p);drawReferee(s);drawBall(s);drawMiniMap(s);
  }

  function kickToPlayer(teamKey,playerId,speed,state,options){
    if(!scene)return null;const t=findPlayerById(teamKey,playerId);if(!t)return null;setTarget(teamKey,playerId);const opts=options||{},lead=Math.max(0,Math.min(.65,Number(opts.leadSeconds)||0)),tx=Math.max(1,Math.min(F.width-1,t.x+t.vx*lead)),ty=Math.max(1,Math.min(F.length-1,t.y+t.vy*lead));const result=Prime.Ball.kickToward(scene.ball,tx,ty,speed,state||'pass',{loft:opts.loft||0,spin:opts.spin||0});setAnim(t,'receive',.5);return result;
  }
  function startPass(evt,done){
    const fromId=evt.playerId||evt.fromId,targetId=evt.targetId||evt.toId;const from=findPlayerById(evt.team,fromId)||scene.carrier,to=findPlayerById(evt.team,targetId);if(!from||!to){done&&done({missing:true});return;}
    setCarrier(evt.team,from.id);setTarget(evt.team,to.id);setAnim(from,evt.type==='CROSS'?'cross':'pass',.46);
    scene.action={type:'receive',team:evt.team,fromId:from.id,targetId:to.id,done,elapsed:0,stallElapsed:0,phase:'prep',impactAt:.16,impactDone:false,speed:evt.speed||B.ball?.passSpeed||18,ballState:evt.type==='CROSS'?'cross':'pass',loft:evt.type==='CROSS'?(B.ball?.crossLoft||.42):(evt.loft||0),spin:evt.type==='CROSS'?((to.x<from.x?-1:1)*(B.ball?.curveSpin||7.5)*.35):(evt.spin||0),leadSeconds:evt.type==='CROSS'?.36:.20};
  }
  function shoot(teamKey,shooterId,outcome,done){
    if(!scene){done&&done({missing:true});return;}const shooter=findPlayerById(teamKey,shooterId)||scene.carrier;if(!shooter){done&&done({missing:true});return;}
    setCarrier(teamKey,shooterId);setAnim(shooter,'shot',.55);scene.action={type:'shot',teamKey,outcome,done,elapsed:0,phase:'prep',impactAt:.20,impactDone:false};
  }
  function executeShotImpact(action){
    const shooter=scene.carrier;if(shooter){scene.ball.x=shooter.x;scene.ball.y=shooter.y;}
    const cfg=B.ball||{},attacksTop=visualAttacksTop(action.teamKey),mouth=G.goalMouthX(),goalY=attacksTop?-1.4:F.length+1.4;
    const side=shooter&&shooter.x<F.width/2?1:-1;
    let tx=F.width/2-side*1.8,ty=goalY,speed=cfg.shotSpeed||36.5,loft=cfg.shotLoft||.18,spin=side*(cfg.curveSpin||7.5)*.72;
    if(action.outcome==='SAVE'){
      const gk=scene.players.find(p=>p.key!==(action.teamKey)&&p.isKeeper);
      tx=gk?gk.x:F.width/2+(action.teamKey==='A'?2.3:-2.3);ty=attacksTop?.7:F.length-.7;speed=(cfg.shotSpeed||36.5)*.9;loft=cfg.saveShotLoft||.12;spin*=.45;
      if(gk)setAnim(gk,'dive',.8);
    }
    if(action.outcome==='OUT'){tx=side>0?mouth.left-4.5:mouth.right+4.5;ty=goalY;speed=(cfg.shotSpeed||36.5)*.96;loft=.23;spin*=1.15;}
    scene.carrier=null;scene.target=null;
    Prime.Ball.kickToward(scene.ball,tx,ty,speed,action.outcome==='GOAL'?'shot-goal':'shot',{loft,spin});
    action.phase='travel';action.impactDone=true;action.elapsed=0;
  }
  function playEvent(evt,done){
    if(!scene||!evt){done&&done();return;}
    const type=evt.type;
    if(type==='POSSESSION'||type==='RECEIVE'){setCarrier(evt.team,evt.playerId);done&&done();return;}
    if(type==='PASS'||type==='CROSS'){startPass(evt,done);return;}
    if(type==='DRIBBLE'||type==='CUT_INSIDE'){
      setCarrier(evt.team,evt.playerId);const p=findPlayerById(evt.team,evt.playerId);if(p){setAnim(p,type==='CUT_INSIDE'?'cut':'dribble',.65);p.tx=Math.max(2,Math.min(F.width-2,p.x+(evt.dx||0)));p.ty=Math.max(2,Math.min(F.length-2,p.y+(evt.dy||0)));}scene.action={type:'delay',done,elapsed:0,duration:.62};return;
    }
    if(type==='SHOT'){shoot(evt.team,evt.playerId,evt.outcome,done);return;}
    if(type==='TACKLE'){const p=findPlayerById(evt.team,evt.playerId);setAnim(p,'tackle',.65);scene.action={type:'delay',done,elapsed:0,duration:.55};return;}
    if(type==='FOUL'){if(scene.carrier)setAnim(scene.carrier,'fall',.7);if(scene.referee){scene.referee.tx=scene.ball.x;scene.referee.ty=scene.ball.y+2;}scene.action={type:'delay',done,elapsed:0,duration:.8};return;}
    if(type==='YELLOW_CARD'){const cp=findPlayerById(evt.team,evt.playerId);if(cp)cp.yellowCards=Math.max(1,Number(scene.state?.match?.cards?.[evt.team]?.[String(evt.playerId)]||cp.yellowCards||1));showRefereeCard('yellow');scene.action={type:'delay',done,elapsed:0,duration:1.1};return;}
    if(type==='RED_CARD'){const cp=findPlayerById(evt.team,evt.playerId);if(cp)cp.cardFlash='red';showRefereeCard('red');scene.action={type:'delay',done,elapsed:0,duration:1.25};return;}
    if(['CORNER','THROW_IN','GOAL_KICK','SUBSTITUTION'].includes(type)){scene.action={type:'delay',done,elapsed:0,duration:.42};return;}
    done&&done();
  }
  function cancelAction(){
    if(!scene)return;const cb=scene.action?.done;scene.action=null;scene.target=null;if(scene.ball.state==='dead'&&scene.carrier)Prime.Ball.setControlled(scene.ball,scene.carrier.x,scene.carrier.y,scene.carrier.key,scene.carrier.index);cb&&cb({cancelled:true});
  }

  function completeReceive(action,target,result){
    scene.ball.x=target.x;scene.ball.y=target.y;scene.ball.z=0;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;
    clearTargets();setCarrier(target.key,target.id);setAnim(target,'control',.35);const cb=action.done;scene.action=null;cb&&cb(result||{});
  }
  function updateAction(dt,prev,wasGoal){
    const a=scene.action;if(!a)return;a.elapsed=(a.elapsed||0)+dt;
    if(a.type==='receive'){
      const t=findPlayerById(a.team,a.targetId);if(!t){const cb=a.done;scene.action=null;cb&&cb({missing:true});return;}
      if(a.phase==='prep'&&!a.impactDone&&a.elapsed>=a.impactAt){
        kickToPlayer(a.team,a.targetId,a.speed,a.ballState,{loft:a.loft||0,spin:a.spin||0,leadSeconds:a.leadSeconds||0});
        a.phase='travel';a.impactDone=true;a.elapsed=0;return;
      }
      if(a.phase==='travel'){
        let dx=scene.ball.x-t.x,dy=scene.ball.y-t.y,dist=Math.hypot(dx,dy),speed=Math.hypot(scene.ball.vx,scene.ball.vy),height=scene.ball.z||0;
        if(dist<1.35&&height<2.2){completeReceive(a,t,{received:true});return;}
        if(speed<.45||scene.ball.state==='dead'||a.elapsed>=(B.receiveTimeout||2.5)){
          a.stallElapsed=(a.stallElapsed||0)+dt;
          if(a.elapsed>=(B.receiveTimeout||2.5)){scene.ball.vx*=Math.max(0,1-dt*5);scene.ball.vy*=Math.max(0,1-dt*5);if(Math.hypot(scene.ball.vx,scene.ball.vy)<.25){scene.ball.vx=scene.ball.vy=0;scene.ball.state='dead';}}
          t.tx=scene.ball.x;t.ty=scene.ball.y;
          dx=scene.ball.x-t.x;dy=scene.ball.y-t.y;dist=Math.hypot(dx,dy);
          if(dist>.001){const step=Math.min(dist,Math.max(4.8,t.maxSpeed||6)*1.15*dt);t.x+=dx/dist*step;t.y+=dy/dist*step;}
          dist=Math.hypot(scene.ball.x-t.x,scene.ball.y-t.y);
          if(dist<1.35&&(scene.ball.z||0)<2.2){completeReceive(a,t,{recovered:true});return;}
        }
      }
    }else if(a.type==='restart'){
      const t=findPlayerById(a.team,a.targetId);if(!t){scene.action=null;return;}
      const q=Math.max(0,Math.min(1,a.elapsed/a.duration)),e=q*q*(3-2*q);
      scene.ball.x=a.fromX+(t.x-a.fromX)*e;scene.ball.y=a.fromY+(t.y-a.fromY)*e;scene.ball.z=Math.max(0,a.fromZ*(1-e)+Math.sin(Math.PI*q)*.18);scene.ball.vx=scene.ball.vy=scene.ball.vz=0;
      if(q>=1){scene.action=null;setCarrier(a.team,a.targetId);}
    }else if(a.type==='delay'){
      if(a.elapsed>=a.duration){const cb=a.done;scene.action=null;cb&&cb();}
    }else if(a.type==='penalty'){
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
    }else if(a.type==='shot'){
      if(a.phase==='prep'&&!a.impactDone&&a.elapsed>=a.impactAt){executeShotImpact(a);return;}
      if(a.phase==='travel'){
        let crossed=false;if(wasGoal&&G.crossesGoalLine(prev,scene.ball,'top')){scene.netPulseTop=1;crossed=true;}if(wasGoal&&G.crossesGoalLine(prev,scene.ball,'bottom')){scene.netPulseBottom=1;crossed=true;}
        if(crossed){scene.ball.vx=scene.ball.vy=0;scene.ball.state='dead';const cb=a.done;scene.action=null;cb&&cb({goalCrossed:true});return;}
        if(a.elapsed>3.2){
          scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';const cb=a.done,outcome=a.outcome;scene.action=null;cb&&cb({goalCrossed:false,outcome,timeout:true});return;
        }
      }
    }
  }

  function playPenalty(teamKey,shooterId,shotZone,diveZone,scored,done,meta){
    if(!scene){done&&done();return;}
    const top=visualAttacksTop(teamKey),spotY=top?F.penaltySpot:F.length-F.penaltySpot;
    const shooter=findPlayerById(teamKey,shooterId)||scene.players.find(p=>p.key===teamKey&&!p.isKeeper);
    const gk=scene.players.find(p=>p.key!==teamKey&&p.isKeeper),resultKind=meta?.resultKind||(scored?'GOAL':'SAVE');
    const startX=F.width/2,startY=spotY+(top?6.2:-6.2),strikeX=F.width/2,strikeY=spotY+(top?.65:-.65);
    if(shooter){shooter.x=startX;shooter.y=startY;shooter.tx=strikeX;shooter.ty=strikeY;setAnim(shooter,'run',.65);}
    if(gk){gk.x=F.width/2;gk.y=top?.45:F.length-.45;gk.tx=gk.x;gk.ty=gk.y;}
    scene.carrier=null;scene.target=null;scene.ball.x=F.width/2;scene.ball.y=spotY;scene.ball.z=0;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;scene.ball.state='dead';
    scene.action={type:'penalty',phase:'runup',elapsed:0,impactAt:.72,flightElapsed:0,flightDuration:.78,done,scored,resultKind,interactiveRole:meta?.interactiveRole||'auto',teamKey,shooterId:String(shooterId),shooterLabel:shooter?.label||shooter?.name||'Cobrador',shotZone,diveZone,top,startX,startY,strikeX,strikeY};
  }

  function frame(dt,realDt){
    if(!scene)return;
    const raw=Math.max(0,Number(realDt)||0),sim=Math.max(0,Number(dt)||0);
    const visualDt=(scene.action?.type==='penalty'&&sim===0)?raw:sim;
    fitCanvas(scene.canvas);updateCamera(scene,visualDt);
    for(const pl of scene.players)updateAnimationState(pl,visualDt);
    updateReferee(scene,raw||visualDt);
    if(!scene.preview&&visualDt>0){
      Prime.MovementAI.update(scene,scene.state,visualDt);
      if(scene.action?.type==='receive'&&scene.action.phase==='travel'){
        const t=findPlayerById(scene.action.team,scene.action.targetId);if(t){const speed=Math.hypot(scene.ball.vx,scene.ball.vy);if(speed<.5){t.tx=scene.ball.x;t.ty=scene.ball.y;}}
      }
      if(scene.carrier&&scene.ball.state==='controlled'){
        const c=scene.carrier,sp=Math.hypot(c.vx,c.vy),ang=sp>.18?Math.atan2(c.vy,c.vx):(c.facing||0)-Math.PI/2;
        const touch=(B.animation?.dribbleTouchDistance||.75)*(sp>.55?1:.52);
        const footWave=Math.sin(c.animPhase*7.5)*.24;
        const bx=c.x+Math.cos(ang)*touch+Math.cos(ang+Math.PI/2)*footWave;
        const by=c.y+Math.sin(ang)*touch+Math.sin(ang+Math.PI/2)*footWave;
        Prime.Ball.setTarget(scene.ball,bx,by);
      }
      const prev={x:scene.ball.x,y:scene.ball.y},wasGoal=scene.ball.state==='shot-goal';Prime.Ball.update(scene.ball,visualDt);
      if(scene.action)updateAction(visualDt,prev,wasGoal);
      if(scene.ball.state==='dead'&&!scene.action&&scene.carrier)Prime.Ball.setControlled(scene.ball,scene.carrier.x,scene.carrier.y,scene.carrier.key,scene.carrier.index);
      scene.netPulseTop=Math.max(0,scene.netPulseTop-visualDt*2.7);scene.netPulseBottom=Math.max(0,scene.netPulseBottom-visualDt*2.7);
      if(scene.celebration){scene.celebration.elapsed+=visualDt;if(scene.celebration.elapsed>=scene.celebration.duration)scene.celebration=null;}
    }
    draw(scene);
  }
  function getBall(){return scene&&scene.ball;}function getScene(){return scene;}function isMounted(){return Boolean(scene&&scene.canvas&&scene.ctx);}function isActionActive(){return Boolean(scene&&scene.action);}

  Prime.Pitch=Object.freeze({
    coordinatesForFormation,mount,refresh,renderPreview,frame,draw,setCarrier,setTarget,kickToPlayer,shoot,playEvent,
    getBall,getScene,isMounted,isActionActive,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,playPenalty,restartToCarrier
  });
})(window.Prime=window.Prime||{});