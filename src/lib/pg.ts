import type {
  AccessRoute,
  Account,
  Dataset,
  Opportunity,
  PgPriority,
  PgRecord,
  SalesPlay,
  Signal,
  Stakeholder,
  UseCase,
  ValidationRow,
} from '../types';

export type AccessResult = { route: AccessRoute; viaId?: string; explanation: string };
export type PgResolved = PgRecord & {
  account: Account;
  stakeholder: Stakeholder;
  initiative?: Account['initiatives'][number];
  useCases: UseCase[];
  signals: Signal[];
  accessExplanation: string;
};

const UNKNOWN = 'UNKNOWN';
const VALIDATION = 'TBD — VALIDATION REQUIRED';
const nonHypothesisRole = (person: Stakeholder) => person.roleIsHypothesis !== true;
const engaged = (person: Stakeholder) => person.relationshipStatus === 'Engaged' || person.relationshipStatus === 'Champion';
const role = (person: Stakeholder) => person.powerRole || person.buyingRole || 'Unknown';
const known = (value?: string) => Boolean(value && value.trim() && !value.trim().startsWith(UNKNOWN) && !value.trim().startsWith(VALIDATION));
const firstName = (name: string) => name.trim().split(/\s+/)[0];
const dateWithin90Days = (date: string) => {
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) && Date.now() - parsed <= 90 * 24 * 60 * 60 * 1000 && parsed <= Date.now();
};

export function suggestPlay(account: Account, initiative?: Account['initiatives'][number], useCases: UseCase[] = []): SalesPlay {
  const categories = new Set(useCases.map((item) => item.category));
  if (categories.has('Migrations')) return /cloud/i.test(initiative?.area || '') ? 'Cloud Migration' : 'Legacy Modernization';
  if (categories.has('Code Quality') || categories.has('Automations')) return 'Quality & Regulatory Delivery';
  if (categories.has('Feature Development') || categories.has('Advanced workflows')) return 'Developer Productivity';
  if (categories.has('Data & Analytics')) return 'Data & AI Product Engineering';
  if (/ai|agentic/i.test(initiative?.area || '')) return 'AI Engineering';
  return 'UNKNOWN';
}

const playCategories: Partial<Record<SalesPlay, string[]>> = {
  'Cloud Migration': ['Migrations'],
  'Legacy Modernization': ['Migrations', 'Code Quality'],
  'Quality & Regulatory Delivery': ['Code Quality', 'Automations'],
  'Developer Productivity': ['Feature Development', 'Advanced workflows'],
  'Data & AI Product Engineering': ['Data & Analytics'],
  'AI Engineering': ['Feature Development', 'Advanced workflows', 'Data & Analytics'],
};

export function relevantUseCases(account: Account, play: SalesPlay, initiativeId?: string): UseCase[] {
  const categories = playCategories[play] || [];
  return account.useCases.filter((item) => (initiativeId && item.initiativeId === initiativeId) || Boolean(item.category && categories.includes(item.category)));
}

export function accessRoute(stakeholder: Stakeholder, accountStakeholders: Stakeholder[], opportunities: Opportunity[]): AccessResult {
  if (engaged(stakeholder)) return { route: 'Existing customer relationship', explanation: 'Direct — already engaged' };
  if (opportunities.some((item) => item.stakeholderIds.includes(stakeholder.id))) return { route: 'Existing opportunity', explanation: 'Already listed on an opportunity' };
  const connectors = accountStakeholders.filter((person) => {
    const connectorRole = role(person);
    return nonHypothesisRole(person) && engaged(person) && ['Champion', 'Technical Champion', 'Coach'].includes(connectorRole);
  });
  const related = connectors.find((person) => person.id === stakeholder.reportsTo || stakeholder.reportsTo === person.id || (person.reportsTo && person.reportsTo === stakeholder.reportsTo));
  if (related) return { route: 'Champion introduction', viaId: related.id, explanation: `Champion path via ${related.name}` };
  if (connectors[0]) return { route: 'Internal introduction', viaId: connectors[0].id, explanation: `Internal path via ${connectors[0].name}` };
  const executive = accountStakeholders.find((person) => nonHypothesisRole(person) && engaged(person) && ['Economic Buyer', 'Executive Sponsor'].includes(role(person)));
  if (executive) return { route: 'Executive introduction', viaId: executive.id, explanation: `Executive sponsorship via ${executive.name}` };
  return { route: 'Direct outreach', explanation: 'No existing relationship identified' };
}

