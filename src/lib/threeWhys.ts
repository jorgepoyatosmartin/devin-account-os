import type { Opportunity, ValidationStatus } from '../types';
import type { Lang } from '../i18n';

export type ThreeWhysTraffic = 'green' | 'yellow' | 'red';
const keys = ['situation', 'problem', 'implication', 'whyNow', 'whyCognition'] as const;
type ValidationKey = (typeof keys)[number];

export function threeWhysStatus(op: Opportunity): { label: string; emoji: string; tone: ThreeWhysTraffic } {
  const rows = op.threeWhys.validation;
  const statuses = keys.map((key) => rows[key].status);
  if (statuses.every((status) => status === 'Confirmed' || status === 'Validated')) {
    return { label: 'Confirmed', emoji: '🟢', tone: 'green' };
  }
  const hypothesisCount = statuses.filter((status) => status === 'Hypothesis' || status === 'Unknown').length;
  if (hypothesisCount >= 3) return { label: 'Hypothesis', emoji: '🔴', tone: 'red' };
  return { label: 'Partially validated', emoji: '🟡', tone: 'yellow' };
}

export function isFullyQualified(op: Opportunity) {
  return threeWhysStatus(op).tone === 'green';
}

export function validationKeys(): ValidationKey[] {
  return [...keys];
}

export function discoveryQuestionTemplates(lang: Lang): Record<ValidationKey, string[]> {
  if (lang === 'es') {
    return {
      situation: ['¿Cómo describiría la situación actual y qué ha cambiado recientemente?'],
      problem: ['¿Qué problema concreto está frenando al equipo y cómo lo mide?'],
      implication: ['¿Qué impacto tendría mantener este problema durante los próximos meses?'],
      whyNow: ['¿Qué detonante hace necesario actuar ahora?'],
      whyCognition: ['¿Qué resultado espera conseguir y qué capacidad necesita para lograrlo?'],
    };
  }
  return {
    situation: ['How would you describe the current situation and what has changed recently?'],
    problem: ['What concrete problem is slowing the team down, and how do you measure it?'],
    implication: ['What would be the impact of leaving this problem unresolved over the next few months?'],
    whyNow: ['What trigger makes action necessary now?'],
    whyCognition: ['What outcome do you want and what capability do you need to achieve it?'],
  };
}

export function isValidationStatus(value: unknown): value is ValidationStatus {
  return value === 'Confirmed' || value === 'Validated' || value === 'Partially validated' || value === 'Hypothesis' || value === 'Unknown';
}

const rowStatusIsStrong = (status: ValidationStatus) => status === 'Confirmed' || status === 'Validated';

export function weakWhys(op: Opportunity) {
  const rows = op.threeWhys.validation;
  return {
    whyAnything: rowStatusIsStrong(rows.situation.status) && rowStatusIsStrong(rows.problem.status) && rowStatusIsStrong(rows.implication.status) ? 'strong' : 'weak',
    whyNow: rowStatusIsStrong(rows.whyNow.status) ? 'strong' : 'weak',
    whyCognition: rowStatusIsStrong(rows.whyCognition.status) ? 'strong' : 'weak',
  } as const;
}
