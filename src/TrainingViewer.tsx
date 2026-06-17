import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea,
} from 'recharts'
import type { GpxRoute, GpxPoint, HRSample, HealthData } from './types'
import 'leaflet/dist/leaflet.css'
import { StatBox, AISummaryButton, useChartTheme, ChartTooltip, humanizeWorkoutType } from './ui'
import StrengthOverview, { SessionDetail, bestE1RMForExercise, ageFromDob } from './Strength'
import type { HevyWorkout } from './types'
import { useTranslation } from './lib/i18n'

const tDict = {
  en: {
    loading: 'Loading...',
    all: 'All',
    gps: 'GPS',
    distance: 'Distance',
    duration: 'Duration',
    avgPace: 'Avg Pace',
    elevationGain: 'Elevation Gain',
    avgSpeed: 'Avg Speed',
    maxSpeed: 'Max Speed',
    profileTitle: 'Elevation & Speed Profile',
    profileDesc: 'Elevation and speed along the route',
    elevation: 'Elevation',
    speed: 'Speed',
    hrChartTitle: 'Heart Rate During Session',
    hrChartDesc: 'Heart rate over the workout duration',
    heartRate: 'Heart Rate',
    splitsTitle: 'Kilometer Splits',
    best: 'BEST',
    strengthDetail: 'Strength Detail',
    // Stat Box
    type: 'Type',
    activeCalories: 'Active Calories',
    avgHr: 'Avg HR',
    hrRange: 'HR Range',
    avgMets: 'Avg METs',
    weather: 'Weather',
    // zones
    zoneRest: 'Rest (<50%)',
    zoneFatBurn: 'Fat Burn (50-60%)',
    zoneCardio: 'Cardio (60-70%)',
    zoneTempo: 'Tempo (70-85%)',
    zonePeak: 'Peak (85%+)',
  },
  zh: {
    loading: '加载中...',
    all: '全部',
    gps: 'GPS',
    distance: '运动距离',
    duration: '运动时长',
    avgPace: '平均配速',
    elevationGain: '累计爬升',
    avgSpeed: '平均速度',
    maxSpeed: '最大速度',
    profileTitle: '海拔高度与速度曲线',
    profileDesc: '沿途的海拔高度和骑行/跑步速度变化走势',
    elevation: '海拔',
    speed: '速度',
    hrChartTitle: '运动心率走势',
    hrChartDesc: '运动期间的心率变化曲线',
    heartRate: '心率',
    splitsTitle: '每公里分段配速',
    best: '最快',
    strengthDetail: '力量训练详情',
    // Stat Box
    type: '运动类型',
    activeCalories: '活动消耗',
    avgHr: '平均心率',
    hrRange: '心率范围',
    avgMets: '平均梅脱 (METs)',
    weather: '天气',
    // zones
    zoneRest: '静息区间 (<50%)',
    zoneFatBurn: '燃脂区间 (50-60%)',
    zoneCardio: '有氧区间 (60-70%)',
    zoneTempo: '混氧区间 (70-85%)',
    zonePeak: '巅峰区间 (85%+)',
  }
}

interface Props {
  data: HealthData
  hevy: HevyWorkout[] | null
}

