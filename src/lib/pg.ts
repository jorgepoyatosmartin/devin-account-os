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
import type { Lang } from '../i18n';

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
const tag = (kind: 'FACT' | 'SOURCE-BASED INTERPRETATION' | 'SALES HYPOTHESIS', lang: Lang) =>
  `[${lang === 'es' ? ({ FACT: 'HECHO', 'SOURCE-BASED INTERPRETATION': 'INTERPRETACIÓN BASADA EN FUENTES', 'SALES HYPOTHESIS': 'HIPÓTESIS COMERCIAL' } as const)[kind] : kind}]`;

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

export function accessRoute(stakeholder: Stakeholder, accountStakeholders: Stakeholder[], opportunities: Opportunity[], lang: Lang = 'en'): AccessResult {
  const text = {
    direct: lang === 'es' ? 'Directo — ya existe relación' : 'Direct — already engaged',
    opportunity: lang === 'es' ? 'Ya figura en una oportunidad' : 'Already listed on an opportunity',
    champion: lang === 'es' ? 'Vía Champion mediante' : 'Champion path via',
    internal: lang === 'es' ? 'Vía interna mediante' : 'Internal path via',
    executive: lang === 'es' ? 'Patrocinio ejecutivo mediante' : 'Executive sponsorship via',
    none: lang === 'es' ? 'No se ha identificado una relación existente' : 'No existing relationship identified',
  };
  if (engaged(stakeholder)) return { route: 'Existing customer relationship', explanation: text.direct };
  if (opportunities.some((item) => item.stakeholderIds.includes(stakeholder.id))) return { route: 'Existing opportunity', explanation: text.opportunity };
  const connectors = accountStakeholders.filter((person) => {
    const connectorRole = role(person);
    return nonHypothesisRole(person) && engaged(person) && ['Champion', 'Technical Champion', 'Coach'].includes(connectorRole);
  });
  const related = connectors.find((person) => person.id === stakeholder.reportsTo || stakeholder.reportsTo === person.id || (person.reportsTo && person.reportsTo === stakeholder.reportsTo));
  if (related) return { route: 'Champion introduction', viaId: related.id, explanation: `${text.champion} ${related.name}` };
  if (connectors[0]) return { route: 'Internal introduction', viaId: connectors[0].id, explanation: `${text.internal} ${connectors[0].name}` };
  const executive = accountStakeholders.find((person) => nonHypothesisRole(person) && engaged(person) && ['Economic Buyer', 'Executive Sponsor'].includes(role(person)));
  if (executive) return { route: 'Executive introduction', viaId: executive.id, explanation: `${text.executive} ${executive.name}` };
  return { route: 'Direct outreach', explanation: text.none };
}

export function whyHighTarget(
  stakeholder: Stakeholder,
  account: Account,
  initiative?: Account['initiatives'][number],
  useCases: UseCase[] = [],
  signals: Signal[] = [],
  opportunities: Opportunity[] = [],
  lang: Lang = 'en',
): string {
  const parts: string[] = [];
  const sourced = stakeholder.dataOrigin === 'TERRITORY PLAN' || stakeholder.dataOrigin === 'ORIGINAL EXCEL DATA';
  if (sourced && stakeholder.powerRole && stakeholder.roleIsHypothesis !== true && stakeholder.powerRole !== 'Unknown') {
    parts.push(`${tag('FACT', lang)} ${lang === 'es' ? 'Designado como' : 'Named'} ${stakeholder.powerRole} ${lang === 'es' ? 'en el ' : 'in '}${stakeholder.dataOrigin === 'TERRITORY PLAN' ? 'Territory Plan' : 'Original Excel Data'}`);
  }
  if (sourced && stakeholder.level && stakeholder.level !== 'Unknown') parts.push(`${tag('FACT', lang)} ${stakeholder.level} ${lang === 'es' ? 'en el ' : 'level in '}${stakeholder.dataOrigin === 'TERRITORY PLAN' ? 'Territory Plan' : 'Original Excel Data'}`);
  if (initiative) parts.push(`${tag('SOURCE-BASED INTERPRETATION', lang)} ${lang === 'es' ? 'Vinculado a la iniciativa' : 'Linked to initiative'} ${initiative.name}`);
  if (known(stakeholder.potentialPain)) parts.push(`${tag('SALES HYPOTHESIS', lang)} ${lang === 'es' ? 'Problema potencial:' : 'Potential pain:'} ${stakeholder.potentialPain}`);
  if (stakeholder.championPotential === 'High') parts.push(`${tag('SALES HYPOTHESIS', lang)} ${lang === 'es' ? 'Alto potencial como Champion' : 'High champion potential'}`);
  if (stakeholder.roleIsHypothesis === true && stakeholder.powerRole) parts.push(`${tag('SALES HYPOTHESIS', lang)} ${lang === 'es' ? 'Posible rol de' : 'Possible'} ${stakeholder.powerRole}`);
  return parts.join(' · ') || 'UNKNOWN — VALIDATION REQUIRED';
}