export function whyHighTarget(
  stakeholder: Stakeholder,
  account: Account,
  initiative?: Account['initiatives'][number],
  useCases: UseCase[] = [],
  signals: Signal[] = [],
  opportunities: Opportunity[] = [],
): string {
  const parts: string[] = [];
  const sourced = stakeholder.dataOrigin === 'TERRITORY PLAN' || stakeholder.dataOrigin === 'ORIGINAL EXCEL DATA';
  if (sourced && stakeholder.powerRole && stakeholder.roleIsHypothesis !== true && stakeholder.powerRole !== 'Unknown') {
    parts.push(`[FACT] Named ${stakeholder.powerRole} in ${stakeholder.dataOrigin === 'TERRITORY PLAN' ? 'Territory Plan' : 'Original Excel Data'}`);
  }
  if (sourced && stakeholder.level && stakeholder.level !== 'Unknown') parts.push(`[FACT] ${stakeholder.level} level in ${stakeholder.dataOrigin === 'TERRITORY PLAN' ? 'Territory Plan' : 'Original Excel Data'}`);
  if (initiative) parts.push(`[SOURCE-BASED INTERPRETATION] Linked to initiative ${initiative.name}`);
  if (known(stakeholder.potentialPain)) parts.push(`[SALES HYPOTHESIS] Potential pain: ${stakeholder.potentialPain}`);
  if (stakeholder.championPotential === 'High') parts.push('[SALES HYPOTHESIS] High champion potential');
  if (stakeholder.roleIsHypothesis === true && stakeholder.powerRole) parts.push(`[SALES HYPOTHESIS] Possible ${stakeholder.powerRole} role`);
  return parts.join(' · ') || 'UNKNOWN — VALIDATION REQUIRED';
}

export function whyMeet(
  stakeholder: Stakeholder,
  initiative: Account['initiatives'][number] | undefined,
  useCases: UseCase[],
  play: SalesPlay,
  businessPain = '',
): string {
  const pain = known(businessPain) ? businessPain : known(stakeholder.potentialPain) ? stakeholder.potentialPain : initiative?.potentialProblem;
  if (!initiative && !known(pain)) return 'UNKNOWN — needs initiative or pain first';
  const useCase = useCases[0]?.name || VALIDATION;
  return `[SALES HYPOTHESIS] ${role(stakeholder)} stakeholder connected to ${initiative?.name || 'an unvalidated initiative'} may be exploring ${pain || VALIDATION}. ${play} could map to ${useCase}. (HYPOTHESIS — VALIDATION REQUIRED)`;
}

export function priority(view: Pick<PgRecord, 'initiativeId' | 'businessPain' | 'accessRoute'>, stakeholder: Stakeholder, useCases: UseCase[], signals: Signal[]): PgPriority {
  let score = view.initiativeId ? 2 : 0;
  const relevance = useCases.map((item) => item.relevance);
  if (relevance.includes('HIGH')) score += 2;
  else if (relevance.includes('MEDIUM')) score += 1;
  if (['Board / CEO', 'Executive Committee', 'Senior Leadership'].includes(stakeholder.level || '')) score += 1;
  if (['Economic Buyer', 'Champion', 'Technical Champion', 'Executive Sponsor'].includes(role(stakeholder))) score += 1;
  if (view.accessRoute !== 'Direct outreach') score += 1;
  if (signals.some((item) => dateWithin90Days(item.date))) score += 1;
  if (known(view.businessPain) || known(stakeholder.potentialPain)) score += 1;
  return score >= 6 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
}

export function suggestAction(view: Pick<PgRecord, 'status' | 'salesPlay' | 'businessPain' | 'initiativeId' | 'accessRoute' | 'accessViaStakeholderId'> & { accessExplanation?: string; opportunityId?: string }, stakeholder: Stakeholder, via?: Stakeholder, opportunity?: Opportunity, initiative?: Account['initiatives'][number], signals: Signal[] = []): string {
  if (view.status === 'OUTREACH') return `[SALES HYPOTHESIS] Follow up (day +5) with ${stakeholder.name}`;
  if (view.status === 'MEETING') return `[SALES HYPOTHESIS] Prepare meeting: validate 3 Whys with ${stakeholder.name}`;
  const path = view.accessRoute;
  if ((path === 'Champion introduction' || path === 'Internal introduction') && via) return `[SALES HYPOTHESIS] Ask ${via.name} for an introduction to ${stakeholder.name} (${view.salesPlay})`;
  if (path === 'Executive introduction' && via) return `[SALES HYPOTHESIS] Ask ${via.name} (EB) to sponsor a meeting with ${stakeholder.name}`;
  if (path === 'Existing opportunity' && opportunity) return `[SALES HYPOTHESIS] Invite ${stakeholder.name} to the next working session on ${opportunity.name}`;
  if (path === 'Existing customer relationship') return `[SALES HYPOTHESIS] Schedule discovery with ${stakeholder.name} to validate ${known(view.businessPain) ? view.businessPain : known(stakeholder.potentialPain) ? stakeholder.potentialPain : 'the potential pain (still UNKNOWN)'}`;
  const reference = initiative?.name || signals.sort((a, b) => b.date.localeCompare(a.date))[0]?.signal || 'the account priority';
  return `[SALES HYPOTHESIS] Send personalized LinkedIn message to ${stakeholder.name} referencing ${reference}`;
}

