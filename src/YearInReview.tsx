import { useMemo } from 'react'
import type { DailyMetrics, Workout } from './types'
import { TabHeader } from './ui'
import { useTranslation } from './lib/i18n'

const tDict = {
  en: {
    title: "Year in Review",
    description: "A yearly breakdown of your key health and fitness metrics.",
    noData: "No data available.",
    metric: "Metric",
    daysTracked: "Days Tracked",
    totalSteps: "Total Steps",
    avgSteps: "Avg Steps/Day",
    totalDistance: "Total Distance",
    activeEnergy: "Active Energy",
    avgSleep: "Avg Sleep",
    avgRestingHR: "Avg Resting HR",
    avgHRV: "Avg HRV",
    bestVO2: "Best VO2 Max",
    workouts: "Workouts",
    workoutTime: "Workout Time",
    workoutCalories: "Workout Calories",
    strengthSessions: "Strength Sessions",
    totalTonnage: "Total Tonnage",
    strengthSets: "Strength Sets",
    strengthTime: "Strength Time",
    unitHrs: "hrs",
    unitKcal: "kcal",
    unitKm: "km",
    unitBpm: "bpm",
    unitHrv: "ms",
    unitKg: "kg"
  },
  zh: {
    title: "年度回顾",
    description: "按年汇总并对比您的核心健康与运动指标。",
    noData: "暂无可用数据。",
    metric: "指标项",
    daysTracked: "记录天数",
    totalSteps: "总步数",
    avgSteps: "日均步数",
    totalDistance: "总里程",
    activeEnergy: "活跃消耗",
    avgSleep: "日均睡眠",
    avgRestingHR: "平均静息心率",
    avgHRV: "平均 HRV",
    bestVO2: "最佳最大摄氧量",
    workouts: "训练次数",
    workoutTime: "训练时长",
    workoutCalories: "训练消耗",
    strengthSessions: "力量训练次数",
    totalTonnage: "累计负重",
    strengthSets: "力量训练总组数",
    strengthTime: "力量训练时长",
    unitHrs: "小时",
    unitKcal: "千卡",
    unitKm: "公里",
    unitBpm: "次/分",
    unitHrv: "毫秒",
    unitKg: "公斤"
  }
}

interface YearStats {
  year: string
  totalSteps: number
  avgSteps: number
  totalDistance: number // km
  totalActiveEnergy: number
  avgSleep: number | null
  avgRestingHR: number | null
  avgHRV: number | null
  bestVO2: number | null
  workoutCount: number
  workoutMinutes: number
  workoutCalories: number
  daysTracked: number
  strengthSessions: number
  tonnageKg: number
  strengthSets: number
  strengthMinutes: number
}

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

function fmt(n: number | null, d = 0): string {
  if (n === null) return '--'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(d)
}

