import { useMemo } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Area, Line, ReferenceArea, ReferenceLine,
} from 'recharts'
import type { Workout } from './types'
import { chartMargin, COLORS, shortDate, StatBox, Legend, AISummaryButton, TabHeader, fmt, useChartTheme, ChartTooltip } from './ui'

// Simplified TRIMP (Training Impulse) calculation
// Uses duration * HR intensity factor. When HR is missing, fall back to calories-based estimate.
function computeTrimp(workout: Workout): number {
  const durationMin = workout.duration
  if (durationMin <= 0) return 0

  if (workout.hrAvg && workout.hrAvg > 0) {
    // Banister's TRIMP simplified: duration * intensity factor
    // intensity = (HRavg - HRrest) / (HRmax - HRrest)
    // We estimate HRrest=60, HRmax=190 as defaults
    const hrRest = 60
    const hrMax = 190
    const intensity = Math.max(0, Math.min(1, (workout.hrAvg - hrRest) / (hrMax - hrRest)))
    return Math.round(durationMin * intensity * (0.64 * Math.exp(1.92 * intensity)))
  }

  // Fallback: use calories as proxy (roughly 1 TRIMP per 5 kcal for moderate exercise)
  if (workout.calories > 0) {
    return Math.round(workout.calories / 5)
  }

  // Last resort: duration-based estimate (moderate intensity)
  return Math.round(durationMin * 0.5)
}

interface DailyLoad {
  date: string
  trimp: number
  workoutCount: number
}

function buildDailyLoads(workouts: Workout[]): DailyLoad[] {
  const byDate = new Map<string, { trimp: number; count: number }>()
  for (const w of workouts) {
    const trimp = computeTrimp(w)
    const existing = byDate.get(w.date)
    if (existing) {
      existing.trimp += trimp
      existing.count++
    } else {
      byDate.set(w.date, { trimp, count: 1 })
    }
  }

  // Fill gaps between first and last workout date
  const dates = [...byDate.keys()].sort()
  if (dates.length === 0) return []

  const result: DailyLoad[] = []
  const start = new Date(dates[0])
  const end = new Date(dates[dates.length - 1])

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().substring(0, 10)
    const load = byDate.get(dateStr)
    result.push({
      date: dateStr,
      trimp: load?.trimp ?? 0,
      workoutCount: load?.count ?? 0,
    })
  }

  return result
}

// Exponentially weighted moving average
function ewma(data: number[], window: number): number[] {
  const alpha = 2 / (window + 1)
  const result: number[] = []
  let prev = data[0] || 0
  for (const v of data) {
    prev = alpha * v + (1 - alpha) * prev
    result.push(Math.round(prev * 10) / 10)
  }
  return result
}

interface Props {
  workouts: Workout[]
  cutoffDate: string
}

import { useTranslation } from './lib/i18n'

