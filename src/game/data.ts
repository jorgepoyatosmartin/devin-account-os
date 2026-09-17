import type { CompanyDef, RoleId, Stage, Tier, StakeholderRole } from './types';

export const ROLES: Record<RoleId, { name: string; salary: number; hireCost: number; desc: string; effects: string[] }> = {
  sdr: {
    name: 'SDR', salary: 4500, hireCost: 8000,
    desc: 'Sales Development Rep. Prospects automatically and books meetings for you.',
    effects: ['Auto-books 1 meeting every ~12 days', '+1 max focus'],
  },
  ae: {
    name: 'Enterprise AE', salary: 9000, hireCost: 15000,
    desc: 'Enterprise Account Executive. Owns deals and advances them on their own.',
    effects: ['+2 opportunity capacity', '+2 focus / day', 'Auto-progresses owned deals', '+10% enterprise win rate'],
  },
  se: {
    name: 'Sales Engineer', salary: 8000, hireCost: 12000,
    desc: 'Runs demos and technical validation. Essential for enterprise deals.',
    effects: ['Technical meetings 2.5x more effective', 'Security reviews possible', '+15% technical win rate'],
  },
};

export const PARTNERS: { id: string; name: string; kind: string; cost: number; repReq: number; desc: string }[] = [
  { id: 'gc', name: 'Global Consulting', kind: 'Advisory', cost: 25000, repReq: 25, desc: 'Board-level advisors. Opens doors to executive sponsors and strategic accounts.' },
  { id: 'ti', name: 'Tech Integrator', kind: 'System Integrator', cost: 15000, repReq: 15, desc: 'Implements your product. Generates enterprise introductions.' },
  { id: 'cp', name: 'Cloud Partner', kind: 'Marketplace', cost: 20000, repReq: 20, desc: 'Co-sell through their marketplace. Steady stream of leads and reputation.' },
];

export const STAGES_BY_TIER: Record<Tier, Stage[]> = {
  1: ['Discovery', 'Negotiation', 'Closing'],
  2: ['Discovery', 'Technical', 'Business Case', 'Negotiation', 'Closing'],
  3: ['Discovery', 'Technical', 'Business Case', 'Security Review', 'Procurement', 'Negotiation', 'Closing'],
};

export const STAGE_META: Record<Stage, { action: string; desc: string; cost: number }> = {
  Discovery: { action: 'Run discovery', desc: 'Understand pain, use case and who decides.', cost: 3 },
  Technical: { action: 'Technical meeting', desc: 'Demo & validate architecture. Much better with a Sales Engineer.', cost: 3 },
  'Business Case': { action: 'Executive meeting', desc: 'Present the business case to the economic buyer.', cost: 3 },
  'Security Review': { action: 'Security review', desc: 'Satisfy the CISO. Needs a Sales Engineer and CISO relationship.', cost: 3 },
  Procurement: { action: 'Procurement process', desc: 'Vendor onboarding, legal, paperwork.', cost: 2 },
  Negotiation: { action: 'Negotiate', desc: 'Handle customer demands and agree terms.', cost: 2 },
  Closing: { action: 'Close the deal', desc: 'Ask for the signature.', cost: 3 },
};

export const FOCUS_COST = { research: 2, prospect: 3, engage: 2 };

export const LEVEL_INFO = {
  1: { name: 'STARTUP', goal: 'Close your first 2 customers', quota: 60000 },
  2: { name: 'ENTERPRISE', goal: 'Close one enterprise deal (€50K+)', quota: 250000 },
  3: { name: 'STRATEGIC', goal: 'Close one strategic deal (€250K+)', quota: 1000000 },
} as const;

const b = 'Banking', t = 'Telecom', i = 'Insurance', r = 'Retail', tech = 'Technology', a = 'Automotive';

