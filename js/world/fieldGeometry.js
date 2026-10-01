(function (Prime) {
  const FIELD = Object.freeze({
    width: 68,
    length: 105,
    penaltyAreaDepth: 16.5,
    penaltyAreaWidth: 40.32,
    goalAreaDepth: 5.5,
    goalAreaWidth: 18.32,
    penaltySpot: 11,
    centerCircleRadius: 9.15,
    penaltyArcRadius: 9.15,
    cornerRadius: 1,
    goalWidth: 7.32,
    goalDepth: 2.4
  });

  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

  function getViewport(canvas, orientation){
    const o=orientation||'vertical';
    const w=canvas.width,h=canvas.height;
    if(o==='horizontal'){
      const marginX=Math.max(34,w*.055), marginY=Math.max(28,h*.055);
      return {orientation:o,x:marginX,y:marginY,w:w-marginX*2,h:h-marginY*2};
    }
    const marginX=Math.max(28,w*.055), marginY=Math.max(44,h*.06);
    return {orientation:o,x:marginX,y:marginY,w:w-marginX*2,h:h-marginY*2};
  }

  function worldToCanvas(x,y,canvas,orientation){
    const v=getViewport(canvas,orientation);
    if(v.orientation==='horizontal'){
      return {x:v.x+(y/FIELD.length)*v.w,y:v.y+(x/FIELD.width)*v.h};
    }
    return {x:v.x+(x/FIELD.width)*v.w,y:v.y+(y/FIELD.length)*v.h};
  }

  function canvasToWorld(px,py,canvas,orientation){
    const v=getViewport(canvas,orientation);
    if(v.orientation==='horizontal'){
      return {x:clamp(((py-v.y)/v.h)*FIELD.width,0,FIELD.width),y:clamp(((px-v.x)/v.w)*FIELD.length,0,FIELD.length)};
    }
    return {x:clamp(((px-v.x)/v.w)*FIELD.width,0,FIELD.width),y:clamp(((py-v.y)/v.h)*FIELD.length,0,FIELD.length)};
  }

  function goalMouthX(){
    const half=FIELD.goalWidth/2,center=FIELD.width/2;
    return {left:center-half,right:center+half};
  }

  function isInsideGoalMouth(x){
    const g=goalMouthX();
    return x>=g.left&&x<=g.right;
  }

  function crossesGoalLine(prev,next,side){
    if(!prev||!next)return false;
    if(side==='top') return prev.y>=0&&next.y<0&&isInsideGoalMouth(next.x);
    return prev.y<=FIELD.length&&next.y>FIELD.length&&isInsideGoalMouth(next.x);
  }

  Prime.FieldGeometry=Object.freeze({FIELD,getViewport,worldToCanvas,canvasToWorld,goalMouthX,isInsideGoalMouth,crossesGoalLine});
})(window.Prime = window.Prime || {});
