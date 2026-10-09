function segment(f) {
  return {
    from: f.departure_airport?.id,
    fromName: f.departure_airport?.name,
    to: f.arrival_airport?.id,
    toName: f.arrival_airport?.name,
    dep: f.departure_airport?.time,
    arr: f.arrival_airport?.time,
    airline: f.airline,
    airlineLogo: f.airline_logo,
    flightNumber: f.flight_number,
    airplane: f.airplane,
    duration: f.duration,
    legroom: f.legroom,
    overnight: Boolean(f.overnight),
    extensions: f.extensions ?? [],
  }
}

function itinerary(item, best) {
  const segments = (item.flights ?? []).map(segment)
  const first = segments[0]
  const last = segments[segments.length - 1]
  const layovers = (item.layovers ?? []).map(l => ({
    id: l.id,
    name: l.name,
    duration: l.duration,
    overnight: Boolean(l.overnight),
  }))
  return {
    id: `${first?.dep?.slice(0, 10)}_${segments.map(s => (s.flightNumber ?? '').replace(/\s+/g, '')).join('-')}`,
    origin: first?.from,
    originName: first?.fromName,
    dest: last?.to,
    destName: last?.toName,
    price: item.price,
    totalDuration: item.total_duration,
    stops: layovers.length,
    layovers,
    segments,
    airlines: [...new Set(segments.map(s => s.airline).filter(Boolean))],
    airlineLogo: item.airline_logo,
    extensions: item.extensions ?? [],
    carbon: item.carbon_emissions?.this_flight,
    best,
  }
}

export function googleFlightsUrl(origins, dests, out, ret, search) {
  const q = `Flights to ${dests.join(',')} from ${origins.join(',')} on ${out} through ${ret}`
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=${search.currency}&hl=${search.hl}`
}

export function normalizeResponse(json, job, config) {
  const best = (json.best_flights ?? []).map(i => itinerary(i, true))
  const other = (json.other_flights ?? []).map(i => itinerary(i, false))
  const seen = new Set()
  const itineraries = [...best, ...other].filter(it => {
    if (typeof it.price !== 'number' || seen.has(it.id)) return false
    seen.add(it.id)
    return true
  })
  const pi = json.price_insights
  return {
    id: `${job.out}_${job.ret}_${job.group.join('-')}`,
    out: job.out,
    ret: job.ret,
    group: job.group,
    googleUrl: json.search_metadata?.google_flights_url
      ?? googleFlightsUrl(config.origins, job.group, job.out, job.ret, config.search),
    priceInsights: pi
      ? {
          lowest: pi.lowest_price,
          level: pi.price_level,
          typicalRange: pi.typical_price_range ?? null,
          history: pi.price_history ?? [],
        }
      : null,
    itineraries,
  }
}
