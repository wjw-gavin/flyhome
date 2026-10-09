import latestJson from '~~/data/latest.json'
import historyJson from '~~/data/history.json'
import configJson from '~~/flyhome.config.json'
import type { FlyhomeConfig, HistoryPoint, Itinerary, Query, RunFile, Scored, Settings } from '~/types/flyhome'

const STORAGE_KEY = 'flyhome.settings.v2'

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
    ...config.scoring,
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
  const known = config.home.onward[it.dest]
  const onward = s.includeOnward ? known ?? config.home.onwardFallback : null
  const onwardHours = onward ? onward.transferHours + onward.trainHours : 0
  // Train fare is in CNY, same as the flight prices (search.currency must stay CNY).
  const onwardCost = onward ? onward.trainCny : 0
  const overnightLayovers = it.layovers.filter(l => l.overnight).length
  const flightCost = it.price
    + (it.totalDuration / 60) * s.hourValue
    + it.stops * s.stopPenalty
    + overnightLayovers * s.overnightPenalty
  const score = flightCost + onwardCost + onwardHours * s.hourValue
  return { ...it, query: q, city: cityOf(it.dest), score, onward, onwardEstimated: !known, onwardCost, onwardHours, flightCost, variants: 0 }
}

// Airlines often price several routings identically (e.g. 国航 via CKG with different layovers);
// keep the best-scoring one per (date pair, airlines, destination, price) and count the rest.
function collapseVariants(list: Scored[]) {
  const groups = new Map<string, Scored>()
  for (const it of list) {
    const key = `${it.query.id}|${it.airlines.join('+')}|${it.dest}|${it.price}`
    const head = groups.get(key)
    if (!head) groups.set(key, { ...it, variants: 0 })
    else if (it.score < head.score) groups.set(key, { ...it, variants: head.variants + 1 })
    else head.variants++
  }
  return [...groups.values()]
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
    const list = collapseVariants(filtered.value)
    if (s.sort === 'price') list.sort((a, b) => a.price - b.price)
    else if (s.sort === 'duration') list.sort((a, b) => a.totalDuration + a.onwardHours * 60 - (b.totalDuration + b.onwardHours * 60))
    else list.sort((a, b) => a.score - b.score)
    return list
  })

  return { all, filtered, ranked }
}
