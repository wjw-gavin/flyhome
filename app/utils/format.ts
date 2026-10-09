const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function fmtDate(iso: string, withWeekday = true) {
  const d = new Date(`${iso}T00:00:00`)
  const base = `${d.getMonth() + 1}月${d.getDate()}日`
  return withWeekday ? `${base} 周${WEEKDAYS[d.getDay()]}` : base
}

export function fmtWeekday(dow: number) {
  return `周${WEEKDAYS[dow]}`
}

export function weekdayOf(iso: string) {
  return new Date(`${iso}T00:00:00`).getDay()
}

export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** How many date pairs a scheduled run covers; mirrors buildDatePairs in scripts/lib/common.mjs. */
export function scheduledPairCount() {
  const { fromDays, toDays, weekdays, stepDays = 7 } = config.trip
  if (!weekdays) return Math.floor((toDays - fromDays) / stepDays) + 1
  let n = 0
  const base = todayIso()
  for (let o = fromDays; o <= toDays; o++) {
    if (weekdays.includes(weekdayOf(addDaysIso(base, o)))) n++
  }
  return n
}

export function fmtTime(dt: string) {
  return dt.slice(11, 16)
}

export function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}分`
  return m ? `${h}小时${m}分` : `${h}小时`
}

export function fmtHours(hours: number) {
  return fmtDuration(Math.round(hours * 60))
}

export function fmtMoney(n: number, currency = 'CNY') {
  const v = Math.round(n).toLocaleString('en-US')
  return currency === 'CNY' ? `¥${v}` : `${v} ${currency}`
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Dubai', hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Google Flights marks a segment's arrival with "+1" semantics via dates; derive day offset. */
export function dayOffset(dep: string, arr: string) {
  const a = new Date(`${dep.slice(0, 10)}T00:00:00`)
  const b = new Date(`${arr.slice(0, 10)}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400e3)
}

export function tripLink(site: 'ctrip' | 'trip', origin: string, dest: string, out: string, ret: string) {
  const o = origin.toLowerCase()
  const d = dest.toLowerCase()
  if (site === 'ctrip') {
    return `https://flights.ctrip.com/online/list/round-${o}-${d}?depdate=${out}_${ret}&cabin=y_s&adult=1&child=0&infant=0`
  }
  return `https://www.trip.com/flights/showfarefirst?dcity=${o}&acity=${d}&ddate=${out}&rdate=${ret}&triptype=rt&class=y&quantity=1&locale=en-AE&curr=AED`
}