const tDict = {
  en: {
    title: 'Training Load',
    desc: 'Track your fitness, fatigue, and form using the TRIMP model — based on workout duration and heart rate intensity.',
    // Stat Box
    fitness: 'Fitness (CTL)',
    fitnessSub: '42-day chronic load',
    fatigue: 'Fatigue (ATL)',
    fatigueSub: '7-day acute load',
    form: 'Form (TSB)',
    weeklyLoad: 'Weekly Load',
    currentWeek: 'Current week',
    workouts: 'Workouts',
    totalRecorded: 'Total recorded',
    // Status
    statusFreshened: 'Freshened',
    statusFresh: 'Fresh',
    statusOptimal: 'Optimal',
    statusFatigued: 'Fatigued',
    statusOverreaching: 'Overreaching',
    // Messages
    noData: 'Not enough workout data to compute training load (need at least 7 days).',
    explainerTitle: 'How to read this',
    explainerDesc: 'Fitness (CTL) is your long-term training load — it builds slowly over weeks. Fatigue (ATL) is your short-term load — it spikes with hard training. Form (TSB) is the balance: when fitness exceeds fatigue, you\'re fresh and ready to perform. When fatigue exceeds fitness, you need recovery. The sweet spot for racing is TSB between -10 and +15.',
    // Charts
    chartTitleMain: 'Fitness, Fatigue & Form',
    chartDescMain: 'Blue = long-term fitness, red = short-term fatigue, green area = form (freshness).',
    chartTitleWeekly: 'Weekly Training Load',
    chartDescWeekly: 'Total TRIMP per week. Avoid increasing more than 10-15% week over week.',
    // Series & Legends
    seriesFitness: 'Fitness (CTL)',
    seriesFatigue: 'Fatigue (ATL)',
    seriesForm: 'Form (TSB)',
    seriesTrimp: 'TRIMP',
    seriesLoad: 'Load',
    seriesWorkouts: 'Workouts',
    legendRaceReady: 'Race-ready zone',
    sessions: 'sessions',
  },
  zh: {
    title: '训练负荷',
    desc: '使用 TRIMP 模型跟踪你的体能、疲劳度和竞技状态——该模型基于运动时长和心率强度计算。',
    // Stat Box
    fitness: '体能 (CTL)',
    fitnessSub: '42天长期训练负荷',
    fatigue: '疲劳度 (ATL)',
    fatigueSub: '7天短期急性负荷',
    form: '竞技状态 (Form/TSB)',
    weeklyLoad: '每周负荷',
    currentWeek: '当前周',
    workouts: '运动次数',
    totalRecorded: '累计记录数',
    // Status
    statusFreshened: '恢复良好',
    statusFresh: '精力充沛',
    statusOptimal: '最佳状态',
    statusFatigued: '处于疲劳',
    statusOverreaching: '疲劳过度',
    // Messages
    noData: '运动数据不足以计算训练负荷（至少需要 7 天的数据）。',
    explainerTitle: '如何解读？',
    explainerDesc: '体能 (CTL) 是你的长期训练负荷——需要在数周内缓慢积累。疲劳度 (ATL) 是你的短期负荷——会随着高强度训练而迅速上升。竞技状态 (Form/TSB) 是两者之差：当体能高于疲劳度时，你处于充沛状态，利于发挥；当疲劳度高于体能时，你需要进行恢复。最适宜比赛的竞技状态 (TSB) 区间在 -10 至 +15 之间。',
    // Charts
    chartTitleMain: '体能、疲劳度与竞技状态',
    chartDescMain: '蓝色代表长期体能，红色代表短期疲劳，绿色阴影区域代表竞技状态（新鲜度）。',
    chartTitleWeekly: '每周训练负荷',
    chartDescWeekly: '每周累计 TRIMP。建议避免周环比增幅超过 10-15%。',
    // Series & Legends
    seriesFitness: '体能 (CTL)',
    seriesFatigue: '疲劳度 (ATL)',
    seriesForm: '竞技状态 (TSB)',
    seriesTrimp: 'TRIMP',
    seriesLoad: '负荷',
    seriesWorkouts: '运动次数',
    legendRaceReady: '适宜比赛区间',
    sessions: '次运动',
  }
}

