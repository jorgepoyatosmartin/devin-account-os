import { useCallback, useState } from 'react';
import type { CompPlan, Dataset, Hypothesis, MeetingNote, Opportunity, OpportunityV2, PgRecord, PgScoreInputs, Stakeholder, Task } from './types';
import { dataset as sourceDataset } from './data';
import { migrateOpportunity } from './prp/migrate';
import { isCompPlan } from './lib/compPlan';

export type OverrideMap = Record<string, unknown>;
const OVERRIDES_KEY = 'cognition-pipeline-overrides';
const NOTES_KEY = 'cognition-pipeline-meeting-notes';
const TASKS_KEY = 'cognition-pipeline-tasks';
const PG_EDITS_KEY = 'cognition-pipeline-pg';
const PG_CUSTOM_KEY = 'cognition-pipeline-pg-custom';
const CUSTOM_OPPORTUNITIES_KEY = 'cognition-pipeline-custom-opps';
export const OPPORTUNITIES_V2_KEY = 'cognition-pipeline-opps-v2';
export const COMP_PLAN_KEY = 'cognition-pipeline-comp-plan';
export const SIGNAL_META_KEY = 'cognition-pipeline-signal-meta';
export const HYPOTHESES_KEY = 'cognition-pipeline-hypotheses';
export const OPPORTUNITIES_V2_SNAPSHOT_VERSION = 1;

export interface OpportunityV2Snapshot {
  version: number;
  items: OpportunityV2[];
}

const load = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const overrideKey = (entityId: string, path: string) => `${entityId}.${path}`;

export function mergeOverrides<T extends object>(entity: T, entityId: string, overrides: OverrideMap): T {
  const result = structuredClone(entity);
  Object.entries(overrides).forEach(([key, value]) => {
    const prefix = `${entityId}.`;
    if (!key.startsWith(prefix)) return;
    const path = key.slice(prefix.length).split('.');
    let target: Record<string, unknown> = result as Record<string, unknown>;
    path.forEach((segment, index) => {
      if (index === path.length - 1) target[segment] = value;
      else target = (target[segment] ??= {}) as Record<string, unknown>;
    });
  });
  return result;
}

function isOpportunityV2(value: unknown): value is OpportunityV2 {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as OpportunityV2).id === 'string'
    && typeof (value as OpportunityV2).stageId === 'string',
  );
}

export function migrateOpportunitySnapshot(
  legacyOpportunities: Opportunity[],
  customOpportunities: Opportunity[],
  stakeholders: Stakeholder[],
  snapshot: unknown,
  version = OPPORTUNITIES_V2_SNAPSHOT_VERSION,
): OpportunityV2Snapshot {
  const migrated = [...legacyOpportunities, ...customOpportunities]
    .map((opportunity) => migrateOpportunity(opportunity, stakeholders));
  const items = new Map(migrated.map((opportunity) => [opportunity.id, opportunity]));
  const savedItems = snapshot && typeof snapshot === 'object' && Array.isArray((snapshot as OpportunityV2Snapshot).items)
    ? (snapshot as OpportunityV2Snapshot).items.filter(isOpportunityV2)
    : [];

  savedItems.forEach((saved) => {
    const base = items.get(saved.id);
    items.set(saved.id, base ? { ...base, ...saved } : saved);
  });

  return { version, items: [...items.values()] };
}

export function mergeDataset(
  dataset: Dataset,
  overrides: OverrideMap,
  pgEdits: Record<string, Partial<PgRecord>> = {},
  pgCustom: PgRecord[] = [],
  customOpportunities: Opportunity[] = [],
): Dataset {
  const mergedCustomOpportunities = customOpportunities.map((item) => mergeOverrides(item, item.id, overrides));
  const mergedPg = [...dataset.pg, ...pgCustom].map((item) => ({ ...item, ...(pgEdits[item.id] || {}) }));
  return {
    accounts: dataset.accounts.map((item) => mergeOverrides(item, item.id, overrides)),
    stakeholders: dataset.stakeholders.map((item) => mergeOverrides(item, item.id, overrides)),
    signals: dataset.signals.map((item) => mergeOverrides(item, item.id, overrides)),
    opportunities: [...dataset.opportunities.map((item) => mergeOverrides(item, item.id, overrides)), ...mergedCustomOpportunities],
    cockpitActions: dataset.cockpitActions.map((item) => mergeOverrides(item, item.id, overrides)),
    pg: mergedPg,
  };
}

