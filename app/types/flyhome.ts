export interface Segment {
  from: string
  fromName: string
  to: string
  toName: string
  dep: string
  arr: string
  airline: string
  airlineLogo?: string
  flightNumber: string
  airplane?: string
  duration: number
  legroom?: string
  overnight?: boolean
  extensions?: string[]
}

export interface Layover {
  id: string
  name: string
  duration: number
  overnight?: boolean
}

export interface Itinerary {
  id: string
  origin: string
  originName: string
  dest: string
  destName: string
  price: number
  totalDuration: number
  stops: number
  layovers: Layover[]
  segments: Segment[]
  airlines: string[]
  airlineLogo?: string
  extensions: string[]
  carbon?: number
  best: boolean
}

export interface PriceInsights {
  lowest: number
  level: string
  typicalRange: [number, number] | null
  history: [number, number][]
}

export interface Query {
  id: string
  out: string
  ret: string
  group: string[]
  googleUrl: string
  priceInsights: PriceInsights | null
  itineraries: Itinerary[]
  fetchedAt?: string
  /** Requested from the page for a specific date pair rather than by the scheduled scan. */
  custom?: boolean
}

export interface RunFile {
  date: string
  fetchedAt: string
  sample?: boolean
  currency: string
  quota: { left: number, total: number | null } | null
  queries: Query[]
}

export interface HistoryPoint {
  run: string
  out: string
  ret: string
  city: string
  min: number
}

export interface Onward {
  station: string
  transferHours: number
  trainHours: number
  trainCny: number
}

export interface FlyhomeConfig {
  origins: string[]
  cities: Record<string, string[]>
  arrivalGroups: string[][]
  custom: { keep: number }
  github: { repo: string, workflow: string, branch: string }
  search: { currency: string, hl: string, gl: string, bags: number, showHidden: boolean }
  /** weekdays use JS convention (0 = Sunday); when absent the scan steps every stepDays. */
  trip: { days: number, fromDays: number, toDays: number, weekdays?: number[], stepDays?: number }
  scoring: { hourValue: number, stopPenalty: number, overnightPenalty: number }
  home: { name: string, onwardFallback: Onward, onward: Record<string, Onward> }
}

export interface Settings {
  hourValue: number
  stopPenalty: number
  overnightPenalty: number
  includeOnward: boolean
  maxStops: number
  origins: string[]
  cities: string[]
  weekdays: number[]
  sort: 'score' | 'price' | 'duration'
}

/** An itinerary annotated with the run-time score and its date pair. */
export interface Scored extends Itinerary {
  query: Query
  city: string
  score: number
  onward: Onward | null
  onwardEstimated: boolean
  onwardCost: number
  onwardHours: number
  flightCost: number
  /** Other itineraries on the same date, airline(s), destination and price that were folded into this one. */
  variants: number
}
