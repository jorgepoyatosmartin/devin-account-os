// Headless bot playthrough to validate balance: no dead ends, reasonable duration.
import { COMPANIES, PARTNERS } from '../src/game/data';
import { capacity, engage, hire, investPartner, oppFor, prospect, research, respondDemand, runStage, hasRole } from '../src/game/engine';
import type { GameState } from '../src/game/types';

export function step(s: GameState): boolean {
  // 1. respond to demands
  for (const o of s.opportunities) if (o.demand) { respondDemand(s, o.id, o.stakeholders.length && !o.traded ? 'trade' : 'accept'); return true; }
  // 2. hire when possible
  if (s.level >= 2) {
    if (!hasRole(s, 'ae') && s.cash > 40000) { hire(s, 'ae'); return true; }
    if (!hasRole(s, 'se') && s.cash > 35000) { hire(s, 'se'); return true; }
    if (!hasRole(s, 'sdr') && s.cash > 30000) { hire(s, 'sdr'); return true; }
    for (const p of PARTNERS) { const ps = s.partners.find(x => x.id === p.id)!; if (!ps.active && s.cash > p.cost + 40000 && s.reputation >= p.repReq) { investPartner(s, p.id); return true; } }
  }
  // 3. work deals: prefer engaging weak stakeholders before business case/security/procurement
  const opps = [...s.opportunities].sort((a, b) => b.value - a.value);
  for (const o of opps) {
    const weak = o.stakeholders.filter(x => x.relationship < 60);
    if (['Business Case', 'Security Review', 'Procurement', 'Closing'].includes(o.stage) && weak.length && s.focus >= 2) { engage(s, o.id, weak[0].role); return true; }
    if (o.stage === 'Technical' && !hasRole(s, 'se') && s.level >= 2 && s.cash < 35000) continue; // wait for SE
    if (o.stage === 'Security Review' && !hasRole(s, 'se')) continue;
    if (s.focus >= 3) { const r = runStage(s, o.id); if (r.ok) return true; }
  }
  // 4. prospect
  if (s.opportunities.length < capacity(s) && s.focus >= 3) {
    const avail = COMPANIES.filter(c => s.accounts[c.id].status === 'available' && !oppFor(s, c.id) && s.day >= s.accounts[c.id].cooldownUntil).sort((a, b) => b.acv - a.acv);
    const c = avail[0];
    if (c) {
      if (s.accounts[c.id].research < 100 && s.focus >= 5) { research(s, c.id); return true; }
      prospect(s, c.id); return true;
    }
  }
  return false;
}

