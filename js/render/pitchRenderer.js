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
    c.x=Math.max(baseViewW*²È="25¥½¸èÄ¸ÅôíÉ•ÑÕÉ¸íô(€€€¥˜¡ÑåÁ”ôôôI}Iœ¥íÍ¡½ÝI•™•É••…É É•œ¤íÍ•¹”¹…Ñ¥½¸õíÑåÁ”è‘•±…äœ±‘½¹”±•±…ÁÍ•èÀ±‘ÕÉ…Ñ¥½¸èÄ¸ÈÕôíÉ•ÑÕÉ¸íô(€€€¥˜¡l=I9Hœ°Q!I=]}%8œ°=1}-%,œ°MU	MQ%QUQ%=8t¹¥¹±Õ‘•Ì¡ÑåÁ”¤¥íÍ•¹”¹…Ñ¥½¸õíÑåÁ”è‘•±…äœ±‘½¹”±•±…ÁÍ•èÀ±‘ÕÉ…Ñ¥½¸è¸ÐÉôíÉ•ÑÕÉ¸íô(€€€‘½¹”˜™‘½¹” ¤ì(€ô(€™Õ¹Ñ¥½¸…¹•±Ñ¥½¸ ¥ì(€€€¥˜ …Í•¹”¥É•ÑÕÉ¸í½¹ÍÐˆõÍ•¹”¹…Ñ¥½¸ü¹‘½¹”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íÍ•¹”¹Ñ…É•Ðõ¹Õ±°í¥˜¡Í•¹”¹‰…±°¹ÍÑ…Ñ”ôôô‘•…œ˜™Í•¹”¹…ÉÉ¥•È¥AÉ¥µ”¹	…±°¹Í•Ñ½¹ÑÉ½±±•¡Í•¹”¹‰…±°±Í•¹”¹…ÉÉ¥•È¹à±Í•¹”¹…ÉÉ¥•È¹ä±Í•¹”¹…ÉÉ¥•È¹­•ä±Í•¹”¹…ÉÉ¥•È¹¥¹‘•à¤íˆ˜™ˆ¡í…¹•±±•éÑÉÕ•ô¤ì(€ô((€™Õ¹Ñ¥½¸½µÁ±•Ñ•I••¥Ù”¡…Ñ¥½¸±Ñ…É•Ð±É•ÍÕ±Ð¥ì(€€€Í•¹”¹‰…±°¹àõÑ…É•Ð¹àíÍ•¹”¹‰…±°¹äõÑ…É•Ð¹äíÍ•¹”¹‰…±°¹ÙàõÍ•¹”¹‰…±°¹ÙäôÀíÍ•Ñ…ÉÉ¥•È¡Ñ…É•Ð¹­•ä±Ñ…É•Ð¹¥¤íÍ•Ñ¹¥´¡Ñ…É•Ð°½¹ÑÉ½°œ°¸ÌÔ¤í½¹ÍÐˆõ…Ñ¥½¸¹‘½¹”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íˆ˜™ˆ¡É•ÍÕ±Ñññíô¤ì(€ô(€™Õ¹Ñ¥½¸ÕÁ‘…Ñ•Ñ¥½¸¡‘Ð±ÁÉ•Ø±Ý…Í½…°¥ì(€€€½¹ÍÐ„õÍ•¹”¹…Ñ¥½¸í¥˜ …„¥É•ÑÕÉ¸í„¹•±…ÁÍ•ô¡„¹•±…ÁÍ•‘ñðÀ¤­‘Ðì(€€€¥˜¡„¹ÑåÁ”ôôôÉ••¥Ù”œ¥ì(€€€€€½¹ÍÐÐõ™¥¹‘A±…å•É	å%¡„¹Ñ•…´±„¹Ñ…É•Ñ%¤í¥˜ …Ð¥í½¹ÍÐˆõ„¹‘½¹”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íˆ˜™ˆ¡íµ¥ÍÍ¥¹œéÑÉÕ•ô¤íÉ•ÑÕÉ¸íô(€€€€€¥˜¡„¹Á¡…Í”ôôôÁÉ•Àœ˜˜…„¹¥µÁ…Ñ½¹”˜™„¹•±…ÁÍ•øõ„¹¥µÁ…ÑÐ¥ì(€€€€€€€­¥­Q½A±…å•È¡„¹Ñ•…´±„¹Ñ…É•Ñ%±„¹ÍÁ••±„¹‰…±±MÑ…Ñ”±í±½™Ðé„¹±½™ÑñðÀ±ÍÁ¥¸é„¹ÍÁ¥¹ñðÀ±±•…‘M•½¹‘Ìé„¹±•…‘M•½¹‘ÍñðÁô¤ì(€€€€€€€„¹Á¡…Í”ôÑÉ…Ù•°œí„¹¥µÁ…Ñ½¹”õÑÉÕ”í„¹•±…ÁÍ•ôÀíÉ•ÑÕÉ¸ì(€€€€€ô(€€€€€¥˜¡„¹Á¡…Í”ôôôÑÉ…Ù•°œ¥ì(€€€€€€€½¹ÍÐ‘¥ÍÐõ5…Ñ ¹¡åÁ½Ð¡Í•¹”¹‰…±°¹àµÐ¹à±Í•¹”¹‰…±°¹äµÐ¹ä¤±ÍÁ••õ5…Ñ ¹¡åÁ½Ð¡Í•¹”¹‰…±°¹Ùà±Í•¹”¹‰…±°¹Ùä¤±¡•¥¡ÐõÍ•¹”¹‰…±°¹éñðÀì(€€€€€€€¥˜¡‘¥ÍÐðÄ¸ÌÔ˜™¡•¥¡ÐðÈ¸È¥í½µÁ±•Ñ•I••¥Ù”¡„±Ð±íÉ••¥Ù•éÑÉÕ•ô¤íÉ•ÑÕÉ¸íô(€€€€€€€¥˜¡ÍÁ••ð¸ÍññÍ•¹”¹‰…±°¹ÍÑ…Ñ”ôôô‘•…œ¥ì(€€€€€€€€€„¹ÍÑ…±±±…ÁÍ•ô¡„¹ÍÑ…±±±…ÁÍ•‘ñðÀ¤­‘ÐíÐ¹ÑàõÍ•¹”¹‰…±°¹àíÐ¹ÑäõÍ•¹”¹‰…±°¹äì(€€€€€€€€€¥˜¡„¹ÍÑ…±±±…ÁÍ•ø¸Èáññ„¹•±…ÁÍ•øÄ¸ä¥í½µÁ±•Ñ•I••¥Ù”¡„±Ð±í™…±±‰…¬éÑÉÕ•ô¤íÉ•ÑÕÉ¸íô(€€€€€€€ô(€€€€€€€¥˜¡„¹•±…ÁÍ•øô¡¹É••¥Ù•Q¥µ•½ÕÑñðÈ¸Ô¤¥í½µÁ±•Ñ•I••¥Ù”¡„±Ð±íÑ¥µ•½ÕÐéÑÉÕ•ô¤íÉ•ÑÕÉ¸íô(€€€€€ô(€€€õ•±Í”¥˜¡„¹ÑåÁ”ôôô‘•±…äœ¥ì(€€€€€¥˜¡„¹•±…ÁÍ•øõ„¹‘ÕÉ…Ñ¥½¸¥í½¹ÍÐˆõ„¹‘½¹”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íˆ˜™ˆ ¤íô(€€€õ•±Í”¥˜¡„¹ÑåÁ”ôôôÁ•¹…±Ñäœ¥ì(€€€€€¥˜¡„¹•±…ÁÍ•øõ„¹‘ÕÉ…Ñ¥½¸¥íÍ•¹”¹‰…±°¹ÙàõÍ•¹”¹‰…±°¹ÙäôÀíÍ•¹”¹‰…±°¹ÙèôÀíÍ•¹”¹‰…±°¹ÍÑ…Ñ”ô‘•…œí½¹ÍÐˆõ„¹‘½¹”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íˆ˜™ˆ¡íÍ½É•é„¹Í½É•‘ô¤íô(€€€õ•±Í”¥˜¡„¹ÑåÁ”ôôôÍ¡½Ðœ¥ì(€€€€€¥˜¡„¹Á¡…Í”ôôôÁÉ•Àœ˜˜…„¹¥µÁ…Ñ½¹”˜™„¹•±…ÁÍ•øõ„¹¥µÁ…ÑÐ¥í•á•ÕÑ•M¡½Ñ%µÁ…Ð¡„¤íÉ•ÑÕÉ¸íô(€€€€€¥˜¡„¹Á¡…Í”ôôôÑÉ…Ù•°œ¥ì(€€€€€€€±•ÐÉ½ÍÍ•õ™…±Í”í¥˜¡Ý…Í½…°˜™¹É½ÍÍ•Í½…±1¥¹”¡ÁÉ•Ø±Í•¹”¹‰…±°°Ñ½Àœ¤¥íÍ•¹”¹¹•ÑAÕ±Í•Q½ÀôÄíÉ½ÍÍ•õÑÉÕ”íõ¥˜¡Ý…Í½…°˜™¹É½ÍÍ•Í½…±1¥¹”¡ÁÉ•Ø±Í•¹”¹‰…±°°‰½ÑÑ½´œ¤¥íÍ•¹”¹¹•ÑAÕ±Í•	½ÑÑ½´ôÄíÉ½ÍÍ•õÑÉÕ”íô(€€€€€€€¥˜¡É½ÍÍ•¥íÍ•¹”¹‰…±°¹ÙàõÍ•¹”¹‰…±°¹ÙäôÀíÍ•¹”¹‰…±°¹ÍÑ…Ñ”ô‘•…œí½¹ÍÐˆõ„¹‘½¹”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íˆ˜™ˆ¡í½…±É½ÍÍ•éÑÉÕ•ô¤íÉ•ÑÕÉ¸íô(€€€€€€€¥˜¡„¹•±…ÁÍ•øÄ¸Ü¥ì(€€€€€€€€€¥˜¡„¹½ÕÑ½µ”ôôô=0œ¥ì(€€€€€€€€€€€€¼¼ƒi±Ñ¥µ¼É•ÕÉÍ¼Í•´Ñ•±•Á½ÉÑ”è“„Õ´Á•ÅÕ•¹¼¥µÁÕ±Í¼…‘¥¥½¹…°•´‘¥É—Ÿ¼ƒ€±¥¹¡„‘¼½°¸(€€€€€€€€€€€€¼¼‰½±„½¹Ñ¥¹Õ„…ÑÉ…Ù•ÍÍ…¹‘¼™¥Í¥…µ•¹Ñ”„±¥¹¡„…¹Ñ•Ì‘¼…±±‰…¬¸(€€€€€€€€€€€½¹ÍÐ…ÑÑ…­ÍQ½ÀõÙ¥ÍÕ…±ÑÑ…­ÍQ½À¡„¹Ñ•…µ-•ä¤±½…±dõ…ÑÑ…­ÍQ½Àü´¸ÐÔé¹±•¹Ñ ¬¸ÐÔì(€€€€€€€€€€€AÉ¥µ”¹	…±°¹­¥­Q½Ý…É¡Í•¹”¹‰…±°±¹Ý¥‘Ñ ¼È±½…±d°ÄÈ°Í¡½Ðµ½…°œ±í±½™ÐèÀ±ÍÁ¥¸èÁô¤ì(€€€€€€€€€€€„¹Á¡…Í”ô™½É”œí„¹•±…ÁÍ•ôÀíÉ•ÑÕÉ¸ì(€€€€€€€€€ô(€€€€€€€€€Í•¹”¹‰…±°¹ÙàõÍ•¹”¹‰…±°¹ÙäôÀíÍ•¹”¹‰…±°¹ÍÑ…Ñ”ô‘•…œí½¹ÍÐˆõ„¹‘½¹”±½ÕÑ½µ”õ„¹½ÕÑ½µ”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íˆ˜™ˆ¡í½…±É½ÍÍ•é™…±Í”±½ÕÑ½µ•ô¤íÉ•ÑÕÉ¸ì(€€€€€€€ô(€€€€€õ•±Í”¥˜¡„¹Á¡…Í”ôôô™½É”œ¥ì(€€€€€€€±•ÐÉ½ÍÍ•õ™…±Í”í¥˜¡¹É½ÍÍ•Í½…±1¥¹”¡ÁÉ•Ø±Í•¹”¹‰…±°°Ñ½Àœ¤¥íÍ•¹”¹¹•ÑAÕ±Í•Q½ÀôÄíÉ½ÍÍ•õÑÉÕ”íõ¥˜¡¹É½ÍÍ•Í½…±1¥¹”¡ÁÉ•Ø±Í•¹”¹‰…±°°‰½ÑÑ½´œ¤¥íÍ•¹”¹¹•ÑAÕ±Í•	½ÑÑ½´ôÄíÉ½ÍÍ•õÑÉÕ”íô(€€€€€€€¥˜¡É½ÍÍ•‘ññ„¹•±…ÁÍ•ø¸ä¥íÍ•¹”¹‰…±°¹ÙàõÍ•¹”¹‰…±°¹ÙäõÍ•¹”¹‰…±°¹ÙèôÀíÍ•¹”¹‰…±°¹ÍÑ…Ñ”ô‘•…œí½¹ÍÐˆõ„¹‘½¹”íÍ•¹”¹…Ñ¥½¸õ¹Õ±°íˆ˜™ˆ¡í½…±É½ÍÍ•éÑÉÕ”±™½É•‘½…°éÑÉÕ•ô¤íÉ•ÑÕÉ¸íô(€€€€€ô(€€€ô(€ô((€™Õ¹Ñ¥½¸Á±…åA•¹…±Ñä¡Ñ•…µ-•ä±Í¡½½Ñ•É%±Í¡½Ñi½¹”±‘¥Ù•i½¹”±Í½É•±‘½¹”¥ì(€€€¥˜ …Í•¹”¥í‘½¹”˜™‘½¹” ¤íÉ•ÑÕÉ¸íô(€€€½¹ÍÐÑ½ÀõÙ¥ÍÕ…±ÑÑ…­ÍQ½À¡Ñ•…µ-•ä¤±ÍÁ½ÑdõÑ½Àý¹Á•¹…±ÑåMÁ½Ðé¹±•¹Ñ µ¹Á•¹…±ÑåMÁ½Ð±½…±dõÑ½Àü¸Èé¹±•¹Ñ ´¸È±µ½ÕÑ õ¹½…±5½ÕÑ¡` ¤ì(€€€½¹ÍÐÍ¡½½Ñ•Èõ™¥¹‘A±…å•É	å%¡Ñ•…µ-•ä±Í¡½½Ñ•É%¥ññÍ•¹”¹Á±…å•ÉÌ¹™¥¹¡ÀôùÀ¹­•äôôõÑ•…µ-•ä˜˜…À¹¥Í-••Á•È¤ì(€€€½¹ÍÐ¬õÍ•¹”¹Á±…å•ÉÌ¹™¥¹¡ÀôùÀ¹­•ä„ôõÑ•…µ-•ä˜™À¹¥Í-••Á•È¤ì(€€€¥˜¡Í¡½½Ñ•È¥íÍ¡½½Ñ•È¹àõ¹Ý¥‘Ñ ¼ÈíÍ¡½½Ñ•È¹äõÍÁ½Ñd¬¡Ñ½ÀüÈè´È¤íÍ¡½½Ñ•È¹ÑàõÍ¡½½Ñ•È¹àíÍ¡½½Ñ•È¹ÑäõÍ¡½½Ñ•È¹äíÍ•Ñ¹¥´¡Í¡½½Ñ•È°Í¡½Ðœ°¸à¤íô(€€€Í•¹”¹…ÉÉ¥•Èõ¹Õ±°íÍ•¹”¹Ñ…É•Ðõ¹Õ±°íÍ•¹”¹‰…±°¹àõ¹Ý¥‘Ñ ¼ÈíÍ•¹”¹‰…±°¹äõÍÁ½ÑdíÍ•¹”¹‰…±°¹èôÀíÍ•¹”¹‰…±°¹ÙàõÍ•¹”¹‰…±°¹ÙäõÍ•¹”¹‰…±°¹ÙèôÀì(€€€½¹ÍÐ½°õÍ¡½Ñi½¹””Ì±É½Üõ5…Ñ ¹™±½½È¡Í¡½Ñi½¹”¼Ì¤±áÉ…Œõl¸Äà°¸Ô°¸àÉum½±t±Ñàõµ½ÕÑ ¹±•™Ð¬¡µ½ÕÑ ¹É¥¡Ðµµ½ÕÑ ¹±•™Ð¤©áÉ…Œì(€€€½¹ÍÐÑ…É•Ñdõ½…±dí½¹ÍÐ±½™Ðõl¸ÔÈ°¸ÈÜ°¸ÀáumÉ½Ýtì(€€€¥˜¡¬¥í½¹ÍÐ‘½°õ‘¥Ù•i½¹””Ìí¬¹Ñàõµ½ÕÑ ¹±•™Ð¬¡µ½ÕÑ ¹É¥¡Ðµµ½ÕÑ ¹±•™Ð¤©l¸Äà°¸Ô°¸àÉum‘½±tí¬¹ÑäõÑ½ÀüÄ¸Ôé¹±•¹Ñ ´Ä¸ÔíÍ•Ñ¹¥´¡¬°‘¥Ù”œ°Ä¸ÀÔ¤íô(€€€AÉ¥µ”¹	…±°¹­¥­Q½Ý…É¡Í•¹”¹‰…±°±Ñà±Ñ…É•Ñd°ÌÄ°Á•¹…±Ñäœ±í±½™Ð±ÍÁ¥¸è¡½°´Ä¤¨Ð¸Õô¤ì(€€€Í•¹”¹…Ñ¥½¸õíÑåÁ”èÁ•¹…±Ñäœ±•±…ÁÍ•èÀ±‘ÕÉ…Ñ¥½¸èÄ¸ÈÔ±‘½¹”±Í½É•‘ôì(€ô((€™Õ¹Ñ¥½¸™É…µ”¡‘Ð±É•…±Ð¥ì(€€€¥˜ …Í•¹”¥É•ÑÕÉ¸ì(€€€½¹ÍÐÉ…Üõ5…Ñ ¹µ…à À±9Õµ‰•È¡É•…±Ð¥ñðÀ¤±Í¥´õ5…Ñ ¹µ…à À±9Õµ‰•È¡‘Ð¥ñðÀ¤ì(€€€€¼¼¥ÍÁÕÑ…Ì‘”Ã©¹…±Ñ¤µ…¹Ó©´¼É•³Í¥¼‘¼©½¼Á…ÕÍ…‘¼°µ…Ì„…¹¥µ‡Ÿ¼ÁÉ•¥Í„½¹Ñ¥¹Õ…È•´Ñ•µÁ¼É•…°¸(€€€½¹ÍÐÙ¥ÍÕ…±Ðô¡Í•¹”¹…Ñ¥½¸ü¹ÑåÁ”ôôôÁ•¹…±Ñäœ˜™Í¥´ôôôÀ¤ýÉ…ÜéÍ¥´ì(€€€™¥Ñ…¹Ù…Ì¡Í•¹”¹…¹Ù…Ì¤íÕÁ‘…Ñ•…µ•É„¡Í•¹”±Ù¥ÍÕ…±Ð¤ì(€€€™½È¡½¹ÍÐÁ°½˜Í•¹”¹Á±…å•ÉÌ¥ÕÁ‘…Ñ•¹¥µ…Ñ¥½¹MÑ…Ñ”¡Á°±Ù¥ÍÕ…±Ð¤ì(€€€ÕÁ‘…Ñ•I•™•É•”¡Í•¹”±É…ÝññÙ¥ÍÕ…±Ð¤ì(€€€¥˜ …Í•¹”¹ÁÉ•Ù¥•Ü˜™Ù¥ÍÕ…±ÐøÀ¥ì(€€€€€AÉ¥µ”¹5½Ù•µ•¹Ñ$¹ÕÁ‘…Ñ”¡Í•¹”±Í•¹”¹ÍÑ…Ñ”±Ù¥ÍÕ…±Ð¤ì(€€€€€¥˜¡Í•¹”¹…Ñ¥½¸ü¹ÑåÁ”ôôôÉ••¥Ù”œ˜™Í•¹”¹…Ñ¥½¸¹Á¡…Í”ôôôÑÉ…Ù•°œ¥ì(€€€€€€€½¹ÍÐÐõ™¥¹‘A±…å•É	å%¡Í•¹”¹…Ñ¥½¸¹Ñ•…´±Í•¹”¹…Ñ¥½¸¹Ñ…É•Ñ%¤í¥˜¡Ð¥í½¹ÍÐÍÁ••õ5…Ñ ¹¡åÁ½Ð¡Í•¹”¹‰…±°¹Ùà±Í•¹”¹‰…±°¹Ùä¤í¥˜¡ÍÁ••ð¸Ô¥íÐ¹ÑàõÍ•¹”¹‰…±°¹àíÐ¹ÑäõÍ•¹”¹‰…±°¹äíõô(€€€€€ô(€€€€€¥˜¡Í•¹”¹…ÉÉ¥•È˜™Í•¹”¹‰…±°¹ÍÑ…Ñ”ôôô½¹ÑÉ½±±•œ¥ì(€€€€€€€½¹ÍÐŒõÍ•¹”¹…ÉÉ¥•È±ÍÀõ5…Ñ ¹¡åÁ½Ð¡Œ¹Ùà±Œ¹Ùä¤±…¹œõÍÀø¸Äàý5…Ñ ¹…Ñ…¸È¡Œ¹Ùä±Œ¹Ùà¤è¡Œ¹™…¥¹ñðÀ¤µ5…Ñ ¹A$¼Èì(€€€€€€€½¹ÍÐÑ½Õ ô¡¹…¹¥µ…Ñ¥½¸ü¹‘É¥‰‰±•Q½Õ¡¥ÍÑ…¹•ñð¸ÜÔ¤¨¡ÍÀø¸ÔÔüÄè¸ÔÈ¤ì(€€€€€€€½¹ÍÐ™½½Ñ]…Ù”õ5…Ñ ¹Í¥¸¡Œ¹…¹¥µA¡…Í”¨Ü¸Ô¤¨¸ÈÐì(€€€€€€€½¹ÍÐ‰àõŒ¹à­5…Ñ ¹½Ì¡…¹œ¤©Ñ½Õ ­5…Ñ ¹½Ì¡…¹œ­5…Ñ ¹A$¼È¤©™½½Ñ]…Ù”ì(€€€€€€€½¹ÍÐ‰äõŒ¹ä­5…Ñ ¹Í¥¸¡…¹œ¤©Ñ½Õ ­5…Ñ ¹Í¥¸¡…¹œ­5…Ñ ¹A$¼È¤©™½½Ñ]…Ù”ì(€€€€€€€AÉ¥µ”¹	…±°¹Í•ÑQ…É•Ð¡Í•¹”¹‰…±°±‰à±‰ä¤ì(€€€€€ô(€€€€€½¹ÍÐÁÉ•ØõíàéÍ•¹”¹‰…±°¹à±äéÍ•¹”¹‰…±°¹åô±Ý…Í½…°õÍ•¹”¹‰…±°¹ÍÑ…Ñ”ôôôÍ¡½Ðµ½…°œíAÉ¥µ”¹	…±°¹ÕÁ‘…Ñ”¡Í•¹”¹‰…±°±Ù¥ÍÕ…±Ð¤ì(€€€€€¥˜¡Í•¹”¹…Ñ¥½¸¥ÕÁ‘…Ñ•Ñ¥½¸¡Ù¥ÍÕ…±Ð±ÁÉ•Ø±Ý…Í½…°¤ì(€€€€€¥˜¡Í•¹”¹‰…±°¹ÍÑ…Ñ”ôôô‘•…œ˜˜…Í•¹”¹…Ñ¥½¸˜™Í•¹”¹…ÉÉ¥•È¥AÉ¥µ”¹	…±°¹Í•Ñ½¹ÑÉ½±±•¡Í•¹”¹‰…±°±Í•¹”¹…ÉÉ¥•È¹à±Í•¹”¹…ÉÉ¥•È¹ä±Í•¹”¹…ÉÉ¥•È¹­•ä±Í•¹”¹…ÉÉ¥•È¹¥¹‘•à¤ì(€€€€€Í•¹”¹¹•ÑAÕ±Í•Q½Àõ5…Ñ ¹µ…à À±Í•¹”¹¹•ÑAÕ±Í•Q½ÀµÙ¥ÍÕ…±Ð¨È¸Ü¤íÍ•¹”¹¹•ÑAÕ±Í•	½ÑÑ½´õ5…Ñ ¹µ…à À±Í•¹”¹¹•ÑAÕ±Í•	½ÑÑ½´µÙ¥ÍÕ…±Ð¨È¸Ü¤ì(€€€€€¥˜¡Í•¹”¹•±•‰É…Ñ¥½¸¥íÍ•¹”¹•±•‰É…Ñ¥½¸¹•±…ÁÍ•¬õÙ¥ÍÕ…±Ðí¥˜¡Í•¹”¹•±•‰É…Ñ¥½¸¹•±…ÁÍ•øõÍ•¹”¹•±•‰É…Ñ¥½¸¹‘ÕÉ…Ñ¥½¸¥Í•¹”¹•±•‰É…Ñ¥½¸õ¹Õ±°íô(€€€ô(€€€‘É…Ü¡Í•¹”¤ì(€ô(€™Õ¹Ñ¥½¸•Ñ	…±° ¥íÉ•ÑÕÉ¸Í•¹”˜™Í•¹”¹‰…±°íõ™Õ¹Ñ¥½¸•ÑM•¹” ¥íÉ•ÑÕÉ¸Í•¹”íõ™Õ¹Ñ¥½¸¥Í5½Õ¹Ñ• ¥íÉ•ÑÕÉ¸	½½±•…¸¡Í•¹”˜™Í•¹”¹…¹Ù…Ì˜™Í•¹”¹Ñà¤íô((€AÉ¥µ”¹A¥Ñ õ=‰©•Ð¹™É••é”¡ì(€€€½½É‘¥¹…Ñ•Í½É½Éµ…Ñ¥½¸±µ½Õ¹Ð±É•™É•Í ±É•¹‘•ÉAÉ•Ù¥•Ü±™É…µ”±‘É…Ü±Í•Ñ…ÉÉ¥•È±Í•ÑQ…É•Ð±­¥­Q½A±…å•È±Í¡½½Ð±Á±…åÙ•¹Ð°(€€€•Ñ	…±°±•ÑM•¹”±¥Í5½Õ¹Ñ•±…¹•±Ñ¥½¸±Í•Ñ…µ•É…5½‘”±•Ñ…µ•É…5½‘”±•±•‰É…Ñ”±Í¡½ÝI•™•É••…É±Á±…åA•¹…±Ñä(€ô¤ì)ô¤¡Ý¥¹‘½Ü¹AÉ¥µ”õÝ¥¹‘½Ü¹AÉ¥µ•ññíô¤ì