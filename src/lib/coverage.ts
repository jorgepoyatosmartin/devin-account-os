import type { Stakeholder } from '../types';

const engagedStatuses = new Set(['Engaged', 'Champion']);
const powerRoles = ['Executive Sponsor', 'Economic Buyer', 'Champion', 'Technical Champion', 'Security', 'Procurement'] as const;

export function singleThreaded(accountId: string, stakeholders: Stakeholder[]) {
  return stakeholders.filter((stakeholder) => stakeholder.accountId === accountId && engagedStatuses.has(stakeholder.relationshipStatus)).length <= 1;
}

export function missingPowerRoles(stakeholders: Stakeholder[]) {
  const present = new Set(stakeholders.map((stakeholder) => stakeholder.powerRole || stakeholder.buyingRole).filter(Boolean));
  return powerRoles.filter((role) => ![...present].some((value) => value === role || value.toLowerCase().includes(role.toLowerCase())));
}
