import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import type { HealthData, Workout, HevyWorkout, HevyExercise } from './types'
import { COLORS, chartMargin, ChartTooltip, SectionHeader, useChartTheme, fmt, shortDateCompact } from './ui'
import { useTranslation } from './lib/i18n'

const tDict = {
  en: {
    title: 'Strength Overview',
    descSummary: '{sessions} Hevy sessions · {matchedCount} linked to Apple Health via time-window overlap.',
    atAGlance: 'At a Glance',
    sessions: 'Sessions',
    totalVolume: 'Total Volume',
    totalSets: 'Total Sets',
    totalReps: 'Total Reps',
    avgDuration: 'Avg Duration',
    weeklyVolume: 'Weekly Volume',
    topExercises: 'Top Exercises by Volume',
    volume: 'Volume',
    schedule: 'Training Schedule',
    less: 'Less',
    more: 'More',
    peak: 'peak',
    // detail
    workingSets: 'Working Sets',
    workingReps: 'Working Reps',
    duration: 'Duration',
    caloriesApple: 'Calories (Apple)',
    estCalories: 'Est. Calories',
    fromVolume: 'from volume',
    avgMets: 'Avg METs',
    hrAvg: 'HR Avg',
    hrMax: 'HR Max',
    weather: 'Weather',
    elevation: 'Elevation',
    volumeByMuscle: 'Volume by Muscle Group',
    set: 'Set',
    type: 'Type',
    weight: 'Weight',
    reps: 'Reps',
    rpe: 'RPE',
    // muscles
    chest: 'Chest',
    back: 'Back',
    legs: 'Legs',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    core: 'Core',
    other: 'Other',
    total: 'total',
    pr: '🥇 PR',
    topLabel: 'top',
  },
  zh: {
    title: '力量训练总览',
    descSummary: '{sessions} 次 Hevy 训练 · {matchedCount} 次通过时间窗口关联到 Apple Health。',
    atAGlance: '数据概览',
    sessions: '训练次数',
    totalVolume: '总容量',
    totalSets: '总组数',
    totalReps: '总次数',
    avgDuration: '平均时长',
    weeklyVolume: '每周容量',
    topExercises: '运动容量排名',
    volume: '容量',
    schedule: '训练日程分布',
    less: '较少',
    more: '较多',
    peak: '峰值',
    // detail
    workingSets: '正式组',
    workingReps: '正式组次数',
    duration: '时长',
    caloriesApple: '消耗热量 (Apple)',
    estCalories: '估算热量',
    fromVolume: '估自容量',
    avgMets: '平均梅脱 (METs)',
    hrAvg: '平均心率',
    hrMax: '最大心率',
    weather: '天气',
    elevation: '累计爬升',
    volumeByMuscle: '肌群容量占比',
    set: '组',
    type: '类型',
    weight: '重量',
    reps: '次数',
    rpe: 'RPE',
    // muscles
    chest: '胸肌',
    back: '背部',
    legs: '腿部',
    shoulders: '肩部',
    biceps: '二头肌',
    triceps: '三头肌',
    core: '核心',
    other: '其他',
    total: '累计',
    pr: '🥇 个人纪录',
    topLabel: '最高重量',
  }
}

const getMuscleLabel = (group: string | null | undefined, t: (key: string) => string): string => {
  if (!group) return t('other')
  const key = group.toLowerCase()
  if (key.includes('chest')) return t('chest')
  if (key.includes('back')) return t('back')
  if (key.includes('legs')) return t('legs')
  if (key.includes('shoulders')) return t('shoulders')
  if (key.includes('biceps')) return t('biceps')
  if (key.includes('triceps')) return t('triceps')
  if (key.includes('core')) return t('core')
  return group
}

// ─── helpers ────────────────────────────────────────────────────────────────

