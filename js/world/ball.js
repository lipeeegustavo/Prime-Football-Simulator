(function (Prime) {
  const CONFIG=Object.freeze({
    controlSpring:24,
    controlDamping:9.2,
    groundDragPerSecond:.31,
    airDragPerSecond:.075,
    shotGroundDragPerSecond:.16,
    stopSpeed:.14,
    maxSpeed:44,
    gravity:16.8,
    bounceRestitution:.39,
    bounceStopVz:1.15,
    curveStrength:.031,
    maxHeight:14,
    controlSnapDistance:1.6,
    controlMaxSpeed:11.5,
    controlMaxAccel:36
  });

  function createBall(x,y){
    return {
      x:x==null?Prime.FieldGeometry.FIELD.width/2:x,
      y:y==null?Prime.FieldGeometry.FIELD.length/2:y,
      z:0,
      vx:0,vy:0,vz:0,
      radius:.36,
      state:'dead',
      targetX:null,targetY:null,
      ownerKey:null,
      ownerIndex:-1,
      returnDelay:0,
      spin:0,
      lastGroundImpact:0,
      travelled:0,
      rotation:0
    };
  }

  function setControlled(ball,x,y,ownerKey,ownerIndex){
    ball.state='controlled';
    ball.targetX=x;ball.targetY=y;
    ball.ownerKey=ownerKey||null;
    ball.ownerIndex=Number.isInteger(ownerIndex)?ownerIndex:-1;
    ball.spin=0;
    ball.vz=0;
    if(ball.z<.08)ball.z=0;
  }

  function setTarget(ball,x,y){ball.targetX=x;ball.targetY=y;}

  function release(ball,vx,vy,state,options){
    const o=options||{};
    ball.state=state||'free';
    ball.vx=vx;ball.vy=vy;
    ball.vz=Number.isFinite(o.vz)?o.vz:0;
    ball.z=Math.max(0,Number.isFinite(o.z)?o.z:ball.z||0);
    ball.spin=Number.isFinite(o.spin)?o.spin:0;
    ball.ownerKey=null;ball.ownerIndex=-1;
    ball.targetX=null;ball.targetY=null;
    ball.travelled=0;
  }

  function kickToward(ball,x,y,speed,state,options){
    const o=options||{};
    const dx=x-ball.x,dy=y-ball.y,len=Math.hypot(dx,dy)||1;
    const s=Math.min(CONFIG.maxSpeed,Math.max(2,speed||18));
    const loft=Math.max(0,Math.min(1,Number(o.loft)||0));
    const baseVz=Number.isFinite(o.vz)?o.vz:(loft>0?(5.2+loft*8.4):0);
    release(ball,dx/len*s,dy/len*s,state||'free',{
      vz:baseVz,
      spin:Number(o.spin)||0,
      z:Math.max(0,Number(o.startHeight)||0)
    });
  }

  function groundDrag(ball,dt){
    const shot=String(ball.state).indexOf('shot')===0;
    const rate=shot?CONFIG.shotGroundDragPerSecond:CONFIG.groundDragPerSecond;
    const drag=Math.exp(-rate*dt);
    ball.vx*=drag;ball.vy*=drag;
  }

  function airForces(ball,dt){
    const drag=Math.exp(-CONFIG.airDragPerSecond*dt);
    ball.vx*=drag;ball.vy*=drag;
    if(Math.abs(ball.spin)>.001){
      const speed=Math.hypot(ball.vx,ball.vy);
      if(speed>.2){
        const nx=-ball.vy/speed,ny=ball.vx/speed;
        const accel=Math.min(7.5,Math.abs(ball.spin)*speed*CONFIG.curveStrength);
        const sign=Math.sign(ball.spin);
        ball.vx+=nx*accel*sign*dt;
        ball.vy+=ny*accel*sign*dt;
        ball.spin*=Math.exp(-.32*dt);
      }
    }
    ball.vz-=CONFIG.gravity*dt;
  }

  function controlledUpdate(ball,dt){
    const dx=(ball.targetX??ball.x)-ball.x;
    const dy=(ball.targetY??ball.y)-ball.y;
    let ax=dx*CONFIG.controlSpring-ball.vx*CONFIG.controlDamping;
    let ay=dy*CONFIG.controlSpring-ball.vy*CONFIG.controlDamping;
    const accel=Math.hypot(ax,ay);
    if(accel>CONFIG.controlMaxAccel){ax=ax/accel*CONFIG.controlMaxAccel;ay=ay/accel*CONFIG.controlMaxAccel;}
    ball.vx+=ax*dt;ball.vy+=ay*dt;
    const speed=Math.hypot(ball.vx,ball.vy);
    if(speed>CONFIG.controlMaxSpeed){ball.vx=ball.vx/speed*CONFIG.controlMaxSpeed;ball.vy=ball.vy/speed*CONFIG.controlMaxSpeed;}
    const d=Math.hypot(dx,dy);
    if(d<.08&&Math.hypot(ball.vx,ball.vy)<.18){ball.x=ball.targetX;ball.y=ball.targetY;ball.vx=0;ball.vy=0;}
    ball.z+=(0-ball.z)*Math.min(1,dt*14);
    if(ball.z<.015)ball.z=0;
  }

  function update(ball,dt){
    if(!ball||dt<=0)return;
    dt=Math.min(.05,dt);
    if(ball.returnDelay>0)ball.returnDelay=Math.max(0,ball.returnDelay-dt);
    if(Prime.PhysicsBridge&&Prime.PhysicsBridge.isReady&&Prime.PhysicsBridge.isReady()){Prime.PhysicsBridge.step(ball,dt);return;}

    if(ball.state==='controlled'&&ball.targetX!=null&&ball.targetY!=null){
      controlledUpdate(ball,dt);
    }else{
      const airborne=ball.z>.015||ball.vz>.05;
      if(airborne)airForces(ball,dt);else groundDrag(ball,dt);
    }

    const oldX=ball.x,oldY=ball.y;
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    ball.z+=ball.vz*dt;
    const stepDistance=Math.hypot(ball.x-oldX,ball.y-oldY);
    ball.travelled+=stepDistance;
    if(stepDistance>0){
      const roll=stepDistance/Math.max(.18,ball.radius||.36);
      ball.rotation=(ball.rotation||0)+roll;
    }

    if(ball.z<=0){
      if(ball.vz<0){
        const impact=Math.abs(ball.vz);
        ball.z=0;
        ball.lastGroundImpact=impact;
        if(impact>CONFIG.bounceStopVz){
          ball.vz=impact*CONFIG.bounceRestitution;
          ball.vx*=.93;ball.vy*=.93;
        }else{
          ball.vz=0;
        }
      }else ball.z=0;
    }
    if(ball.z>CONFIG.maxHeight){ball.z=CONFIG.maxHeight;ball.vz=Math.min(0,ball.vz);}

    if(ball.state!=='controlled'&&ball.z===0&&Math.abs(ball.vz)<.01&&Math.hypot(ball.vx,ball.vy)<CONFIG.stopSpeed){
      ball.vx=0;ball.vy=0;ball.vz=0;ball.spin=0;ball.state='dead';
    }
  }

  Prime.Ball=Object.freeze({CONFIG,createBall,setControlled,setTarget,release,kickToward,update});
})(window.Prime = window.Prime || {});
