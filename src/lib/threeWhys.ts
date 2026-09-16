import type { Opportunity, ValidationStatus } from '../types';

export type ThreeWhysTraffic = 'green' | 'yellow' | 'red';
const keys = ['situation', 'problem', 'implication', 'whyNow', 'whyCognition'] as const;
type ValidationKey = (typeof keys)[number];

export function threeWhysStatus(op: Opportunity): { label: string; emoji: string; tone: ThreeWhysTraffic } {
  const rows = op.threeWhys.validation;
  const statuses = keys.map((key) => rows[key].status);
  if (statuses.every((status) => status === 'Confirmed' || status === 'Validated')) {
    return { label: 'Confirmed', emoji: '🟢', tone: 'green' };
  }
  const hypothesisCount = statuses.filter((status) => status === 'Hypothesis').length;
  if (hypothesisCount >= 3) return { label: 'Hypothesis', emoji: '🔴', tone: 'red' };
  return { label: 'Partially validated', emoji: '🟡', tone: 'yellow' };
}

export function isFullyQualified(op: Opportunity) {
  return threeWhysStatus(op).tone === 'green';
}

export function validationKeys(): ValidationKey[] {
  return [...keys];
}

export function isValidationStatus(value: unknown): value is ValidationStatus {
  return value === 'Confirmed' || value === 'Validated' || value === 'Partially validated' || value === 'Hypothesis';
}
