import { newGame, tick } from '../src/game/engine';
import { step } from './bot';

const runs = 20;
let totalDays = 0, totalActions = 0, fails = 0, minCash = Infinity;
for (let r = 0; r < runs; r++) {
  const s = newGame('Bot');
  s.seed = 1000 + r * 7919;
  let actions = 0;
  while (!s.completed && s.day < 3000) {
    let n = 0;
    while (step(s) && n++ < 10) { actions++; s.modals = []; }
    tick(s, true);
    s.modals = [];
    minCash = Math.min(minCash, s.cash);
  }
  if (!s.completed) { fails++; console.log(`run ${r}: NOT completed. level ${s.level} day ${s.day} cash ${s.cash} rep ${s.reputation} won ${s.stats.won} opps ${s.opportunities.map(o => o.companyId + ':' + o.stage).join(',')}`); }
  else console.log(`run ${r}: done day ${s.day} (${(s.day / 60).toFixed(1)} min @1x) actions ${actions} cash ${Math.round(s.cash / 1000)}K rev ${Math.round(s.stats.revenue / 1000)}K won ${s.stats.won} lost ${s.stats.lost} emp ${s.employees.length}`);
  totalDays += s.day; totalActions += actions;
}
console.log(`avg days ${totalDays / runs} (${(totalDays / runs / 60).toFixed(1)} min @1x), avg actions ${totalActions / runs}, fails ${fails}, minCash ${minCash}`);
