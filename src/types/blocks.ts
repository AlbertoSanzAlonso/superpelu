export type BlockScope = 'single' | 'range' | 'weekly'

export type BlockSeriesMeta = {
  blockId: string
  seriesId: string | null
  scope: BlockScope | 'legacy'
  count: number
  dates: string[]
  anchorDate: string
  startTime: string
  endTime: string
}

export type PendingBlockGroup = {
  startTime: string
  endTime: string
}
