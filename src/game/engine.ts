import {
  ACHIEVEMENTS, COMPANIES, COMPANY_MAP, FIRST_NAMES, FOCUS_COST, LAST_NAMES, PARTNERS, ROLES, STAGES_BY_TIER, STAGE_META,
} from './data';
import type {
  AccountState, CompanyDef, Demand, GameState, Level, Opportunity, RoleId, Stage, StakeholderRole, Tier,
} from './types';

export const SAVE_VERSION = 3;
export const DAYS_PER_MONTH = 30;

// ---------- RNG ----------
function rand(s: GameState): number {
  let t = (s.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(s: GameState, arr: T[]): T { return arr[Math.floor(rand(s) * arr.length)]; }
function randName(s: GameState) { return `${pick(s, FIRST_NAMES)} ${pick(s, LAST_NAMES)}`; }
let idc = 0;
function uid(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${(idc++).toString(36)}`; }

// ---------- Helpers ----------
export function log(s: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info') {
  s.log.unshift({ id: s.logCounter++, day: s.day, text, kind });
  if (s.log.length > 80) s.log.length = 80;
}
export function count(s: GameState, role: RoleId) { return s.employees.filter(e => e.role === role).length; }
export function hasRole(s: GameState, role: RoleId) { return count(s, role) > 0; }
export function capacity(s: GameState) { return 2 + count(s, 'ae') * 2; }
export function focusRegen(s: GameState) { return 1 + count(s, 'ae') * 2; }
export function monthlyBurn(s: GameState) { return s.employees.reduce((a, e) => a + e.salary, 0); }
export function isCustomer(s: GameState, id: string) { return s.accounts[id]?.status === 'customer'; }
export function company(id: string): CompanyDef { return COMPANY_MAP[id]; }
export function oppFor(s: GameState, companyId: string) { return s.opportunities.find(o => o.companyId === companyId); }
export function tierForLevel(level: Level): Tier { return level; }

export function pipelineTotals(s: GameState) {
  let pipeline = 0, weighted = 0;
  for (const o of s.opportunities) {
    pipeline += o.value;
    weighted += o.value * displayProbability(s, o);
  }
  const closedWon = s.contracts.reduce((a, c) => a + c.acv, 0);
  return { pipeline, weighted, closedWon, forecast: weighted + s.quarterClosed };
}

// ---------- Unlock requirements ----------
export interface ReqCheck { label: string; met: boolean }
export function requirements(s: GameState, c: CompanyDef): ReqCheck[] {
  const r: ReqCheck[] = [];
  if (c.req.level > 1) r.push({ label: `Level ${c.req.level}`, met: s.level >= c.req.level });
  if (c.req.rep > 0) r.push({ label: `Reputation ${c.req.rep}`, met: s.reputation >= c.req.rep });
  for (const role of c.req.roles ?? []) r.push({ label: ROLES[role].name, met: hasRole(s, role) });
  if (c.req.reference) {
    const names = c.req.reference.map(id => company(id).name).join(' or ');
    r.push({ label: `Reference: ${names}`, met: c.req.reference.some(id => isCustomer(s, id)) });
  }
  if (c.req.refTier) {
    r.push({ label: `Any ${c.req.refTier === 1 ? 'SMB' : 'enterprise'} customer`, met: s.contracts.some(k => company(k.companyId).tier === c.req.refTier) });
  }
  if (c.req.partner) r.push({ label: 'Active partner', met: s.partners.some(p => p.active) });
  return r;
}

export function recomputeUnlocks(s: GameState): string[] {
  const newly: string[] = [];
  for (const c of COMPANIES) {
    const a = s.accounts[c.id];
    if (a.status !== 'locked') continue;
    if (requirements(s, c).every(x => x.met)) {
      a.status = 'available';
      if (!a.announced) { a.announced = true; newly.push(c.id); }
    }
  }
  if (newly.length) {
    for (const id of newly) log(s, `New account unlocked: ${company(id).name}`, 'unlock');
  }
  return newly;
}

// ---------- New game ----------
export function newGame(name = 'Your Company'): GameState {
  const accounts: Record<string, AccountState> = {};
  for (const c of COMPANIES) accounts[c.id] = { research: 0, status: 'locked', cooldownUntil: 0, meetingBooked: false, announced: c.req.level === 1 && c.req.rep === 0 && !c.req.reference };
  const s: GameState = {
    version: SAVE_VERSION, companyName: name, day: 1, cash: 100000, reputation: 0, focus: 10, focusMax: 10, level: 1, speed: 1,
    employees: [], opportunities: [], contracts: [], partners: PARTNERS.map(p => ({ id: p.id, invested: 0, active: false })),
    accounts, log: [], logCounter: 1,
    stats: { revenue: 0, won: 0, lost: 0, meetings: 0, biggestDeal: 0, leads: 0, accountsOpened: 0 },
    achievements: [], modals: [], quarterClosed: 0, lastSalaryDay: 1, sdrTimer: 0, partnerTimer: 0, aeTimer: 0,
    lastSaved: Date.now(), completed: false, continued: false, seed: (Date.now() & 0xffff) | 1,
  };
  recomputeUnlocks(s);
  log(s, `${name} founded in Madrid with €100K and one very motivated founder. Research an account and start prospecting.`, 'info');
  return s;
}

// ---------- Probabilities ----------
export function avgRelationship(o: Opportunity) {
  if (!o.stakeholders.length) return 100;
  return o.stakeholders.reduce((a, x) => a + x.relationship, 0) / o.stakeholders.length;
}
export function winProbability(s: GameState, o: Opportunity): number {
  const c = company(o.companyId);
  let p = c.tier === 1 ? 0.7 : c.tier === 2 ? 0.45 : 0.3;
  p += (o.pain / 100) * 0.12;
  if (c.tier >= 2) {
    p += (avgRelationship(o) / 100) * 0.3;
    p += (o.technical / 100) * 0.2;
    if (hasRole(s, 'ae')) p += 0.1;
    if (hasRole(s, 'se')) p += 0.05;
  } else {
    p += (o.technical / 100) * 0.05;
  }
  p -= c.difficulty * 0.03;
  p -= o.closeAttempts * 0.1;
  p += Math.min(0.15, (1 - o.value / o.baseValue) * 0.6); // discounts help
  if (o.termYears > 1) p += 0.03;
  return Math.max(0.05, Math.min(0.95, p));
}
export function displayProbability(s: GameState, o: Opportunity): number {
  const stages = STAGES_BY_TIER[company(o.companyId).tier];
  const stageWeight = (o.stageIdx + o.progress / 100) / stages.length;
  return Math.round(winProbability(s, o) * (0.25 + 0.75 * stageWeight) * 100) / 100;
}
export function prospectChance(s: GameState, c: CompanyDef) {
  const a = s.accounts[c.id];
  let p = 0.3 + a.research * 0.005 + Math.min(0.15, s.reputation * 0.003) - c.difficulty * 0.05;
  if (c.tier >= 2 && hasRole(s, 'sdr')) p += 0.1;
  return Math.max(0.15, Math.min(0.92, p));
}

// ---------- Opportunity creation ----------
function makeOpportunity(s: GameState, c: CompanyDef, source: Opportunity['source'], relBonus = 0): Opportunity {
  const stages = STAGES_BY_TIER[c.tier];
  const value = Math.round(c.acv * (0.85 + rand(s) * 0.3) / 1000) * 1000;
  const stakeholders = c.tier === 1 ? [] : c.stakeholders.map(role => ({
    role, name: randName(s), relationship: Math.round(rand(s) * (c.tier === 3 ? 8 : 15) + relBonus + (role === 'Champion' ? 20 : 0)),
  }));
  return {
    id: uid('opp'), companyId: c.id, stage: stages[0], stageIdx: 0, progress: 0, value, baseValue: value, termYears: 1,
    technical: c.tier === 1 ? 50 : 10, pain: 10, stakeholders, demand: null, demandsResolved: 0, reference: false,
    daysOpen: 0, closeAttempts: 0, researched: s.accounts[c.id].research > 0, nextMeetingDay: 0, traded: false, ownerId: null, log: [], source,
  };
}
function assignOwners(s: GameState) {
  const aes = s.employees.filter(e => e.role === 'ae');
  for (const o of s.opportunities) {
    if (o.ownerId && !aes.some(a => a.id === o.ownerId)) o.ownerId = null;
    if (!o.ownerId) {
      const free = aes.find(a => s.opportunities.filter(x => x.ownerId === a.id).length < 2);
      if (free) o.ownerId = free.id;
    }
  }
}

// ---------- Player actions ----------
export type ActionResult = { ok: boolean; msg: string; good?: boolean };

export function canAfford(s: GameState, focus: number) { return s.focus >= focus; }

export function research(s: GameState, id: string): ActionResult {
  const a = s.accounts[id];
  if (a.status !== 'available') return { ok: false, msg: 'Account not available.' };
  if (a.research >= 100) return { ok: false, msg: 'Already fully researched.' };
  if (!canAfford(s, FOCUS_COST.research)) return { ok: false, msg: 'Not enough focus.' };
  s.focus -= FOCUS_COST.research;
  a.research = Math.min(100, a.research + 50);
  const c = company(id);
  const msg = a.research >= 100
    ? `${c.name}: research complete. ${c.blurb}`
    : `${c.name}: you learn they have ${c.employees.toLocaleString()} employees and a ${c.cycle.toLowerCase()} buying cycle.`;
  log(s, msg);
  return { ok: true, msg, good: true };
}

export function prospect(s: GameState, id: string): ActionResult {
  const c = company(id);
  const a = s.accounts[id];
  if (a.status !== 'available') return { ok: false, msg: 'Account not available.' };
  if (oppFor(s, id)) return { ok: false, msg: 'Already engaged.' };
  if (s.day < a.cooldownUntil) return { ok: false, msg: `They asked you to come back in ${a.cooldownUntil - s.day} days.` };
  if (s.opportunities.length >= capacity(s)) return { ok: false, msg: 'Opportunity capacity full. Close deals or hire an Enterprise AE.' };
  if (!canAfford(s, FOCUS_COST.prospect)) return { ok: false, msg: 'Not enough focus.' };
  s.focus -= FOCUS_COST.prospect;
  const p = prospectChance(s, c);
  if (rand(s) < p) {
    const o = makeOpportunity(s, c, 'Outbound');
    s.opportunities.push(o);
    assignOwners(s);
    s.stats.leads++; s.stats.accountsOpened++;
    const msg = `Meeting booked with ${c.name}! Opportunity created (~€${fmtK(o.value)}).`;
    log(s, msg, 'good');
    checkAchievements(s);
    return { ok: true, msg, good: true };
  }
  const msg = pick(s, [`${c.name} didn't reply. Try again.`, `${c.name}: "Not a priority right now." Keep pushing.`, `Gatekeeper at ${c.name} blocked you. Research helps.`]);
  log(s, msg, 'bad');
  return { ok: true, msg, good: false };
}

export function engage(s: GameState, oppId: string, role: StakeholderRole): ActionResult {
  const o = s.opportunities.find(x => x.id === oppId);
  if (!o) return { ok: false, msg: 'No opportunity.' };
  const st = o.stakeholders.find(x => x.role === role);
  if (!st) return { ok: false, msg: 'No such stakeholder.' };
  if (!canAfford(s, FOCUS_COST.engage)) return { ok: false, msg: 'Not enough focus.' };
  s.focus -= FOCUS_COST.engage;
  const c = company(o.companyId);
  let gain = (c.tier === 3 ? 14 : 18) + Math.round(rand(s) * 12);
  if ((role === 'CISO' || role === 'Technical Buyer' || role === 'CTO' || role === 'Engineering Director') && hasRole(s, 'se')) gain += 8;
  if ((role === 'CFO' || role === 'Economic Buyer' || role === 'Procurement') && hasRole(s, 'ae')) gain += 6;
  const champ = o.stakeholders.find(x => x.role === 'Champion');
  if (champ && champ.relationship >= 60 && role !== 'Champion') gain += 6;
  st.relationship = Math.min(100, st.relationship + gain);
  s.stats.meetings++;
  const msg = `${st.name} (${st.role}) at ${company(o.companyId).name}: relationship +${gain}.`;
  o.log.unshift(msg);
  checkAchievements(s);
  return { ok: true, msg, good: true };
}

function stageQuality(s: GameState, o: Opportunity, auto = false): { q: number; note: string } {
  const c = company(o.companyId);
  const rel = (role: StakeholderRole) => o.stakeholders.find(x => x.role === role)?.relationship ?? 50;
  const r = rand(s);
  let q = 0, note = '';
  switch (o.stage) {
    case 'Discovery': {
      q = 28 + r * 20 + (c.tier === 1 ? 22 : 0) - (c.tier === 3 ? 6 : 0);
      o.pain = Math.min(100, o.pain + q * 0.9);
      note = r > 0.5 ? 'Clear pain uncovered.' : 'Good conversation, pain partially understood.';
      break;
    }
    case 'Technical': {
      const se = hasRole(s, 'se');
      q = (se ? 32 : 12) + r * 14 - (c.tier === 3 ? 5 : 0);
      o.technical = Math.min(100, o.technical + q * 1.1);
      note = se ? 'Your Sales Engineer nailed the demo.' : 'Without a Sales Engineer, tough technical questions stayed open.';
      break;
    }
    case 'Business Case': {
      const eb = Math.max(rel('Economic Buyer'), rel('CFO'));
      q = 8 + eb * 0.35 + o.pain * 0.12 + r * 8;
      note = eb >= 60 ? 'The economic buyer is bought in.' : 'The economic buyer barely knows you. Build the relationship.';
      break;
    }
    case 'Security Review': {
      const se = hasRole(s, 'se');
      q = (se ? 10 : 2) + rel('CISO') * 0.38 + o.technical * 0.15 + r * 8;
      note = rel('CISO') >= 60 ? 'CISO comfortable with your controls.' : 'CISO has open questions. Engage them.';
      break;
    }
    case 'Procurement': {
      q = 22 + rel('Procurement') * 0.3 + r * 12;
      note = 'Vendor onboarding forms, forms, forms.';
      break;
    }
    default: q = 0;
  }
  if (auto) q *= 0.7;
  return { q: Math.round(q), note };
}

function advanceStage(_s: GameState, o: Opportunity) {
  const stages = STAGES_BY_TIER[company(o.companyId).tier];
  o.stageIdx = Math.min(stages.length - 1, o.stageIdx + 1);
  o.stage = stages[o.stageIdx];
  o.progress = 0;
  o.log.unshift(`Moved to ${o.stage}.`);
}

export function meetingCooldown(tier: Tier) { return tier === 1 ? 2 : tier === 2 ? 4 : 6; }
export function meetingWait(s: GameState, o: Opportunity) { return Math.max(0, o.nextMeetingDay - s.day); }

export function runStage(s: GameState, oppId: string): ActionResult {
  const o = s.opportunities.find(x => x.id === oppId);
  if (!o) return { ok: false, msg: 'No opportunity.' };
  const c = company(o.companyId);
  const cost = STAGE_META[o.stage].cost;
  if (!canAfford(s, cost)) return { ok: false, msg: 'Not enough focus.' };
  if (meetingWait(s, o) > 0) return { ok: false, msg: `${c.name} can't meet for another ${meetingWait(s, o)} days.` };
  if (o.stage === 'Security Review' && !hasRole(s, 'se')) return { ok: false, msg: 'Security reviews require a Sales Engineer.' };
  if (o.stage === 'Negotiation' && o.demand) return { ok: false, msg: 'Respond to the current demand first.' };
  o.nextMeetingDay = s.day + meetingCooldown(c.tier);
  if (o.stage === 'Negotiation') return negotiateStart(s, o);
  if (o.stage === 'Closing') return attemptClose(s, o);
  s.focus -= cost;
  s.stats.meetings++;
  const { q, note } = stageQuality(s, o);
  o.progress += q;
  let msg = `${STAGE_META[o.stage].action} with ${c.name}: ${note} (+${q}%)`;
  if (o.progress >= 100) { advanceStage(s, o); msg += ` → ${o.stage}`; }
  o.log.unshift(msg);
  return { ok: true, msg, good: q >= 40 };
}

function requiredDemands(t: Tier) { return t === 1 ? 1 : t === 2 ? 2 : 3; }

function negotiateStart(s: GameState, o: Opportunity): ActionResult {
  if (o.demand) return { ok: false, msg: 'Respond to the current demand first.' };
  s.focus -= STAGE_META.Negotiation.cost;
  const c = company(o.companyId);
  const kinds: Demand['kind'][] = ['discount', 'terms', 'services'];
  const kind = kinds[o.demandsResolved % 3 === 0 ? 0 : Math.floor(rand(s) * 3)];
  const pct = c.tier === 1 ? 10 : c.tier === 2 ? 15 : 20;
  const demand: Demand =
    kind === 'discount' ? { kind, amount: pct, text: `"We need a ${pct}% discount to move forward."` }
      : kind === 'terms' ? { kind, amount: 8, text: `"Procurement insists on 90-day payment terms and an exit clause."` }
        : { kind, amount: 12, text: `"We expect onboarding and training services included at no extra cost."` };
  o.demand = demand;
  const msg = `${c.name} negotiation: ${demand.text}`;
  o.log.unshift(msg);
  return { ok: true, msg, good: true };
}

export function respondDemand(s: GameState, oppId: string, choice: 'accept' | 'reject' | 'trade'): ActionResult {
  const o = s.opportunities.find(x => x.id === oppId);
  if (!o || !o.demand) return { ok: false, msg: 'Nothing to respond to.' };
  const c = company(o.companyId);
  const d = o.demand;
  let msg = '';
  const need = requiredDemands(c.tier);
  if (choice === 'accept') {
    o.value = Math.round(o.value * (1 - d.amount / 100) / 1000) * 1000;
    o.pain = Math.min(100, o.pain + 5);
    msg = `Accepted. ACV now €${fmtK(o.value)}. They're happy — win probability up.`;
  } else if (choice === 'reject') {
    const r = rand(s);
    if (r < 0.3 + c.difficulty * 0.08) {
      for (const st of o.stakeholders) st.relationship = Math.max(0, st.relationship - 12);
      o.pain = Math.max(0, o.pain - 15);
      msg = `Rejected. ${c.name} is annoyed — relationships took a hit, but ACV is intact.`;
    } else {
      msg = `Rejected. They blinked. ACV intact at €${fmtK(o.value)}.`;
    }
  } else {
    if (o.traded) return { ok: false, msg: 'You already traded on this deal. Accept or reject.' };
    o.traded = true;
    o.value = Math.round(o.value * (1 - d.amount / 200) / 1000) * 1000;
    o.termYears = 3;
    o.reference = true;
    for (const st of o.stakeholders) st.relationship = Math.min(100, st.relationship + 5);
    msg = `Traded: ${Math.round(d.amount / 2)}% concession for a 3-year contract and a public reference. TCV €${fmtK(o.value * 3)}.`;
  }
  o.demand = null;
  o.demandsResolved++;
  o.progress = Math.min(100, Math.round((o.demandsResolved / need) * 100));
  if (o.demandsResolved >= need) { advanceStage(s, o); msg += ' Ready to close.'; }
  o.log.unshift(msg);
  log(s, `${c.name}: ${msg}`, choice === 'reject' ? 'info' : 'good');
  return { ok: true, msg, good: true };
}

function attemptClose(s: GameState, o: Opportunity): ActionResult {
  s.focus -= STAGE_META.Closing.cost;
  const c = company(o.companyId);
  const p = winProbability(s, o);
  if (rand(s) < p) {
    signContract(s, o);
    return { ok: true, msg: `CONTRACT SIGNED with ${c.name}!`, good: true };
  }
  o.closeAttempts++;
  if (o.closeAttempts >= 2 || c.tier === 1 && rand(s) < 0.5) {
    s.opportunities = s.opportunities.filter(x => x.id !== o.id);
    const a = s.accounts[c.id];
    a.cooldownUntil = s.day + (c.tier === 1 ? 30 : 60);
    a.meetingBooked = false;
    s.stats.lost++;
    const reason = pick(s, ['They chose a competitor.', 'Budget got frozen this quarter.', 'The champion left the company.', 'Procurement picked the incumbent.']);
    log(s, `Lost ${c.name}. ${reason}`, 'bad');
    s.modals.push({ type: 'lost', companyId: c.id, reason });
    return { ok: true, msg: `Deal lost with ${c.name}. ${reason}`, good: false };
  }
  const msg = `${c.name}: "Not yet." They want more confidence before signing. Strengthen the deal and try again.`;
  o.log.unshift(msg);
  log(s, msg, 'bad');
  return { ok: true, msg, good: false };
}

function repFor(tier: Tier) { return tier === 1 ? 5 : tier === 2 ? 12 : 30; }

export function signContract(s: GameState, o: Opportunity) {
  const c = company(o.companyId);
  s.opportunities = s.opportunities.filter(x => x.id !== o.id);
  s.contracts.push({ companyId: c.id, acv: o.value, termYears: o.termYears, signedDay: s.day });
  s.accounts[c.id].status = 'customer';
  s.cash += o.value;
  s.stats.revenue += o.value;
  s.quarterClosed += o.value;
  s.stats.won++;
  s.stats.biggestDeal = Math.max(s.stats.biggestDeal, o.value);
  const rep = repFor(c.tier) + (o.reference ? 3 : 0);
  s.reputation += rep;
  log(s, `CONTRACT SIGNED: ${c.name} — €${fmtK(o.value)} ACV, ${o.termYears}y. +${rep} reputation.`, 'money');
  if (!o.researched) unlockAchievement(s, 'from_zero');
  const prevLevel = s.level;
  checkLevel(s);
  const unlocked = recomputeUnlocks(s);
  s.modals.push({ type: 'contract', companyId: c.id, acv: o.value, term: o.termYears, unlocked, rep });
  if (s.level > prevLevel) s.modals.push({ type: 'level', level: s.level });
  checkAchievements(s);
  if (c.tier === 3 && !s.completed) { s.completed = true; s.modals.push({ type: 'complete' }); }
}

function checkLevel(s: GameState) {
  if (s.level === 1 && s.stats.won >= 2) { s.level = 2; log(s, 'LEVEL 2 UNLOCKED — ENTERPRISE. You can now hire and work with partners.', 'unlock'); }
  if (s.level === 2 && s.contracts.some(k => company(k.companyId).tier === 2)) { s.level = 3; log(s, 'LEVEL 3 UNLOCKED — STRATEGIC. Strategic accounts are within reach.', 'unlock'); }
}

export function hire(s: GameState, role: RoleId): ActionResult {
  if (s.level < 2) return { ok: false, msg: 'Hiring unlocks at Level 2.' };
  const r = ROLES[role];
  if (s.cash < r.hireCost) return { ok: false, msg: 'Not enough cash.' };
  s.cash -= r.hireCost;
  const name = randName(s);
  s.employees.push({ id: uid('emp'), name, role, salary: r.salary, hiredDay: s.day });
  s.focusMax = 10 + count(s, 'sdr') + count(s, 'ae') * 2;
  assignOwners(s);
  log(s, `Hired ${name} as ${r.name}. Monthly burn now €${fmtK(monthlyBurn(s))}.`, 'good');
  const unlocked = recomputeUnlocks(s);
  if (unlocked.length) s.modals.push({ type: 'unlock', companyIds: unlocked });
  checkAchievements(s);
  return { ok: true, msg: `Hired ${name} (${r.name}).`, good: true };
}

export function investPartner(s: GameState, id: string): ActionResult {
  if (s.level < 2) return { ok: false, msg: 'Partners unlock at Level 2.' };
  const def = PARTNERS.find(p => p.id === id)!;
  const p = s.partners.find(x => x.id === id)!;
  if (p.active) return { ok: false, msg: 'Already active.' };
  if (s.reputation < def.repReq) return { ok: false, msg: `Needs reputation ${def.repReq}.` };
  if (s.cash < def.cost) return { ok: false, msg: 'Not enough cash.' };
  s.cash -= def.cost;
  p.active = true; p.invested = 100;
  s.reputation += 3;
  log(s, `Partnership signed with ${def.name}. +3 reputation. They will start introducing you to accounts.`, 'good');
  const unlocked = recomputeUnlocks(s);
  if (unlocked.length) s.modals.push({ type: 'unlock', companyIds: unlocked });
  return { ok: true, msg: `Partnership with ${def.name} active.`, good: true };
}

export function unlockAchievement(s: GameState, id: string) {
  if (s.achievements.includes(id)) return;
  s.achievements.push(id);
  const a = ACHIEVEMENTS.find(x => x.id === id)!;
  log(s, `Achievement: ${a.name} — ${a.desc}`, 'unlock');
  s.modals.push({ type: 'achievement', id });
}
function checkAchievements(s: GameState) {
  if (s.stats.won >= 1) unlockAchievement(s, 'first_deal');
  if (s.stats.accountsOpened >= 5) unlockAchievement(s, 'hunter');
  if (s.contracts.some(k => company(k.companyId).tier >= 2)) unlockAchievement(s, 'enterprise');
  if (s.stats.biggestDeal >= 500000) unlockAchievement(s, 'whale');
  if (s.opportunities.some(o => o.stakeholders.filter(x => x.relationship >= 60).length >= 5)) unlockAchievement(s, 'multithread');
  if (hasRole(s, 'sdr') && hasRole(s, 'ae') && hasRole(s, 'se')) unlockAchievement(s, 'team');
}

// ---------- Tick (1 day) ----------
export function tick(s: GameState, quiet = false) {
  s.day++;
  s.focus = Math.min(s.focusMax, s.focus + focusRegen(s));
  for (const o of s.opportunities) o.daysOpen++;

  // salaries
  if (s.day - s.lastSalaryDay >= DAYS_PER_MONTH) {
    s.lastSalaryDay = s.day;
    const burn = monthlyBurn(s);
    if (burn > 0) { s.cash -= burn; if (!quiet) log(s, `Payroll: −€${fmtK(burn)}.`, 'money'); }
  }
  // quarter reset
  if (s.day % 90 === 0) s.quarterClosed = 0;
  // renewals: yearly payment for multi-year contracts
  for (const k of s.contracts) {
    const age = s.day - k.signedDay;
    if (age > 0 && age % 360 === 0 && age / 360 < k.termYears) {
      s.cash += k.acv; s.stats.revenue += k.acv; s.quarterClosed += k.acv;
      if (!quiet) log(s, `${company(k.companyId).name} renewal year ${age / 360 + 1}: +€${fmtK(k.acv)}.`, 'money');
    }
  }
  // SDR automation
  const sdrs = count(s, 'sdr');
  if (sdrs > 0) {
    s.sdrTimer += sdrs;
    if (s.sdrTimer >= 12 && s.opportunities.length < capacity(s)) {
      s.sdrTimer = 0;
      const targets = COMPANIES.filter(c => s.accounts[c.id].status === 'available' && !oppFor(s, c.id) && s.day >= s.accounts[c.id].cooldownUntil && c.tier <= s.level);
      if (targets.length) {
        const c = pick(s, targets.sort((x, y) => y.tier - x.tier).slice(0, 3));
        s.opportunities.push(makeOpportunity(s, c, 'SDR'));
        assignOwners(s);
        s.stats.leads++; s.stats.accountsOpened++;
        log(s, `Your SDR booked a meeting with ${c.name}.`, 'good');
      }
    }
  }
  // Partner automation
  const partners = s.partners.filter(p => p.active).length;
  if (partners > 0) {
    s.partnerTimer += partners;
    if (s.partnerTimer >= 25) {
      s.partnerTimer = 0;
      const targets = COMPANIES.filter(c => c.tier >= 2 && c.tier <= s.level && s.accounts[c.id].status === 'available' && !oppFor(s, c.id) && s.day >= s.accounts[c.id].cooldownUntil);
      if (targets.length && s.opportunities.length < capacity(s)) {
        const c = pick(s, targets);
        s.opportunities.push(makeOpportunity(s, c, 'Partner', 20));
        assignOwners(s);
        s.stats.leads++; s.stats.accountsOpened++;
        log(s, `Partner introduction: warm intro to ${c.name} with executive sponsorship.`, 'good');
      } else {
        s.reputation += 1;
        log(s, 'Partner co-marketing: +1 reputation.', 'good');
      }
    }
  }
  // AE automation: owned deals progress by themselves (not negotiation / closing)
  const aes = count(s, 'ae');
  if (aes > 0) {
    s.aeTimer++;
    if (s.aeTimer >= 5) {
      s.aeTimer = 0;
      for (const o of s.opportunities) {
        if (!o.ownerId) continue;
        if (o.stage === 'Negotiation' || o.stage === 'Closing') continue;
        if (o.stage === 'Security Review' && !hasRole(s, 'se')) continue;
        const { q } = stageQuality(s, o, true);
        o.progress += q;
        s.stats.meetings++;
        const weak = o.stakeholders.filter(x => x.relationship < 50);
        if (weak.length) { const w = pick(s, weak); w.relationship = Math.min(100, w.relationship + 8); }
        const owner = s.employees.find(e => e.id === o.ownerId);
        if (o.progress >= 100) { advanceStage(s, o); log(s, `${owner?.name ?? 'Your AE'} advanced ${company(o.companyId).name} to ${o.stage}.`, 'info'); }
        else o.log.unshift(`${owner?.name ?? 'AE'} ran a ${o.stage.toLowerCase()} session (+${q}%).`);
      }
    }
  }
  recomputeUnlocksAnnounce(s);
  checkAchievements(s);
}

function recomputeUnlocksAnnounce(s: GameState) {
  const u = recomputeUnlocks(s);
  if (u.length) s.modals.push({ type: 'unlock', companyIds: u });
}

// ---------- Offline ----------
export function applyOffline(s: GameState, nowMs: number) {
  const secs = Math.floor((nowMs - s.lastSaved) / 1000);
  const days = Math.min(600, secs);
  if (days < 30 || s.speed === 0) return;
  const before = { leads: s.stats.leads, pipe: pipelineTotals(s).pipeline, rev: s.stats.revenue, meetings: s.stats.meetings };
  for (let i = 0; i < days; i++) tick(s, true);
  s.modals = s.modals.filter(m => m.type !== 'unlock');
  const after = pipelineTotals(s);
  s.modals.unshift({ type: 'away', days, leads: s.stats.leads - before.leads, meetings: s.stats.meetings - before.meetings, pipeline: after.pipeline - before.pipe, revenue: s.stats.revenue - before.rev });
}

// ---------- Recommendations ----------
export interface Recommendation { color: 'blue' | 'yellow' | 'green' | 'red'; text: string; target?: { tab: string; id?: string } }
export function recommendations(s: GameState): Recommendation[] {
  const r: Recommendation[] = [];
  if (s.cash < monthlyBurn(s) * 2 && monthlyBurn(s) > 0) r.push({ color: 'red', text: `Cash is tight (€${fmtK(s.cash)}). Close a deal soon or payroll will hurt.`, target: { tab: 'pipeline' } });
  // deals ready to close / negotiate
  for (const o of s.opportunities) {
    const c = company(o.companyId);
    if (o.stage === 'Closing') { r.push({ color: 'green', text: `Close ${c.name} — ${Math.round(winProbability(s, o) * 100)}% win chance`, target: { tab: 'pipeline', id: o.id } }); continue; }
    if (o.demand) { r.push({ color: 'yellow', text: `Respond to ${c.name}'s demand`, target: { tab: 'pipeline', id: o.id } }); continue; }
    const weak = o.stakeholders.filter(x => x.relationship < 45);
    if (c.tier >= 2 && weak.length && (o.stage === 'Business Case' || o.stage === 'Security Review' || o.stage === 'Procurement')) {
      r.push({ color: 'blue', text: `Engage ${weak[0].role} at ${c.name} before the ${o.stage.toLowerCase()}`, target: { tab: 'pipeline', id: o.id } }); continue;
    }
    r.push({ color: 'blue', text: `${STAGE_META[o.stage].action} with ${c.name}`, target: { tab: 'pipeline', id: o.id } });
  }
  if (s.level >= 2) {
    if (!hasRole(s, 'ae') && s.cash > 40000) r.push({ color: 'yellow', text: 'Hire an Enterprise AE — required by most enterprise accounts', target: { tab: 'team' } });
    else if (!hasRole(s, 'se') && s.cash > 35000) r.push({ color: 'yellow', text: 'Hire a Sales Engineer — technical meetings are weak without one', target: { tab: 'team' } });
    else if (!hasRole(s, 'sdr') && s.cash > 25000) r.push({ color: 'yellow', text: 'Hire an SDR to automate prospecting', target: { tab: 'team' } });
    if (!s.partners.some(p => p.active) && s.cash > 60000) r.push({ color: 'yellow', text: 'Activate a partner — some accounts only buy through partners', target: { tab: 'partners' } });
  }
  if (s.opportunities.length < capacity(s)) {
    const avail = COMPANIES.filter(c => s.accounts[c.id].status === 'available' && !oppFor(s, c.id) && s.day >= s.accounts[c.id].cooldownUntil).sort((a, b) => b.acv - a.acv);
    if (avail.length) r.push({ color: 'blue', text: `Prospect ${avail[0].name} (€${fmtK(avail[0].acv)} potential)`, target: { tab: 'accounts', id: avail[0].id } });
  }
  // next unlock
  const locked = COMPANIES.filter(c => s.accounts[c.id].status === 'locked' && c.req.level <= s.level).sort((a, b) => a.acv - b.acv);
  if (locked.length) {
    const c = locked[0];
    const missing = requirements(s, c).filter(x => !x.met);
    if (missing.length) r.push({ color: 'green', text: `Unlock ${c.name}: needs ${missing.map(m => m.label).join(', ')}`, target: { tab: 'accounts', id: c.id } });
  }
  return r.slice(0, 3);
}

export function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}K`;
  return `${Math.round(n)}`;
}
export function fmtEur(n: number) { return `€${fmtK(n)}`; }
export function stageList(o: Opportunity): Stage[] { return STAGES_BY_TIER[company(o.companyId).tier]; }
