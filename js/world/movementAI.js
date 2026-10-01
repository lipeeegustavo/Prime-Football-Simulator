(function (Prime) {
  const G = Prime.FieldGeometry;
  const F = G.FIELD;
  const M = Prime.Balance?.movement || {};
  const DEFAULT_TACTICS = {
    lineHeight: 58, pressing: 60, tempo: 65,
    width: 65, passRisk: 55, transitionSpeed: 68
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function playerData(id) { return Prime.Squad.playerById(id); }
  function coachTactics(team) {
    const c = Prime.Squad.coachById(team.coach);
    return c && c.tactics ? c.tactics : DEFAULT_TACTICS;
  }
  function maxSpeedFor(p) { return 4.8 + ((p?.attributes?.pace || 70) - 50) * 0.036; }
  function accelFor(p) { return 7.2 + ((p?.attributes?.physical || 70) - 50) * 0.052; }
  function flipped(){ return Boolean(Prime.Store?.state?.match?.secondHalf); }
  function attackDir(key) { const base=key === 'A' ? -1 : 1; return flipped()?-base:base; }
  function ownGoalY(key) { const base=key === 'A' ? F.length : 0; return flipped()?F.length-base:base; }
  function opponentGoalY(key) { return F.length-ownGoalY(key); }

  function steering(entity, dt) {
    const dx = entity.tx - entity.x;
    const dy = entity.ty - entity.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) {
      entity.vx *= Math.exp(-7 * dt);
      entity.vy *= Math.exp(-7 * dt);
      entity.x += entity.vx * dt;
      entity.y += entity.vy * dt;
      return;
    }
    const braking = d < 2.5 ? 0.62 + d * 0.15 : 1;
    const desired = Math.min(entity.maxSpeed * braking, d * 2.1 + 0.9);
    const ux = dx / d, uy = dy / d;
    const dvx = ux * desired - entity.vx;
    const dvy = uy * desired - entity.vy;
    const mag = Math.hypot(dvx, dvy) || 1;
    const maxDelta = entity.accel * dt;
    const scale = Math.min(1, maxDelta / mag);
    entity.vx += dvx * scale;
    entity.vy += dvy * scale;
    const sp = Math.hypot(entity.vx, entity.vy);
    if (sp > entity.maxSpeed) {
      entity.vx = entity.vx / sp * entity.maxSpeed;
      entity.vy = entity.vy / sp * entity.maxSpeed;
    }
    entity.x = clamp(entity.x + entity.vx * dt, 1.2, F.width - 1.2);
    entity.y = clamp(entity.y + entity.vy * dt, 1.2, F.length - 1.2);
  }

  function nearestPlayers(point, list, count) {
    return list
      .map(p => ({ p, d: Math.hypot(p.x - point.x, p.y - point.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count);
  }

  function laneY(position, key, ballY, phase) {
    const dir = attackDir(key);
    const attacking = key === phase.possession;
    const own = ownGoalY(key);
    const opp = opponentGoalY(key);
    const progress = Math.max(0,Math.min(1,Math.abs(ballY-own)/F.length));

    if (position === 'GOL') return own + dir * 4.5;

    let y;
    if (['ZAG', 'LD', 'LE'].includes(position)) {
      const baseFromOwn = 18 + progress * (attacking ? 16 : 7);
      y = own + dir * baseFromOwn;
    } else if (['VOL', 'MC', 'ALA'].includes(position)) {
      const baseFromOwn = 35 + progress * (attacking ? 21 : 10);
      y = own + dir * baseFromOwn;
    } else if (['MEI', 'PE', 'PD'].includes(position)) {
      const baseFromOwn = 52 + progress * (attacking ? 25 : 13);
      y = own + dir * baseFromOwn;
    } else {
      const baseFromOwn = 64 + progress * (attacking ? 27 : 15);
      y = own + dir * baseFromOwn;
    }

    // Nunca deixa as linhas atravessarem completamente o gol adversário.
    const lo = Math.min(own, opp) + 5;
    const hi = Math.max(own, opp) - 5;
    return clamp(y, lo, hi);
  }

  function roleWidthX(pl, tactics, ballX, attacking) {
    const center = F.width / 2;
    const width = 0.68 + (tactics.width / 100) * 0.48;
    let x = center + (pl.baseX - center) * width;
    if (attacking) x += (ballX - x) * 0.12;
    else x += (ballX - x) * 0.08;
    return clamp(x, 2, F.width - 2);
  }

  function updatePhase(scene, state, dt) {
    if (!scene.teamPhase) {
      scene.teamPhase = {
        A: { mode: 'shape', transition: 0 },
        B: { mode: 'shape', transition: 0 }
      };
      scene._lastPoss = state.match?.poss || 'A';
    }
    const poss = state.match?.poss || scene.ball.ownerKey || 'A';
    if (scene._lastPoss !== poss) {
      scene.teamPhase[poss].mode = 'transition_attack';
      scene.teamPhase[poss].transition = 2.4;
      const lost = poss === 'A' ? 'B' : 'A';
      scene.teamPhase[lost].mode = 'transition_defend';
      scene.teamPhase[lost].transition = 2.7;
      scene._lastPoss = poss;
    }
    ['A', 'B'].forEach(key => {
      const ph = scene.teamPhase[key];
      if (ph.transition > 0) {
        ph.transition -= dt;
        if (ph.transition <= 0) ph.mode = key === poss ? 'attack' : 'defend';
      } else {
        ph.mode = key === poss ? 'attack' : 'defend';
      }
    });
    return poss;
  }

  function computeTargets(scene, state, dt) {
    const poss = updatePhase(scene, state, dt || 0);
    const ball = scene.ball;
    const ballX = clamp(ball.x, 0, F.width);
    const ballY = clamp(ball.y, 0, F.length);
    const carrier = scene.carrier;

    const teams = {
      A: scene.players.filter(p => p.key === 'A'),
      B: scene.players.filter(p => p.key === 'B')
    };

    for (const key of ['A', 'B']) {
      const teamState = state.teams[key];
      const tac = coachTactics(teamState);
      const attacking = key === poss;
      const phase = scene.teamPhase[key]?.mode || (attacking ? 'attack' : 'defend');
      const dir = attackDir(key);
      const ownPlayers = teams[key];
      const oppPlayers = teams[key === 'A' ? 'B' : 'A'];
      const pressers = !attacking && carrier ? nearestPlayers(carrier, ownPlayers.filter(p => !p.isKeeper), tac.pressing > 78 ? 2 : 1) : [];

      ownPlayers.forEach((pl) => {
        const pdata = playerData(pl.id);
        const a = pdata?.attributes || {};
        const stamina = state.match?.stamina?.[key] || 1;

        let tx = roleWidthX(pl, tac, ballX, attacking);
        let ty = laneY(pl.position, key, ballY, { possession: poss });
        // Linha alta/baixa do técnico desloca o bloco inteiro e fica visível no campo.
        if(!pl.isKeeper)ty += dir * ((tac.lineHeight||58)-58) * 0.11;

        // Formação continua reconhecível: a posição original puxa o alvo de volta.
        const anchorWeight = attacking ? 0.34 : 0.48;
        tx = lerp(tx, pl.baseX, anchorWeight);
        ty = lerp(ty, pl.baseY, anchorWeight * 0.50);

        if (attacking) {
          if (pl === carrier) {
            // Portador progride sem atravessar o campo sozinho.
            const advance = (M.carrierAdvance || 2.2) + (a.dribbling || 70) / 100 * 1.4;
            tx = clamp(ballX + (tx - ballX) * 0.16, 2, F.width - 2);
            ty = clamp(ballY + dir * advance, 3, F.length - 3);
          } else {
            const distBall = Math.hypot(pl.x - ballX, pl.y - ballY);
            const support = (a.passing || 70) / 100;

            if (['VOL', 'MC', 'MEI'].includes(pl.position) && distBall < 24) {
              // Triângulos de apoio ao portador.
              tx += (ballX - tx) * (0.18 + support * 0.10);
              ty += (ballY - ty) * 0.14;
            }

            if (['CA', 'SA', 'PE', 'PD'].includes(pl.position)) {
              // Infiltrações só quando a bola tem condições de progredir.
              const laneBoost = phase === 'transition_attack' ? 8 : 3.5;
              ty += dir * laneBoost * ((a.pace || 70) / 100);
            }

            if (['LD', 'LE', 'ALA'].includes(pl.position)) {
              // Laterais dão amplitude com posse, mas não sobem todos ao mesmo tempo.
              const isBallSide = Math.abs(pl.baseX - ballX) < F.width * 0.34;
              if (isBallSide) ty += dir * 5.5;
              else ty -= dir * 1.5;
            }
          }
        } else {
          const presser = pressers.find(x => x.p === pl);
          if (presser && carrier) {
            // Pressão: aproxima sem colar exatamente no portador.
            const dx = pl.x - carrier.x, dy = pl.y - carrier.y;
            const d = Math.hypot(dx, dy) || 1;
            tx = carrier.x + dx / d * 1.6;
            ty = carrier.y + dy / d * 1.6;
          } else {
            // Bloco defensivo se move junto com a bola.
            const compact = M.compactness || 0.72;
            tx = lerp(tx, ballX, 0.10 + tac.pressing / 100 * 0.09);
            ty = lerp(ty, ballY, 0.06 + tac.pressing / 100 * 0.05);

            // Cobertura do adversário mais próximo, sem abandonar a zona.
            const nearby = nearestPlayers(pl, oppPlayers.filter(p => !p.isKeeper), 1)[0];
            if (nearby && nearby.d < 13) {
              tx = lerp(tx, nearby.p.x, 0.13 * compact);
              ty = lerp(ty, nearby.p.y, 0.10 * compact);
            }
          }

          // Transição defensiva = corrida clara de volta para trás da bola.
          if (phase === 'transition_defend' && !pl.isKeeper) {
            const recoveryY = ballY - dir * 7;
            ty = lerp(ty, recoveryY, 0.42);
          }
        }

        // Goleiro acompanha lateralmente e sai um pouco mais se for sweeper keeper.
        if (pl.isKeeper) {
          const sweep = pdata?.profileStyle === 'sweeper_keeper' ? 8.5 : 5.2;
          tx = clamp(F.width / 2 + (ballX - F.width / 2) * 0.15, F.width / 2 - 6, F.width / 2 + 6);
          const ownY=ownGoalY(key), d=attackDir(key);
          ty = clamp(ownY + d*(sweep + Math.abs(ballY-ownY)*0.035), 2.3, F.length-2.3);
        }

        pl.tx = clamp(tx, 1.5, F.width - 1.5);
        pl.ty = clamp(ty, 1.5, F.length - 1.5);

        let speedBoost = 1;
        const transitionCoach=1+Math.max(-.08,Math.min(.18,((tac.transitionSpeed||68)-60)*.004));
        if (phase === 'transition_attack') speedBoost = (M.transitionBoost || 1.12)*transitionCoach;
        if (phase === 'transition_defend') speedBoost = (M.recoveryBoost || 1.13)*(0.96+Math.min(.12,(tac.pressing||60)*.0015));
        const tempoBoost=.94+Math.min(.12,(tac.tempo||65)*.0015);
        pl.maxSpeed = maxSpeedFor(pdata) * (0.84 + 0.16 * stamina) * speedBoost * tempoBoost;
        pl.accel = accelFor(pdata) * (0.88 + 0.12 * stamina) * speedBoost * tempoBoost;
      });
    }
  }

  function update(scene, state, dt) {
    if (!scene || scene.preview) return;
    computeTargets(scene, state, dt);
    for (const pl of scene.players) steering(pl, dt);
  }

  Prime.MovementAI = Object.freeze({
    update, computeTargets, maxSpeedFor, accelFor, coachTactics
  });
})(window.Prime = window.Prime || {});
