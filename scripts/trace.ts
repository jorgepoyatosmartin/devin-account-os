import { newGame, tick } from '../src/game/engine';
import { step } from './bot';
const s = newGame('Bot'); s.seed = 1000;
while (!s.completed && s.day < 3000) { let n = 0; while (step(s) && n++ < 10) s.modals = []; tick(s, true); s.modals = []; }
console.log([...s.log].reverse().map(l => `D${l.day} ${l.text}`).join('\n'));