export function useOverrides() {
  const [overrides, setOverrides] = useState<OverrideMap>(() => load(OVERRIDES_KEY, {}));
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>(() => load(NOTES_KEY, []));
  const [tasks, setTasks] = useState<Task[]>(() => load(TASKS_KEY, []));
  const [pgEdits, setPgEdits] = useState<Record<string, Partial<PgRecord>>>(() => load(PG_EDITS_KEY, {}));
  const [pgCustom, setPgCustom] = useState<PgRecord[]>(() => load(PG_CUSTOM_KEY, []));
  const [signalMeta, setSignalMeta] = useState<Record<string, Partial<Pick<Dataset['signals'][number], 'productIds' | 'salesPlayId' | 'scoreInputs'>>>>(() => load(SIGNAL_META_KEY, {}));
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>(() => load(HYPOTHESES_KEY, []));
  const [customOpportunities, setCustomOpportunities] = useState<Opportunity[]>(() => load(CUSTOM_OPPORTUNITIES_KEY, []));
  const [opportunitiesV2, setOpportunitiesV2] = useState<OpportunityV2[]>(() => {
    const legacyOpportunities = sourceDataset.opportunities.map((item) => mergeOverrides(item, item.id, overrides));
    const custom = customOpportunities.map((item) => mergeOverrides(item, item.id, overrides));
    const stakeholders = sourceDataset.stakeholders.map((item) => mergeOverrides(item, item.id, overrides));
    return migrateOpportunitySnapshot(
      legacyOpportunities,
      custom,
      stakeholders,
      load<unknown>(OPPORTUNITIES_V2_KEY, null),
    ).items;
  });
  const [compPlan, setCompPlanState] = useState<CompPlan | null>(() => {
    const stored = load<unknown>(COMP_PLAN_KEY, null);
    return isCompPlan(stored) ? stored : null;
  });
  const upsertOpportunityV2 = useCallback((opportunity: OpportunityV2) => {
    setOpportunitiesV2((current) => {
      const next = [opportunity, ...current.filter((item) => item.id !== opportunity.id)];
      localStorage.setItem(OPPORTUNITIES_V2_KEY, JSON.stringify({
        version: OPPORTUNITIES_V2_SNAPSHOT_VERSION,
        items: next,
      } satisfies OpportunityV2Snapshot));
      return next;
    });
  }, []);
  const setCompPlan = useCallback((plan: CompPlan | null) => {
    if (plan) localStorage.setItem(COMP_PLAN_KEY, JSON.stringify(plan));
    else localStorage.removeItem(COMP_PLAN_KEY);
    setCompPlanState(plan);
  }, []);
  const setOverride = useCallback((entityId: string, path: string, value: unknown) => {
    setOverrides((current) => {
      const next = { ...current, [overrideKey(entityId, path)]: value };
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const saveMeetingNote = useCallback((note: MeetingNote) => {
    setMeetingNotes((current) => {
      const next = [note, ...current];
      localStorage.setItem(NOTES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    localStorage.removeItem(OVERRIDES_KEY);
    localStorage.removeItem(NOTES_KEY);
    localStorage.removeItem(TASKS_KEY);
    localStorage.removeItem(PG_EDITS_KEY);
    localStorage.removeItem(PG_CUSTOM_KEY);
    localStorage.removeItem(SIGNAL_META_KEY);
    localStorage.removeItem(HYPOTHESES_KEY);
    localStorage.removeItem(CUSTOM_OPPORTUNITIES_KEY);
    localStorage.removeItem(OPPORTUNITIES_V2_KEY);
    localStorage.removeItem(COMP_PLAN_KEY);
    setOverrides({});
    setMeetingNotes([]);
    setTasks([]);
    setPgEdits({});
    setPgCustom([]);
    setSignalMeta({});
    setHypotheses([]);
    setCustomOpportunities([]);
    setOpportunitiesV2(migrateOpportunitySnapshot(
      sourceDataset.opportunities,
      [],
      sourceDataset.stakeholders,
      null,
    ).items);
    setCompPlanState(null);
  }, []);
  const persistTasks = useCallback((next: Task[]) => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(next));
    setTasks(next);
  }, []);
  const addTask = useCallback((task: Task) => {
    setTasks((current) => {
      const next = [task, ...current];
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const toggleTask = useCallback((id: string) => {
    setTasks((current) => {
      const next = current.map((task) => task.id === id ? { ...task, status: (task.status === 'Done' ? 'Open' : 'Done') as Task['status'] } : task);
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const deleteTask = useCallback((id: string) => {
    setTasks((current) => {
      const next = current.filter((task) => task.id !== id);
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const upsertPg = useCallback((id: string, patch: Partial<PgRecord>) => {
    setPgEdits((current) => {
      const next = { ...current, [id]: { ...(current[id] || {}), ...patch } };
      localStorage.setItem(PG_EDITS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const addPg = useCallback((record: PgRecord) => {
    setPgCustom((current) => {
      const next = [record, ...current];
      localStorage.setItem(PG_CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const deletePg = useCallback((id: string) => {
    setPgCustom((current) => {
      const next = current.filter((item) => item.id !== id);
      localStorage.setItem(PG_CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const upsertSignalMeta = useCallback((id: string, patch: { productIds?: string[]; salesPlayId?: string; scoreInputs?: PgScoreInputs }) => {
    setSignalMeta((current) => {
      const next = { ...current, [id]: { ...(current[id] || {}), ...patch } };
      localStorage.setItem(SIGNAL_META_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const upsertHypothesis = useCallback((hypothesis: Hypothesis) => {
    setHypotheses((current) => {
      const next = [hypothesis, ...current.filter((item) => item.id !== hypothesis.id)];
      localStorage.setItem(HYPOTHESES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const addOpportunity = useCallback((opportunity: Opportunity) => {
    setCustomOpportunities((current) => {
      const next = [opportunity, ...current];
      localStorage.setItem(CUSTOM_OPPORTUNITIES_KEY, JSON.stringify(next));
      return next;
    });
    const stakeholders = sourceDataset.stakeholders.map((item) => mergeOverrides(item, item.id, overrides));
    upsertOpportunityV2(migrateOpportunity(opportunity, stakeholders));
  }, [overrides, upsertOpportunityV2]);
  return {
    overrides,
    setOverride,
    meetingNotes,
    saveMeetingNote,
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    pgEdits,
    pgCustom,
    signalMeta,
    upsertSignalMeta,
    hypotheses,
    upsertHypothesis,
    customOpportunities,
    opportunitiesV2,
    upsertOpportunityV2,
    compPlan,
    setCompPlan,
    upsertPg,
    addPg,
    deletePg,
    addOpportunity,
    reset,
  };
}