export function generateMessage(view: PgResolved, ctx: { initiative?: Account['initiatives'][number]; signal?: Signal; useCase?: UseCase; via?: Stakeholder }, lang: 'es' | 'en' = 'es'): string {
  const person = view.stakeholder;
  const target = view.accessRoute === 'Champion introduction' && ctx.via ? ctx.via : person;
  const initiative = ctx.initiative?.name || ctx.signal?.signal || view.account.name;
  const pain = known(view.businessPain) ? view.businessPain : known(person.potentialPain) ? person.potentialPain : lang === 'en' ? 'this engineering priority' : 'esta prioridad de ingeniería';
  const useCase = ctx.useCase?.name || view.salesPlay;
  if (lang === 'en') {
    return view.accessRoute === 'Champion introduction' && ctx.via
      ? `Hi ${firstName(ctx.via.name)}. I am mapping a ${view.salesPlay} conversation around ${initiative} and believe ${person.name} could be relevant. Could you introduce us to discuss whether ${pain} is on their agenda? We would bring a concrete ${useCase} hypothesis. Would you be open to a 30-minute introduction next week?`
      : `Hi ${firstName(target.name)}. I am mapping a ${view.salesPlay} conversation around ${initiative}. Is ${pain} currently a priority for your team? We see a potential fit with ${useCase}. Would you be open to a 30-minute conversation next week?`;
  }
  return view.accessRoute === 'Champion introduction' && ctx.via
    ? `Hola ${firstName(ctx.via.name)}. Estoy preparando una conversación de ${view.salesPlay} sobre ${initiative} y creo que ${person.name} puede ser una persona relevante. ¿Podrías presentarnos para validar si ${pain} está entre sus prioridades? Llevaríamos una hipótesis concreta sobre ${useCase}. ¿Te encajaría una introducción de 30 minutos la próxima semana?`
    : `Hola ${firstName(target.name)}. Estoy preparando una conversación de ${view.salesPlay} sobre ${initiative}. ¿${pain} es actualmente una prioridad para vuestro equipo? Vemos un posible encaje con ${useCase}. ¿Te encajaría una conversación de 30 minutos la próxima semana?`;
}

export function resolvePg(record: PgRecord, data: Dataset): PgResolved {
  const account = data.accounts.find((item) => item.id === record.accountId)!;
  const stakeholder = data.stakeholders.find((item) => item.id === record.stakeholderId)!;
  const initiative = record.initiativeId ? account.initiatives.find((item) => item.id === record.initiativeId) : undefined;
  const selectedUseCases = account.useCases.filter((item) => record.useCaseIds.includes(item.id));
  const useCases = selectedUseCases.length ? selectedUseCases : relevantUseCases(account, record.salesPlay, record.initiativeId);
  const signals = data.signals.filter((item) => item.accountId === account.id && record.signalIds.includes(item.id));
  const access = accessRoute(stakeholder, data.stakeholders.filter((item) => item.accountId === account.id), data.opportunities.filter((item) => item.accountId === account.id));
  const linkedOpportunity = data.opportunities.find((item) => item.id === record.opportunityId) || data.opportunities.find((item) => item.stakeholderIds.includes(stakeholder.id));
  const computed: PgRecord = {
    ...record,
    accessRoute: record.accessRoute !== 'Direct outreach' ? record.accessRoute : access.route,
    accessViaStakeholderId: record.accessViaStakeholderId || access.viaId,
    whyHighTarget: record.whyHighTarget || whyHighTarget(stakeholder, account, initiative, useCases, signals, data.opportunities),
    whyMeet: record.whyMeet || whyMeet(stakeholder, initiative, useCases, record.salesPlay, record.businessPain),
    howGetMeeting: record.howGetMeeting || `[${access.route === 'Direct outreach' ? 'SALES HYPOTHESIS' : 'SOURCE-BASED INTERPRETATION'}] ${access.explanation}`,
    action: record.action || suggestAction({ ...record, accessRoute: record.accessRoute !== 'Direct outreach' ? record.accessRoute : access.route, accessViaStakeholderId: record.accessViaStakeholderId || access.viaId }, stakeholder, data.stakeholders.find((item) => item.id === (record.accessViaStakeholderId || access.viaId)), linkedOpportunity, initiative, signals),
    priority: record.priorityIsAuto ? priority({ ...record, accessRoute: record.accessRoute !== 'Direct outreach' ? record.accessRoute : access.route }, stakeholder, useCases, data.signals.filter((item) => item.accountId === account.id)) : record.priority,
    message: record.message || '',
  };
  const result = { ...computed, account, stakeholder, initiative, useCases, signals, accessExplanation: access.explanation };
  if (!result.message) result.message = generateMessage(result, { initiative, signal: signals[0], useCase: useCases[0], via: data.stakeholders.find((item) => item.id === result.accessViaStakeholderId) }, result.messageLang);
  return result;
}