function startOfIsoWeek(iso: string): string {
  const d = new Date(iso)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function bestE1RMForExercise(ex: HevyExercise): number {
  let best = 0
  for (const s of ex.sets) {
    if (s.type === 'warmup') continue
    if (s.weightKg == null || s.reps == null || s.reps < 1) continue
    const e = s.weightKg * (1 + s.reps / 30)
    if (e > best) best = e
  }
  return best
}

export function ageFromDob(dob: string): number {
  if (!dob) return 30
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function bestE1RM(sets: { weightKg: number | null; reps: number | null; type: string }[]): number {
  let best = 0
  for (const s of sets) {
    if (s.type === 'warmup') continue
    if (s.weightKg == null || s.reps == null || s.reps < 1) continue
    const e = s.weightKg * (1 + s.reps / 30)
    if (e > best) best = e
  }
  return best
}

function bestSet(sets: { weightKg: number | null; reps: number | null; type: string }[]): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null
  for (const s of sets) {
    if (s.type === 'warmup') continue
    if (s.weightKg == null || s.reps == null) continue
    if (!best || s.weightKg > best.weight) best = { weight: s.weightKg, reps: s.reps }
  }
  return best
}

// Muscle group color map
const MUSCLE_COLORS: Record<string, string> = {
  chest: COLORS.red,
  back: COLORS.blue,
  legs: COLORS.green,
  shoulders: COLORS.purple,
  biceps: COLORS.orange,
  triceps: COLORS.cyan,
  core: COLORS.yellow,
  other: COLORS.zinc,
}

function muscleColor(group: string | null | undefined): string {
  if (!group) return MUSCLE_COLORS.other
  const key = group.toLowerCase()
  for (const [k, v] of Object.entries(MUSCLE_COLORS)) {
    if (key.includes(k)) return v
  }
  return MUSCLE_COLORS.other
}

// ─── types ──────────────────────────────────────────────────────────────────

export interface StrengthEntry {
  hevy: HevyWorkout
  apple: Workout | null
}

// ─── main component ──────────────────────────────────────────────────────────

interface StrengthOverviewProps {
  data: HealthData
  hevy: HevyWorkout[]
}

export default function StrengthOverview({ data, hevy }: StrengthOverviewProps) {
  const { language } = useTranslation()
  const t = (key: string): string => (tDict[language as 'en' | 'zh'] as Record<string, string>)[key] || key

  const workouts = data.workouts
  const ct = useChartTheme()

  const entries = useMemo<StrengthEntry[]>(() => {
    const matched = new Map<string, Workout>()
    for (const w of workouts) {
      if (w.hevy) matched.set(w.hevy.id, w)
    }
    return hevy
      .map(h => ({ hevy: h, apple: matched.get(h.id) ?? null }))
      .sort((a, b) => +new Date(b.hevy.startDate) - +new Date(a.hevy.startDate))
  }, [hevy, workouts])

  // No separate unmatched bucket — `entries` already covers all Hevy sessions
  // (apple = null when not matched).
  const unmatchedHevy: HevyWorkout[] = useMemo(() => [], [])

  const stats = useMemo(() => {
    const totalVolume = entries.reduce((s, e) => s + e.hevy.totalVolumeKg, 0)
    const totalSets = entries.reduce((s, e) => s + e.hevy.totalSets, 0)
    const totalReps = entries.reduce((s, e) => s + e.hevy.totalReps, 0)
    const matchedCount = entries.filter(e => e.apple).length
    const totalDurMin = entries.reduce((s, e) => s + e.hevy.durationMin, 0)
    return {
      sessions: entries.length,
      totalVolume,
      totalSets,
      totalReps,
      matchedCount,
      avgDurationMin: entries.length ? totalDurMin / entries.length : 0,
    }
  }, [entries])

  const weeklyVolume = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      const wk = startOfIsoWeek(e.hevy.startDate)
      map.set(wk, (map.get(wk) ?? 0) + e.hevy.totalVolumeKg)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, volume]) => ({ week, volume: Math.round(volume) }))
  }, [entries])

  const topExercises = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      for (const ex of e.hevy.exercises) {
        map.set(ex.title, (map.get(ex.title) ?? 0) + ex.volumeKg)
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([title, volume]) => ({ title, volume: Math.round(volume) }))
  }, [entries])

  if (entries.length === 0) return null

  const summaryDesc = t('descSummary')
    .replace('{sessions}', String(stats.sessions))
    .replace('{matchedCount}', String(stats.matchedCount))

  return (
    <>
      <SectionHeader>{t('title')}</SectionHeader>
      <p className="text-xs text-zinc-500 -mt-3 mb-2 leading-relaxed">
        {summaryDesc}
      </p>

      <SectionHeader>{t('atAGlance')}</SectionHeader>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Stat label={t('sessions')} value={`${stats.sessions}`} />
        <Stat label={t('totalVolume')} value={fmt(stats.totalVolume)} unit="kg" color={COLORS.purple} />
        <Stat label={t('totalSets')} value={`${stats.totalSets}`} color={COLORS.blue} />
        <Stat label={t('totalReps')} value={fmt(stats.totalReps)} color={COLORS.cyan} />
        <Stat label={t('avgDuration')} value={fmt(stats.avgDurationMin)} unit="min" />
      </div>

      <SectionHeader>{t('weeklyVolume')}</SectionHeader>
      <div className="bg-zinc-900 rounded-xl p-4 h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
          <BarChart data={weeklyVolume} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis dataKey="week" tickFormatter={shortDateCompact} stroke={ct.tick} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={ct.tick} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip formatter={(v) => [`${v} kg`, t('volume')]} />} />
            <Bar dataKey="volume" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionHeader>{t('topExercises')}</SectionHeader>
      <div className="bg-zinc-900 rounded-xl p-4 h-80">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
          <BarChart data={topExercises} layout="vertical" margin={{ top: 5, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
            <XAxis type="number" stroke={ct.tick} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis dataKey="title" type="category" stroke={ct.tick} fontSize={11} width={180} tickLine={false} axisLine={false} interval={0} />
            <Tooltip content={<ChartTooltip formatter={(v) => [`${v} kg`, t('volume')]} />} />
            <Bar dataKey="volume" fill={COLORS.green} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Chart 12: Weekday × Hour heatmap ── */}
      <ScheduleHeatmap entries={entries} unmatchedHevy={unmatchedHevy} />
    </>
  )
}

