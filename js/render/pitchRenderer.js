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
          actionTime:0,celebrateTime:0,isKeeper:positions[i]==='GOL'
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
      canvas,ctx,state,orientation:'vertical',players:createPlayers(state),ball:Prime.Ball.createBall(F.width/2,F.length/2),
      carrier:null,target:null,netPulseTop:0,netPulseBottom:0,preview:Boolean(opts&&opts.preview),action:null,
      camera:createCamera(opts?.cameraMode||state.settings?.cameraMode||'follow'),celebration:null,
      referee:{x:F.width/2+6,y:F.length/2+5,tx:F.width/2+6,ty:F.length/2+5,vx:0,vy:0,card:null,cardTime:0}
    };
    draw(scene);return scene;
  }
  function refresh(state){
    if(!scene)return;
    const oldBall=scene.ball,oldCamera=scene.camera,oldAction=scene.action;
    const carrierRef=scene.carrier?{key:scene.carrier.key,id:scene.carrier.id,index:scene.carrier.index}:null;
    const targetRef=scene.target?{key:scene.target.key,id:scene.target.id,index:scene.target.index}:null;
    scene.state=state;scene.players=createPlayers(state);
    scene.ball=oldBall||Prime.Ball.createBall(F.width/2,F.length/2);scene.camera=oldCamera||createCamera('follow');scene.action=oldAction||null;
    scene.carrier=carrierRef?(findPlayerById(carrierRef.key,carrierRef.id)||scene.players.find(p=>p.key===carrierRef.key&&p.index===carrierRef.index)||null):null;
    scene.target=targetRef?(findPlayerById(targetRef.key,targetRef.id)||scene.players.find(p=>p.key===targetRef.key&&p.index===targetRef.index)||null):null;
    if(scene.carrier&&scene.ball.state==='controlled')Prime.Ball.setControlled(scene.ball,scene.carrier.x,scene.carrier.y,scene.carrier.key,scene.carrier.index);
    else if(scene.ball.state==='dead'&&!scene.action){const fallback=scene.players.find(p=>p.key===(state.match?.poss||'A')&&!p.isKeeper)||scene.players[0];if(fallback)setCarrier(fallback.key,fallback.id);}
    draw(scene);
  }
  function renderPreview(canvas,state){return mount(canvas,state,{preview:true,cameraMode:'full'});}
  function findPlayerById(key,id){return scene&&scene.players.find(p=>p.key===key&&String(p.id)===String(id));}

  function setCarrier(key,id){
    if(!scene)return;const p=findPlayerById(key,id);scene.carrier=p||null;scene.target=null;
    if(p){Prime.Ball.setControlled(scene.ball,p.x,p.y,key,p.index);setAnim(p,'control',.35);}
  }
  function setTarget(key,id){if(!scene)return;scene.target=findPlayerById(key,id)||null;}
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

  function cameraWorldToCanvas(s,x,y){
    const c=s.camera,canvas=s.canvas;
    if(c.mode==='full')return fullWorldToCanvas(s,x,y);
    const margin=18*Math.min(2,window.devicePixelRatio||1),usableW=canvas.width-margin*2,usableH=canvas.height-margin*2;
    const fullScale=Math.min(usableW/F.width,usableH/(F.length+F.goalDepth*2));
    const scale=fullScale*c.zoom;
    return {x:canvas.width/2+(x-c.x)*scale,y:canvas.height/2+(y-c.y)*scale,scale};
  }
  function fullWorldToCanvas(s,x,y){
    const canvas=s.canvas,margin=18*Math.min(2,window.devicePixelRatio||1),totalLen=F.length+F.goalDepth*2;
    const scale=Math.min((canvas.width-margin*2)/F.width,(canvas.height-margin*2)/totalLen);
    const drawW=F.width*scale,drawH=totalLen*scale,ox=(canvas.width-drawW)/2,oy=(canvas.height-drawH)/2;
    return {x:ox+x*scale,y:oy+(y+F.goalDepth)*scale,scale};
  }
  function updateCamera(s,dt){
    const c=s.camera;if(c.mode==='full'){c.x=F.width/2;c.y=F.length/2;return;}
    const focus=s.ball||s.carrier||{x:F.width/2,y:F.length/2};
    const poss=s.state?.match?.poss||s.carrier?.key||'A';
    const dir=visualAttacksTop(poss)?-1:1;
    const look=B.camera?.lookAhead||5.5;
    c.targetX=focus.x;
    c.targetY=focus.y+dir*look;
    const smooth=1-Math.exp(-(B.camera?.smoothing||4.6)*Math.max(0,dt));
    c.x+=(c.targetX-c.x)*smooth;c.y+=(c.targetY-c.y)*smooth;
    const aspect=s.canvas.width/s.canvas.height,baseViewW=F.width/(c.zoom||2),baseViewH=baseViewW/aspect;
    c.x=Math.max(baseViewW*.46,Math.min(F.width-baseViewW*.46,c.x));
    c.y=Math.max(baseViewH*.46-F.goalDepth,Math.min(F.length+F.goalDepth-baseViewH*.46,c.y));
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
  function drawPenalty(s,side){const ctx=s.ctx,sy=side==='top'?F.penaltySpot:F.length-F.penaltySpot,c=cameraWorldToCanvas(s,F.width/2,sy),scale=c.scale;ctx.beginPath();ctx.arc(c.x,c.y,Math.max(2,scale*.16),0,Math.PI*2);ctx.fill();ctx.save();const boundary=side==='top'?F.penaltyAreaDepth:F.length-F.penaltyAreaDepth,b=cameraWorldToCanvas(s,0,boundary).y;ctx.beginPath();if(side==='top')ctx.rect(-10000,b,s.canvas.width+20000,s.canvas.height+10000);else ctx.rect(-10000,-10000,s.canvas.width+20000,b+10000);ctx.clip();ctx.beginPath();ctx.arc(c.x,c.y,F.penaltyArcRadius*scale,0,Math.PI*2);ctx.stroke();ctx.restore();}
  function drawCorners(s){const ctx=s.ctx;[[0,0,0],[F.width,0,Math.PI/2],[F.width,F.length,Math.PI],[0,F.length,Math.PI*1.5]].forEach(([x,y,a])=>{const c=cameraWorldToCanvas(s,x,y),r=F.cornerRadius*c.scale;ctx.beginPath();ctx.arc(c.x,c.y,r,a,a+Math.PI/2);ctx.stroke();});}
  function drawGoal(s,side,pulse){
    const ctx=s.ctx,m=G.goalMouthX(),ly=side==='top'?0:F.length,oy=side==='top'?-F.goalDepth:F.length+F.goalDepth,a=cameraWorldToCanvas(s,m.left,ly),b=cameraWorldToCanvas(s,m.right,ly),ao=cameraWorldToCanvas(s,m.left,oy),bo=cameraWorldToCanvas(s,m.right,oy),pulsePx=(pulse||0)*5*a.scale;
    ctx.save();ctx.strokeStyle='#FFFFFF';ctx.lineWidth=Math.max(2,a.scale*.22);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(ao.x,ao.y+(side==='top'?-pulsePx:pulsePx));ctx.lineTo(bo.x,bo.y+(side==='top'?pulsePx:-pulsePx));ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.44)';ctx.lineWidth=Math.max(1,a.scale*.07);
    for(let i=1;i<6;i++){const t=i/6;ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*t,a.y);ctx.lineTo(ao.x+(bo.x-ao.x)*t,ao.y);ctx.stroke();}
    for(let i=1;i<4;i++){const t=i/4;ctx.beginPath();ctx.moveTo(a.x+(ao.x-a.x)*t,a.y+(ao.y-a.y)*t);ctx.lineTo(b.x+(bo.x-b.x)*t,b.y+(bo.y-b.y)*t);ctx.stroke();}ctx.restore();
  }

  function updateAnimationState(pl,dt){
    pl.animTime+=dt;pl.animPhase+=dt;
    if(pl.actionState){pl.actionTime-=dt;if(pl.actionTime<=0){pl.actionState=null;pl.actionTime=0;}}
    const sp=Math.hypot(pl.vx,pl.vy);
    if(sp>.12)pl.facing=Math.atan2(pl.vy,pl.vx)+Math.PI/2;else if(scene&&scene.ball){const dx=scene.ball.x-pl.x,dy=scene.ball.y-pl.y;if(Math.hypot(dx,dy)>1)pl.facing=Math.atan2(dy,dx)+Math.PI/2;}
    if(pl.actionState)pl.animState=pl.actionState;else if(sp>4.1)pl.animState='run';else if(sp>.55)pl.animState='jog';else pl.animState='idle';
  }
  function drawPlayerCharacter(s,pl){
    const ctx=s.ctx,q=cameraWorldToCanvas(s,pl.x,pl.y),scale=q.scale;
    const radius=Math.max(9,Math.min(18,scale*0.95));
    const teamColor=pl.key==='A'?'#3B82F6':'#FF6B35';
    const keeperColor=pl.key==='A'?'#7C3AED':'#F59E0B';
    const fill=pl.isKeeper?keeperColor:teamColor;

    ctx.save();
    // sombra: dá volume ao marcador sem transformar em boneco.
    ctx.globalAlpha=.34;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(q.x+2,q.y+radius*.72,radius*.9,radius*.34,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;

    // halo de portador/alvo.
    if(s.carrier===pl||s.target===pl){
      ctx.strokeStyle=s.carrier===pl?'#FFC93C':'#B6F23A';ctx.lineWidth=Math.max(2.5,radius*.18);
      ctx.setLineDash(s.target===pl?[6,4]:[]);ctx.beginPath();ctx.arc(q.x,q.y,radius+5,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }

    const grad=ctx.createRadialGradient(q.x-radius*.35,q.y-radius*.42,radius*.15,q.x,q.y,radius);
    grad.addColorStop(0,'rgba(255,255,255,.42)');grad.addColorStop(.26,fill);grad.addColorStop(1,shadeColor(fill,-34));
    ctx.fillStyle=grad;ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=Math.max(1.5,radius*.1);
    ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();

    // número central.
    ctx.fillStyle='#fff';ctx.font=`1000 ${Math.max(9,radius*.82)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=3;ctx.fillText(String(pl.number),q.x,q.y+.5);ctx.shadowBlur=0;

    // pequeno indicador da direção do movimento/olhar.
    const angle=(pl.facing||0)-Math.PI/2;
    const tipX=q.x+Math.cos(angle)*(radius+5),tipY=q.y+Math.sin(angle)*(radius+5);
    const side=3.2;
    ctx.fillStyle='rgba(255,255,255,.95)';ctx.beginPath();ctx.moveTo(tipX,tipY);
    ctx.lineTo(q.x+Math.cos(angle+2.45)*side+Math.cos(angle)*radius,q.y+Math.sin(angle+2.45)*side+Math.sin(angle)*radius);
    ctx.lineTo(q.x+Math.cos(angle-2.45)*side+Math.cos(angle)*radius,q.y+Math.sin(angle-2.45)*side+Math.sin(angle)*radius);ctx.closePath();ctx.fill();
    ctx.restore();

    // nome pequeno e sempre legível.
    ctx.save();ctx.font=`800 ${Math.max(8,Math.min(13,scale*.68))}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.92)';ctx.lineWidth=3;
    const labelY=q.y+radius+12;ctx.strokeText(pl.label,q.x,labelY);ctx.fillText(pl.label,q.x,labelY);ctx.restore();
  }
  function shadeColor(hex,percent){
    const n=parseInt(hex.slice(1),16),amt=Math.round(2.55*percent),r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
    return '#'+(0x1000000+(Math.max(0,Math.min(255,r))<<16)+(Math.max(0,Math.min(255,g))<<8)+Math.max(0,Math.min(255,b))).toString(16).slice(1);
  }

  function drawIntentArrow(s){
    if(s.preview||!s.action)return;
    const a=s.action,ctx=s.ctx;
    let from=null,to=null;
    if(a.type==='receive'){
      from=s.carrier;to=findPlayerById(a.team,a.targetId);
    }else if(a.type==='penalty'){
      if(a.elapsed>=a.duration){scene.ball.vx=scene.ball.vy=0;scene.ball.vz=0;scene.ball.state='dead';const cb=a.done;scene.action=null;cb&&cb({scored:a.scored});}
    }else if(a.type==='shot'){
      from=s.carrier;
      if(from){
        const attacksTop=visualAttacksTop(a.teamKey);
        to={x:F.width/2,y:attacksTop?0:F.length};
      }
    }
    if(!from||!to)return;
    const p1=cameraWorldToCanvas(s,from.x,from.y),p2=cameraWorldToCanvas(s,to.x,to.y);
    const dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.hypot(dx,dy);if(len<12)return;
    const ux=dx/len,uy=dy/len,startPad=14,endPad=18;
    const sx=p1.x+ux*startPad,sy=p1.y+uy*startPad,ex=p2.x-ux*endPad,ey=p2.y-uy*endPad;
    const alpha=a.phase==='prep'?.92:.42;
    ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#F4F7F4';ctx.fillStyle='#F4F7F4';ctx.lineWidth=2.4;ctx.setLineDash([9,7]);ctx.lineDashOffset=-(a.elapsed||0)*22;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);
    const ang=Math.atan2(ey-sy,ex-sx),head=9;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-Math.cos(ang-.55)*head,ey-Math.sin(ang-.55)*head);ctx.lineTo(ex-Math.cos(ang+.55)*head,ey-Math.sin(ang+.55)*head);ctx.closePath();ctx.fill();ctx.restore();
  }
  function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}
  function updateReferee(s,dt){
    const r=s.referee;if(!r)return;
    const focus=s.ball||{x:F.width/2,y:F.length/2};
    // segue a jogada por uma diagonal, sem ocupar a linha da bola
    r.tx=Math.max(5,Math.min(F.width-5,focus.x+(focus.x<F.width/2?7:-7)));
    r.ty=Math.max(8,Math.min(F.length-8,focus.y+7));
    const dx=r.tx-r.x,dy=r.ty-r.y,d=Math.hypot(dx,dy)||1,sp=Math.min(5.3,d*2);
    r.vx+=(dx/d*sp-r.vx)*Math.min(1,dt*6);r.vy+=(dy/d*sp-r.vy)*Math.min(1,dt*6);
    r.x+=r.vx*dt;r.y+=r.vy*dt;
    if(r.cardTime>0){r.cardTime-=dt;if(r.cardTime<=0)r.card=null;}
  }
  function showRefereeCard(color){if(scene?.referee){scene.referee.card=color;scene.referee.cardTime=1.7;}}
  function drawReferee(s){
    const r=s.referee;if(!r||s.preview)return;const q=cameraWorldToCanvas(s,r.x,r.y),ctx=s.ctx,rad=Math.max(8,Math.min(15,q.scale*.78));
    ctx.save();ctx.globalAlpha=.28;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(q.x+2,q.y+rad*.75,rad*.85,rad*.3,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    const g=ctx.createRadialGradient(q.x-rad*.3,q.y-rad*.4,2,q.x,q.y,rad);g.addColorStop(0,'#5B6472');g.addColorStop(.35,'#222831');g.addColorStop(1,'#05070A');ctx.fillStyle=g;ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(q.x,q.y,rad,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(8,rad*.72)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('J',q.x,q.y);
    if(r.card){ctx.fillStyle=r.card==='red'?'#FF3344':'#FFD43B';ctx.fillRect(q.x+rad*.45,q.y-rad*1.65,rad*.55,rad*.8);}
    ctx.restore();
  }
  function drawPlayers(s){for(const pl of s.players)drawPlayerCharacter(s,pl);}
  function drawBall(s){
    const ball=s.ball,ground=cameraWorldToCanvas(s,ball.x,ball.y),ctx=s.ctx;
    const height=Math.max(0,ball.z||0),lift=Math.min(26,height*ground.scale*.18);
    const q={x:ground.x,y:ground.y-lift,scale:ground.scale};
    const r=Math.max(3.4,Math.min(8,q.scale*.31));
    ctx.save();
    const shadowScale=1+Math.min(.9,height*.08);
    ctx.fillStyle=`rgba(0,0,0,${Math.max(.12,.34-height*.018)})`;
    ctx.beginPath();ctx.ellipse(ground.x,ground.y+r*.72,r*shadowScale,r*.46*shadowScale,0,0,Math.PI*2);ctx.fill();
    ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=height>0?3:5;
    ctx.fillStyle='#fff';ctx.strokeStyle='#151515';ctx.lineWidth=1.3;
    ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate((ball.travelled||0)*2.25+(ball.spin||0)*.03);
    ctx.fillStyle='#222';ctx.beginPath();ctx.arc(0,0,r*.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(r*.42,-r*.18,r*.12,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.restore();
  }
  function drawMiniMap(s){
    if(s.preview)return;const ctx=s.ctx,w=Math.min(150,s.canvas.width*.2),h=w*1.54,x=s.canvas.width-w-12,y=s.canvas.height-h-12;ctx.save();ctx.fillStyle='rgba(5,20,10,.78)';roundRect(ctx,x,y,w,h,10);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.36)';ctx.stroke();const pad=8,fx=x+pad,fy=y+pad,fw=w-pad*2,fh=h-pad*2;ctx.strokeStyle='rgba(255,255,255,.7)';ctx.strokeRect(fx,fy,fw,fh);ctx.beginPath();ctx.moveTo(fx,fy+fh/2);ctx.lineTo(fx+fw,fy+fh/2);ctx.stroke();for(const pl of s.players){const px=fx+pl.x/F.width*fw,py=fy+pl.y/F.length*fh;ctx.fillStyle=pl.key==='A'?'#3B82F6':'#FF6B35';ctx.beginPath();ctx.arc(px,py,2.6,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(fx+s.ball.x/F.width*fw,fy+s.ball.y/F.length*fh,2.4,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function draw(s){if(!s||!s.ctx)return;drawField(s);drawIntentArrow(s);drawReferee(s);drawPlayers(s);drawBall(s);drawMiniMap(s);}

  function kickToPlayer(key,id,speed,stateName,options){
    if(!scene)return;const p=findPlayerById(key,id);if(!p)return;scene.target=p;
    const o=Object.assign({},options||{}),cfg=B.ball||{};
    const leadSeconds=Math.max(0,Number(o.leadSeconds)||0);
    const maxLead=cfg.passLeadMaxMeters||4.5;
    let leadX=(p.vx||0)*leadSeconds,leadY=(p.vy||0)*leadSeconds;
    const leadLen=Math.hypot(leadX,leadY);
    if(leadLen>maxLead){leadX=leadX/leadLen*maxLead;leadY=leadY/leadLen*maxLead;}
    Prime.Ball.kickToward(scene.ball,p.x+leadX,p.y+leadY,speed||cfg.shortPassSpeed||18,stateName||'pass',o);
  }
  function startPass(evt,done){
    const from=findPlayerById(evt.team,evt.fromId),to=findPlayerById(evt.team,evt.toId);if(!from||!to){done&&done({missing:true});return;}
    setCarrier(evt.team,evt.fromId);setTarget(evt.team,evt.toId);setAnim(from,evt.type==='CROSS'?'cross':'pass',.42);setAnim(to,'receive',.55);
    const cfg=B.ball||{},cross=evt.type==='CROSS';
    const dist=Math.hypot(to.x-from.x,to.y-from.y);
    const longPass=!cross&&dist>22;
    scene.action={type:'receive',team:evt.team,targetId:String(evt.toId),done,elapsed:0,phase:'prep',impactAt:.18,
      speed:cross?(cfg.crossSpeed||24):(longPass?(cfg.longPassSpeed||22.5):(cfg.shortPassSpeed||17.5)),
      ballState:evt.type.toLowerCase(),impactDone:false,stallElapsed:0,
      loft:cross?(cfg.crossLoft||.62):(longPass?.14:0),
      leadSeconds:cross?.16:(cfg.throughBallLead||.34),
      spin:cross?((from.x<F.width/2?1:-1)*(cfg.curveSpin||7.5)):(longPass?2.4:0)};
  }
  function shoot(teamKey,shooterId,outcome,done){
    if(!scene)return;const shooter=findPlayerById(teamKey,shooterId)||scene.carrier;if(!shooter){done&&done({missing:true});return;}
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
    if(type==='YELLOW_CARD'){showRefereeCard('yellow');scene.action={type:'delay',done,elapsed:0,duration:1.1};return;}
    if(type==='RED_CARD'){showRefereeCard('red');scene.action={type:'delay',done,elapsed:0,duration:1.25};return;}
    if(['CORNER','THROW_IN','GOAL_KICK','SUBSTITUTION'].includes(type)){scene.action={type:'delay',done,elapsed:0,duration:.42};return;}
    done&&done();
  }
  function cancelAction(){
    if(!scene)return;const cb=scene.action?.done;scene.action=null;scene.target=null;if(scene.ball.state==='dead'&&scene.carrier)Prime.Ball.setControlled(scene.ball,scene.carrier.x,scene.carrier.y,scene.carrier.key,scene.carrier.index);cb&&cb({cancelled:true});
  }

  function completeReceive(action,target,result){
    scene.ball.x=target.x;scene.ball.y=target.y;scene.ball.vx=scene.ball.vy=0;setCarrier(target.key,target.id);setAnim(target,'control',.35);const cb=action.done;scene.action=null;cb&&cb(result||{});
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
        const dist=Math.hypot(scene.ball.x-t.x,scene.ball.y-t.y),speed=Math.hypot(scene.ball.vx,scene.ball.vy),height=scene.ball.z||0;
        if(dist<1.35&&height<2.2){completeReceive(a,t,{received:true});return;}
        if(speed<.3||scene.ball.state==='dead'){
          a.stallElapsed=(a.stallElapsed||0)+dt;t.tx=scene.ball.x;t.ty=scene.ball.y;
          if(a.stallElapsed>.28||a.elapsed>1.9){completeReceive(a,t,{fallback:true});return;}
        }
        if(a.elapsed>=(B.receiveTimeout||2.5)){completeReceive(a,t,{timeout:true});return;}
      }
    }else if(a.type==='delay'){
      if(a.elapsed>=a.duration){const cb=a.done;scene.action=null;cb&&cb();}
    }else if(a.type==='penalty'){
      if(a.elapsed>=a.duration){scene.ball.vx=scene.ball.vy=0;scene.ball.vz=0;scene.ball.state='dead';const cb=a.done;scene.action=null;cb&&cb({scored:a.scored});}
    }else if(a.type==='shot'){
      if(a.phase==='prep'&&!a.impactDone&&a.elapsed>=a.impactAt){executeShotImpact(a);return;}
      if(a.phase==='travel'){
        let crossed=false;if(wasGoal&&G.crossesGoalLine(prev,scene.ball,'top')){scene.netPulseTop=1;crossed=true;}if(wasGoal&&G.crossesGoalLine(prev,scene.ball,'bottom')){scene.netPulseBottom=1;crossed=true;}
        if(crossed){scene.ball.vx=scene.ball.vy=0;scene.ball.state='dead';const cb=a.done;scene.action=null;cb&&cb({goalCrossed:true});return;}
        if(a.elapsed>1.7){
          if(a.outcome==='GOAL'){
            const attacksTop=visualAttacksTop(a.teamKey);const before={x:scene.ball.x,y:attacksTop?.1:F.length-.1};scene.ball.x=F.width/2;scene.ball.y=attacksTop?-0.25:F.length+.25;const crossedNow=G.crossesGoalLine(before,scene.ball,attacksTop?'top':'bottom');if(attacksTop)scene.netPulseTop=1;else scene.netPulseBottom=1;scene.ball.vx=scene.ball.vy=0;scene.ball.state='dead';const cb=a.done;scene.action=null;cb&&cb({goalCrossed:crossedNow,forcedGoal:true});return;
          }
          scene.ball.vx=scene.ball.vy=0;scene.ball.state='dead';const cb=a.done,outcome=a.outcome;scene.action=null;cb&&cb({goalCrossed:false,outcome});return;
        }
      }
    }
  }

  function playPenalty(teamKey,shooterId,shotZone,diveZone,scored,done){
    if(!scene){done&&done();return;}
    const top=visualAttacksTop(teamKey),spotY=top?F.penaltySpot:F.length-F.penaltySpot,goalY=top?.2:F.length-.2,mouth=G.goalMouthX();
    const shooter=findPlayerById(teamKey,shooterId)||scene.players.find(p=>p.key===teamKey&&!p.isKeeper);
    const gk=scene.players.find(p=>p.key!==teamKey&&p.isKeeper);
    if(shooter){shooter.x=F.width/2;shooter.y=spotY+(top?2:-2);shooter.tx=shooter.x;shooter.ty=shooter.y;setAnim(shooter,'shot',.8);}
    scene.carrier=null;scene.target=null;scene.ball.x=F.width/2;scene.ball.y=spotY;scene.ball.z=0;scene.ball.vx=scene.ball.vy=scene.ball.vz=0;
    const col=shotZone%3,row=Math.floor(shotZone/3),xFrac=[.18,.5,.82][col],tx=mouth.left+(mouth.right-mouth.left)*xFrac;
    const targetY=goalY;const loft=[.52,.27,.08][row];
    if(gk){const dcol=diveZone%3;gk.tx=mouth.left+(mouth.right-mouth.left)*[.18,.5,.82][dcol];gk.ty=top?1.5:F.length-1.5;setAnim(gk,'dive',1.05);}
    Prime.Ball.kickToward(scene.ball,tx,targetY,31,'penalty',{loft,spin:(col-1)*4.5});
    scene.action={type:'penalty',elapsed:0,duration:1.25,done,scored};
  }

  function frame(dt){
    if(!scene)return;fitCanvas(scene.canvas);updateCamera(scene,dt);
    for(const pl of scene.players)updateAnimationState(pl,dt);
    updateReferee(scene,dt);
    if(!scene.preview){
      Prime.MovementAI.update(scene,scene.state,dt);
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
      const prev={x:scene.ball.x,y:scene.ball.y},wasGoal=scene.ball.state==='shot-goal';Prime.Ball.update(scene.ball,dt);
      if(scene.action)updateAction(dt,prev,wasGoal);
      if(scene.ball.state==='dead'&&!scene.action&&scene.carrier)Prime.Ball.setControlled(scene.ball,scene.carrier.x,scene.carrier.y,scene.carrier.key,scene.carrier.index);
      scene.netPulseTop=Math.max(0,scene.netPulseTop-dt*2.7);scene.netPulseBottom=Math.max(0,scene.netPulseBottom-dt*2.7);
      if(scene.celebration){scene.celebration.elapsed+=dt;if(scene.celebration.elapsed>=scene.celebration.duration)scene.celebration=null;}
    }
    draw(scene);
  }
  function getBall(){return scene&&scene.ball;}function getScene(){return scene;}function isMounted(){return Boolean(scene&&scene.canvas&&scene.ctx);}

  Prime.Pitch=Object.freeze({
    coordinatesForFormation,mount,refresh,renderPreview,frame,draw,setCarrier,setTarget,kickToPlayer,shoot,playEvent,
    getBall,getScene,isMounted,cancelAction,setCameraMode,getCameraMode,celebrate,showRefereeCard,playPenalty
  });
})(window.Prime=window.Prime||{});
