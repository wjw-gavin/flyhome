// Pull round-trip prices from Google Flights (via SerpApi) and store a normalized run under data/.
// Default: every scheduled date pair × arrival group → data/runs + latest.json.
// With CUSTOM_OUT (and optional CUSTOM_RET) set: just that one date pair → data/custom.json.
import { addDays, buildDatePairs, loadConfig, saveCustom, saveRun, todayDubai } from './lib/common.mjs'
import { normalizeResponse } from './lib/normalize.mjs'

const key = process.env.SERPAPI_KEY
if (!key) {
  console.error('SERPAPI_KEY is not set (put it in .env locally, or in GitHub Secrets).')
  process.exit(1)
}

const config = await loadConfig()
const today = todayDubai()

const customOut = process.env.CUSTOM_OUT?.trim()
let pairs
if (customOut) {
  const ret = process.env.CUSTOM_RET?.trim() || addDays(customOut, config.trip.days)
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (!iso.test(customOut) || !iso.test(ret) || ret <= customOut || customOut <= today) {
    console.error(`Bad custom dates: out=${customOut} ret=${ret} (need YYYY-MM-DD, out after today, ret after out).`)
    process.exit(1)
  }
  pairs = [{ out: customOut, ret }]
} else {
  pairs = buildDatePairs(config, today)
}
const jobs = config.arrivalGroups.flatMap(group => pairs.map(p => ({ group, ...p })))

const account = await (await fetch(`https://serpapi.com/account.json?api_key=${key}`)).json()
if (account.error) {
  console.error('SerpApi account check failed:', account.error)
  process.exit(1)
}
const left = account.total_searches_left ?? account.plan_searches_left ?? 0
console.log(`SerpApi searches left this month: ${left}; this run needs ${jobs.length}`)
if (left < jobs.length) {
  console.error('Not enough quota for a full run, skipping so partial data never overwrites latest.json.')
  process.exit(0)
}

const { currency, hl, gl, bags, showHidden } = config.search
const queries = []
for (const job of jobs) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: key,
    departure_id: config.origins.join(','),
    arrival_id: job.group.join(','),
    outbound_date: job.out,
    return_date: job.ret,
    type: '1',
    adults: '1',
    bags: String(bags),
    show_hidden: String(showHidden),
    currency,
    hl,
    gl,
  })
  const label = `${config.origins.join('/')} → ${job.group.join('/')} ${job.out}↔${job.ret}`
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`)
    const json = await res.json()
    if (json.error) {
      console.warn(`[skip] ${label}: ${json.error}`)
      continue
    }
    const q = normalizeResponse(json, job, config)
    q.fetchedAt = new Date().toISOString()
    console.log(`[ok] ${label}: ${q.itineraries.length} itineraries`)
    queries.push(q)
  } catch (err) {
    console.warn(`[fail] ${label}: ${err.message}`)
  }
  await new Promise(r => setTimeout(r, 800))
}

if (queries.length === 0) {
  console.error('No successful queries, nothing saved.')
  process.exit(1)
}

const quota = { left: left - queries.length, total: account.searches_per_month ?? null }
if (customOut) {
  await saveCustom(queries, quota)
  console.log(`Saved custom query ${pairs[0].out}↔${pairs[0].ret} (${queries.length}/${jobs.length} groups).`)
} else {
  await saveRun({ date: today, fetchedAt: new Date().toISOString(), currency, quota, queries })
  console.log(`Saved run ${today} with ${queries.length}/${jobs.length} queries.`)
}
