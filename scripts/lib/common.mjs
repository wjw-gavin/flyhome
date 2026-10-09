import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
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

export async function saveRun(run) {
  await mkdir(RUNS_DIR, { recursive: true })
  await writeFile(path.join(RUNS_DIR, `${run.date}.json`), JSON.stringify(run))
  await writeFile(path.join(DATA_DIR, 'latest.json'), JSON.stringify(run))
  await rebuildHistory()
}

// Flat list of (run, date pair, city) -> min price, rebuilt from every stored run.
export async function rebuildHistory() {
  const config = await loadConfig()
  const files = (await readdir(RUNS_DIR)).filter(f => f.endsWith('.json')).sort()
  const points = []
  for (const file of files) {
    const run = JSON.parse(await readFile(path.join(RUNS_DIR, file), 'utf8'))
    for (const q of run.queries) {
      const byCity = new Map()
      for (const it of q.itineraries) {
        const city = cityOf(config, it.dest)
        byCity.set(city, Math.min(byCity.get(city) ?? Infinity, it.price))
      }
      for (const [city, min] of byCity) points.push({ run: run.date, out: q.out, ret: q.ret, city, min })
    }
  }
  await writeFile(path.join(DATA_DIR, 'history.json'), JSON.stringify(points))
  return points
}