export const COMPANIES: CompanyDef[] = [
  // ---------- LEVEL 1 : SMB / Mid-market ----------
  { id: 'nubefin', name: 'NubeFin', industry: b, region: 'Madrid', employees: 45, tier: 1, acv: 12000, difficulty: 1, cycle: 'Short', expansion: 'Medium',
    stakeholders: ['Champion'], req: { rep: 0, level: 1 }, blurb: 'Fintech startup drowning in spreadsheets. Founder-led buying, fast decisions.' },
  { id: 'tiendas_sol', name: 'Tiendas Sol', industry: r, region: 'Valencia', employees: 120, tier: 1, acv: 18000, difficulty: 1, cycle: 'Short', expansion: 'Medium',
    stakeholders: ['Champion'], req: { rep: 0, level: 1 }, blurb: 'Regional retail chain with 14 stores. Wants a modern back office.' },
  { id: 'segurplus', name: 'SegurPlus', industry: i, region: 'Barcelona', employees: 80, tier: 1, acv: 22000, difficulty: 2, cycle: 'Short', expansion: 'Low',
    stakeholders: ['Champion'], req: { rep: 0, level: 1 }, blurb: 'Insurance broker. Conservative but has budget this year.' },
  { id: 'movilcity', name: 'MovilCity', industry: t, region: 'Sevilla', employees: 60, tier: 1, acv: 15000, difficulty: 2, cycle: 'Short', expansion: 'Medium',
    stakeholders: ['Champion'], req: { rep: 0, level: 1 }, blurb: 'Local MVNO. Small team, high growth.' },
  { id: 'devhouse', name: 'DevHouse Labs', industry: tech, region: 'Madrid', employees: 35, tier: 1, acv: 10000, difficulty: 1, cycle: 'Short', expansion: 'High',
    stakeholders: ['Champion'], req: { rep: 0, level: 1 }, blurb: 'Software agency. Tech-savvy, price sensitive, great reference for tech buyers.' },
  { id: 'talleres_ruiz', name: 'Talleres Ruiz', industry: a, region: 'Bilbao', employees: 200, tier: 1, acv: 30000, difficulty: 2, cycle: 'Medium', expansion: 'High',
    stakeholders: ['Champion'], req: { rep: 5, level: 1 }, blurb: 'Auto parts supplier. Family business, loyal once won.' },
  { id: 'cajarural_norte', name: 'Caja Rural del Norte', industry: b, region: 'Oviedo', employees: 350, tier: 1, acv: 45000, difficulty: 3, cycle: 'Medium', expansion: 'High',
    stakeholders: ['Champion'], req: { rep: 10, reference: ['nubefin', 'segurplus'], level: 1 }, blurb: 'Regional cooperative bank. Needs a reference in financial services.' },

  // ---------- LEVEL 2 : Enterprise ----------
  { id: 'iberiatel', name: 'IberiaTel', industry: t, region: 'Madrid', employees: 4500, tier: 2, acv: 120000, difficulty: 3, cycle: 'Long', expansion: 'High',
    stakeholders: ['Champion', 'Technical Buyer', 'Economic Buyer'], req: { rep: 20, roles: ['ae'], level: 2 }, blurb: 'National telecom operator #3. Aggressive digital transformation program.' },
  { id: 'autonova', name: 'AutoNova', industry: a, region: 'Valladolid', employees: 3200, tier: 2, acv: 95000, difficulty: 3, cycle: 'Long', expansion: 'High',
    stakeholders: ['Champion', 'Engineering Director', 'Economic Buyer'], req: { rep: 15, reference: ['talleres_ruiz'], level: 2 }, blurb: 'Automotive OEM. Engineering-led culture. Talleres Ruiz is their supplier.' },
  { id: 'banco_iberia', name: 'Banco Iberia', industry: b, region: 'Madrid', employees: 12000, tier: 2, acv: 180000, difficulty: 4, cycle: 'Long', expansion: 'High',
    stakeholders: ['Champion', 'Technical Buyer', 'CISO', 'Economic Buyer'], req: { rep: 30, roles: ['ae', 'se'], refTier: 1, level: 2 }, blurb: 'Top-5 retail bank. Rigorous technical validation and security.' },
  { id: 'globalretail', name: 'GlobalRetail', industry: r, region: 'Barcelona', employees: 8000, tier: 2, acv: 140000, difficulty: 3, cycle: 'Long', expansion: 'High',
    stakeholders: ['Champion', 'Technical Buyer', 'Economic Buyer'], req: { rep: 20, reference: ['tiendas_sol'], roles: ['ae'], level: 2 }, blurb: 'Retail group with 600 stores in Iberia. Tiendas Sol is a great reference.' },
  { id: 'aseguradora_iberica', name: 'Aseguradora Ibérica', industry: i, region: 'Madrid', employees: 2800, tier: 2, acv: 85000, difficulty: 2, cycle: 'Medium', expansion: 'Medium',
    stakeholders: ['Champion', 'Economic Buyer', 'Technical Buyer'], req: { rep: 15, level: 2 }, blurb: 'Mid-size insurer. Fastest enterprise cycle available.' },
  { id: 'techsphere', name: 'TechSphere', industry: tech, region: 'Barcelona', employees: 1500, tier: 2, acv: 70000, difficulty: 2, cycle: 'Medium', expansion: 'High',
    stakeholders: ['Champion', 'CTO', 'Engineering Director'], req: { rep: 15, reference: ['devhouse'], level: 2 }, blurb: 'Scale-up unicorn. Engineering wants to see the product work first.' },
  { id: 'fincorp', name: 'FinCorp', industry: b, region: 'Madrid', employees: 2200, tier: 2, acv: 110000, difficulty: 3, cycle: 'Long', expansion: 'Medium',
    stakeholders: ['Champion', 'CISO', 'Economic Buyer'], req: { rep: 25, roles: ['se'], reference: ['cajarural_norte', 'nubefin'], level: 2 }, blurb: 'Asset manager. Security review is non-negotiable.' },
  { id: 'telecomone', name: 'TelecomOne', industry: t, region: 'Madrid', employees: 6000, tier: 2, acv: 150000, difficulty: 4, cycle: 'Long', expansion: 'High',
    stakeholders: ['Champion', 'Technical Buyer', 'Procurement', 'Economic Buyer'], req: { rep: 30, reference: ['movilcity', 'iberiatel'], roles: ['ae'], level: 2 }, blurb: 'Telecom #2. Procurement-heavy. Wants to see a telco reference.' },
  { id: 'motorgroup', name: 'MotorGroup Ibérica', industry: a, region: 'Zaragoza', employees: 5000, tier: 2, acv: 130000, difficulty: 3, cycle: 'Long', expansion: 'High',
    stakeholders: ['Champion', 'Engineering Director', 'Economic Buyer', 'Procurement'], req: { rep: 25, partner: true, roles: ['ae'], level: 2 }, blurb: 'Automotive manufacturer. Only buys through implementation partners.' },

  // ---------- LEVEL 3 : Strategic ----------
  { id: 'megabank', name: 'MegaBank', industry: b, region: 'Madrid · Global', employees: 95000, tier: 3, acv: 750000, difficulty: 5, cycle: 'Very long', expansion: 'High',
    stakeholders: ['Engineering Director', 'CTO', 'CISO', 'Procurement', 'CFO'], req: { rep: 60, roles: ['ae', 'se'], reference: ['banco_iberia', 'fincorp'], level: 3 }, blurb: 'Systemic global bank. The deal that makes a company. Five stakeholders, all of them matter.' },
  { id: 'digitalbank', name: 'DigitalBank', industry: b, region: 'Madrid · EU', employees: 22000, tier: 3, acv: 420000, difficulty: 4, cycle: 'Very long', expansion: 'High',
    stakeholders: ['Champion', 'CTO', 'CISO', 'Procurement', 'CFO'], req: { rep: 50, roles: ['ae', 'se'], refTier: 2, level: 3 }, blurb: 'Digital-first bank expanding across Europe. Modern stack, tough CISO.' },
  { id: 'megaretail', name: 'MegaRetail', industry: r, region: 'Barcelona · Global', employees: 150000, tier: 3, acv: 600000, difficulty: 4, cycle: 'Very long', expansion: 'High',
    stakeholders: ['Champion', 'Engineering Director', 'CTO', 'Procurement', 'CFO'], req: { rep: 55, roles: ['ae', 'se'], reference: ['globalretail'], partner: true, level: 3 }, blurb: 'Global fashion retailer. Runs vendor programs via partners only.' },
  { id: 'globalinsurance', name: 'GlobalInsurance', industry: i, region: 'Madrid · Global', employees: 60000, tier: 3, acv: 480000, difficulty: 4, cycle: 'Very long', expansion: 'Medium',
    stakeholders: ['Champion', 'Technical Buyer', 'CISO', 'Procurement', 'CFO'], req: { rep: 50, roles: ['ae', 'se'], reference: ['aseguradora_iberica'], level: 3 }, blurb: 'Insurance conglomerate. Long, formal, but pays well.' },
  { id: 'eurotelecom', name: 'EuroTelecom Group', industry: t, region: 'Madrid · EU', employees: 110000, tier: 3, acv: 900000, difficulty: 5, cycle: 'Very long', expansion: 'High',
    stakeholders: ['Engineering Director', 'CTO', 'CISO', 'Procurement', 'CFO'], req: { rep: 65, roles: ['ae', 'se'], reference: ['iberiatel', 'telecomone'], partner: true, level: 3 }, blurb: 'Pan-European telecom giant. Largest deal in the demo.' },
  { id: 'autoworld', name: 'AutoWorld Group', industry: a, region: 'Valladolid · Global', employees: 80000, tier: 3, acv: 520000, difficulty: 4, cycle: 'Very long', expansion: 'High',
    stakeholders: ['Champion', 'Engineering Director', 'CTO', 'Procurement', 'CFO'], req: { rep: 50, roles: ['ae', 'se'], reference: ['autonova', 'motorgroup'], level: 3 }, blurb: 'Global automotive group. AutoNova is one of its brands.' },
];