function pctChange(curr: number | null, prev: number | null): { text: string; positive: boolean | null } {
  if (curr === null || prev === null || prev === 0) return { text: '', positive: null }
  const pct = ((curr - prev) / prev) * 100
  return {
    text: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`,
    positive: pct > 0,
  }
}

interface Props {
  metrics: DailyMetrics[]
  workouts: Workout[]
}

export default function YearInReview({ metrics, workouts }: Props) {
  const { language } = useTranslation()
  const t = (key: keyof typeof tDict.en) => tDict[language as 'en' | 'zh'][key]

  const years = useMemo(() => {
    const byYear = new Map<string, DailyMetrics[]>()
    for (const m of metrics) {
      const y = m.date.substring(0, 4)
      const arr = byYear.get(y) || []
      arr.push(m)
      byYear.set(y, arr)
    }

    const workoutsByYear = new Map<string, Workout[]>()
    for (const w of workouts) {
      const y = w.date.substring(0, 4)
      const arr = workoutsByYear.get(y) || []
      arr.push(w)
      workoutsByYear.set(y, arr)
    }

    const result: YearStats[] = []
    for (const [year, days] of byYear) {
      const yw = workoutsByYear.get(year) || []
      const sleepDays = days.filter(d => d.sleepHours && d.sleepHours > 0).map(d => d.sleepHours!)
      const hrDays = days.filter(d => d.restingHeartRate && d.restingHeartRate > 0).map(d => d.restingHeartRate!)
      const hrvDays = days.filter(d => d.hrv && d.hrv > 0).map(d => d.hrv!)
      const vo2Days = days.filter(d => d.vo2max && d.vo2max > 0).map(d => d.vo2max!)

      result.push({
        year,
        totalSteps: days.reduce((s, d) => s + d.steps, 0),
        avgSteps: Math.round(days.reduce((s, d) => s + d.steps, 0) / days.length),
        totalDistance: days.reduce((s, d) => s + d.distance, 0),
        totalActiveEnergy: days.reduce((s, d) => s + d.activeEnergy, 0),
        avgSleep: avg(sleepDays),
        avgRestingHR: avg(hrDays),
        avgHRV: avg(hrvDays),
        bestVO2: vo2Days.length > 0 ? Math.max(...vo2Days) : null,
        workoutCount: yw.length,
        workoutMinutes: yw.reduce((s, w) => s + w.duration, 0),
        workoutCalories: yw.reduce((s, w) => s + w.calories, 0),
        daysTracked: days.length,
        strengthSessions: yw.reduce((s, w) => s + (w.hevy ? 1 : 0), 0),
        tonnageKg: yw.reduce((s, w) => s + (w.hevy ? w.hevy.totalVolumeKg : 0), 0),
        strengthSets: yw.reduce((s, w) => s + (w.hevy ? w.hevy.totalSets : 0), 0),
        strengthMinutes: yw.reduce((s, w) => s + (w.hevy ? w.hevy.durationMin : 0), 0),
      })
    }

    return result.sort((a, b) => b.year.localeCompare(a.year))
  }, [metrics, workouts])

  if (years.length === 0) {
    return <div className="text-zinc-500 text-center py-20">{t('noData')}</div>
  }

  const rows: {
    label: string
    key: keyof YearStats
    format: (v: number | null) => string
    unit: string
    higherIsGood: boolean
  }[] = [
    { label: t('daysTracked'), key: 'daysTracked', format: v => fmt(v), unit: '', higherIsGood: true },
    { label: t('totalSteps'), key: 'totalSteps', format: v => fmt(v), unit: '', higherIsGood: true },
    { label: t('avgSteps'), key: 'avgSteps', format: v => fmt(v), unit: '', higherIsGood: true },
    { label: t('totalDistance'), key: 'totalDistance', format: v => fmt(v, 0), unit: t('unitKm'), higherIsGood: true },
    { label: t('activeEnergy'), key: 'totalActiveEnergy', format: v => fmt(v), unit: t('unitKcal'), higherIsGood: true },
    { label: t('avgSleep'), key: 'avgSleep', format: v => fmt(v, 1), unit: t('unitHrs'), higherIsGood: true },
    { label: t('avgRestingHR'), key: 'avgRestingHR', format: v => fmt(v, 0), unit: t('unitBpm'), higherIsGood: false },
    { label: t('avgHRV'), key: 'avgHRV', format: v => fmt(v, 0), unit: t('unitHrv'), higherIsGood: true },
    { label: t('bestVO2'), key: 'bestVO2', format: v => fmt(v, 1), unit: '', higherIsGood: true },
    { label: t('workouts'), key: 'workoutCount', format: v => fmt(v), unit: '', higherIsGood: true },
    { label: t('workoutTime'), key: 'workoutMinutes', format: v => v !== null ? `${Math.round(v / 60)}` : '--', unit: t('unitHrs'), higherIsGood: true },
    { label: t('workoutCalories'), key: 'workoutCalories', format: v => fmt(v), unit: t('unitKcal'), higherIsGood: true },
    { label: t('strengthSessions'), key: 'strengthSessions', format: v => fmt(v), unit: '', higherIsGood: true },
    { label: t('totalTonnage'), key: 'tonnageKg', format: v => fmt(v), unit: t('unitKg'), higherIsGood: true },
    { label: t('strengthSets'), key: 'strengthSets', format: v => fmt(v), unit: '', higherIsGood: true },
    { label: t('strengthTime'), key: 'strengthMinutes', format: v => v !== null ? `${Math.round(v / 60)}` : '--', unit: t('unitHrs'), higherIsGood: true },
  ]

  return (
    <div className="overflow-x-auto">
      <TabHeader title={t('title')} description={t('description')} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-3 pr-6 text-zinc-500 text-xs font-normal sticky left-0 bg-zinc-950 z-10">{t('metric')}</th>
            {years.map(y => (
              <th key={y.year} className="text-right py-3 px-4 text-zinc-200 font-semibold text-lg">{y.year}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
              <td className="py-2.5 pr-6 text-zinc-400 text-xs sticky left-0 bg-zinc-950 z-10">{row.label}</td>
              {years.map((y, i) => {
                const val = y[row.key] as number | null
                const prevYear = years[i + 1]
                const prevVal = prevYear ? prevYear[row.key] as number | null : null
                const change = pctChange(val, prevVal)

                return (
                  <td key={y.year} className="text-right py-2.5 px-4">
                    <div className="text-zinc-100">
                      {row.format(val)}
                      {row.unit && <span className="text-zinc-500 text-xs ml-1">{row.unit}</span>}
                    </div>
                    {change.text && (
                      <div className={`text-[10px] mt-0.5 ${
                        change.positive === null ? 'text-zinc-600' :
                        (change.positive === row.higherIsGood) ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {change.text}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
