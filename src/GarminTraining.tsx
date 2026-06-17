import { useMemo } from 'react'
import {
  XAxis, YAxis, Tooltip, CartesianGrid,
  Area, AreaChart, Line, LineChart, Bar, BarChart, ComposedChart,
  ReferenceLine,
} from 'recharts'
import type { GarminMetrics } from './types'
import {
  COLORS, chartMargin, ChartCard, StatBox, SectionHeader, TabHeader,
  shortDateCompact, tooltipStyle,
} from './ui'

import { useTranslation } from './lib/i18n'

const tDict = {
  en: {
    title: 'Garmin Training',
    desc: 'Training metrics, readiness, and performance scores from your Garmin device',
    // Stat Box Labels
    readiness: 'Training Readiness',
    vo2max: 'VO2 Max',
    endurance: 'Endurance Score',
    hill: 'Hill Score',
    acwr: 'ACWR',
    race5k: 'Predicted 5K',
    fitnessAge: 'Fitness Age',
    avgStress: 'Avg Stress',
    // Units & Subtexts
    yrs: 'yrs',
    chrono: 'Chrono',
    chronoFull: 'Chronological Age',
    str: 'Str',
    end: 'End',
    // Section Headers
    secReadiness: 'Training Readiness',
    secVO2Max: 'VO2 Max',
    secPerformance: 'Performance Scores',
    secLoad: 'Training Load',
    secRace: 'Race Predictions',
    secStress: 'Stress',
    secSleep: 'Sleep Scores',
    secFitness: 'Fitness Age',
    secAcclimation: 'Heat & Altitude Acclimatization',
    secHydration: 'Hydration',
    // Chart Titles
    chartReadiness: 'Readiness Score',
    chartVO2Progression: 'VO2 Max Progression',
    chartEndurance: 'Endurance Score',
    chartHill: 'Hill Score',
    chartAcuteChronic: 'Acute vs Chronic Load',
    chartAcwrRatio: 'ACWR Ratio',
    chartRace: 'Predicted Race Times',
    chartStress: 'Daily Average Stress',
    chartSleep: 'Sleep Score Components',
    chartFitnessVsChrono: 'Fitness Age vs Chronological Age',
    chartAcclimatization: 'Acclimatization',
    chartSweat: 'Sweat Loss During Activities',
    // Series / Legend Names
    seriesScore: 'Score',
    seriesOverall: 'Overall',
    seriesStrength: 'Strength',
    seriesEndurance: 'Endurance',
    seriesAcute: 'Acute',
    seriesChronic: 'Chronic',
    seriesAcwr: 'ACWR',
    seriesAvgStress: 'Avg Stress',
    seriesDeep: 'Deep',
    seriesRem: 'REM',
    seriesRecovery: 'Recovery',
    seriesFitnessAge: 'Fitness Age',
    seriesChronoAge: 'Chrono Age',
    seriesHeat: 'Heat %',
    seriesAltitude: 'Altitude',
    seriesSweatLoss: 'Sweat Loss (ml)',
    // Level Maps
    levelPrime: 'Prime',
    levelHigh: 'High',
    levelModerate: 'Moderate',
    levelLow: 'Low',
    levelPoor: 'Poor',
    statusOptimal: 'Optimal',
  },
  zh: {
    title: '佳明训练',
    desc: '来自佳明设备的训练指标、身体准备度及运动表现评分。',
    // Stat Box Labels
    readiness: '训练准备度',
    vo2max: 'VO2 Max',
    endurance: '耐力得分',
    hill: '山地得分',
    acwr: '急慢性负荷比 (ACWR)',
    race5k: '预测 5K 成绩',
    fitnessAge: '身体年龄',
    avgStress: '平均压力',
    // Units & Subtexts
    yrs: '岁',
    chrono: '实际年龄',
    chronoFull: '实际年龄',
    str: '力量',
    end: '耐力',
    // Section Headers
    secReadiness: '训练准备度',
    secVO2Max: 'VO2 Max',
    secPerformance: '运动表现评分',
    secLoad: '训练负荷',
    secRace: '赛事成绩预测',
    secStress: '身体压力',
    secSleep: '睡眠评分',
    secFitness: '身体年龄',
    secAcclimation: '热适应与高度适应',
    secHydration: '水分流失',
    // Chart Titles
    chartReadiness: '准备度评分趋势',
    chartVO2Progression: 'VO2 Max 变化趋势',
    chartEndurance: '耐力得分趋势',
    chartHill: '山地得分趋势',
    chartAcuteChronic: '急慢性训练负荷对照',
    chartAcwrRatio: '急慢性负荷比 (ACWR) 走势',
    chartRace: '预测完赛时间',
    chartStress: '日均压力走势',
    chartSleep: '睡眠评分维度细分',
    chartFitnessVsChrono: '身体年龄 vs 实际年龄',
    chartAcclimatization: '高热与高原适应性进度',
    chartSweat: '单次运动排汗量',
    // Series / Legend Names
    seriesScore: '评分',
    seriesOverall: '整体评分',
    seriesStrength: '力量得分',
    seriesEndurance: '耐力得分',
    seriesAcute: '急性负荷 (ATL)',
    seriesChronic: '慢性负荷 (CTL)',
    seriesAcwr: '急慢性比值 (ACWR)',
    seriesAvgStress: '平均压力',
    seriesDeep: '深睡评分',
    seriesRem: 'REM评分',
    seriesRecovery: '恢复评分',
    seriesFitnessAge: '身体年龄',
    seriesChronoAge: '实际年龄',
    seriesHeat: '高热适应 %',
    seriesAltitude: '高度适应',
    seriesSweatLoss: '排汗量 (毫升)',
    // Level Maps
    levelPrime: '巅峰状态',
    levelHigh: '高准备度',
    levelModerate: '中等准备度',
    levelLow: '低准备度',
    levelPoor: '状态不佳',
    statusOptimal: '最佳区间',
  }
}