export function whyMeet(
  stakeholder: Stakeholder,
  initiative: Account['initiatives'][number] | undefined,
  useCases: UseCase[],
  play: SalesPlay,
  businessPain = '',
  lang: Lang = 'en',
): string {
  const pain = known(businessPain) ? businessPain : known(stakeholder.potentialPain) ? stakeholder.potentialPain : initiative?.potentialProblem;
  if (!initiative && !known(pain)) return lang === 'es' ? 'DESCONOCIDO — primero hace falta una iniciativa o un problema' : 'UNKNOWN — needs initiative or pain first';
  const useCase = useCases[0]?.name || VALIDATION;
  return `${tag('SALES HYPOTHESIS', lang)} ${lang === 'es' ? `El stakeholder con rol ${role(stakeholder)} vinculado a ${initiative?.name || 'una iniciativa no validada'} podría estar explorando ${pain || VALIDATION}. ${play} podría conectarse con ${useCase}. (HIPÓTESIS — VALIDACIÓN REQUERIDA)` : `${role(stakeholder)} stakeholder connected to ${initiative?.name || 'an unvalidated initiative'} may be exploring ${pain || VALIDATION}. ${play} could map to ${useCase}. (HYPOTHESIS — VALIDATION REQUIRED)`}`;
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

export function suggestAction(view: Pick<PgRecord, 'status' | 'salesPlay' | 'businessPain' | 'initiativeId' | 'accessRoute' | 'accessViaStakeholderId'> & { accessExplanation?: string; opportunityId?: string }, stakeholder: Stakeholder, via?: Stakeholder, opportunity?: Opportunity, initiative?: Account['initiatives'][number], signals: Signal[] = [], lang: Lang = 'en'): string {
  const prefix = tag('SALES HYPOTHESIS', lang);
  if (view.status === 'OUTREACH') return `${prefix} ${lang === 'es' ? 'Hacer seguimiento (día +5) con' : 'Follow up (day +5) with'} ${stakeholder.name}`;
  if (view.status === 'MEETING') return `${prefix} ${lang === 'es' ? 'Preparar reunión: validar los 3 WHYS con' : 'Prepare meeting: validate 3 Whys with'} ${stakeholder.name}`;
  const path = view.accessRoute;
  if ((path === 'Champion introduction' || path === 'Internal introduction') && via) return `${prefix} ${lang === 'es' ? 'Pedir a' : 'Ask'} ${via.name} ${lang === 'es' ? 'que nos presente a' : 'for an introduction to'} ${stakeholder.name} (${view.salesPlay})`;
  if (path === 'Executive introduction' && via) return `${prefix} ${lang === 'es' ? 'Pedir a' : 'Ask'} ${via.name} (EB) ${lang === 'es' ? 'que patrocine una reunión con' : 'to sponsor a meeting with'} ${stakeholder.name}`;
  if (path === 'Existing opportunity' && opportunity) return `${prefix} ${lang === 'es' ? 'Invitar a' : 'Invite'} ${stakeholder.name} ${lang === 'es' ? 'a la próxima sesión de trabajo sobre' : 'to the next working session on'} ${opportunity.name}`;
  if (path === 'Existing customer relationship') return `${prefix} ${lang === 'es' ? 'Programar discovery con' : 'Schedule discovery with'} ${stakeholder.name} ${lang === 'es' ? 'para validar' : 'to validate'} ${known(view.businessPain) ? view.businessPain : known(stakeholder.potentialPain) ? stakeholder.potentialPain : lang === 'es' ? 'el problema potencial (aún DESCONOCIDO)' : 'the potential pain (still UNKNOWN)'}`;
  const reference = initiative?.name || signals.sort((a, b) => b.date.localeCompare(a.date))[0]?.signal || 'the account priority';
  return `${prefix} ${lang === 'es' ? 'Enviar un mensaje personalizado de LinkedIn a' : 'Send personalized LinkedIn message to'} ${stakeholder.name} ${lang === 'es' ? 'mencionando' : 'referencing'} ${reference}`;
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

export function resolvePg(record: PgRecord, data: Dataset, lang: Lang = 'en'): PgResolved {
  const account = data.accounts.find((item) => item.id === record.accountId)!;
  const stakeholder = data.stakeholders.find((item) => item.id === record.stakeholderId)!;
  const initiative = record.initiativeId ? account.initiatives.find((item) => item.id === record.initiativeId) : undefined;
  const selectedUseCases = account.useCases.filter((item) => record.useCaseIds.includes(item.id));
  const useCases = selectedUseCases.length ? selectedUseCases : relevantUseCases(account, record.salesPlay, record.initiativeId);
  const signals = data.signals.filter((item) => item.accountId === account.id && record.signalIds.includes(item.id));
  const access = accessRoute(stakeholder, data.stakeholders.filter((item) => item.accountId === account.id), data.opportunities.filter((item) => item.accountId === account.id), lang);
  const linkedOpportunity = data.opportunities.find((item) => item.id === record.opportunityId) || data.opportunities.find((item) => item.stakeholderIds.includes(stakeholder.id));
  const computed: PgRecord = {
    ...record,
    accessRoute: record.accessRoute !== 'Direct outreach' ? record.accessRoute : access.route,
    accessViaStakeholderId: record.accessViaStakeholderId || access.viaId,
    whyHighTarget: record.whyHighTarget || whyHighTarget(stakeholder, account, initiative, useCases, signals, data.opportunities, lang),
    whyMeet: record.whyMeet || whyMeet(stakeholder, initiative, useCases, record.salesPlay, record.businessPain, lang),
    howGetMeeting: record.howGetMeeting || `${tag(access.route === 'Direct outreach' ? 'SALES HYPOTHESIS' : 'SOURCE-BASED INTERPRETATION', lang)} ${access.explanation}`,
    action: record.action || suggestAction({ ...record, accessRoute: record.accessRoute !== 'Direct outreach' ? record.accessRoute : access.route, accessViaStakeholderId: record.accessViaStakeholderId || access.viaId }, stakeholder, data.stakeholders.find((item) => item.id === (record.accessViaStakeholderId || access.viaId)), linkedOpportunity, initiative, signals, lang),
    priority: record.priorityIsAuto ? priority({ ...record, accessRoute: record.accessRoute !== 'Direct outreach' ? record.accessRoute : access.route }, stakeholder, useCases, data.signals.filter((item) => item.accountId === account.id)) : record.priority,
    message: record.message || '',
  };
  const result = { ...computed, account, stakeholder, initiative, useCases, signals, accessExplanation: access.explanation };
  if (!result.message) result.message = generateMessage(result, { initiative, signal: signals[0], useCase: useCases[0], via: data.stakeholders.find((item) => item.id === result.accessViaStakeholderId) }, result.messageLang);
  return result;
}

const validation = (text: string, today: string, lang: Lang): ValidationRow => ({
  status: known(text) ? 'Hypothesis' : 'Unknown',
  evidence: lang === 'es' ? 'Creado desde un registro PG' : 'Created from PG record',
  source: 'PG',
  lastUpdated: today,
});

export function convertToOpportunity(view: PgResolved, data: Dataset, lang: Lang = 'en'): Opportunity {
  const today = new Date().toISOString().slice(0, 10);
  const initiative = view.initiative;
  const useCase = view.useCases[0];
  const via = view.accessViaStakeholderId;
  const participants = [view.stakeholderId, ...(via && via !== view.stakeholderId ? [via] : [])];
  const champion = [view.stakeholder, data.stakeholders.find((item) => item.id === via)].find((item) => item && nonHypothesisRole(item) && ['Champion', 'Technical Champion', 'Business Champion', 'Coach'].includes(role(item)));
  const buyer = [view.stakeholder, data.stakeholders.find((item) => item.id === via)].find((item) => item && nonHypothesisRole(item) && ['Economic Buyer', 'Executive Sponsor'].includes(role(item)));
  const textSituation = initiative?.currentSituation || VALIDATION;
  const textProblem = view.businessPain || initiative?.potentialProblem || VALIDATION;
  const textImplication = initiative?.potentialImplication || VALIDATION;
  const textTrigger = view.signals[0]?.signal || VALIDATION;
  const opRows = {
    situation: validation(textSituation, today, lang),
    problem: validation(textProblem, today, lang),
    implication: validation(textImplication, today, lang),
    whyNow: validation(textTrigger, today, lang),
    whyCognition: validation(useCase?.whyCognition || VALIDATION, today, lang),
  };
  const generic = (section: string, subject: string) => lang === 'es' ? `¿Qué validarías sobre ${subject} en la conversación de ${section.toLowerCase()}?` : `What would you validate about ${subject} in the ${section.toLowerCase()} discussion?`;
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
