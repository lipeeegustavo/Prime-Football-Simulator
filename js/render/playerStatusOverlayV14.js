(function(Prime){
  const F=Prime.FieldGeometry&&Prime.FieldGeometry.FIELD;
  if(!F)return;

  let canvas=null,lastBase=null;

  function ensure(scene){
    const base=scene&&scene.canvas;
    if(!base||!base.parentElement)return null;
    if(canvas&&lastBase===base&&canvas.isConnected)return canvas;
    if(canvas)canvas.remove();
    canvas=document.createElement('canvas');
    canvas.className='pitch-status-overlay';
    Object.assign(canvas.style,{
      position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'8'
    });
    base.parentElement.appendChild(canvas);lastBase=base;return canvas;
  }

  function resize(o,base){if(o.width!==base.width)o.width=base.width;if(o.height!==base.height)o.height=base.height;}
  function worldToCanvas(scene,x,y){
    const c=scene.camera||{mode:'full',x:F.width/2,y:F.length/2,zoom:1},base=scene.canvas;
    const ratio=Math.min(2,window.devicePixelRatio||1),margin=18*ratio,totalLen=F.length+F.goalDepth*2;
    if(c.mode==='full'){
      const scale=Math.min((base.width-margin*2)/totalLen,(base.height-margin*2)/F.width);
      const drawW=totalLen*scale,drawH=F.width*scale,ox=(base.width-drawW)/2,oy=(base.height-drawH)/2;
      return{x:ox+(y+F.goalDepth)*scale,y:oy+x*scale,scale};
    }
    const usableW=base.width-margin*2,usableH=base.height-margin*2,fullScale=Math.min(usableW/totalLen,usableH/F.width),scale=fullScale*(c.zoom||2.05);
    return{x:base.width/2+(y-c.y)*scale,y:base.height/2+(x-c.x)*scale,scale};
  }

  function drawYellowBand(ctx,scene,p){
    if(!(p.yellowCards>0))return;
    const c=worldToCanvas(scene,p.x,p.y),r=Math.max(9,Math.min(17,2.15*c.scale)),y=c.y-r*.18;
    ctx.save();
    ctx.lineCap='round';
    ctx.strokeStyle='rgba(255,201,60,.22)';ctx.lineWidth=Math.max(9,r*.65);
    ctx.beginPath();ctx.moveTo(c.x-r*.78,y);ctx.lineTo(c.x+r*.78,y);ctx.stroke();
    ctx.strokeStyle='#FFC93C';ctx.lineWidth=Math.max(4,r*.27);
    ctx.beginPath();ctx.moveTo(c.x-r*.74,y);ctx.lineTo(c.x+r*.74,y);ctx.stroke();
    ctx.fillStyle='#171000';ctx.font=`900 ${Math.max(7,r*.48)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('YC',c.x,y+.5);
    ctx.restore();
  }

  function tick(){
    try{
      const scene=Prime.Pitch&&Prime.Pitch.getScene&&Prime.Pitch.getScene();
      if(scene&&scene.canvas&&!scene.preview){
        const o=ensure(scene);resize(o,scene.canvas);const ctx=o.getContext('2d');ctx.clearRect(0,0,o.width,o.height);
        for(const p of scene.players||[])drawYellowBand(ctx,scene,p);
      }else if(canvas){canvas.remove();canvas=null;lastBase=null;}
    }catch(_e){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})(window.Prime=window.Prime||{});
