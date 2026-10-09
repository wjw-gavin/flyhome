import latestJson from '~~/data/latest.json'
import historyJson from '~~/data/history.json'
import configJson from '~~/flyhome.config.json'
import type { FlyhomeConfig, HistoryPoint, Itinerary, Query, RunFile, Scored, Settings } from '~/types/flyhome'

const STORAGE_KEY = 'flyhome.settings.v1'

export const config = configJson as FlyhomeConfig
export const latest = latestJson as unknown as RunFile
// Named to avoid shadowing window.history inside components.
export const priceHistory = historyJson as HistoryPoint[]

export const cityNames = Object.keys(config.cities)

export function cityOf(airport: string) {
  return cityNames.find(c => config.cities[c]!.includes(airport)) ?? airport
}

function defaultSettings(): Settings {
  return {
    hourValue: 25,
    stopPenalty: 150,
    overnightPenalty: 120,
    includeOnward: true,
    maxStops: 2,
    origins: [...config.origins],
    cities: [...cityNames],
    sort: 'score',
  }
}

export function useSettings() {
  const settings = useState<Settings>('settings', defaultSettings)
  onMounted(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) Object.assign(settings.value, { ...defaultSettings(), ...JSON.parse(raw) })
    } catch {}
    watch(settings, (v) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch {}
    }, { deep: true })
  })
  const reset = () => Object.assign(settings.value, defaultSettings())
  return { settings, reset }
}

export function scoreItinerary(it: Itinerary, q: Query, s: Settings): Scored {
  const onward = config.home.onward[it.dest]
  const onwardHours = s.includeOnward && onward ? onward.transferHours + onward.trainHours : 0
  const onwardCost = s.includeOnward && onward ? onward.trainCny / config.home.cnyPerAed : 0
  const overnightLayovers = it.layovers.filter(l => l.overnight).length
  const flightCost = it.price
    + (it.totalDuration / 60) * s.hourValue
    + it.stops * s.stopPenalty
    + overnightLayovers * s.overnightPenalty
  const score = flightCost + onwardCost + onwardHours * s.hourValue
  return { ...it, query: q, city: cityOf(it.dest), score, onwardCost, onwardHours, flightCost }
}

export function useRanked(settings: Ref<Settings>, selectedOut: Ref<string | null>) {
  const all = computed<Scored[]>(() =>
    latest.queries.flatMap(q => q.itineraries.map(it => scoreItinerary(it, q, settings.value))),
  )

  const filtered = computed(() => {
    const s = settings.value
    return all.value.filter(it =>
      s.origins.includes(it.origin)
      && s.cities.includes(it.city)
      && it.stops <= s.maxStops
      && (!selectedOut.value || it.query.out === selectedOut.value),
    )
  })

  const ranked = computed(() => {
    const s = settings.value
    const list = [...filtered.value]
    if (s.sort === 'price') list.sort((a, b) => a.price - b.price)
    else if (s.sort === 'duration') list.sort((a, b) => a.totalDuration + a.onwardHours * 60 - (b.totalDuration + b.onwardHours * 60))
    else list.sort((a, b) => a.score - b.score)
    return list
  })

  return { all, filtered, ranked }
}
