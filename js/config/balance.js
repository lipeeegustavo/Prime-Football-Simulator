(function (Prime) {
  Prime.Balance = Object.freeze({
    visualQueueMax: 5,
    receiveTimeout: 2.5,
    visualFlushAtFullTime: 3,
    shortPassBacklogThreshold: 3,
    playerRadius: 1.05,

    // Camera / leitura visual
    camera: Object.freeze({
      followZoom: 2.45,
      fullZoom: 1,
      smoothing: 4.6,
      lookAhead: 5.5
    }),

    // Ritmo: eventos são menos aleatórios e mais encadeados em uma posse.
    event: Object.freeze({
      baseGapMin: 18,
      baseGapMax: 34,
      transitionWindow: 7.5,
      maxPossessionActions: 8,
      minPossessionActions: 2,
      foulChance: 0.075,
      throwInChance: 0.115,
      cornerChanceFinalThird: 0.055,
      goalKickChance: 0.025,
      shotBoost: 5.0,
      maxShootoutKicks: 30
    }),

    // Movimento coletivo em metros do campo.
    movement: Object.freeze({
      blockShiftAttack: 18,
      blockShiftDefend: 13,
      compactness: 0.72,
      supportRadius: 12,
      pressRadius: 11,
      coverDistance: 5.5,
      carrierAdvance: 2.2,
      recoveryBoost: 1.13,
      transitionBoost: 1.12,
      defenderLineGap: 11,
      midfieldLineGap: 18,
      attackLineGap: 27
    }),

    animation: Object.freeze({
      idleBreathHz: 1.6,
      runCycleBase: 5.2,
      celebrationSeconds: 1.8,
      characterMinPx: 13,
      characterMaxPx: 30,
      dribbleTouchDistance: 0.75
    }),

    // Física visual da bola. O motor decide o resultado; estes valores só definem a trajetória.
    ball: Object.freeze({
      shortPassSpeed: 18.5,
      longPassSpeed: 24.0,
      crossSpeed: 25.5,
      crossLoft: 0.70,
      shotSpeed: 38.0,
      shotLoft: 0.22,
      saveShotLoft: 0.12,
      throughBallLead: 0.34,
      passLeadMaxMeters: 4.5,
      curveSpin: 8.5
    })
  });
})(window.Prime = window.Prime || {});
