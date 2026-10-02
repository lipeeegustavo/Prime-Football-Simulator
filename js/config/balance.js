(function (Prime) {
  Prime.Balance = Object.freeze({
    visualQueueMax: 5,
    receiveTimeout: 3.0,
    visualFlushAtFullTime: 3,
    shortPassBacklogThreshold: 3,
    playerRadius: 1.05,

    camera: Object.freeze({
      followZoom: 2.45,
      fullZoom: 1,
      smoothing: 4.6,
      lookAhead: 5.5
    }),

    event: Object.freeze({
      baseGapMin: 18,
      baseGapMax: 34,
      transitionWindow: 7.5,
      maxPossessionActions: 8,
      minPossessionActions: 2,
      foulChance: 0.085,
      // Valores negativos desativam completamente os eventos artificiais no motor antigo.
      // Lateral/escanteio/tiro de meta passam a nascer somente da física das linhas do campo.
      throwInChance: -1,
      cornerChanceFinalThird: -1,
      goalKickChance: -1,
      shotBoost: 4.1,
      maxShootoutKicks: 30
    }),

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

    ball: Object.freeze({
      shortPassSpeed: 19.5,
      longPassSpeed: 27.5,
      crossSpeed: 25.5,
      crossLoft: 0.70,
      shotSpeed: 38.0,
      shotLoft: 0.22,
      saveShotLoft: 0.12,
      throughBallLead: 0.34,
      passLeadMaxMeters: 4.5,
      curveSpin: 7.4,
      maxPhysicsStep: 0.02,
      shotMaxVisualSeconds: 3.2
    })
  });
})(window.Prime = window.Prime || {});
