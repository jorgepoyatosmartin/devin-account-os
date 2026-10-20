import { stagesConfig } from '../config'
import en from '../i18n/en'

const stageKeys: Record<string, keyof typeof en> = {
  '1-disco-scheduled': 'stage.discoveryScheduled',
  '2-engage': 'stage.engage',
  '3-qualify': 'stage.qualify',
  '4-evaluate': 'stage.evaluate',
  '6-validate': 'stage.validate',
  '7-negotiate': 'stage.negotiate',
  'closed-won': 'stage.closedWon',
  'closed-lost': 'stage.closedLost',
}

export function stageDisplayLabel(stageId: string, translate: (key: keyof typeof en) => string): string {
  const key = stageKeys[stageId]
  if (key) return translate(key)
  return stagesConfig.find((stage) => stage.id === stageId)?.label ?? stageId
}
