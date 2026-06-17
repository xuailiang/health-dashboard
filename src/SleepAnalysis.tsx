import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, ScatterChart, Scatter, ZAxis, ReferenceLine, ComposedChart, Line,
} from 'recharts'
import type { SleepRecord, DailySleep, WristTempRecord, DailyBreathing } from './types'
import type { Granularity } from './analysis'
import { chartMargin, COLORS, shortDate, avg, Legend, AISummaryButton, TabHeader, useChartTheme, ChartTooltip } from './ui'
import { useTranslation } from './lib/i18n'


const SLEEP_COLORS = { core: '#6366f1', deep: COLORS.purple, rem: COLORS.cyan, awake: COLORS.orange, temp: COLORS.red }

function buildDailySleep(records: SleepRecord[]): DailySleep[] {
  const byDate = new Map<string, SleepRecord[]>()
  for (const r of records) {
    const existing = byDate.get(r.date) || []
    existing.push(r)
    byDate.set(r.date, existing)
  }

  const result: DailySleep[] = []
  for (const [date, recs] of byDate) {
    let core = 0, deep = 0, rem = 0, awake = 0
    let earliest = '', latest = ''
    let earliestInBed = ''

    // Check if granular stages exist — if so, ignore 'unspecified' to avoid double-counting
    const hasStages = recs.some(r => r.stage === 'core' || r.stage === 'deep' || r.stage === 'rem')

    for (const r of recs) {
      if (r.stage === 'inbed') {
        if (!earliestInBed || r.startDate < earliestInBed) earliestInBed = r.startDate
        continue
      }
      if (r.stage === 'awake') awake += r.minutes
      else if (r.stage === 'unspecified') {
        if (!hasStages) core += r.minutes // Only count if no granular data
      }
      else if (r.stage === 'core') core += r.minutes
      else if (r.stage === 'deep') deep += r.minutes
      else if (r.stage === 'rem') rem += r.minutes

      if (!earliest || r.startDate < earliest) earliest = r.startDate
      if (!latest || r.endDate > latest) latest = r.endDate
    }

    const total = core + deep + rem
    if (total < 60) continue

    // Sleep latency: minutes from bed → first asleep stage. Only meaningful if InBed was logged before sleep onset.
    let latency: number | null = null
    if (earliestInBed && earliest && earliestInBed < earliest) {
      const mins = (new Date(earliest).getTime() - new Date(earliestInBed).getTime()) / 60000
      if (mins >= 0 && mins < 180) latency = Math.round(mins)
    }

    // WASO: sum of 'awake' stage minutes whose records fall within [firstSleep, lastSleep]
    let waso = 0
    if (earliest && latest) {
      for (const r of recs) {
        if (r.stage !== 'awake') continue
        if (r.startDate >= earliest && r.endDate <= latest) waso += r.minutes
      }
    }

    // Midsleep: time-of-day midpoint between sleep onset and final wake
    let midSleep: number | null = null
    if (earliest && latest) {
      const midMs = (new Date(earliest).getTime() + new Date(latest).getTime()) / 2
      const md = new Date(midMs)
      midSleep = md.getHours() * 60 + md.getMinutes()
    }

    result.push({
      date,
      core: Math.round(core), deep: Math.round(deep), rem: Math.round(rem), awake: Math.round(awake),
      total: Math.round(total),
      bedtime: earliest ? formatTimeOfDay(earliest) : '',
      wakeTime: latest ? formatTimeOfDay(latest) : '',
      latency,
      waso: Math.round(waso),
      midSleep,
    })
  }
  return result.sort((a, b) => a.date.localeCompare(b.date))
}

function formatTimeOfDay(iso: string): string {
  const match = iso.match(/(\d{2}):(\d{2}):\d{2}/)
  if (match) return `${match[1]}:${match[2]}`
  try {
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  } catch { return '' }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(((m % 1440) + 1440) % 1440 / 60)
  const min = Math.round(m % 60)
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const mean = avg(arr)
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length)
}

// Sleep consistency score: 0-100 based on bedtime regularity, wake regularity, and duration regularity
function computeConsistencyScore(daily: DailySleep[]): number | null {
  if (daily.length < 7) return null

  const bedtimes = daily.filter(d => d.bedtime).map(d => {
    let m = timeToMinutes(d.bedtime)
    if (m < 720) m += 1440
    return m
  })
  const wakes = daily.filter(d => d.wakeTime).map(d => timeToMinutes(d.wakeTime))
  const durations = daily.map(d => d.total)

  if (bedtimes.length < 5) return null

  // Score each component: lower std dev = higher score
  // Bedtime: <15min std = 100, >90min std = 0
  const bedStd = stdDev(bedtimes)
  const bedScore = Math.max(0, Math.min(100, 100 - (bedStd - 15) * (100 / 75)))

  const wakeStd = stdDev(wakes)
  const wakeScore = Math.max(0, Math.min(100, 100 - (wakeStd - 15) * (100 / 75)))

  const durStd = stdDev(durations)
  const durScore = Math.max(0, Math.min(100, 100 - (durStd - 15) * (100 / 75)))

  return Math.round((bedScore * 0.4 + wakeScore * 0.4 + durScore * 0.2))
}

function weeklyAverageSleep(daily: DailySleep[]): { week: string; core: number; deep: number; rem: number; awake: number }[] {
  if (daily.length === 0) return []
  const result: { week: string; core: number; deep: number; rem: number; awake: number }[] = []
  let weekStart = daily[0].date
  let coreAcc: number[] = [], deepAcc: number[] = [], remAcc: number[] = [], awakeAcc: number[] = []

  for (const d of daily) {
    const daysDiff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
    if (daysDiff >= 7) {
      if (coreAcc.length > 0) {
        result.push({
          week: weekStart,
          core: Math.round(avg(coreAcc) / 60 * 10) / 10,
          deep: Math.round(avg(deepAcc) / 60 * 10) / 10,
          rem: Math.round(avg(remAcc) / 60 * 10) / 10,
          awake: Math.round(avg(awakeAcc) / 60 * 10) / 10,
        })
      }
      weekStart = d.date
      coreAcc = []; deepAcc = []; remAcc = []; awakeAcc = []
    }
    coreAcc.push(d.core); deepAcc.push(d.deep); remAcc.push(d.rem); awakeAcc.push(d.awake)
  }
  if (coreAcc.length > 0) {
    result.push({
      week: weekStart,
      core: Math.round(avg(coreAcc) / 60 * 10) / 10,
      deep: Math.round(avg(deepAcc) / 60 * 10) / 10,
      rem: Math.round(avg(remAcc) / 60 * 10) / 10,
      awake: Math.round(avg(awakeAcc) / 60 * 10) / 10,
    })
  }
  return result
}

