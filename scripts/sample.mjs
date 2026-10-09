// Deterministic fake run so the UI can be developed without spending SerpApi quota.
// Output is flagged `sample: true`; the site shows a banner until a real fetch replaces it.
import { buildDatePairs, loadConfig, saveRun, todayDubai } from './lib/common.mjs'
import { googleFlightsUrl } from './lib/normalize.mjs'

const config = await loadConfig()
const today = todayDubai()
const pairs = buildDatePairs(config, today)

let seed = 20261009
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const pick = arr => arr[Math.floor(rand() * arr.length)]

const logo = code => `https://www.gstatic.com/flights/airline_logos/70px/${code}.png`
const airports = {
  DXB: '迪拜国际机场', AUH: '阿布扎比扎耶德国际机场', DOH: '哈马德国际机场', CAN: '广州白云国际机场',
  PEK: '北京首都国际机场', PKX: '北京大兴国际机场', PVG: '上海浦东国际机场', SHA: '上海虹桥国际机场',
  NKG: '南京禄口国际机场', CGO: '郑州新郑国际机场',
}
const routes = [
  { origin: 'DXB', dest: 'PEK', legs: [['EK 306', '阿联酋航空', 'EK', 475]], base: 2900 },
  { origin: 'DXB', dest: 'PVG', legs: [['EK 302', '阿联酋航空', 'EK', 500]], base: 2750 },
  { origin: 'DXB', dest: 'PEK', legs: [['CA 942', '中国国际航空', 'CA', 470]], base: 2500 },
  { origin: 'DXB', dest: 'PVG', legs: [['MU 212', '中国东方航空', 'MU', 495]], base: 2450 },
  { origin: 'AUH', dest: 'PEK', legs: [['EY 888', '阿提哈德航空', 'EY', 480]], base: 2650 },
  { origin: 'AUH', dest: 'PVG', legs: [['EY 862', '阿提哈德航空', 'EY', 505]], base: 2600 },
  { origin: 'AUH', dest: 'NKG', legs: [['EY 866', '阿提哈德航空', 'EY', 500]], base: 2800 },
  { origin: 'DXB', dest: 'PEK', via: 'DOH', legs: [['QR 1003', '卡塔尔航空', 'QR', 70], ['QR 892', '卡塔尔航空', 'QR', 470]], base: 2300 },
  { origin: 'DXB', dest: 'PVG', via: 'DOH', legs: [['QR 1017', '卡塔尔航空', 'QR', 70], ['QR 870', '卡塔尔航空', 'QR', 495]], base: 2250 },
  { origin: 'DXB', dest: 'NKG', via: 'CAN', legs: [['CZ 382', '中国南方航空', 'CZ', 470], ['CZ 3637', '中国南方航空', 'CZ', 130]], base: 2150 },
  { origin: 'DXB', dest: 'CGO', via: 'CAN', legs: [['CZ 382', '中国南方航空', 'CZ', 470], ['CZ 3171', '中国南方航空', 'CZ', 140]], base: 2550 },
  { origin: 'AUH', dest: 'CGO', via: 'DOH', legs: [['QR 1041', '卡塔尔航空', 'QR', 75], ['QR 876', '卡塔尔航空', 'QR', 465]], base: 2950 },
  { origin: 'DXB', dest: 'PKX', via: 'CAN', legs: [['CZ 382', '中国南方航空', 'CZ', 470], ['CZ 3903', '中国南方航空', 'CZ', 185]], base: 2350 },
]

function addMinutes(iso, minutes) {
  const d = new Date(`${iso}:00Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

function build(route, out, seasonal) {
  const depHour = pick([2, 3, 8, 10, 14, 22])
  let cursor = `${out} ${String(depHour).padStart(2, '0')}:${pick(['05', '30', '45'])}`
  const stops = route.via ? [route.origin, route.via, route.dest] : [route.origin, route.dest]
  const segments = []
  const layovers = []
  route.legs.forEach(([fn, airline, code, dur], i) => {
    const dep = cursor
    // Arrival is kept in departure-airport wall time for simplicity; Google returns local times.
    const arr = addMinutes(dep, dur)
    segments.push({
      from: stops[i], fromName: airports[stops[i]], to: stops[i + 1], toName: airports[stops[i + 1]],
      dep, arr, airline, airlineLogo: logo(code), flightNumber: fn, airplane: pick(['波音 777', '空客 A350', '空客 A330']),
      duration: dur, legroom: pick(['79 厘米', '81 厘米', '86 厘米']), overnight: depHour >= 22 || depHour <= 3, extensions: [],
    })
    if (i < route.legs.length - 1) {
      const wait = pick([95, 150, 240, 420, 780])
      layovers.push({ id: stops[i + 1], name: airports[stops[i + 1]], duration: wait, overnight: wait >= 600 })
      cursor = addMinutes(arr, wait)
    }
  })
  const total = segments.reduce((s, x) => s + x.duration, 0) + layovers.reduce((s, l) => s + l.duration, 0)
  const price = Math.round((route.base * seasonal * (0.9 + rand() * 0.3)) / 5) * 5
  return {
    id: `${out}_${segments.map(s => s.flightNumber.replace(/\s+/g, '')).join('-')}`,
    origin: route.origin, originName: airports[route.origin], dest: route.dest, destName: airports[route.dest],
    price, totalDuration: total, stops: layovers.length, layovers, segments,
    airlines: [...new Set(segments.map(s => s.airline))], airlineLogo: segments[0].airlineLogo,
    extensions: route.via ? [] : ['Wi-Fi 收费', '机上娱乐'], carbon: Math.round(total * 1.8) * 1000, best: false,
  }
}

const queries = pairs.map(({ out, ret }) => {
  const month = Number(out.slice(5, 7))
  // Late Jan / early Feb (Spring Festival window) and summer are priced up.
  const seasonal = month === 1 || month === 2 ? 1.35 : month >= 6 && month <= 8 ? 1.2 : 1
  const items = routes.filter(() => rand() > 0.2).map(r => build(r, out, seasonal))
  items.sort((a, b) => a.price + a.totalDuration * 2 - (b.price + b.totalDuration * 2))
  items.slice(0, 3).forEach(i => (i.best = true))
  const lowest = Math.min(...items.map(i => i.price))
  const history = Array.from({ length: 60 }, (_, i) => {
    const ts = Math.floor(Date.now() / 1000) - (59 - i) * 86400
    return [ts, Math.round((lowest * (1 + Math.sin(i / 7) * 0.08 + rand() * 0.06)) / 5) * 5]
  })
  const group = config.arrivalGroups[0]
  return {
    id: `${out}_${ret}_${group.join('-')}`, out, ret, group,
    googleUrl: googleFlightsUrl(config.origins, group, out, ret, config.search),
    priceInsights: { lowest, level: pick(['low', 'typical', 'high']), typicalRange: [lowest * 1.05, lowest * 1.4].map(Math.round), history },
    itineraries: items,
  }
})

await saveRun({
  date: today,
  fetchedAt: new Date().toISOString(),
  sample: true,
  currency: config.search.currency,
  quota: null,
  queries,
})
console.log(`Sample run written for ${today}: ${queries.length} date pairs.`)
