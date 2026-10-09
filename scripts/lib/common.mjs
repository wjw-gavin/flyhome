import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const DATA_DIR = path.join(ROOT, 'data')
export const RUNS_DIR = path.join(DATA_DIR, 'runs')

export async function loadConfig() {
  return JSON.parse(await readFile(path.join(ROOT, 'flyhome.config.json'), 'utf8'))
}

// Calendar date in Dubai (UTC+4), so a 03:00 UTC cron still files under the local day.
export function todayDubai() {
  return new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10)
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function buildDatePairs(config, today) {
  const { fromDays, toDays, stepDays, days } = config.trip
  const pairs = []
  for (let offset = fromDays; offset <= toDays; offset += stepDays) {
    const out = addDays(today, offset)
    pairs.push({ out, ret: addDays(out, days) })
  }
  return pairs
}

export function cityOf(config, airport) {
  for (const [city, airports] of Object.entries(config.cities)) {
    if (airports.includes(airport)) return city
  }
  return airport
}

// show_hidden returns ~300 itineraries per query (6.7 MB/run); the page bundles latest.json,
// so keep only what can plausibly rank: cheapest, best value at default weights, and Google's picks.
export function trimItineraries(itineraries, keep, scoring) {
  const value = it => it.price + (it.totalDuration / 60) * scoring.hourValue + it.stops * scoring.stopPenalty
  const byPrice = [...itineraries].sort((a, b) => a.price - b.price).slice(0, keep)
  const byValue = [...itineraries].sort((a, b) => value(a) - value(b)).slice(0, Math.ceil(keep / 2))
  const kept = new Map()
  for (const it of [...itineraries.filter(i => i.best), ...byPrice, ...byValue]) kept.set(it.id, it)
  return [...kept.values()]
}

export async function saveRun(run) {
  const config = await loadConfig()
  const keep = config.keepPerQuery ?? 60
  const trimmed = { ...run, queries: run.queries.map(q => ({ ...q, itineraries: trimItineraries(q.itineraries, keep, config.scoring) })) }
  await mkdir(RUNS_DIR, { recursive: true })
  await writeFile(path.join(RUNS_DIR, `${run.date}.json`), JSON.stringify(trimmed))
  await writeFile(path.join(DATA_DIR, 'latest.json'), JSON.stringify(trimmed))
  await updateHistory(trimmed, config)
  await pruneRuns(config.keepRunDays ?? 90)
}

// history.json is cumulative (run, date pair, city) -> min price; a re-saved run replaces its own points.
async function updateHistory(run, config) {
  const file = path.join(DATA_DIR, 'history.json')
  let points = []
  try { points = JSON.parse(await readFile(file, 'utf8')) } catch {}
  points = points.filter(p => p.run !== run.date)
  for (const q of run.queries) {
    const byCity = new Map()
    for (const it of q.itineraries) {
      const city = cityOf(config, it.dest)
      byCity.set(city, Math.min(byCity.get(city) ?? Infinity, it.price))
    }
    for (const [city, min] of byCity) points.push({ run: run.date, out: q.out, ret: q.ret, city, min })
  }
  points.sort((a, b) => a.run.localeCompare(b.run) || a.out.localeCompare(b.out))
  await writeFile(file, JSON.stringify(points))
}

async function pruneRuns(keepDays) {
  const cutoff = addDays(todayDubai(), -keepDays)
  for (const f of await readdir(RUNS_DIR)) {
    if (f.endsWith('.json') && f.slice(0, 10) < cutoff) await rm(path.join(RUNS_DIR, f))
  }
}
