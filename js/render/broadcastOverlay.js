(function(Prime){
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  if(!F)return;

  let overlay=null,lastCanvas=null;

  function ensureOverlay(scene){
    const base=scene&&scene.canvas;
    if(!base||!base.parentElement)return null;
    if(overlay&&lastCanvas===base&&overlay.isConnected)return overlay;
    if(overlay&&overlay.remove)overlay.remove();
    overlay=document.createElement('canvas');
    overlay.className='pitch-3d-overlay';
    overlay.setAttribute('aria-hidden','true');
    base.parentElement.appendChild(overlay);
    lastCanvas=base;
    return overlay;
  }

  function resize(o,base){
    if(o.width!==base.width)o.width=base.width;
    if(o.height!==base.height)o.height=base.height;
  }

  function worldToCanvas(scene,x,y){
    const c=scene.camera||{mode:'full',x:F.width/2,y:F.length/2,zoom:1};
    const canvas=scene.canvas;
    const ratio=Math.min(2,window.devicePixelRatio||1);
    const margin=18*ratio;
    const totalLen=F.length+F.goalDepth*2;
    if(c.mode==='full'){
      const scale=Math.min((canvas.width-margin*2)/totalLen,(canvas.height-margin*2)/F.width);
      const drawW=totalLen*scale,drawH=F.width*scale;
      const ox=(canvas.width-drawW)/2,oy=(canvas.height-drawH)/2;
      return {x:ox+(y+F.goalDepth)*scale,y:oy+x*scale,scale};
    }
    const usableW=canvas.width-margin*2,usableH=canvas.height-margin*2;
    const fullScale=Math.min(usableW/totalLen,usableH/F.width);
    const scale=fullScale*(c.zoom||2.05);
    return {x:canvas.width/2+(y-c.y)*scale,y:canvas.height/2+(x-c.x)*scale,scale};
  }

  function teamColor(key){return key==='A'?'#3B82F6':'#FF6B35';}

  function drawToken(ctx,scene,p){
    const c=worldToCanvas(scene,p.x,p.y);
    const r=Math.max(9,Math.min(17,2.15*c.scale));
    const col=p.isKeeper?(p.key==='A'?'#F8D34D':'#B6F23A'):teamColor(p.key);
    const depth=Math.max(4,r*.42);
    const bodyY=c.y-depth*.18;

    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.34)';
    ctx.beginPath();ctx.ellipse(c.x+3,c.y+depth+r*.54,r*1.02,r*.43,0,0,Math.PI*2);ctx.fill();

    const side=ctx.createLinearGradient(c.x-r,bodyY,c.x+r,bodyY+depth);
    side.addColorStop(0,'rgba(8,18,12,.96)');side.addColorStop(.42,col);side.addColorStop(1,'rgba(3,10,6,.98)');
    ctx.fillStyle=side;
    ctx.beginPath();ctx.ellipse(c.x,bodyY+depth,r,r*.66,0,0,Math.PI*2);ctx.fill();
    ctx.fillRect(c.x-r,bodyY,c.x+r-(c.x-r),depth*.72);

    const top=ctx.createRadialGradient(c.x-r*.42,bodyY-r*.52,r*.06,c.x,bodyY,r*1.05);
    top.addColorStop(0,'rgba(255,255,255,.98)');
    top.addColorStop(.11,col);top.addColorStop(.7,col);top.addColorStop(1,'rgba(5,23,13,.98)');
    ctx.fillStyle=top;ctx.strokeStyle='rgba(255,255,255,.94)';ctx.lineWidth=Math.max(2,r*.13);
    ctx.beginPath();ctx.arc(c.x,bodyY,r,0,Math.PI*2);ctx.fill();ctx.stroke();

    ctx.strokeStyle='rgba(255,255,255,.38)';ctx.lineWidth=Math.max(1,r*.07);
    ctx.beginPath();ctx.arc(c.x-r*.12,bodyY-r*.08,r*.63,Math.PI*1.08,Math.PI*1.7);ctx.stroke();

    if(scene.carrier===p){ctx.strokeStyle='#FFC93C';ctx.lineWidth=3;ctx.beginPath();ctx.arc(c.x,bodyY,r+5,0,Math.PI*2);ctx.stroke();}
    if(p.targeted){ctx.strokeStyle='#B6F23A';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(c.x,bodyY,r+8,0,Math.PI*2);ctx.stroke();}

    ctx.fillStyle='#07150D';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(9,r*.82)}px system-ui`;
    ctx.fillText(String(p.number||''),c.x,bodyY+.5);

    if(p.yellowCards>0){
      const cw=Math.max(6,r*.38),ch=Math.max(9,r*.58);
      ctx.save();ctx.translate(c.x+r*.78,bodyY-r*.78);ctx.rotate(.12);ctx.fillStyle='#FFC93C';ctx.fillRect(-cw/2,-ch/2,cw,ch);ctx.restore();
    }
    ctx.restore();
  }

  function tick(){
    try{
      const scene=Prime.Pitch&&Prime.Pitch.getScene&&Prime.Pitch.getScene();
      if(scene&&scene.canvas&&!scene.preview){
        const o=ensureOverlay(scene);resize(o,scene.canvas);
        const ctx=o.getContext('2d');ctx.clearRect(0,0,o.width,o.height);
        const players=[...(scene.players||[])].sort((a,b)=>worldToCanvas(scene,a.x,a.y).y-worldToCanvas(scene,b.x,b.y).y);
        for(const p of players)drawToken(ctx,scene,p);
      }else if(overlay){overlay.remove();overlay=null;lastCanvas=null;}
    }catch(_e){}
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})(window.Prime=window.Prime||{});
