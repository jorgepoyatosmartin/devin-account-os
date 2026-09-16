import { useCallback, useState } from 'react';
import type { Dataset, MeetingNote } from './types';

export type OverrideMap = Record<string, unknown>;
const OVERRIDES_KEY = 'cognition-pipeline-overrides';
const NOTES_KEY = 'cognition-pipeline-meeting-notes';

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

export function mergeDataset(dataset: Dataset, overrides: OverrideMap): Dataset {
  return {
    accounts: dataset.accounts.map((item) => mergeOverrides(item, item.id, overrides)),
    stakeholders: dataset.stakeholders.map((item) => mergeOverrides(item, item.id, overrides)),
    signals: dataset.signals.map((item) => mergeOverrides(item, item.id, overrides)),
    opportunities: dataset.opportunities.map((item) => mergeOverrides(item, item.id, overrides)),
    cockpitActions: dataset.cockpitActions.map((item) => mergeOverrides(item, item.id, overrides)),
  };
}

export function useOverrides() {
  const [overrides, setOverrides] = useState<OverrideMap>(() => load(OVERRIDES_KEY, {}));
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>(() => load(NOTES_KEY, []));
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
    setOverrides({});
    setMeetingNotes([]);
  }, []);
  return { overrides, setOverride, meetingNotes, saveMeetingNote, reset };
}
