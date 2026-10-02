import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const index=read('index.html');
const balance=read('js/config/balance.js');
const core=read('js/runtime/coreStabilityV24.js');
const boundary=read('js/runtime/physicalBoundaryV23.js');

assert.match(index,/coreStabilityV24\.js/,'v24 core must be loaded');
assert.match(index,/rulesStabilityV24\.js/,'v24 rules must be loaded');
assert.match(balance,/throwInChance:\s*-1/,'scripted throw-ins must be disabled');
assert.match(balance,/cornerChanceFinalThird:\s*-1/,'scripted corners must be disabled');
assert.match(core,/evt\.playerId\|\|evt\.fromId/,'pass source aliases must be normalized');
assert.match(core,/evt\.targetId\|\|evt\.toId/,'pass target aliases must be normalized');
assert.match(core,/physicalShot/,'v24 physical shot path must exist');
assert.doesNotMatch(core,/Math\.random/,'v24 must stay seeded/deterministic');
assert.match(boundary,/s\.v24ShotActive/,'boundary detector must not race active v24 shots');

// Physics regression: a large dt must be integrated by substeps, not truncated to 50 ms.
const context={window:{},console};
context.window.Prime={FieldGeometry:{FIELD:{width:68,length:105}},Balance:{ball:{maxPhysicsStep:.02}}};
vm.createContext(context);
vm.runInContext(read('js/world/ball.js'),context);
const Ball=context.window.Prime.Ball;
const ball=Ball.createBall(34,52.5);
Ball.release(ball,20,0,'free',{vz:0});
Ball.update(ball,.20);
assert.ok(ball.x>37.5,`expected >3.5 m movement at dt=.20, got x=${ball.x}`);
assert.ok(Number.isFinite(ball.x)&&Number.isFinite(ball.y)&&Number.isFinite(ball.z),'ball coordinates must stay finite');

console.log('v24 smoke checks: OK');
