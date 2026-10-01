(function (Prime) {
  function hashString(seed) {
    const text = String(seed || 'PRIME-001');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function createSeededRng(seed) {
    let h = hashString(seed);
    return function () {
      h = (h + 0x6D2B79F5) >>> 0;
      let x = h;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(input, rng) {
    if (typeof rng !== 'function') throw new Error('shuffle exige um RNG com seed.');
    const a = input.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = a[i]; a[i] = a[j]; a[j] = temp;
    }
    return a;
  }

  function pick(input, rng) {
    if (!input.length) return null;
    if (typeof rng !== 'function') throw new Error('pick exige um RNG com seed.');
    return input[Math.floor(rng() * input.length)];
  }

  Prime.Rng = Object.freeze({hashString, createSeededRng, shuffle, pick});
})(window.Prime = window.Prime || {});
