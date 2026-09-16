import type { Account, CockpitAction, Dataset, Opportunity, Signal, Stakeholder } from '../types';
import accountsJson from './accounts.json';
import stakeholdersJson from './stakeholders.json';
import signalsJson from './signals.json';
import opportunitiesJson from './opportunities.json';
import cockpitJson from './cockpit.json';

export const dataset: Dataset = {
  accounts: accountsJson as Account[],
  stakeholders: stakeholdersJson as Stakeholder[],
  signals: signalsJson as Signal[],
  opportunities: opportunitiesJson as Opportunity[],
  cockpitActions: cockpitJson as CockpitAction[],
};

export const accountById = (id: string) => dataset.accounts.find((item) => item.id === id);
export const stakeholderById = (id: string) => dataset.stakeholders.find((item) => item.id === id);
export const opportunityById = (id: string) => dataset.opportunities.find((item) => item.id === id);
export const signalById = (id: string) => dataset.signals.find((item) => item.id === id);
export const opportunitiesForAccount = (accountId: string) => dataset.opportunities.filter((item) => item.accountId === accountId);
export const stakeholdersForAccount = (accountId: string) => dataset.stakeholders.filter((item) => item.accountId === accountId);
export const signalsForAccount = (accountId: string) => dataset.signals.filter((item) => item.accountId === accountId);