export default function TrainingLoad({ workouts, cutoffDate }: Props) {
  const { language } = useTranslation()
  const t = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]
  const ct = useChartTheme()
  const dailyLoads = useMemo(() => buildDailyLoads(workouts), [workouts])

  const chartData = useMemo(() => {
    if (dailyLoads.length === 0) return []
    const trimps = dailyLoads.map(d => d.trimp)
    const atl = ewma(trimps, 7)  // Acute (fatigue) — 7-day
    const ctl = ewma(trimps, 42) // Chronic (fitness) — 42-day

    const all = dailyLoads.map((d, i) => ({
      date: d.date,
      trimp: d.trimp,
      atl: atl[i],
      ctl: ctl[i],
      tsb: Math.round((ctl[i] - atl[i]) * 10) / 10, // Training Stress Balance (form)
    }))

    if (!cutoffDate) return all
    return all.filter(d => d.date >= cutoffDate)
  }, [dailyLoads, cutoffDate])

  // Weekly load summary
  const weeklyLoad = useMemo(() => {
    if (chartData.length === 0) return []
    const result: { week: string; trimp: number; count: number }[] = []
    let weekStart = chartData[0].date
    let sum = 0, count = 0
    for (const d of chartData) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        result.push({ week: weekStart, trimp: sum, count })
        weekStart = d.date
        sum = 0; count = 0
      }
      sum += d.trimp
      const dl = dailyLoads.find(l => l.date === d.date)
      if (dl) count += dl.workoutCount
    }
    if (sum > 0 || count > 0) result.push({ week: weekStart, trimp: sum, count })
    return result
  }, [chartData, dailyLoads])

  // Current values
  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const currentATL = latest?.atl ?? null
  const currentCTL = latest?.ctl ?? null
  const currentTSB = latest?.tsb ?? null

  const getFormStatus = (tsb: number) => {
    if (tsb > 15) return t('statusFreshened')
    if (tsb > 0) return t('statusFresh')
    if (tsb > -15) return t('statusOptimal')
    if (tsb > -30) return t('statusFatigued')
    return t('statusOverreaching')
  }

  const formStatus = currentTSB !== null ? getFormStatus(currentTSB) : null
  const formColor = currentTSB !== null
    ? currentTSB > 15 ? COLORS.blue : currentTSB > 0 ? COLORS.green : currentTSB > -15 ? COLORS.cyan : currentTSB > -30 ? COLORS.orange : COLORS.red
    : undefined

  // Recent week trimp
  const recentWeekTrimp = weeklyLoad.length > 0 ? weeklyLoad[weeklyLoad.length - 1].trimp : null

  if (chartData.length < 7) {
    return <div className="text-zinc-500 text-center py-20">{t('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={t('title')} description={t('desc')} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {currentCTL !== null && <StatBox label={t('fitness')} value={fmt(currentCTL, 0)} color={COLORS.blue} sub={t('fitnessSub')} />}
        {currentATL !== null && <StatBox label={t('fatigue')} value={fmt(currentATL, 0)} color={COLORS.red} sub={t('fatigueSub')} />}
        {currentTSB !== null && <StatBox label={t('form')} value={`${currentTSB > 0 ? '+' : ''}${fmt(currentTSB, 0)}`} color={formColor} sub={formStatus ?? undefined} />}
        {recentWeekTrimp !== null && <StatBox label={t('weeklyLoad')} value={fmt(recentWeekTrimp, 0)} unit="TRIMP" sub={t('currentWeek')} />}
        <StatBox label={t('workouts')} value={`${workouts.length}`} sub={t('totalRecorded')} />
      </div>

      {/* Explainer */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-1.5">{t('explainerTitle')}</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          {t('explainerDesc')}
        </p>
      </div>

      {/* Main ATL/CTL/TSB chart */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-sm font-medium text-zinc-300">{t('chartTitleMain')}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{t('chartDescMain')}</p>
          </div>
          <AISummaryButton title={t('chartTitleMain')} description={t('chartDescMain')} chartData={chartData} />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
            <ComposedChart margin={chartMargin} data={chartData}>
              <defs>
                <linearGradient id="tsbPosGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tsbNegGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
              <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
              {/* Optimal TSB zone */}
              <ReferenceArea y1={-10} y2={15} fill="#22c55e" fillOpacity={0.03} />
              <ReferenceLine y={0} stroke="#71717a" strokeDasharray="3 3" />
              <Tooltip content={<ChartTooltip formatter={(v, name) => {
                  if (name === 'ctl') return [`${v}`, t('seriesFitness')]
                  if (name === 'atl') return [`${v}`, t('seriesFatigue')]
                  if (name === 'tsb') return [`${v}`, t('seriesForm')]
                  return [`${v}`, t('seriesTrimp')]
                }} />} />
              <Area type="monotone" dataKey="tsb" stroke="#22c55e" fill="url(#tsbPosGrad)" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="ctl" stroke={COLORS.blue} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="atl" stroke={COLORS.red} strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 justify-center mt-2">
          <Legend color={COLORS.blue} label={t('seriesFitness')} />
          <Legend color={COLORS.red} label={t('seriesFatigue')} />
          <Legend color="#22c55e" label={t('seriesForm')} />
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <div className="w-4 h-2 rounded-sm bg-green-500/10 border border-green-500/20" />
            {t('legendRaceReady')}
          </div>
        </div>
      </div>

      {/* Weekly training load */}
      {weeklyLoad.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('chartTitleWeekly')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('chartDescWeekly')}</p>
            </div>
            <AISummaryButton title={t('chartTitleWeekly')} description={t('chartDescWeekly')} chartData={weeklyLoad} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <ComposedChart margin={chartMargin} data={weeklyLoad}>
                <defs>
                  <linearGradient id="weeklyTrimpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(v, name) => [name === 'trimp' ? `${v} TRIMP` : `${v} ${t('sessions')}`, name === 'trimp' ? t('seriesLoad') : t('seriesWorkouts')]} />} />
                <Area type="monotone" dataKey="trimp" stroke={COLORS.orange} fill="url(#weeklyTrimpGrad)" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