// Binary search for index of first sample >= target time
function bisect(arr: HRSample[], target: number): number {
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].t < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function parseGpx(text: string, filename: string): GpxRoute {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const trkpts = doc.querySelectorAll('trkpt')
  const points: GpxPoint[] = []

  trkpts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute('lat') || '0')
    const lon = parseFloat(pt.getAttribute('lon') || '0')
    const ele = parseFloat(pt.querySelector('ele')?.textContent || '0')
    const time = pt.querySelector('time')?.textContent || ''
    const speed = parseFloat(pt.querySelector('speed')?.textContent || '0')
    points.push({ lat, lon, ele, time, speed })
  })

  let totalDistance = 0
  let elevationGain = 0
  let maxSpeed = 0

  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
    totalDistance += d
    const elevDiff = points[i].ele - points[i - 1].ele
    if (elevDiff > 0) elevationGain += elevDiff
    if (points[i].speed > maxSpeed) maxSpeed = points[i].speed
  }

  const startTime = points[0]?.time || ''
  const endTime = points[points.length - 1]?.time || ''
  const totalTime = startTime && endTime
    ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
    : 0

  const name = doc.querySelector('trk > name')?.textContent || filename

  return {
    name,
    filename,
    points,
    totalDistance: totalDistance / 1000,
    totalTime,
    elevationGain: Math.round(elevationGain),
    avgSpeed: totalTime > 0 ? (totalDistance / 1000) / (totalTime / 3600) : 0,
    maxSpeed: maxSpeed * 3.6,
    startTime,
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(seconds: number, lang: string): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (lang === 'zh') {
    if (h > 0) return `${h}小时 ${m}分钟`
    return `${m}分钟 ${s}秒`
  }
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function formatPace(kmh: number, lang: string): string {
  if (kmh <= 0) return '--'
  const minPerKm = 60 / kmh
  const mins = Math.floor(minPerKm)
  const secs = Math.round((minPerKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')} ${lang === 'zh' ? '/公里' : '/km'}`
}

function FitBounds({ points }: { points: GpxPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) {
      const bounds = points.map(p => [p.lat, p.lon] as [number, number])
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [points, map])
  return null
}

function RouteDetail({ route }: { route: GpxRoute }) {
  const ct = useChartTheme()
  const { language } = useTranslation()
  const t = (key: string): string => (tDict[language as 'en' | 'zh'] as Record<string, string>)[key] || key

  const positions = useMemo(
    () => route.points.map(p => [p.lat, p.lon] as [number, number]),
    [route]
  )

  // Build elevation & speed profile data (sample every N points for performance)
  const profileData = useMemo(() => {
    const step = Math.max(1, Math.floor(route.points.length / 200))
    let cumDist = 0
    const data: { dist: number; ele: number; speed: number }[] = []

    for (let i = 0; i < route.points.length; i += step) {
      if (i > 0) {
        const prev = route.points[i - step] || route.points[i - 1]
        cumDist += haversine(prev.lat, prev.lon, route.points[i].lat, route.points[i].lon)
      }
      data.push({
        dist: Math.round(cumDist / 10) / 100,
        ele: Math.round(route.points[i].ele * 10) / 10,
        speed: Math.round(route.points[i].speed * 3.6 * 10) / 10,
      })
    }
    return data
  }, [route])

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label={t('distance')} value={`${route.totalDistance.toFixed(2)} km`} />
        <StatBox label={t('duration')} value={formatDuration(route.totalTime, language)} />
        <StatBox label={t('avgPace')} value={formatPace(route.avgSpeed, language)} />
        <StatBox label={t('elevationGain')} value={`${route.elevationGain} m`} />
        <StatBox label={t('avgSpeed')} value={`${route.avgSpeed.toFixed(1)} km/h`} />
        <StatBox label={t('maxSpeed')} value={`${route.maxSpeed.toFixed(1)} km/h`} />
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-zinc-800 h-80">
        <MapContainer
          center={[route.points[0]?.lat || 0, route.points[0]?.lon || 0]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <Polyline positions={positions} pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.9 }} />
          <FitBounds points={route.points} />
        </MapContainer>
      </div>

      {/* Elevation profile */}
      {profileData.length > 2 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h4 className="text-sm font-medium text-zinc-300">{t('profileTitle')}</h4>
            </div>
            <AISummaryButton title={t('profileTitle')} description={t('profileDesc')} chartData={profileData} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={{ top: 5, right: 5, bottom: 0, left: -15 }} data={profileData}>
                <defs>
                  <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis
                  dataKey="dist"
                  tick={{ fontSize: 10, fill: ct.tick }}
                  tickFormatter={v => `${v} km`}
                />
                <YAxis yAxisId="ele" tick={{ fontSize: 10, fill: ct.tick }} domain={['auto', 'auto']} />
                <YAxis yAxisId="speed" orientation="right" tick={{ fontSize: 10, fill: ct.tick }} domain={[0, 'auto']} />
                <Tooltip content={<ChartTooltip formatter={(value, name) => [
                    name === 'ele' ? `${value} m` : `${value} km/h`,
                    name === 'ele' ? t('elevation') : t('speed'),
                  ]} />} />
                <Area yAxisId="ele" type="monotone" dataKey="ele" stroke="#22c55e" fill="url(#eleGrad)" strokeWidth={1.5} dot={false} />
                <Area yAxisId="speed" type="monotone" dataKey="speed" stroke="#3b82f6" fill="none" strokeWidth={1} dot={false} strokeOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}


function HRSessionChart({
  hrData, maxHR, ct,
}: {
  hrData: { min: number; bpm: number }[]
  maxHR: number
  ct: ReturnType<typeof useChartTheme>
}) {
  const { language } = useTranslation()
  const t = (key: string): string => (tDict[language as 'en' | 'zh'] as Record<string, string>)[key] || key

  const ZONE_COLORS = ['#71717a', '#3b82f6', '#22c55e', '#f97316', '#ef4444']
  const ZONE_NAMES = language === 'zh'
    ? [t('zoneRest'), t('zoneFatBurn'), t('zoneCardio'), t('zoneTempo'), t('zonePeak')]
    : ['Rest (<50%)', 'Fat Burn (50-60%)', 'Cardio (60-70%)', 'Tempo (70-85%)', 'Peak (85%+)']
  // Lower bound of each zone as a fraction of maxHR; upper bound = next entry (or Infinity for Peak).
  const ZONE_LOWER = [0, 0.5, 0.6, 0.7, 0.85]

  // Time-in-zone percentages for the legend below the chart.
  const zonePcts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    for (const d of hrData) {
      const pct = d.bpm / maxHR
      if (pct < 0.5) counts[0]++
      else if (pct < 0.6) counts[1]++
      else if (pct < 0.7) counts[2]++
      else if (pct < 0.85) counts[3]++
      else counts[4]++
    }
    const total = counts.reduce((a, b) => a + b, 0) || 1
    return counts.map(c => Math.round((c / total) * 100))
  }, [hrData, maxHR])

  // Y-axis range: pad below the lowest sample so the Rest band is visible
  // and just above the highest so the Peak band is too. Recharts' 'auto'
  // would otherwise clip ReferenceArea's y1/y2 to the data extent.
  const { yMin, yMax } = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (const d of hrData) {
      if (d.bpm < lo) lo = d.bpm
      if (d.bpm > hi) hi = d.bpm
    }
    return { yMin: Math.floor(lo - 5), yMax: Math.ceil(hi + 5) }
  }, [hrData])

  // Convert zone fractions → bpm bounds, clipped to chart Y range.
  const bands = ZONE_LOWER.map((lower, i) => {
    const upper = i < ZONE_LOWER.length - 1 ? ZONE_LOWER[i + 1] : Infinity
    const y1 = Math.max(yMin, lower * maxHR)
    const y2 = upper === Infinity ? yMax : Math.min(yMax, upper * maxHR)
    return { y1, y2, color: ZONE_COLORS[i] }
  }).filter(b => b.y2 > b.y1)

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-sm font-medium text-zinc-300">{t('hrChartTitle')}</h4>
        <AISummaryButton title={t('hrChartTitle')} description={t('hrChartDesc')} chartData={hrData} />
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
          <AreaChart margin={{ top: 5, right: 5, bottom: 0, left: -15 }} data={hrData}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis
              dataKey="min"
              tick={{ fontSize: 10, fill: ct.tick }}
              tickFormatter={v => `${Math.floor(v as number)}m`}
            />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: ct.tick }} />
            {bands.map((b, i) => (
              <ReferenceArea
                key={i}
                y1={b.y1}
                y2={b.y2}
                fill={b.color}
                fillOpacity={0.08}
                strokeOpacity={0}
                ifOverflow="hidden"
              />
            ))}
            <Tooltip content={<ChartTooltip formatter={(v) => [`${v} bpm`, t('heartRate')]} />} />
            <Area type="monotone" dataKey="bpm" stroke="#ef4444" fill="none" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-5 gap-2 mt-2">
        {zonePcts.map((pct, i) => (
          <div key={i} className="text-center">
            <div className="text-xs font-medium tabular-nums" style={{ color: ZONE_COLORS[i] }}>{pct}%</div>
            <div className="text-[10px] text-zinc-500">{ZONE_NAMES[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KmSplits({ route }: { route: GpxRoute }) {
  const { language } = useTranslation()
  const t = (key: string): string => (tDict[language as 'en' | 'zh'] as Record<string, string>)[key] || key

  const splits = useMemo(() => {
    const pts = route.points
    if (pts.length < 2) return []

    const result: { km: number; pace: number; avgSpeed: number }[] = []
    let cumDist = 0
    let splitStart = 0
    let kmCount = 1

    for (let i = 1; i < pts.length; i++) {
      cumDist += haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon)

      if (cumDist >= kmCount * 1000) {
        const splitTime = (new Date(pts[i].time).getTime() - new Date(pts[splitStart].time).getTime()) / 1000
        const splitDist = cumDist - (kmCount - 1) * 1000
        result.push({
          km: kmCount,
          pace: splitTime > 0 ? splitTime / 60 : 0, // min/km
          avgSpeed: splitTime > 0 ? (splitDist / 1000) / (splitTime / 3600) : 0,
        })
        splitStart = i
        kmCount++
      }
    }

    return result
  }, [route])

  if (splits.length === 0) return null

  const bestPace = Math.min(...splits.map(s => s.pace))

  return (
    <div className="space-y-1">
      {splits.map(s => {
        const isBest = s.pace === bestPace
        const maxPace = Math.max(...splits.map(sp => sp.pace))
        const barPct = maxPace > 0 ? (s.pace / maxPace) * 100 : 0
        return (
          <div key={s.km} className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500 w-8 text-right text-xs">{s.km} km</span>
            <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden relative">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${barPct}%`,
                  background: isBest ? '#22c55e' : '#3b82f6',
                  opacity: 0.7,
                }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-mono text-zinc-200">
                {Math.floor(s.pace)}:{Math.round((s.pace % 1) * 60).toString().padStart(2, '0')} {language === 'zh' ? '/公里' : '/km'}
                {isBest && <span className="ml-2 text-green-400 text-[10px]">{t('best')}</span>}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TrainingViewer({ data, hevy }: Props) {
  const { language } = useTranslation()
  const t = (key: string): string => (tDict[language as 'en' | 'zh'] as Record<string, string>)[key] || key

  const { workouts, gpxFiles, hrTimeline, profile } = data
  const dob = profile.dob
  const ct = useChartTheme()
  const [routes, setRoutes] = useState<GpxRoute[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const parsedRef = useRef(false)

  const estimatedMaxHR = useMemo(() => 220 - ageFromDob(dob), [dob])

  // Per-exercise history (chronological) for PR detection in SessionDetail.
  const exerciseHistory = useMemo(() => {
    const map = new Map<string, { sessionId: string; sessionStart: string; e1rm: number; volume: number }[]>()
    if (!hevy) return map
    const sorted = [...hevy].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    for (const h of sorted) {
      for (const ex of h.exercises) {
        const arr = map.get(ex.title) ?? []
        arr.push({ sessionId: h.id, sessionStart: h.startDate, e1rm: bestE1RMForExercise(ex), volume: ex.volumeKg })
        map.set(ex.title, arr)
      }
    }
    return map
  }, [hevy])

  useEffect(() => {
    if (parsedRef.current) return
    parsedRef.current = true
    async function loadRoutes() {
      const parsed: GpxRoute[] = []
      const entries = Array.from(gpxFiles.entries())
      const results = await Promise.all(
        entries.map(async ([filename, file]) => {
          try {
            const text = await file.text()
            const route = parseGpx(text, filename)
            return route.points.length > 1 ? route : null
          } catch { return null }
        })
      )
      for (const route of results) {
        if (route) parsed.push(route)
      }
      parsed.sort((a, b) => b.startTime.localeCompare(a.startTime))
      setRoutes(parsed)
      setLoading(false)
    }
    loadRoutes()
  }, [gpxFiles])

  // Build route lookup by date
  const routeByDate = useMemo(() => {
    const map = new Map<string, GpxRoute>()
    for (const r of routes) {
      const d = r.startTime.substring(0, 10)
      map.set(d, r)
    }
    return map
  }, [routes])

  // All workouts sorted newest first
  const sortedWorkouts = useMemo(() =>
    [...workouts].sort((a, b) => b.date.localeCompare(a.date)),
    [workouts]
  )

  // Workout types for filter
  const workoutTypes = useMemo(() => {
    const types = new Map<string, number>()
    for (const w of workouts) {
      types.set(w.type, (types.get(w.type) || 0) + 1)
    }
    return Array.from(types.entries()).sort((a, b) => b[1] - a[1])
  }, [workouts])

  const filteredWorkouts = useMemo(() =>
    filter === 'all' ? sortedWorkouts : sortedWorkouts.filter(w => w.type === filter),
    [sortedWorkouts, filter]
  )

  const selected = filteredWorkouts[selectedIdx] || null
  const selectedRoute = selected ? routeByDate.get(selected.date) : null

  // HR during selected workout
  const workoutHR = useMemo(() => {
    if (!selected?.startDate || !selected?.endDate || hrTimeline.length === 0) return []
    const startMs = new Date(selected.startDate).getTime()
    const endMs = new Date(selected.endDate).getTime()
    if (!startMs || !endMs || endMs <= startMs) return []

    const lo = bisect(hrTimeline, startMs - 60000) // 1 min buffer
    const hi = bisect(hrTimeline, endMs + 60000)
    const slice = hrTimeline.slice(lo, hi)

    return slice.map(s => ({
      min: Math.round((s.t - startMs) / 60000 * 10) / 10, // minutes into workout
      bpm: s.v,
    }))
  }, [selected, hrTimeline])


  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-zinc-400 animate-pulse">{t('loading')}</div></div>
  }

  return (
    <>
      {hevy && hevy.length > 0 && (
        <div className="mb-6 space-y-4">
          <StrengthOverview data={data} hevy={hevy} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-3">
      {/* Left panel: workout list */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        {/* Type filter */}
        <div className="px-3 py-2 border-b border-zinc-800 flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => { setFilter('all'); setSelectedIdx(0) }}
            className={`shrink-0 px-2.5 py-1 text-xs rounded-md transition-colors ${
              filter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t('all')} ({workouts.length})
          </button>
          {workoutTypes.map(([type, count]) => (
            <button
              key={type}
              onClick={() => { setFilter(type); setSelectedIdx(0) }}
              className={`shrink-0 px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter === type ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {humanizeWorkoutType(type)} ({count})
            </button>
          ))}
        </div>

        {/* Workout list */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] divide-y divide-zinc-800/50">
          {filteredWorkouts.map((w, idx) => {
            const hasRoute = routeByDate.has(w.date)
            const isActive = idx === selectedIdx
            return (
              <button
                key={`${w.date}-${w.type}-${idx}`}
                onClick={() => setSelectedIdx(idx)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">{humanizeWorkoutType(w.type)}</span>
                  <div className="flex items-center gap-1.5">
                    {w.hevy && <span className="text-[10px] text-green-400 bg-green-500/10 ring-1 ring-green-500/25 px-1.5 py-0.5 rounded">Hevy</span>}
                    {hasRoute && <span className="text-[10px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">{t('gps')}</span>}
                    <span className="text-xs text-zinc-500">{formatDate(w.date, language)}</span>
                  </div>
                </div>
                <div className="text-xs text-zinc-500 mt-1 flex gap-3 flex-wrap">
                  <span>{w.duration} {language === 'zh' ? '分钟' : 'min'}</span>
                  {w.distance != null && w.distance > 0 && <span>{w.distance.toFixed(1)} km</span>}
                  {w.calories > 0 && <span>{w.calories} kcal</span>}
                  {w.hrAvg && <span>{w.hrAvg} bpm {language === 'zh' ? '均值' : 'avg'}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel: detail */}
      <div>
        {selected && (
          <div className="space-y-4">
            {/* Workout stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <StatBox label={t('type')} value={humanizeWorkoutType(selected.type)} />
              <StatBox label={t('duration')} value={`${selected.duration} ${language === 'zh' ? '分钟' : 'min'}`} />
              {selected.distance != null && selected.distance > 0 && <StatBox label={t('distance')} value={`${selected.distance.toFixed(2)} km`} />}
              {selected.calories > 0 && <StatBox label={t('activeCalories')} value={`${selected.calories} kcal`} />}
              {selected.hrAvg && <StatBox label={t('avgHr')} value={`${selected.hrAvg} bpm`} />}
              {selected.hrMin && selected.hrMax && <StatBox label={t('hrRange')} value={`${selected.hrMin}–${selected.hrMax} bpm`} />}
              {selected.distance != null && selected.distance > 0 && selected.duration > 0 && (
                <StatBox label={t('avgPace')} value={formatPace(selected.distance / (selected.duration / 60), language)} />
              )}
              {selected.distance != null && selected.distance > 0 && selected.duration > 0 && (
                <StatBox label={t('avgSpeed')} value={`${(selected.distance / (selected.duration / 60)).toFixed(1)} km/h`} />
              )}
              {selected.avgMETs && <StatBox label={t('avgMets')} value={`${selected.avgMETs.toFixed(1)}`} />}
              {selected.elevationAscended && <StatBox label={t('elevation')} value={`${selected.elevationAscended} m`} />}
              {selected.weather && <StatBox label={t('weather')} value={selected.weather} />}
            </div>

            {/* Heart rate during session, with HR-zone bands overlaid */}
            {workoutHR.length > 2 && (
              <HRSessionChart hrData={workoutHR} maxHR={estimatedMaxHR} ct={ct} />
            )}

            {/* Route detail if GPS available */}
            {selectedRoute && <RouteDetail route={selectedRoute} />}

            {/* Km Splits for GPS workouts */}
            {selectedRoute && selectedRoute.totalDistance >= 1 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">{t('splitsTitle')}</h4>
                <KmSplits route={selectedRoute} />
              </div>
            )}

            {/* Hevy strength detail when this workout is matched to a Hevy session */}
            {selected.hevy && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-zinc-300">{t('strengthDetail')} · {selected.hevy.title}</h4>
                  <span className="text-[10px] text-green-400 bg-green-500/10 ring-1 ring-green-500/25 px-1.5 py-0.5 rounded uppercase tracking-wider">Hevy</span>
                </div>
                <SessionDetail
                  entry={{ hevy: selected.hevy, apple: selected }}
                  exerciseHistory={exerciseHistory}
                  hrTimeline={hrTimeline}
                  maxHR={estimatedMaxHR}
                  ct={ct}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

function formatDate(d: string, lang: string): string {
  try {
    const date = new Date(d)
    if (lang === 'zh') {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  } catch { return d }
}