export const COMPANY_MAP: Record<string, CompanyDef> = Object.fromEntries(COMPANIES.map(c => [c.id, c]));

export const ACHIEVEMENTS: { id: string; name: string; desc: string }[] = [
  { id: 'first_deal', name: 'First Deal', desc: 'Close your first customer.' },
  { id: 'hunter', name: 'Hunter', desc: 'Open 5 accounts.' },
  { id: 'enterprise', name: 'Enterprise Seller', desc: 'Close your first enterprise deal.' },
  { id: 'whale', name: 'Whale', desc: 'Close a €500K+ ACV deal.' },
  { id: 'multithread', name: 'Multithreader', desc: 'Build strong relationships with 5 stakeholders in one deal.' },
  { id: 'from_zero', name: 'From Zero', desc: 'Close an account you prospected without any research.' },
  { id: 'team', name: 'Team Builder', desc: 'Hire all three roles.' },
];

export const FIRST_NAMES = ['Lucía', 'Marta', 'Carlos', 'Javier', 'Ana', 'Pablo', 'Elena', 'Sergio', 'Laura', 'Miguel', 'Nuria', 'David', 'Clara', 'Álvaro', 'Sofía', 'Diego', 'Irene', 'Rubén', 'Paula', 'Iván'];
export const LAST_NAMES = ['García', 'Martín', 'López', 'Sánchez', 'Fernández', 'Romero', 'Navarro', 'Torres', 'Serrano', 'Ortega', 'Vidal', 'Molina', 'Castro', 'Rubio', 'Iglesias', 'Delgado'];

export const STAKEHOLDER_ICON: Record<StakeholderRole, string> = {
  Champion: '★', 'Economic Buyer': '€', 'Technical Buyer': '⚙', 'Engineering Director': '⚙',
  CTO: '◆', CISO: '🛡', Procurement: '§', CFO: '€',
};