const validation = (text: string, today: string): ValidationRow => ({
  status: known(text) ? 'Hypothesis' : 'Unknown',
  evidence: 'Created from PG record',
  source: 'PG',
  lastUpdated: today,
});

export function convertToOpportunity(view: PgResolved, data: Dataset): Opportunity {
  const today = new Date().toISOString().slice(0, 10);
  const initiative = view.initiative;
  const useCase = view.useCases[0];
  const via = view.accessViaStakeholderId;
  const participants = [view.stakeholderId, via].filter((id): id is string => Boolean(id && id !== view.stakeholderId));
  const champion = [view.stakeholder, data.stakeholders.find((item) => item.id === via)].find((item) => item && nonHypothesisRole(item) && ['Champion', 'Technical Champion', 'Business Champion', 'Coach'].includes(role(item)));
  const buyer = [view.stakeholder, data.stakeholders.find((item) => item.id === via)].find((item) => item && nonHypothesisRole(item) && ['Economic Buyer', 'Executive Sponsor'].includes(role(item)));
  const textSituation = initiative?.currentSituation || VALIDATION;
  const textProblem = view.businessPain || initiative?.potentialProblem || VALIDATION;
  const textImplication = initiative?.potentialImplication || VALIDATION;
  const textTrigger = view.signals[0]?.signal || VALIDATION;
  const opRows = {
    situation: validation(textSituation, today),
    problem: validation(textProblem, today),
    implication: validation(textImplication, today),
    whyNow: validation(textTrigger, today),
    whyCognition: validation(useCase?.whyCognition || VALIDATION, today),
  };
  const generic = (section: string, subject: string) => `What would you validate about ${subject} in the ${section.toLowerCase()} discussion?`;
  return {
    id: `opp-pg-${view.id}-${Date.now()}`,
    accountId: view.accountId,
    name: `${view.account.name} — ${view.salesPlay} (${view.stakeholder.name})`,
    businessUnit: view.stakeholder.businessUnit || view.stakeholder.functionArea,
    initiativeId: view.initiativeId,
    useCase: useCase?.name || VALIDATION,
    potentialValue: VALIDATION,
    stage: 'Identified',
    stakeholderIds: participants,
    ...(champion ? { championId: champion.id } : {}),
    ...(buyer ? { economicBuyerId: buyer.id } : {}),
    competition: view.account.competitiveIntel?.[0]?.potentialCompetitor || VALIDATION,
    meddpicc: {
      metrics: VALIDATION,
      economicBuyer: buyer?.name || VALIDATION,
      decisionCriteria: VALIDATION,
      decisionProcess: VALIDATION,
      paperProcess: VALIDATION,
      identifyPain: textProblem,
      champion: champion?.name || VALIDATION,
      competition: view.account.competitiveIntel?.[0]?.potentialCompetitor || VALIDATION,
    },
    nextAction: view.action,
    evidence: initiative?.evidence || [],
    confidence: 'Low',
    threeWhys: {
      whyAnything: { situation: textSituation, problem: textProblem, implication: textImplication },
      whyNow: { trigger: textTrigger, timing: VALIDATION, urgency: VALIDATION },
      whyCognition: { customerPain: textProblem, cognitionCapability: useCase?.whyCognition || VALIDATION, businessOutcome: useCase?.businessOutcome || VALIDATION },
      validation: opRows,
      discoveryQuestions: {
        situation: [generic('Situation', initiative?.name || view.account.name)],
        problem: [generic('Problem', textProblem)],
        implication: [generic('Implication', textImplication)],
        whyNow: [generic('Why now', textTrigger)],
        whyCognition: [generic('Why Cognition', useCase?.name || view.salesPlay)],
      },
    },
  };
}