// ─── Chart 12: Weekday × Hour heatmap ───────────────────────────────────────

function ScheduleHeatmap({
  entries,
  unmatchedHevy,
}: {
  entries: StrengthEntry[]
  unmatchedHevy: HevyWorkout[]
}) {
  const { language } = useTranslation()
  const t = (key: string): string => (tDict[language as 'en' | 'zh'] as Record<string, string>)[key] || key

  const cells = useMemo(() => {
    // grid[day 0=Mon..6=Sun][hour 0..23] = { sessions, volume }
    const grid: { sessions: number; volume: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ sessions: 0, volume: 0 })),
    )
    const all = [...entries.map(e => e.hevy), ...unmatchedHevy]
    for (const h of all) {
      const d = new Date(h.startDate)
      const dow = (d.getDay() + 6) % 7 // Mon=0
      const hr = d.getHours()
      grid[dow][hr].sessions += 1
      grid[dow][hr].volume += h.totalVolumeKg
    }
    return grid
  }, [entries, unmatchedHevy])

  const max = useMemo(() => {
    let m = 0
    for (const row of cells) for (const c of row) if (c.sessions > m) m = c.sessions
    return m
  }, [cells])

  if (entries.length === 0 && unmatchedHevy.length === 0) return null

  const DAYS = language === 'zh'
    ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  // Show only "interesting" hours range to keep cells readable (still all 24).
  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  return (
    <>
      <SectionHeader>{t('schedule')}</SectionHeader>
      <div className="bg-zinc-900 rounded-xl p-4 overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour header */}
          <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: '40px repeat(24, minmax(18px, 1fr))' }}>
            <div />
            {HOURS.map(h => (
              <div key={h} className="text-[9px] text-zinc-600 text-center tabular-nums">
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>
          {DAYS.map((day, dow) => (
            <div key={day} className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: '40px repeat(24, minmax(18px, 1fr))' }}>
              <div className="text-[10px] text-zinc-500 self-center pr-2 text-right">{day}</div>
              {HOURS.map(hr => {
                const c = cells[dow][hr]
                const opacity = max > 0 ? c.sessions / max : 0
                const empty = c.sessions === 0
                const tip = empty
                  ? (language === 'zh' ? `${day} ${hr}:00 — 无训练` : `${day} ${hr}:00 — no sessions`)
                  : (language === 'zh' ? `${day} ${hr}:00 — ${c.sessions} 次训练, ${Math.round(c.volume)} 公斤` : `${day} ${hr}:00 — ${c.sessions} session${c.sessions === 1 ? '' : 's'}, ${Math.round(c.volume)} kg`)
                return (
                  <div
                    key={hr}
                    title={tip}
                    className="aspect-square rounded-sm"
                    style={{
                      background: empty ? 'rgba(63,63,70,0.35)' : COLORS.purple,
                      opacity: empty ? 1 : 0.25 + opacity * 0.75,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-zinc-500">
          <span>{t('less')}</span>
          {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
            <div key={o} className="w-3 h-3 rounded-sm" style={{ background: COLORS.purple, opacity: 0.25 + o * 0.75 }} />
          ))}
          <span>{t('more')}</span>
          <span className="ml-auto tabular-nums">{t('peak')}: {max} {language === 'zh' ? '次训练' : `session${max === 1 ? '' : 's'}`}</span>
        </div>
      </div>
    </>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

interface SessionDetailProps {
  entry: StrengthEntry
  exerciseHistory: Map<string, { sessionId: string; sessionStart: string; e1rm: number; volume: number }[]>
  hrTimeline: { t: number; v: number }[]
  maxHR: number
  ct: ReturnType<typeof useChartTheme>
}

export function SessionDetail({ entry, exerciseHistory, hrTimeline, maxHR }: SessionDetailProps) {
  const { language } = useTranslation()
  const t = (key: string): string => (tDict[language as 'en' | 'zh'] as Record<string, string>)[key] || key

  const { hevy: h, apple } = entry
  const startMs = +new Date(h.startDate)
  const endMs = +new Date(h.endDate)

  // Working sets/reps (exclude warmups)
  const working = useMemo(() => {
    let sets = 0, reps = 0, vol = 0
    for (const ex of h.exercises) {
      for (const s of ex.sets) {
        if (s.type === 'warmup') continue
        sets++
        reps += s.reps ?? 0
        if (s.weightKg != null && s.reps != null && s.type !== 'dropset') vol += s.weightKg * s.reps
      }
    }
    return { sets, reps, vol }
  }, [h.exercises])

  // HR samples within the session window
  const hrSamples = useMemo(() => {
    if (!hrTimeline.length) return []
    return hrTimeline.filter(s => s.t >= startMs && s.t <= endMs)
      .map(s => ({ min: (s.t - startMs) / 60000, bpm: s.v }))
  }, [hrTimeline, startMs, endMs])

  const hrStats = useMemo(() => {
    if (hrSamples.length === 0) return null
    let sum = 0, mn = Infinity, mx = 0
    for (const s of hrSamples) {
      sum += s.bpm
      if (s.bpm < mn) mn = s.bpm
      if (s.bpm > mx) mx = s.bpm
    }
    return { avg: sum / hrSamples.length, min: mn, max: mx }
  }, [hrSamples])

  // Per-muscle-group volume for THIS session
  const muscleVolume = useMemo(() => {
    const m = new Map<string, number>()
    for (const ex of h.exercises) {
      const key = ex.primaryMuscleGroup ?? 'other'
      m.set(key, (m.get(key) ?? 0) + ex.volumeKg)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [h.exercises])
  const muscleTotal = muscleVolume.reduce((s, [, v]) => s + v, 0)

  // Volume-derived calorie estimate (rough)
  const derivedKcal = Math.round(0.05 * h.totalVolumeKg + 5 * h.totalSets)

  return (
    <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 space-y-4">
      {h.description && (
        <p className="text-xs text-zinc-300 italic bg-zinc-950/50 rounded-lg px-3 py-2">"{h.description}"</p>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <Chip label={t('volume')} value={fmt(h.totalVolumeKg)} unit="kg" color={COLORS.purple} />
        <Chip label={t('workingSets')} value={`${working.sets}`} sub={`/ ${t('total')} ${h.totalSets}`} color={COLORS.blue} />
        <Chip label={t('workingReps')} value={`${working.reps}`} color={COLORS.cyan} />
        <Chip label={t('duration')} value={fmt(h.durationMin)} unit="min" />
        {apple?.calories ? (
          <Chip label={t('caloriesApple')} value={`${Math.round(apple.calories)}`} unit="kcal" color={COLORS.orange} />
        ) : (
          <Chip label={t('estCalories')} value={`${derivedKcal}`} unit="kcal" color={COLORS.orange} sub={t('fromVolume')} />
        )}
        {apple?.avgMETs != null && <Chip label={t('avgMets')} value={apple.avgMETs.toFixed(1)} />}
        {hrStats && <Chip label={t('hrAvg')} value={`${Math.round(hrStats.avg)}`} unit="bpm" color={COLORS.red} />}
        {hrStats && <Chip label={t('hrMax')} value={`${Math.round(hrStats.max)}`} unit="bpm" color={COLORS.red} sub={language === 'zh' ? `最大心率的 ${Math.round(hrStats.max / maxHR * 100)}%` : `${Math.round(hrStats.max / maxHR * 100)}% maxHR`} />}
        {apple?.weather && <Chip label={t('weather')} value={`${apple.weather}`} />}
        {apple?.elevationAscended != null && apple.elevationAscended > 0 && <Chip label={t('elevation')} value={`${Math.round(apple.elevationAscended)}`} unit="m" />}
      </div>


      {/* Muscle-group distribution for this session */}
      {muscleTotal > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">{t('volumeByMuscle')}</span>
            <span className="text-[10px] text-zinc-500 tabular-nums">{fmt(muscleTotal)} kg</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-zinc-950">
            {muscleVolume.map(([group, vol]) => (
              <div
                key={group}
                style={{ width: `${(vol / muscleTotal) * 100}%`, background: muscleColor(group) }}
                title={`${getMuscleLabel(group, t)}: ${Math.round(vol)} kg`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] tabular-nums">
            {muscleVolume.map(([group, vol]) => (
              <span key={group} className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: muscleColor(group) }} />
                <span className="text-zinc-400 capitalize">{getMuscleLabel(group, t)}</span>
                <span className="text-zinc-500">{Math.round((vol / muscleTotal) * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-exercise detail */}
      {h.exercises.map(ex => {
        const top = bestSet(ex.sets)
        const e1 = bestE1RM(ex.sets)
        const history = exerciseHistory.get(ex.title) ?? []
        const idx = history.findIndex(x => x.sessionId === h.id)
        const priorBest = idx > 0 ? Math.max(...history.slice(0, idx).map(x => x.e1rm)) : 0
        const isPR = idx >= 0 && e1 > 0 && e1 > priorBest && history.length > 1
        const lastE1 = idx > 0 ? history[idx - 1].e1rm : 0
        const delta = idx > 0 && lastE1 > 0 ? e1 - lastE1 : null

        return (
          <div key={`${ex.index}-${ex.templateId}`} className="bg-zinc-950/30 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-medium text-zinc-100 truncate">{ex.title}</span>
                {ex.primaryMuscleGroup && (
                  <span
                    className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ color: muscleColor(ex.primaryMuscleGroup), background: `${muscleColor(ex.primaryMuscleGroup)}1f` }}
                  >
                    {getMuscleLabel(ex.primaryMuscleGroup, t)}
                  </span>
                )}
                {isPR && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/30">
                    {t('pr')}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-500 tabular-nums shrink-0 flex items-center gap-3">
                {top && <span>{t('topLabel')}: <span className="text-zinc-300">{top.weight} kg × {top.reps}</span></span>}
                {e1 > 0 && (
                  <span>
                    e1RM <span className="text-zinc-300">{e1.toFixed(1)}</span>
                    {delta !== null && Math.abs(delta) >= 0.05 && (
                      <span className={delta > 0 ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                      </span>
                    )}
                  </span>
                )}
                <span>vol <span className="text-zinc-300">{Math.round(ex.volumeKg)}</span> kg</span>
              </div>
            </div>
            <div className="grid grid-cols-[40px_60px_60px_60px_60px] gap-x-3 gap-y-1 text-[11px] tabular-nums">
              <div className="text-zinc-600 uppercase tracking-wider text-[10px]">{t('set')}</div>
              <div className="text-zinc-600 uppercase tracking-wider text-[10px]">{t('type')}</div>
              <div className="text-zinc-600 uppercase tracking-wider text-[10px]">{t('weight')}</div>
              <div className="text-zinc-600 uppercase tracking-wider text-[10px]">{t('reps')}</div>
              <div className="text-zinc-600 uppercase tracking-wider text-[10px]">{t('rpe')}</div>
              {ex.sets.map(s => <SetRow key={s.index} set={s} />)}
            </div>
            {ex.notes && <div className="text-[11px] text-zinc-500 italic mt-2">{ex.notes}</div>}
          </div>
        )
      })}
    </div>
  )
}

function Chip({ label, value, unit, sub, color }: { label: string; value: string; unit?: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-950/40 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">{label}</div>
      <div className="text-[15px] font-semibold tabular-nums leading-tight">
        <span style={{ color }}>{value}</span>
        {unit && <span className="text-[11px] text-zinc-500 ml-1 font-normal">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function SetRow({ set }: { set: { index: number; type: string; weightKg: number | null; reps: number | null; rpe: number | null } }) {
  const typeColor =
    set.type === 'warmup' ? 'text-amber-400/80' :
    set.type === 'failure' ? 'text-red-400/80' :
    set.type === 'dropset' ? 'text-purple-400/80' :
    'text-zinc-500'
  const typeLabel =
    set.type === 'warmup' ? 'W' :
    set.type === 'failure' ? 'F' :
    set.type === 'dropset' ? 'D' :
    '·'
  return (
    <>
      <div className="text-zinc-500">{set.index + 1}</div>
      <div className={typeColor}>{typeLabel}</div>
      <div className="text-zinc-200">{set.weightKg != null ? `${set.weightKg}` : '—'}</div>
      <div className="text-zinc-200">{set.reps != null ? set.reps : '—'}</div>
      <div className="text-zinc-400">{set.rpe != null ? set.rpe : '—'}</div>
    </>
  )
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4">
      <div className="text-[11px] font-medium tracking-wider uppercase text-zinc-500 mb-1.5">{label}</div>
      <div className="text-[26px] font-semibold tracking-tight tabular-nums leading-none">
        <span style={{ color }}>{value}</span>
        {unit && <span className="text-[13px] text-zinc-500 ml-1 font-normal">{unit}</span>}
      </div>
    </div>
  )
}