const READINESS_COLORS: Record<string, string> = {
  PRIME: COLORS.green,
  HIGH: '#4ade80',
  MODERATE: COLORS.orange,
  LOW: COLORS.red,
  POOR: '#dc2626',
}

function formatRaceTime(seconds: number): string {
  if (!seconds) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function GarminTraining({
  garminMetrics: g,
  granularity,
  dateRange,
}: {
  garminMetrics: GarminMetrics
  granularity: 'daily' | 'weekly' | 'monthly'
  dateRange: [string, string]
}) {
  const { language } = useTranslation()
  const t = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]

  const getReadinessLevel = (level: string) => {
    const map: Record<string, string> = {
      PRIME: t('levelPrime'),
      HIGH: t('levelHigh'),
      MODERATE: t('levelModerate'),
      LOW: t('levelLow'),
      POOR: t('levelPoor'),
    }
    return map[level] || level.replace(/_/g, ' ').toLowerCase()
  }

  const getAcwrStatus = (status: string) => {
    const map: Record<string, string> = {
      OPTIMAL: t('statusOptimal'),
      HIGH: t('levelHigh'),
      MODERATE: t('levelModerate'),
      POOR: t('levelPoor'),
    }
    return map[status] || status.toLowerCase()
  }

  const getSportLabel = (sport: string) => {
    if (language === 'zh') {
      const upper = sport.toUpperCase()
      if (upper === 'RUNNING') return '跑步'
      if (upper === 'CYCLING') return '骑行'
    }
    return sport.toLowerCase()
  }

  const [startDate, endDate] = dateRange

  const filterByRange = <T extends { date: string }>(arr: T[]) =>
    arr.filter(d => d.date >= startDate && d.date <= endDate)

  const readiness = useMemo(() => filterByRange(g.trainingReadiness), [g.trainingReadiness, startDate, endDate])
  const vo2max = useMemo(() => filterByRange(g.vo2max), [g.vo2max, startDate, endDate])
  const endurance = useMemo(() => filterByRange(g.enduranceScore), [g.enduranceScore, startDate, endDate])
  const hill = useMemo(() => filterByRange(g.hillScore), [g.hillScore, startDate, endDate])
  const atl = useMemo(() => filterByRange(g.acuteTrainingLoad), [g.acuteTrainingLoad, startDate, endDate])
  const race = useMemo(() => filterByRange(g.racePredictions), [g.racePredictions, startDate, endDate])
  const heat = useMemo(() => filterByRange(g.heatAltitude), [g.heatAltitude, startDate, endDate])
  const fitness = useMemo(() => filterByRange(g.fitnessAge), [g.fitnessAge, startDate, endDate])
  const stress = useMemo(() => filterByRange(g.stressDaily), [g.stressDaily, startDate, endDate])
  const hydration = useMemo(() => filterByRange(g.hydration), [g.hydration, startDate, endDate])
  const sleepScores = useMemo(() => filterByRange(g.sleepScores), [g.sleepScores, startDate, endDate])

  const latestReadiness = readiness[readiness.length - 1]
  const latestVO2 = vo2max[vo2max.length - 1]
  const latestEndurance = endurance[endurance.length - 1]
  const latestHill = hill[hill.length - 1]
  const latestATL = atl[atl.length - 1]
  const latestRace = race[race.length - 1]
  const latestFitness = fitness[fitness.length - 1]

  const groupData = <T extends { date: string }>(data: T[], valueKey: keyof T): T[] => {
    if (granularity === 'daily') return data
    const grouped = new Map<string, { items: T[]; sum: number; count: number }>()
    for (const item of data) {
      const key = granularity === 'monthly' ? item.date.slice(0, 7) : (() => {
        const d = new Date(item.date)
        d.setDate(d.getDate() - d.getDay())
        return d.toISOString().slice(0, 10)
      })()
      const existing = grouped.get(key) || { items: [], sum: 0, count: 0 }
      existing.items.push(item)
      existing.sum += (item[valueKey] as number) || 0
      existing.count++
      grouped.set(key, existing)
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { items, sum, count }]) => ({ ...items[0], date, [valueKey]: Math.round(sum / count) } as T))
  }

  const readinessGrouped = useMemo(() => groupData(readiness, 'score'), [readiness, granularity])
  const stressGrouped = useMemo(() => groupData(stress, 'avgStress'), [stress, granularity])

  return (
    <div className="space-y-6">
      <TabHeader title={t('title')} description={t('desc')} />

      {/* Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {latestReadiness && (
          <StatBox
            label={t('readiness')}
            value={String(latestReadiness.score)}
            sub={getReadinessLevel(latestReadiness.level)}
            color={READINESS_COLORS[latestReadiness.level] || COLORS.zinc}
          />
        )}
        {latestVO2 && (
          <StatBox label={t('vo2max')} value={latestVO2.value.toFixed(1)} unit="ml/kg/min" sub={getSportLabel(latestVO2.sport)} color={COLORS.cyan} />
        )}
        {latestEndurance && (
          <StatBox label={t('endurance')} value={String(Math.round(latestEndurance.score / 100))} color={COLORS.blue} />
        )}
        {latestHill && (
          <StatBox label={t('hill')} value={String(latestHill.overall)} sub={`${t('str')} ${latestHill.strength} / ${t('end')} ${latestHill.endurance}`} color={COLORS.orange} />
        )}
        {latestATL && (
          <StatBox
            label={t('acwr')}
            value={latestATL.ratio.toFixed(2)}
            sub={getAcwrStatus(latestATL.status)}
            color={latestATL.status === 'OPTIMAL' ? COLORS.green : latestATL.status === 'HIGH' ? COLORS.red : COLORS.orange}
          />
        )}
        {latestRace && (
          <StatBox label={t('race5k')} value={formatRaceTime(latestRace.time5k)} color={COLORS.purple} />
        )}
        {latestFitness && (
          <StatBox label={t('fitnessAge')} value={String(Math.round(latestFitness.fitnessAge))} unit={t('yrs')} sub={`${t('chrono')}: ${latestFitness.chronologicalAge}`} color={COLORS.green} />
        )}
        {stress.length > 0 && (
          <StatBox label={t('avgStress')} value={String(Math.round(stress.reduce((s, d) => s + d.avgStress, 0) / stress.length))} color={COLORS.yellow} />
        )}
      </div>

      {/* Training Readiness */}
      {readiness.length > 0 && (
        <>
          <SectionHeader>{t('secReadiness')}</SectionHeader>
          <ChartCard title={t('chartReadiness')}>
            <AreaChart data={readinessGrouped} margin={chartMargin}>
              <defs>
                <linearGradient id="readinessGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <Tooltip {...tooltipStyle} formatter={(v) => [v, t('seriesScore')]} />
              <Area type="monotone" dataKey="score" stroke={COLORS.green} fill="url(#readinessGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ChartCard>
        </>
      )}

      {/* VO2 Max */}
      {vo2max.length > 0 && (
        <>
          <SectionHeader>{t('secVO2Max')}</SectionHeader>
          <ChartCard title={t('chartVO2Progression')}>
            <LineChart data={vo2max} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke={COLORS.cyan} strokeWidth={2} dot={{ r: 3, fill: COLORS.cyan }} name="VO2 Max" />
            </LineChart>
          </ChartCard>
        </>
      )}

      {/* Endurance & Hill Score */}
      {(endurance.length > 0 || hill.length > 0) && (
        <>
          <SectionHeader>{t('secPerformance')}</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {endurance.length > 0 && (
              <ChartCard title={t('chartEndurance')}>
                <LineChart data={endurance.map(e => ({ ...e, scoreDisplay: Math.round(e.score / 100) }))} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="scoreDisplay" stroke={COLORS.blue} strokeWidth={2} dot={false} name={t('seriesScore')} />
                </LineChart>
              </ChartCard>
            )}
            {hill.length > 0 && (
              <ChartCard title={t('chartHill')}>
                <LineChart data={hill} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="overall" stroke={COLORS.orange} strokeWidth={2} dot={false} name={t('seriesOverall')} />
                  <Line type="monotone" dataKey="strength" stroke={COLORS.red} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name={t('seriesStrength')} />
                  <Line type="monotone" dataKey="endurance" stroke={COLORS.blue} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name={t('seriesEndurance')} />
                </LineChart>
              </ChartCard>
            )}
          </div>
        </>
      )}

      {/* Training Load (ACWR) */}
      {atl.length > 0 && (
        <>
          <SectionHeader>{t('secLoad')}</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title={t('chartAcuteChronic')}>
              <LineChart data={atl} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
                <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="acute" stroke={COLORS.red} strokeWidth={2} dot={false} name={t('seriesAcute')} />
                <Line type="monotone" dataKey="chronic" stroke={COLORS.blue} strokeWidth={2} dot={false} name={t('seriesChronic')} />
              </LineChart>
            </ChartCard>
            <ChartCard title={t('chartAcwrRatio')}>
              <ComposedChart data={atl} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
                <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" domain={[0, 'auto']} />
                <Tooltip {...tooltipStyle} />
                <ReferenceLine y={0.8} stroke={COLORS.green} strokeDasharray="3 3" label={{ value: '0.8', fill: '#71717a', fontSize: 10 }} />
                <ReferenceLine y={1.3} stroke={COLORS.red} strokeDasharray="3 3" label={{ value: '1.3', fill: '#71717a', fontSize: 10 }} />
                <Area type="monotone" dataKey="ratio" stroke={COLORS.purple} fill={COLORS.purple} fillOpacity={0.15} strokeWidth={2} dot={false} name={t('seriesAcwr')} />
              </ComposedChart>
            </ChartCard>
          </div>
        </>
      )}

      {/* Race Predictions */}
      {race.length > 0 && (
        <>
          <SectionHeader>{t('secRace')}</SectionHeader>
          <ChartCard title={t('chartRace')} tall>
            <LineChart data={race} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis tickFormatter={(v: number) => formatRaceTime(v)} tick={{ fontSize: 10 }} stroke="#3f3f46" />
              <Tooltip {...tooltipStyle} formatter={(v) => [formatRaceTime(v as number), '']} />
              <Line type="monotone" dataKey="time5k" stroke={COLORS.green} strokeWidth={2} dot={false} name="5K" />
              <Line type="monotone" dataKey="time10k" stroke={COLORS.blue} strokeWidth={2} dot={false} name="10K" />
              <Line type="monotone" dataKey="timeHalf" stroke={COLORS.purple} strokeWidth={2} dot={false} name="Half" />
              <Line type="monotone" dataKey="timeMarathon" stroke={COLORS.orange} strokeWidth={2} dot={false} name="Marathon" />
            </LineChart>
          </ChartCard>
          {latestRace && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="5K" value={formatRaceTime(latestRace.time5k)} color={COLORS.green} />
              <StatBox label="10K" value={formatRaceTime(latestRace.time10k)} color={COLORS.blue} />
              <StatBox label="Half Marathon" value={formatRaceTime(latestRace.timeHalf)} color={COLORS.purple} />
              <StatBox label="Marathon" value={formatRaceTime(latestRace.timeMarathon)} color={COLORS.orange} />
            </div>
          )}
        </>
      )}

      {/* Stress */}
      {stress.length > 0 && (
        <>
          <SectionHeader>{t('secStress')}</SectionHeader>
          <ChartCard title={t('chartStress')}>
            <AreaChart data={stressGrouped} margin={chartMargin}>
              <defs>
                <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.yellow} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.yellow} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="avgStress" stroke={COLORS.yellow} fill="url(#stressGrad)" strokeWidth={1.5} dot={false} name={t('seriesAvgStress')} />
            </AreaChart>
          </ChartCard>
        </>
      )}

      {/* Sleep Scores */}
      {sleepScores.length > 0 && (
        <>
          <SectionHeader>{t('secSleep')}</SectionHeader>
          <ChartCard title={t('chartSleep')} tall>
            <LineChart data={sleepScores} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="overall" stroke={COLORS.blue} strokeWidth={2} dot={false} name={t('seriesOverall')} />
              <Line type="monotone" dataKey="deep" stroke={COLORS.purple} strokeWidth={1.5} dot={false} name={t('seriesDeep')} />
              <Line type="monotone" dataKey="rem" stroke={COLORS.cyan} strokeWidth={1.5} dot={false} name={t('seriesRem')} />
              <Line type="monotone" dataKey="recovery" stroke={COLORS.green} strokeWidth={1.5} dot={false} name={t('seriesRecovery')} />
            </LineChart>
          </ChartCard>
        </>
      )}

      {/* Fitness Age */}
      {fitness.length > 0 && (
        <>
          <SectionHeader>{t('secFitness')}</SectionHeader>
          <ChartCard title={t('chartFitnessVsChrono')}>
            <LineChart data={fitness} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="fitnessAge" stroke={COLORS.green} strokeWidth={2} dot={false} name={t('seriesFitnessAge')} />
              <Line type="monotone" dataKey="chronologicalAge" stroke={COLORS.zinc} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name={t('seriesChronoAge')} />
            </LineChart>
          </ChartCard>
        </>
      )}

      {/* Heat & Altitude */}
      {heat.length > 0 && (
        <>
          <SectionHeader>{t('secAcclimation')}</SectionHeader>
          <ChartCard title={t('chartAcclimatization')}>
            <LineChart data={heat} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="heatPercent" stroke={COLORS.red} strokeWidth={2} dot={false} name={t('seriesHeat')} />
              <Line type="monotone" dataKey="altitudeAcclimation" stroke={COLORS.blue} strokeWidth={2} dot={false} name={t('seriesAltitude')} />
            </LineChart>
          </ChartCard>
        </>
      )}

      {/* Hydration */}
      {hydration.length > 0 && (
        <>
          <SectionHeader>{t('secHydration')}</SectionHeader>
          <ChartCard title={t('chartSweat')}>
            <BarChart data={hydration} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={shortDateCompact} tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <YAxis tick={{ fontSize: 11 }} stroke="#3f3f46" />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${Math.round(v as number)} ml`, '']} />
              <Bar dataKey="sweatLossMl" fill={COLORS.cyan} opacity={0.8} name={t('seriesSweatLoss')} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartCard>
        </>
      )}
    </div>
  )
}