interface Metric {
  label: string
  value: string
  sub?: string
  color?: string
}

function MetricGroup({ title, description, metrics }: { title: string; description: string; metrics: (Metric | null)[] }) {
  const visible = metrics.filter((m): m is Metric => m !== null)
  if (visible.length === 0) return null
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-4">
        {visible.map((m) => (
          <div key={m.label} className="min-w-0">
            <div className="text-[10px] font-medium tracking-wider uppercase text-zinc-500 mb-1">{m.label}</div>
            <div className="text-[22px] font-semibold tracking-tight tabular-nums leading-none" style={{ color: m.color }}>
              {m.value}
            </div>
            {m.sub && <div className="text-zinc-500 text-[11px] mt-1.5 tabular-nums">{m.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

const tDict = {
  en: {
    noData: 'No sleep stage data found.',
    sleep: 'Sleep',
    desc: 'Sleep duration, stages, schedule patterns, and breathing metrics during sleep.',
    durationStages: 'Duration & Stages',
    durationStagesDesc: 'Deep = physical recovery. REM = learning and mood. Core = light sleep between them.',
    avgSleep: 'Avg Sleep',
    deep: 'Deep',
    rem: 'REM',
    core: 'Core',
    last30: 'Last 30 nights',
    ofTotal: 'of total',
    scheduleChronotype: 'Schedule & Chronotype',
    scheduleChronotypeDesc: 'Consistency (0–100) rewards steady bed/wake times. Midsleep is your body-clock marker — a shifting one signals social jet lag.',
    bedtime: 'Bedtime',
    wake: 'Wake',
    consistency: 'Consistency',
    midsleep: 'Midsleep',
    midpoint: 'Midpoint of sleep',
    min: 'min',
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    sleepQuality: 'Sleep Quality',
    sleepQualityDesc: 'How well you slept once in bed. Latency = time to fall asleep. WASO = minutes awake after falling asleep. Debt = rolling hours vs an 8h target.',
    efficiency: 'Efficiency',
    asleepInBed: 'Asleep / in bed',
    latency: 'Latency',
    mins: 'mins',
    fallAsleep: 'To fall asleep',
    waso: 'WASO',
    awakeAfterFall: 'Awake after sleep onset',
    debt: 'Sleep Debt',
    vsTarget: 'vs 8h target',
    hrs: 'hrs',
    cumulativeDebt: 'Cumulative Debt',
    nightlyDelta: 'Nightly Δ',
    sleepStagesWeekly: 'Sleep Stages (weekly avg, hours)',
    awake: 'Awake',
    bedtimeWakeWeekly: 'Bedtime & Wake Schedule (weekly avg)',
    consistentSchedule: 'Consistent schedule = better sleep quality',
    totalSleepTrend: 'Total Sleep Trend (weekly avg)',
    totalSleep: 'Total Sleep',
    bedtimeScatter: 'Bedtime Scatter',
    total: 'Total',
    wristTempTitle: 'Wrist Temperature During Sleep',
    wristTempDesc: 'Deviation from baseline ({avgTemp}°C ±{tempStd}°C). Spikes may indicate illness or cycle changes.',
    deviation: 'Deviation',
    temperature: 'Temperature',
    deepDive: 'Deep Dive',
    sleepConsistencyTitle: 'Sleep Consistency (rolling 14-day)',
    sleepConsistencyDesc: 'Higher = steadier bed/wake times and duration. Low variance is a stronger health predictor than any single night.',
    sleepLatencyTitle: 'Sleep Latency',
    sleepLatencyDesc: 'Minutes from bed to first sleep stage. Healthy range: 10–20 min. >30 min suggests stress, screens, or late caffeine.',
    wasoTitle: 'Wake After Sleep Onset (WASO)',
    wasoDesc: 'Minutes awake between falling asleep and final wake. Healthy: <20 min. Rising trend can indicate fragmentation.',
    chronotypeDriftTitle: 'Chronotype Drift (monthly midsleep)',
    chronotypeDriftDesc: 'Midpoint between sleep onset and final wake. A shifting midsleep signals social jet lag or lifestyle changes.',
    respRateAnomaliesTitle: 'Respiratory Rate Anomalies',
    respRateAnomaliesDesc: 'Nights more than 1 SD from your 30-day baseline. Elevated resp rate often precedes illness by 1–2 days.',
    respRate: 'Resp Rate',
    baseline: 'Baseline',
    plus1SD: '+1 SD',
    minus1SD: '−1 SD',
    anomaly: 'Anomaly',
    respRateLabel: 'Resp rate',
    baselineLabel: '30-day baseline',
    anomalyLabel: 'Anomaly (>1 SD)',
    breathingResp: 'Breathing & Respiratory',
    breathingDisturbancesTitle: 'Breathing Disturbances (weekly avg)',
    breathingDisturbancesDesc: 'Events/hr during sleep. Under 5 is normal.',
    respRateWeeklyTitle: 'Respiratory Rate (weekly avg)',
    respRateWeeklyDesc: 'Normal: 12-20 breaths/min at rest',
    bloodOxygenWeeklyTitle: 'Blood Oxygen (weekly avg)',
    bloodOxygenWeeklyDesc: 'Normal: 95-100%',
    sleepDebtDesc: 'Cumulative surplus or deficit against an {TARGET_HOURS}h nightly target. Below zero means you owe your body sleep.',
    currentAvg: 'Current avg',
  },
  zh: {
    noData: '未发现睡眠阶段数据。',
    sleep: '睡眠分析',
    desc: '分析睡眠时长、睡眠阶段分布、作息规律一致性以及睡眠呼吸健康指标。',
    durationStages: '睡眠时长与阶段',
    durationStagesDesc: '深睡 = 身体恢复与免疫。快速动眼 (REM) = 脑力整理与情绪调节。核心睡眠 = 介于两者之间的浅睡。',
    avgSleep: '日均睡眠',
    deep: '深睡',
    rem: '快速动眼 (REM)',
    core: '核心睡眠',
    last30: '最近30晚日均',
    ofTotal: '占总睡眠时长',
    scheduleChronotype: '作息时间与体质分型',
    scheduleChronotypeDesc: '作息一致性 (0–100) 评估入睡/起床规律度。睡眠中点值反映生物钟稳定性，剧烈漂移提示社交时差。',
    bedtime: '平均入睡时间',
    wake: '平均起床时间',
    consistency: '作息一致性',
    midsleep: '睡眠中点值',
    midpoint: '睡眠的中点时间',
    min: '分钟',
    excellent: '极佳',
    good: '优良',
    fair: '一般',
    poor: '较差',
    sleepQuality: '睡眠质量指标',
    sleepQualityDesc: '评估在床上的睡眠效率。入睡潜伏期指入睡耗时；WASO 为入睡后苏醒时间；睡眠债则对比每晚 8 小时目标的缺口。',
    efficiency: '睡眠效率',
    asleepInBed: '在床睡眠比例',
    latency: '入睡潜伏期',
    mins: '分钟',
    fallAsleep: '入睡耗时',
    waso: '入睡后苏醒 (WASO)',
    awakeAfterFall: '睡着后的清醒时间',
    debt: '睡眠负债',
    vsTarget: '对比 8小时 目标',
    hrs: '小时',
    cumulativeDebt: '累计负债',
    nightlyDelta: '单晚差值',
    sleepStagesWeekly: '睡眠阶段走势（周均值，小时）',
    awake: '清醒',
    bedtimeWakeWeekly: '入睡与起床时间走势（周均值）',
    consistentSchedule: '作息越规律 = 睡眠质量越好',
    totalSleepTrend: '总睡眠时长趋势（周均值）',
    totalSleep: '总睡眠时间',
    bedtimeScatter: '入睡时间散点分布',
    total: '总计',
    wristTempTitle: '睡眠期间手腕温度变化',
    wristTempDesc: '手腕温度与基线的偏离度 ({avgTemp}°C ±{tempStd}°C)。异常波动可能提示身体不适或生理周期变化。',
    deviation: '偏离度',
    temperature: '绝对温度',
    deepDive: '深度指标分析',
    sleepConsistencyTitle: '作息一致性趋势（14天滚动）',
    sleepConsistencyDesc: '分值越高代表入睡/起床和睡眠时长越规律。低波动比单晚时长更有助于预测健康状态。',
    sleepLatencyTitle: '入睡潜伏期',
    sleepLatencyDesc: '躺下到进入第一睡眠阶段的时间。健康范围为 10-20 分钟。超过 30 分钟可能暗示有压力、看屏幕或晚摄入咖啡因。',
    wasoTitle: '入睡后清醒时间 (WASO)',
    wasoDesc: '入睡到最终醒来之间醒着的分钟数。健康标准：小于 20 分钟。上升趋势可能预示睡眠呈碎片化。',
    chronotypeDriftTitle: '生物钟偏移（月度睡眠中点）',
    chronotypeDriftDesc: '入睡与最终醒来的中间中间时刻。睡眠中点偏移代表有社交时差或作息变化。',
    respRateAnomaliesTitle: '呼吸频率异常监测',
    respRateAnomaliesDesc: '偏离 30 天基线超过 1 倍标准差的夜晚。呼吸频率升高通常比生病提前 1-2 天显现。',
    respRate: '呼吸频率',
    baseline: '基线值',
    plus1SD: '+1 标准差',
    minus1SD: '−1 标准差',
    anomaly: '异常波动',
    respRateLabel: '呼吸频率',
    baselineLabel: '30天基线',
    anomalyLabel: '异常 (>1标准差)',
    breathingResp: '呼吸与肺部健康',
    breathingDisturbancesTitle: '呼吸紊乱指数（周均值）',
    breathingDisturbancesDesc: '每小时睡眠中的紊乱事件。5 次以下属于正常。',
    respRateWeeklyTitle: '呼吸频率趋势（周均值）',
    respRateWeeklyDesc: '正常值：静息状态下每分钟 12-20 次',
    bloodOxygenWeeklyTitle: '血氧饱和度走势（周均值）',
    bloodOxygenWeeklyDesc: '正常范围：95-100%',
    sleepDebtDesc: '对比每晚 8 小时目标的累计盈余或赤字。低于 0 代表您处于睡眠不足状态。',
    currentAvg: '当前均值',
  }
}

interface Props {
  sleepRecords: SleepRecord[]
  wristTempRecords: WristTempRecord[]
  dailyBreathing: DailyBreathing[]
  cutoffDate: string
  granularity: Granularity
}

export default function SleepAnalysis({ sleepRecords, wristTempRecords, dailyBreathing, cutoffDate, granularity: _granularity }: Props) {
  const { language } = useTranslation()
  const t = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]
  const ct = useChartTheme()
  const filtered = useMemo(() => {
    if (!cutoffDate) return sleepRecords
    return sleepRecords.filter(r => r.date >= cutoffDate)
  }, [sleepRecords, cutoffDate])

  const dailySleep = useMemo(() => buildDailySleep(filtered), [filtered])
  const weeklyData = useMemo(() => weeklyAverageSleep(dailySleep), [dailySleep])

  const recent = dailySleep.slice(-30)
  const avgTotal = recent.length ? avg(recent.map(d => d.total)) / 60 : 0
  const avgDeep = recent.length ? avg(recent.map(d => d.deep)) / 60 : 0
  const avgRem = recent.length ? avg(recent.map(d => d.rem)) / 60 : 0
  const avgCore = recent.length ? avg(recent.map(d => d.core)) / 60 : 0

  const bedtimes = recent.filter(d => d.bedtime).map(d => {
    let mins = timeToMinutes(d.bedtime)
    if (mins < 720) mins += 1440
    return mins
  })
  const avgBedtime = bedtimes.length ? avg(bedtimes) : 0
  const bedtimeStd = stdDev(bedtimes)

  const wakeTimes = recent.filter(d => d.wakeTime).map(d => timeToMinutes(d.wakeTime))
  const avgWake = wakeTimes.length ? avg(wakeTimes) : 0
  const wakeStd = stdDev(wakeTimes)

  const consistencyScore = useMemo(() => computeConsistencyScore(recent), [recent])

  const avgEfficiency = recent.length > 0
    ? Math.round(avg(recent.map(d => d.total / (d.total + d.awake) * 100)))
    : null

  const weeklySchedule = useMemo(() => {
    if (dailySleep.length === 0) return []
    const result: { week: string; bedtime: number | null; wake: number | null }[] = []
    let weekStart = dailySleep[0].date
    let bedAcc: number[] = [], wakeAcc: number[] = []

    for (const d of dailySleep) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        result.push({
          week: weekStart,
          bedtime: bedAcc.length ? Math.round(avg(bedAcc)) : null,
          wake: wakeAcc.length ? Math.round(avg(wakeAcc)) : null,
        })
        weekStart = d.date
        bedAcc = []; wakeAcc = []
      }
      if (d.bedtime) {
        let m = timeToMinutes(d.bedtime)
        if (m < 720) m += 1440
        bedAcc.push(m)
      }
      if (d.wakeTime) wakeAcc.push(timeToMinutes(d.wakeTime))
    }
    if (bedAcc.length > 0 || wakeAcc.length > 0) {
      result.push({
        week: weekStart,
        bedtime: bedAcc.length ? Math.round(avg(bedAcc)) : null,
        wake: wakeAcc.length ? Math.round(avg(wakeAcc)) : null,
      })
    }
    return result
  }, [dailySleep])

  const tempData = useMemo(() => {
    let data = wristTempRecords
    if (cutoffDate) data = data.filter(r => r.date >= cutoffDate)
    if (data.length === 0) return []
    return [...data].sort((a, b) => a.date.localeCompare(b.date))
  }, [wristTempRecords, cutoffDate])

  const avgTemp = tempData.length > 0 ? avg(tempData.map(t => t.value)) : null
  const tempStd = tempData.length > 1 ? stdDev(tempData.map(t => t.value)) : null

  const tempDeviationData = useMemo(() => {
    if (tempData.length < 7) return []
    const baseline = avg(tempData.map(t => t.value))
    return tempData.map(t => ({
      date: t.date,
      deviation: Math.round((t.value - baseline) * 100) / 100,
      absolute: t.value,
    }))
  }, [tempData])

  const filteredBreathing = useMemo(() => {
    if (!cutoffDate) return dailyBreathing
    return dailyBreathing.filter(d => d.date >= cutoffDate)
  }, [dailyBreathing, cutoffDate])

  const weeklyDisturbances = useMemo(() => {
    const data = filteredBreathing.filter(d => d.disturbances !== null)
    if (data.length === 0) return []
    const result: { week: string; value: number }[] = []
    let weekStart = data[0].date
    let vals: number[] = []
    for (const d of data) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals) * 10) / 10 })
        weekStart = d.date
        vals = []
      }
      vals.push(d.disturbances!)
    }
    if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals) * 10) / 10 })
    return result
  }, [filteredBreathing])

  const weeklyRespRate = useMemo(() => {
    const data = filteredBreathing.filter(d => d.respiratoryRate !== null)
    if (data.length === 0) return []
    const result: { week: string; value: number }[] = []
    let weekStart = data[0].date
    let vals: number[] = []
    for (const d of data) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals) * 10) / 10 })
        weekStart = d.date
        vals = []
      }
      vals.push(d.respiratoryRate!)
    }
    if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals) * 10) / 10 })
    return result
  }, [filteredBreathing])

  const weeklySpo2 = useMemo(() => {
    const data = filteredBreathing.filter(d => d.spo2 !== null)
    if (data.length === 0) return []
    const result: { week: string; value: number }[] = []
    let weekStart = data[0].date
    let vals: number[] = []
    for (const d of data) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals) * 10) / 10 })
        weekStart = d.date
        vals = []
      }
      vals.push(d.spo2!)
    }
    if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals) * 10) / 10 })
    return result
  }, [filteredBreathing])

  const recentBreathing = filteredBreathing.slice(-30)
  const recentDist = recentBreathing.filter(d => d.disturbances !== null).map(d => d.disturbances!)
  const avgDist = recentDist.length > 0 ? avg(recentDist) : null

  const TARGET_HOURS = 8
  const sleepDebtData = useMemo(() => {
    if (dailySleep.length === 0) return []
    const sorted = [...dailySleep].sort((a, b) => a.date.localeCompare(b.date))
    let cumDebt = 0
    return sorted.map(d => {
      const hoursSlept = d.total / 60
      const diff = hoursSlept - TARGET_HOURS
      cumDebt += diff
      return {
        date: d.date,
        debt: Math.round(cumDebt * 10) / 10,
        nightly: Math.round(diff * 10) / 10,
      }
    })
  }, [dailySleep])

  const filteredDebt = useMemo(() => {
    if (!cutoffDate) return sleepDebtData
    return sleepDebtData.filter(d => d.date >= cutoffDate)
  }, [sleepDebtData, cutoffDate])

  const currentDebt = filteredDebt.length > 0 ? filteredDebt[filteredDebt.length - 1].debt : null
  const recent7Debt = useMemo(() => {
    const last7 = dailySleep.slice(-7)
    if (last7.length === 0) return null
    return Math.round(last7.reduce((s, d) => s + (d.total / 60 - TARGET_HOURS), 0) * 10) / 10
  }, [dailySleep])

  const consistencyTrend = useMemo(() => {
    const filteredDaily = cutoffDate ? dailySleep.filter(d => d.date >= cutoffDate) : dailySleep
    if (filteredDaily.length < 14) return []
    const out: { date: string; score: number }[] = []
    for (let i = 13; i < filteredDaily.length; i++) {
      const window = filteredDaily.slice(i - 13, i + 1)
      const score = computeConsistencyScore(window)
      if (score !== null) out.push({ date: filteredDaily[i].date, score })
    }
    return out
  }, [dailySleep, cutoffDate])

  const latencyData = useMemo(() => {
    const filteredDaily = cutoffDate ? dailySleep.filter(d => d.date >= cutoffDate) : dailySleep
    return filteredDaily.filter(d => d.latency !== null).map(d => ({ date: d.date, value: d.latency! }))
  }, [dailySleep, cutoffDate])

  const recentLatency = latencyData.slice(-30)
  const avgLatency = recentLatency.length > 0 ? Math.round(avg(recentLatency.map(d => d.value))) : null

  const wasoData = useMemo(() => {
    const filteredDaily = cutoffDate ? dailySleep.filter(d => d.date >= cutoffDate) : dailySleep
    return filteredDaily.filter(d => d.waso > 0).map(d => ({ date: d.date, value: d.waso }))
  }, [dailySleep, cutoffDate])

  const recentWaso = wasoData.slice(-30)
  const avgWaso = recentWaso.length > 0 ? Math.round(avg(recentWaso.map(d => d.value))) : null

  const chronotypeData = useMemo(() => {
    const filteredDaily = cutoffDate ? dailySleep.filter(d => d.date >= cutoffDate) : dailySleep
    const byMonth = new Map<string, number[]>()
    for (const d of filteredDaily) {
      if (d.midSleep === null) continue
      const month = d.date.substring(0, 7)
      const arr = byMonth.get(month) || []
      arr.push(d.midSleep)
      byMonth.set(month, arr)
    }
    return Array.from(byMonth.entries())
      .map(([month, vals]) => ({
        month: month + '-01',
        midSleep: Math.round(avg(vals)),
        spread: Math.round(stdDev(vals)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [dailySleep, cutoffDate])

  const recentMidSleep = dailySleep.slice(-30).filter(d => d.midSleep !== null).map(d => d.midSleep!)
  const avgMidSleep = recentMidSleep.length > 0 ? Math.round(avg(recentMidSleep)) : null

  const respAnomalyData = useMemo(() => {
    const data = filteredBreathing.filter(d => d.respiratoryRate !== null)
      .map(d => ({ date: d.date, value: d.respiratoryRate! }))
    if (data.length < 14) return { series: [] as Array<{ date: string; value: number; baseline: number | null; upper: number | null; lower: number | null; anomaly: number | null }>, anomalyCount: 0 }
    let anomalyCount = 0
    const series = data.map((d, i) => {
      const start = Math.max(0, i - 29)
      const window = data.slice(start, i).map(p => p.value) 
      if (window.length < 7) {
        return { date: d.date, value: d.value, baseline: null, upper: null, lower: null, anomaly: null }
      }
      const mean = avg(window)
      const sd = stdDev(window)
      const upper = mean + sd
      const lower = mean - sd
      const isAnomaly = d.value > upper || d.value < lower
      if (isAnomaly) anomalyCount++
      return {
        date: d.date,
        value: Math.round(d.value * 10) / 10,
        baseline: Math.round(mean * 10) / 10,
        upper: Math.round(upper * 10) / 10,
        lower: Math.round(lower * 10) / 10,
        anomaly: isAnomaly ? Math.round(d.value * 10) / 10 : null,
      }
    })
    return { series, anomalyCount }
  }, [filteredBreathing])

  if (dailySleep.length === 0 && filteredBreathing.length === 0) {
    return <div className="text-zinc-500 text-center py-20">{t('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={t('sleep')} description={t('desc')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricGroup
          title={t('durationStages')}
          description={t('durationStagesDesc')}
          metrics={[
            { label: t('avgSleep'), value: `${avgTotal.toFixed(1)}h`, sub: t('last30') },
            { label: t('deep'), value: `${avgDeep.toFixed(1)}h`, sub: `${avgTotal > 0 ? Math.round(avgDeep / avgTotal * 100) : 0}% ${t('ofTotal')}`, color: SLEEP_COLORS.deep },
            { label: t('rem'), value: `${avgRem.toFixed(1)}h`, sub: `${avgTotal > 0 ? Math.round(avgRem / avgTotal * 100) : 0}% ${t('ofTotal')}`, color: SLEEP_COLORS.rem },
            { label: t('core'), value: `${avgCore.toFixed(1)}h`, sub: `${avgTotal > 0 ? Math.round(avgCore / avgTotal * 100) : 0}% ${t('ofTotal')}`, color: SLEEP_COLORS.core },
          ]}
        />
        <MetricGroup
          title={t('scheduleChronotype')}
          description={t('scheduleChronotypeDesc')}
          metrics={[
            { label: t('bedtime'), value: minutesToTime(avgBedtime > 1440 ? avgBedtime - 1440 : avgBedtime), sub: `±${Math.round(bedtimeStd)} ${t('min')}` },
            { label: t('wake'), value: minutesToTime(avgWake), sub: `±${Math.round(wakeStd)} ${t('min')}` },
            consistencyScore !== null
              ? {
                  label: t('consistency'),
                  value: `${consistencyScore}`,
                  sub: consistencyScore >= 80 ? t('excellent') : consistencyScore >= 60 ? t('good') : consistencyScore >= 40 ? t('fair') : t('poor'),
                  color: consistencyScore >= 80 ? '#22c55e' : consistencyScore >= 60 ? '#f97316' : '#ef4444',
                }
              : null,
            avgMidSleep !== null ? { label: t('midsleep'), value: minutesToTime(avgMidSleep), sub: t('midpoint') } : null,
          ]}
        />
      </div>

      <MetricGroup
        title={t('sleepQuality')}
        description={t('sleepQualityDesc')}
        metrics={[
          avgEfficiency !== null
            ? {
                label: t('efficiency'),
                value: `${avgEfficiency}%`,
                sub: t('asleepInBed'),
                color: avgEfficiency >= 85 ? '#22c55e' : avgEfficiency >= 75 ? '#f97316' : '#ef4444',
              }
            : null,
          avgLatency !== null
            ? {
                label: t('latency'),
                value: `${avgLatency}${t('mins')}`,
                sub: t('fallAsleep'),
                color: avgLatency <= 20 ? '#22c55e' : avgLatency <= 35 ? '#f97316' : '#ef4444',
              }
            : null,
          avgWaso !== null
            ? {
                label: 'WASO',
                value: `${avgWaso}m`,
                sub: 'Awake mid-sleep',
                color: avgWaso <= 20 ? '#22c55e' : avgWaso <= 40 ? '#f97316' : '#ef4444',
              }
            : null,
          recent7Debt !== null
            ? {
                label: '7-Day Debt',
                value: `${recent7Debt > 0 ? '+' : ''}${recent7Debt}h`,
                sub: recent7Debt >= 0 ? 'Surplus vs 8h' : 'Deficit vs 8h',
                color: recent7Debt >= 0 ? '#22c55e' : recent7Debt >= -3 ? '#f97316' : '#ef4444',
              }
            : null,
        ]}
      />

      {/* Sleep Debt Tracker */}
      {filteredDebt.length > 7 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('debt')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('sleepDebtDesc')}</p>
            </div>
            <AISummaryButton title={t('debt')} description={language === 'zh' ? `累计睡眠盈余/赤字 (对比 ${TARGET_HOURS}小时 目标)` : `Cumulative sleep surplus/deficit vs ${TARGET_HOURS}h target`} chartData={filteredDebt} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <ComposedChart margin={chartMargin} data={filteredDebt}>
                <defs>
                  <linearGradient id="debtPosGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="debtNegGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                <ReferenceLine y={0} stroke="#71717a" strokeDasharray="3 3" />
                <Tooltip content={<ChartTooltip formatter={(v, name) => [
                  name === 'debt' ? `${v}h` : `${(v as number) > 0 ? '+' : ''}${v}h`,
                  name === 'debt' ? t('cumulativeDebt') : t('nightlyDelta')
                ]} />} />
                <Area type="monotone" dataKey="debt" stroke={currentDebt !== null && currentDebt >= 0 ? '#22c55e' : '#ef4444'} fill={currentDebt !== null && currentDebt >= 0 ? 'url(#debtPosGrad)' : 'url(#debtNegGrad)'} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="nightly" stroke={COLORS.cyan} strokeWidth={1} dot={false} strokeOpacity={0.4} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {currentDebt !== null && (
            <p className="text-xs text-zinc-500 text-center mt-2">
              {currentDebt >= 0
                ? (language === 'zh' ? `您比 ${TARGET_HOURS}小时 目标超前了 ${currentDebt} 小时。` : `You're ${currentDebt}h ahead of your ${TARGET_HOURS}h target.`)
                : (language === 'zh' ? `您还欠身体 ${Math.abs(currentDebt)} 小时的睡眠。` : `You owe your body ${Math.abs(currentDebt)}h of sleep.`)
              }
            </p>
          )}
        </div>
      )}

      {/* Sleep stages stacked bar (weekly) */}
      {weeklyData.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('sleepStagesWeekly')}</h3>
            </div>
            <AISummaryButton title={t('sleepStagesWeekly')} description={language === 'zh' ? '周均睡眠阶段占比（小时）' : 'Weekly average sleep stages in hours'} chartData={weeklyData} />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <BarChart margin={chartMargin} data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(value, name) => [`${value}h`, name === 'core' ? t('core') : name === 'deep' ? t('deep') : name === 'rem' ? t('rem') : t('awake')]} />} />
                <Bar dataKey="deep" stackId="sleep" fill={SLEEP_COLORS.deep} radius={[0, 0, 0, 0]} />
                <Bar dataKey="rem" stackId="sleep" fill={SLEEP_COLORS.rem} />
                <Bar dataKey="core" stackId="sleep" fill={SLEEP_COLORS.core} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-2">
            {Object.entries(SLEEP_COLORS).filter(([k]) => k !== 'temp').map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                {key === 'core' ? t('core') : key === 'deep' ? t('deep') : key === 'rem' ? t('rem') : key === 'awake' ? t('awake') : key}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bedtime & wake schedule trend */}
        {weeklySchedule.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('bedtimeWakeWeekly')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('consistentSchedule')}</p>
              </div>
              <AISummaryButton title={t('bedtimeWakeWeekly')} description={t('consistentSchedule')} chartData={weeklySchedule} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklySchedule}>
                  <defs>
                    <linearGradient id="bedtimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SLEEP_COLORS.deep} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={SLEEP_COLORS.deep} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="wakeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10, fill: ct.tick }}
                    tickFormatter={v => minutesToTime(v > 1440 ? v - 1440 : v)}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v, name) => [minutesToTime((v as number) > 1440 ? (v as number) - 1440 : (v as number)), name === 'bedtime' ? t('bedtime') : t('wake')]} />} />
                  <Area type="monotone" dataKey="bedtime" stroke={SLEEP_COLORS.deep} fill="url(#bedtimeGrad)" strokeWidth={1.5} dot={false} connectNulls />
                  <Area type="monotone" dataKey="wake" stroke="#f97316" fill="url(#wakeGrad)" strokeWidth={1.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 justify-center mt-2">
              <Legend color={SLEEP_COLORS.deep} label={t('bedtime')} />
              <Legend color="#f97316" label={t('wake')} />
            </div>
          </div>
        )}

        {/* Total sleep duration trend */}
        {weeklyData.length > 0 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('totalSleepTrend')}</h3>
              </div>
              <AISummaryButton title={t('totalSleepTrend')} description={language === 'zh' ? '周均总睡眠时长走势' : 'Weekly average total sleep duration'} chartData={weeklyData.map(w => ({ week: w.week, total: Math.round((w.core + w.deep + w.rem) * 10) / 10 }))} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyData.map(w => ({ week: w.week, total: Math.round((w.core + w.deep + w.rem) * 10) / 10 }))}>
                  <defs>
                    <linearGradient id="sleepTotalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v}h`, t('totalSleep')]} />} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#sleepTotalGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bedtime consistency scatter */}
        {dailySleep.length > 7 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('bedtimeScatter')}</h3>
              </div>
              <AISummaryButton title={t('bedtimeScatter')} description={language === 'zh' ? '每日入睡时间及睡眠时长散点分布' : 'Daily bedtime consistency scatter plot'} chartData={dailySleep.filter(d => d.bedtime).map(d => { let bedMins = timeToMinutes(d.bedtime); if (bedMins < 720) bedMins += 1440; return { date: d.date, bedtime: bedMins, total: d.total / 60 } })} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <ScatterChart margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: ct.tick }}
                    tickFormatter={shortDate}
                  />
                  <YAxis
                    dataKey="bedtime"
                    tick={{ fontSize: 10, fill: ct.tick }}
                    domain={['auto', 'auto']}
                    tickFormatter={v => minutesToTime(v > 1440 ? v - 1440 : v)}
                    reversed
                  />
                  <ZAxis dataKey="total" range={[20, 80]} />
                  <Tooltip content={<ChartTooltip formatter={(value, name) => {
                      if (typeof value !== 'number') return [`${value}`, String(name)]
                      if (name === 'bedtime') return [minutesToTime(value > 1440 ? value - 1440 : value), t('bedtime')]
                      if (name === 'total') return [`${value.toFixed(1)}h`, t('total')]
                      return [`${value}`, String(name)]
                    }} />} />
                  <Scatter
                    data={dailySleep.filter(d => d.bedtime).map(d => {
                      let bedMins = timeToMinutes(d.bedtime)
                      if (bedMins < 720) bedMins += 1440
                      return { date: d.date, bedtime: bedMins, total: d.total / 60 }
                    })}
                    fill="#8b5cf6"
                    opacity={0.5}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Wrist temperature deviation */}
        {tempDeviationData.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('wristTempTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t('wristTempDesc').replace('{avgTemp}', avgTemp?.toFixed(1) || '').replace('{tempStd}', tempStd?.toFixed(2) || '')}
                </p>
              </div>
              <AISummaryButton title={t('wristTempTitle')} description={language === 'zh' ? '睡眠期间手腕温度与基线的偏离度。异常波动可能提示身体不适或生理周期变化。' : 'Deviation from baseline wrist temperature. Spikes may indicate illness or cycle changes.'} chartData={tempDeviationData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={tempDeviationData}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SLEEP_COLORS.temp} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={SLEEP_COLORS.temp} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={v => `${v > 0 ? '+' : ''}${v}°`} />
                  <ReferenceLine y={0} stroke="#71717a" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTooltip formatter={(v, name) => {
                      if (name === 'deviation') return [`${(v as number) > 0 ? '+' : ''}${v}°C`, t('deviation')]
                      return [`${v}°C`, t('temperature')]
                    }} />} />
                  <Area type="monotone" dataKey="deviation" stroke={SLEEP_COLORS.temp} fill="url(#tempGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Deep-dive section */}
      {(consistencyTrend.length > 0 || latencyData.length > 0 || wasoData.length > 0 || chronotypeData.length > 1) && (
        <h2 className="text-sm font-medium text-zinc-400 mt-2">{t('deepDive')}</h2>
      )}

      {/* Sleep Consistency trend */}
      {consistencyTrend.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('sleepConsistencyTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('sleepConsistencyDesc')}</p>
            </div>
            <AISummaryButton title={t('sleepConsistencyTitle')} description={language === 'zh' ? '14天滚动一致性评分。分值越高代表睡眠越规律。' : 'Rolling 14-day consistency score. Higher = steadier sleep schedule.'} chartData={consistencyTrend} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={chartMargin} data={consistencyTrend}>
                <defs>
                  <linearGradient id="consistencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: ct.tick }} />
                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" label={{ value: t('excellent'), position: 'right', fill: ct.tick, fontSize: 10 }} />
                <ReferenceLine y={60} stroke="#f97316" strokeDasharray="3 3" label={{ value: t('good'), position: 'right', fill: ct.tick, fontSize: 10 }} />
                <Tooltip content={<ChartTooltip formatter={(v) => [`${v}`, language === 'zh' ? '一致性评分' : 'Score']} />} />
                <Area type="monotone" dataKey="score" stroke="#22c55e" fill="url(#consistencyGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sleep Latency */}
        {latencyData.length > 3 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('sleepLatencyTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('sleepLatencyDesc')}</p>
              </div>
              <AISummaryButton title={t('sleepLatencyTitle')} description={language === 'zh' ? '入睡潜伏期时间走势（分钟）' : 'Minutes from bed to first sleep stage'} chartData={latencyData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={latencyData}>
                  <defs>
                    <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" />
                  <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${t('min')}`, t('latency')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.cyan} fill="url(#latencyGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* WASO */}
        {wasoData.length > 3 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('wasoTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('wasoDesc')}</p>
              </div>
              <AISummaryButton title={t('wasoTitle')} description={language === 'zh' ? '入睡后苏醒时间走势（分钟）' : 'Minutes awake between first sleep and final wake'} chartData={wasoData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={wasoData}>
                  <defs>
                    <linearGradient id="wasoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SLEEP_COLORS.awake} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={SLEEP_COLORS.awake} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${t('min')}`, t('waso')]} />} />
                  <Area type="monotone" dataKey="value" stroke={SLEEP_COLORS.awake} fill="url(#wasoGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Chronotype drift */}
      {chronotypeData.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('chronotypeDriftTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('chronotypeDriftDesc')}</p>
            </div>
            <AISummaryButton title={t('chronotypeDriftTitle')} description={language === 'zh' ? '月度睡眠中点（入睡与起床中间时刻）变化趋势' : 'Monthly average midsleep time (midpoint between sleep onset and final wake)'} chartData={chronotypeData} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={chartMargin} data={chronotypeData}>
                <defs>
                  <linearGradient id="chronoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis
                  tick={{ fontSize: 10, fill: ct.tick }}
                  tickFormatter={(v) => minutesToTime(v)}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<ChartTooltip formatter={(v, name) => {
                  if (name === 'midSleep') return [minutesToTime(v as number), t('midsleep')]
                  return [`±${v} ${t('min')}`, language === 'zh' ? '标准差 (σ)' : 'Spread (σ)']
                }} />} />
                <Area type="monotone" dataKey="midSleep" stroke={COLORS.purple} fill="url(#chronoGrad)" strokeWidth={1.5} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Respiratory Rate Anomalies */}
      {respAnomalyData.series.length > 14 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('respRateAnomaliesTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('respRateAnomaliesDesc')}
                {respAnomalyData.anomalyCount > 0 && <> {language === 'zh' ? '已标记：' : 'Flagged: '} <span className="text-orange-400">{respAnomalyData.anomalyCount} {language === 'zh' ? '晚' : `night${respAnomalyData.anomalyCount === 1 ? '' : 's'}`}</span>.</>}
              </p>
            </div>
            <AISummaryButton title={t('respRateAnomaliesTitle')} description={language === 'zh' ? '超出滚动 30 天基线 1 倍标准差的夜晚' : 'Nights outside 1 SD of rolling 30-day baseline'} chartData={respAnomalyData.series} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <ComposedChart margin={chartMargin} data={respAnomalyData.series}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(v, name) => {
                  const unit = language === 'zh' ? '次/分' : 'br/min'
                  if (name === 'value') return [`${v} ${unit}`, t('respRate')]
                  if (name === 'baseline') return [`${v} ${unit}`, t('baseline')]
                  if (name === 'upper') return [`${v} ${unit}`, t('plus1SD')]
                  if (name === 'lower') return [`${v} ${unit}`, t('minus1SD')]
                  if (name === 'anomaly') return [`${v} ${unit}`, t('anomaly')]
                  return [`${v}`, String(name)]
                }} />} />
                <Area type="monotone" dataKey="upper" stroke="none" fill={COLORS.cyan} fillOpacity={0.08} />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#0a0a0a" fillOpacity={1} />
                <Line type="monotone" dataKey="baseline" stroke={COLORS.cyan} strokeWidth={1} strokeDasharray="4 4" dot={false} strokeOpacity={0.6} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                <Scatter dataKey="anomaly" fill="#ef4444" shape="circle" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-2 flex-wrap">
            <Legend color="#3b82f6" label={t('respRateLabel')} />
            <Legend color={COLORS.cyan} label={t('baselineLabel')} dashed />
            <Legend color="#ef4444" label={t('anomalyLabel')} />
          </div>
        </div>
      )}

      {/* Breathing & Respiratory section */}
      {(weeklyDisturbances.length > 1 || weeklyRespRate.length > 1 || weeklySpo2.length > 1) && (
        <>
          <h2 className="text-sm font-medium text-zinc-400 mt-2">{t('breathingResp')}</h2>

          {/* Disturbances */}
          {weeklyDisturbances.length > 1 && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="text-sm font-medium text-zinc-300">{t('breathingDisturbancesTitle')}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {t('breathingDisturbancesDesc')}
                    {avgDist !== null && <> {t('currentAvg')}: <span className={avgDist < 5 ? 'text-green-400' : avgDist < 15 ? 'text-orange-400' : 'text-red-400'}>{avgDist.toFixed(1)}/hr</span></>}
                  </p>
                </div>
                <AISummaryButton title={t('breathingDisturbancesTitle')} description={language === 'zh' ? '每小时睡眠中的紊乱事件（5次以下正常）' : 'Events per hour during sleep. Under 5 is normal.'} chartData={weeklyDisturbances} />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                  <AreaChart margin={chartMargin} data={weeklyDisturbances}>
                    <defs>
                      <linearGradient id="distGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                    <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                    <ReferenceLine y={5} stroke="#f97316" strokeDasharray="3 3" label={{ value: language === 'zh' ? '轻度' : 'Mild', position: 'right', fill: ct.tick, fontSize: 10 }} />
                    <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="3 3" label={{ value: language === 'zh' ? '中度' : 'Moderate', position: 'right', fill: ct.tick, fontSize: 10 }} />
                    <Tooltip content={<ChartTooltip formatter={(v) => [`${v}/hr`, language === 'zh' ? '紊乱事件' : 'Disturbances']} />} />
                    <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#distGrad2)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Respiratory rate */}
            {weeklyRespRate.length > 1 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300">{t('respRateWeeklyTitle')}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{t('respRateWeeklyDesc')}</p>
                  </div>
                  <AISummaryButton title={t('respRateWeeklyTitle')} description={t('respRateWeeklyDesc')} chartData={weeklyRespRate} />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <AreaChart margin={chartMargin} data={weeklyRespRate}>
                      <defs>
                        <linearGradient id="sleepRespRateGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                      <ReferenceLine y={12} stroke="#71717a" strokeDasharray="3 3" />
                      <ReferenceLine y={20} stroke="#71717a" strokeDasharray="3 3" />
                      <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${language === 'zh' ? '次/分' : 'br/min'}`, t('respRateLabel')]} />} />
                      <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#sleepRespRateGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* SpO2 */}
            {weeklySpo2.length > 1 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300">{t('bloodOxygenWeeklyTitle')}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{t('bloodOxygenWeeklyDesc')}</p>
                  </div>
                  <AISummaryButton title={t('bloodOxygenWeeklyTitle')} description={t('bloodOxygenWeeklyDesc')} chartData={weeklySpo2} />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <AreaChart margin={chartMargin} data={weeklySpo2}>
                      <defs>
                        <linearGradient id="spo2Grad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                      <YAxis domain={['auto', 100]} tick={{ fontSize: 10, fill: ct.tick }} />
                      <ReferenceLine y={95} stroke="#71717a" strokeDasharray="3 3" />
                      <Tooltip content={<ChartTooltip formatter={(v) => [`${v}%`, 'SpO2']} />} />
                      <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#spo2Grad2)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

