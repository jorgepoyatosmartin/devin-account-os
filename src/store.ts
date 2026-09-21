import { useCallback, useState } from 'react';
import type { Dataset, MeetingNote, Opportunity, PgRecord, Task } from './types';

export type OverrideMap = Record<string, unknown>;
const OVERRIDES_KEY = 'cognition-pipeline-overrides';
const NOTES_KEY = 'cognition-pipeline-meeting-notes';
const TASKS_KEY = 'cognition-pipeline-tasks';
const PG_EDITS_KEY = 'cognition-pipeline-pg';
const PG_CUSTOM_KEY = 'cognition-pipeline-pg-custom';
const CUSTOM_OPPORTUNITIES_KEY = 'cognition-pipeline-custom-opps';

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
  const [customOpportunities, setCustomOpportunities] = useState<Opportunity[]>(() => load(CUSTOM_OPPORTUNITIES_KEY, []));
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
    localStorage.removeItem(CUSTOM_OPPORTUNITIES_KEY);
    setOverrides({});
    setMeetingNotes([]);
    setTasks([]);
    setPgEdits({});
    setPgCustom([]);
    setCustomOpportunities([]);
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
  const addOpportunity = useCallback((opportunity: Opportunity) => {
    setCustomOpportunities((current) => {
      const next = [opportunity, ...current];
      localStorage.setItem(CUSTOM_OPPORTUNITIES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
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
    customOpportunities,
    upsertPg,
    addPg,
    deletePg,
    addOpportunity,
    reset,
  };
}
