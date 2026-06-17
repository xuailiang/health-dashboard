import { useMemo } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, BarChart, Bar,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Cell,
} from 'recharts'
import type { MenstrualRecord, WristTempRecord } from './types'
import { StatBox, ChartCard, AISummaryButton, ChartTooltip, chartMargin, COLORS, shortDateCompact, fmt, TabHeader, useChartTheme } from './ui'
import { useTranslation } from './lib/i18n'

const CYCLE_COLORS = {
  flow: '#ef4444',
  flowLight: '#fca5a5',
  flowMedium: '#ef4444',
  flowHeavy: '#991b1b',
  fertile: '#a855f7',
  ovulation: '#22c55e',
  luteal: '#f97316',
}

const FLOW_INTENSITY: Record<string, number> = {
  none: 0,
  light: 1,
  medium: 2,
  heavy: 3,
  unspecified: 1.5,
}

interface Props {
  menstrualRecords: MenstrualRecord[]
  wristTempRecords: WristTempRecord[]
  cutoffDate: string
}

interface CycleInfo {
  startDate: string
  endDate: string
  length: number // days
  periodDays: number
}

function detectCycles(records: MenstrualRecord[]): CycleInfo[] {
  // Find period start days: days with flow that follow a gap of >= 3 days without flow
  const flowDays = records
    .filter(r => r.flow && r.flow !== 'none')
    .map(r => r.date)
    .sort()

  if (flowDays.length === 0) return []

  // Group consecutive flow days into periods
  const periods: string[][] = []
  let current: string[] = [flowDays[0]]

  for (let i = 1; i < flowDays.length; i++) {
    const prev = new Date(flowDays[i - 1])
    const curr = new Date(flowDays[i])
    const gap = (curr.getTime() - prev.getTime()) / 86400000
    if (gap <= 2) {
      current.push(flowDays[i])
    } else {
      periods.push(current)
      current = [flowDays[i]]
    }
  }
  periods.push(current)

  // Build cycles from consecutive period starts
  const cycles: CycleInfo[] = []
  for (let i = 0; i < periods.length - 1; i++) {
    const start = periods[i][0]
    const nextStart = periods[i + 1][0]
    const length = Math.round((new Date(nextStart).getTime() - new Date(start).getTime()) / 86400000)
    if (length >= 15 && length <= 60) {
      cycles.push({
        startDate: start,
        endDate: nextStart,
        length,
        periodDays: periods[i].length,
      })
    }
  }

  return cycles
}

export default function MenstrualCycle({ menstrualRecords, wristTempRecords, cutoffDate }: Props) {
  const { language } = useTranslation()

  const tDict = {
    en: {
      title: 'Menstrual Cycle',
      desc: 'Cycle length, period duration, flow patterns, and temperature tracking.',
      cycleLength: 'Cycle Length',
      period: 'Period',
      range: 'Range',
      regularity: 'Regularity',
      cycles: 'Cycles',
      flowDays: 'Flow Days',
      nextPeriod: 'Next Period',
      days: 'days',
      average: 'Average',
      minMaxCycle: 'Min-Max cycle',
      regular: 'Regular',
      moderate: 'Moderate',
      irregular: 'Irregular',
      stdDev: 'd std dev',
      totalDetected: 'Total detected',
      totalTracked: 'Total tracked',
      estimated: 'Estimated',
      recentCycles: 'Recent Cycles',
      recentDesc: 'Period (red), estimated fertile window (purple), estimated ovulation (green)',
      fertileWindow: 'Fertile window',
      ovulation: 'Ovulation',
      noData: 'No menstrual cycle data found.',
      normalRange: 'Normal range: 21-35 days.',
      cycleLengthTitle: 'Cycle Length',
      cycleLengthDesc: 'Days between period starts. Normal range: 21-35 days.',
      periodDurationTitle: 'Period Duration',
      periodDurationDesc: 'Number of flow days per cycle',
      flowIntensityTitle: 'Flow Intensity Distribution',
      flowIntensityDesc: 'Days by flow level across all tracked data',
      tempTitle: 'Temperature Tracking',
      tempBbtDesc: 'Basal body temperature. A sustained rise of ~0.2-0.5°C after ovulation is typical.',
      tempWristDesc: 'Wrist temperature deviation during sleep. Shifts can correlate with cycle phases.',
      tempLabel: 'Temperature',
      flowTimelineTitle: 'Flow Timeline',
      flowTimelineDesc: 'Daily flow intensity over time',
      light: 'Light',
      medium: 'Medium',
      heavy: 'Heavy',
      unspecified: 'Unspecified',
      flow: 'Flow',
      count: 'Count',
      day: 'Day'
    },
    zh: {
      title: '生理周期',
      desc: '记录与分析月经周期长度、行经天数、经量特征以及基础体温变化。',
      cycleLength: '周期长度',
      period: '行经期',
      range: '变动范围',
      regularity: '规律度',
      cycles: '监测周期数',
      flowDays: '行经天数',
      nextPeriod: '下期预测',
      days: '天',
      average: '平均',
      minMaxCycle: '最长-最短周期',
      regular: '规律',
      moderate: '基本规律',
      irregular: '不规律',
      stdDev: '天标准差',
      totalDetected: '累计监测到',
      totalTracked: '累计记录行经',
      estimated: '估算时间',
      recentCycles: '近期周期分布',
      recentDesc: '行经期 (红)，估算易孕期 (紫)，估算排卵日 (绿)',
      fertileWindow: '易孕期',
      ovulation: '排卵日',
      noData: '未发现生理周期相关数据。',
      normalRange: '正常范围：21-35 天。',
      cycleLengthTitle: '周期长度趋势',
      cycleLengthDesc: '两次月经开始的间隔天数。正常生理范围为 21-35 天。',
      periodDurationTitle: '行经期时长',
      periodDurationDesc: '每个周期内出现经血流出的天数',
      flowIntensityTitle: '经量强度分布',
      flowIntensityDesc: '全部记录中按轻度、中度、重度划分的天数分布',
      tempTitle: '基础体温追踪',
      tempBbtDesc: '基础体温 (BBT)。排卵后体温通常会持续升高约 0.2-0.5°C。',
      tempWristDesc: '睡眠期间的手腕温度偏差。温度变化通常与周期阶段相契合。',
      tempLabel: '体温',
      flowTimelineTitle: '经量变化时间轴',
      flowTimelineDesc: '每日经血流出强度的长期记录走势',
      light: '轻度',
      medium: '中度',
      heavy: '重度',
      unspecified: '未定义',
      flow: '经量',
      count: '天数',
      day: '第'
    }
  }
  const localT = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]

  const filtered = useMemo(() => {
    if (!cutoffDate) return menstrualRecords
    return menstrualRecords.filter(r => r.date >= cutoffDate)
  }, [menstrualRecords, cutoffDate])

  const cycles = useMemo(() => detectCycles(menstrualRecords), [menstrualRecords])
  const filteredCycles = useMemo(() => {
    if (!cutoffDate) return cycles
    return cycles.filter(c => c.startDate >= cutoffDate)
  }, [cycles, cutoffDate])

  // Cycle length over time
  const cycleLengthData = useMemo(() =>
    filteredCycles.map(c => ({ date: c.startDate, length: c.length })),
  [filteredCycles])

  // Period duration over time
  const periodDurationData = useMemo(() =>
    filteredCycles.map(c => ({ date: c.startDate, days: c.periodDays })),
  [filteredCycles])

  // Flow intensity timeline
  const flowTimeline = useMemo(() => {
    return filtered
      .filter(r => r.flow && r.flow !== 'none')
      .map(r => ({
        date: r.date,
        intensity: FLOW_INTENSITY[r.flow!] || 0,
        flow: r.flow,
      }))
  }, [filtered])

  // BBT data
  const bbtData = useMemo(() => {
    const bbt = filtered.filter(r => r.basalBodyTemp !== null)
    if (bbt.length > 0) {
      return bbt.map(r => ({
        date: r.date,
        temp: Math.round(r.basalBodyTemp! * 100) / 100,
      }))
    }
    // Fall back to wrist temperature if no BBT
    if (wristTempRecords.length === 0) return []
    const wrist = cutoffDate
      ? wristTempRecords.filter(r => r.date >= cutoffDate)
      : wristTempRecords
    return wrist.map(r => ({ date: r.date, temp: r.value }))
  }, [filtered, wristTempRecords, cutoffDate])

  // Flow distribution
  const flowDistribution = useMemo(() => {
    const counts: Record<string, number> = { light: 0, medium: 0, heavy: 0, unspecified: 0 }
    for (const r of filtered) {
      if (r.flow && r.flow !== 'none' && counts[r.flow] !== undefined) {
        counts[r.flow]++
      }
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }))
  }, [filtered])

  // Summary stats
  const avgCycleLength = cycles.length > 0
    ? Math.round(cycles.reduce((s, c) => s + c.length, 0) / cycles.length)
    : null
  const avgPeriodDays = cycles.length > 0
    ? Math.round(cycles.reduce((s, c) => s + c.periodDays, 0) / cycles.length * 10) / 10
    : null
  const shortestCycle = cycles.length > 0 ? Math.min(...cycles.map(c => c.length)) : null
  const longestCycle = cycles.length > 0 ? Math.max(...cycles.map(c => c.length)) : null
  const regularity = cycles.length >= 3
    ? Math.round(Math.sqrt(cycles.reduce((s, c) => s + (c.length - avgCycleLength!) ** 2, 0) / cycles.length) * 10) / 10
    : null

  const totalFlowDays = filtered.filter(r => r.flow && r.flow !== 'none').length
  const lastPeriod = cycles.length > 0 ? cycles[cycles.length - 1] : null

  // Predicted next period
  const nextPeriodDate = lastPeriod && avgCycleLength
    ? new Date(new Date(lastPeriod.startDate).getTime() + avgCycleLength * 86400000).toISOString().substring(0, 10)
    : null

  // Cycle phase calendar (last 3 cycles)
  const cycleCalendar = useMemo(() => {
    const recent = cycles.slice(-6)
    return recent.map(c => {
      const estimatedOvulation = Math.round(c.length - 14)
      return {
        start: c.startDate,
        length: c.length,
        periodDays: c.periodDays,
        ovulationDay: estimatedOvulation,
      }
    })
  }, [cycles])

  const ct = useChartTheme()

  const hasData = filtered.length > 0

  if (!hasData) {
    return <div className="text-zinc-500 text-center py-20">{localT('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={localT('title')} description={localT('desc')} />
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {avgCycleLength !== null && (
          <StatBox label={localT('cycleLength')} value={`${avgCycleLength}`} unit={localT('days')} sub={localT('average')} color={COLORS.purple} />
        )}
        {avgPeriodDays !== null && (
          <StatBox label={localT('period')} value={fmt(avgPeriodDays, 1)} unit={localT('days')} sub={localT('average')} color={CYCLE_COLORS.flow} />
        )}
        {shortestCycle !== null && longestCycle !== null && (
          <StatBox label={localT('range')} value={`${shortestCycle}-${longestCycle}`} unit={localT('days')} sub={localT('minMaxCycle')} />
        )}
        {regularity !== null && (
          <StatBox
            label={localT('regularity')}
            value={regularity <= 2 ? localT('regular') : regularity <= 5 ? localT('moderate') : localT('irregular')}
            sub={`${regularity}${localT('stdDev')}`}
            color={regularity <= 2 ? COLORS.green : regularity <= 5 ? COLORS.orange : COLORS.red}
          />
        )}
        <StatBox label={localT('cycles')} value={`${cycles.length}`} sub={localT('totalDetected')} />
        <StatBox label={localT('flowDays')} value={`${totalFlowDays}`} sub={localT('totalTracked')} color={CYCLE_COLORS.flow} />
        {nextPeriodDate && (
          <StatBox label={localT('nextPeriod')} value={nextPeriodDate.substring(5)} sub={localT('estimated')} color={COLORS.pink} />
        )}
      </div>

      {/* Cycle Phases (recent cycles) */}
      {cycleCalendar.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-1">{localT('recentCycles')}</h3>
          <p className="text-xs text-zinc-500 mb-3">{localT('recentDesc')}</p>
          <div className="space-y-2">
            {cycleCalendar.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-20 shrink-0">{c.start}</span>
                <div className="flex-1 flex h-5 rounded-md overflow-hidden bg-zinc-800">
                  {Array.from({ length: c.length }, (_, d) => {
                    let color = '#27272a'
                    if (d < c.periodDays) color = CYCLE_COLORS.flow
                    else if (d >= c.ovulationDay - 5 && d < c.ovulationDay) color = CYCLE_COLORS.fertile + '80'
                    else if (d === c.ovulationDay) color = CYCLE_COLORS.ovulation
                    return (
                      <div
                        key={d}
                        className="h-full"
                        style={{ flex: 1, backgroundColor: color, minWidth: 1 }}
                        title={`${localT('day')} ${d + 1} ${language === 'zh' ? '天' : ''}`}
                      />
                    )
                  })}
                </div>
                <span className="text-xs text-zinc-500 w-16 text-right shrink-0">{c.length}{language === 'zh' ? '天' : 'd'}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CYCLE_COLORS.flow }} /> {localT('period')}</div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CYCLE_COLORS.fertile + '80' }} /> {localT('fertileWindow')}</div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CYCLE_COLORS.ovulation }} /> {localT('ovulation')}</div>
          </div>
        </div>
      )}

      {/* Cycle Length Over Time */}
      {cycleLengthData.length > 1 && (
        <ChartCard title={localT('cycleLengthTitle')} description={localT('cycleLengthDesc')} chartData={cycleLengthData}>
          <AreaChart margin={chartMargin} data={cycleLengthData}>
            <defs>
              <linearGradient id="cycleLenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDateCompact} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
            <ReferenceLine y={28} stroke="#71717a" strokeDasharray="3 3" label={{ value: `28${language === 'zh' ? '天' : 'd'}`, position: 'right', fill: ct.tick, fontSize: 10 }} />
            <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${localT('days')}`, localT('cycleLength')]} />} />
            <Area type="monotone" dataKey="length" stroke={COLORS.purple} fill="url(#cycleLenGrad)" strokeWidth={1.5} dot={{ r: 3, fill: COLORS.purple }} />
          </AreaChart>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Period Duration */}
        {periodDurationData.length > 1 && (
          <ChartCard title={localT('periodDurationTitle')} description={localT('periodDurationDesc')} chartData={periodDurationData}>
            <BarChart margin={chartMargin} data={periodDurationData}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDateCompact} />
              <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
              <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${localT('days')}`, localT('period')]} />} />
              <Bar dataKey="days" fill={CYCLE_COLORS.flow} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        )}

        {/* Flow Distribution */}
        {flowDistribution.length > 0 && (
          <ChartCard title={localT('flowIntensityTitle')} description={localT('flowIntensityDesc')} chartData={flowDistribution}>
            <BarChart margin={chartMargin} data={flowDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="name" tickFormatter={(v) => localT(v.toLowerCase() as any)} tick={{ fontSize: 10, fill: ct.tick }} />
              <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
              <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${localT('days')}`, localT('count')]} />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {flowDistribution.map((entry, i) => {
                  const colorMap: Record<string, string> = {
                    Light: CYCLE_COLORS.flowLight,
                    Medium: CYCLE_COLORS.flowMedium,
                    Heavy: CYCLE_COLORS.flowHeavy,
                    Unspecified: COLORS.zinc,
                  }
                  return <Cell key={i} fill={colorMap[entry.name] || COLORS.zinc} />
                })}
              </Bar>
            </BarChart>
          </ChartCard>
        )}
      </div>

      {/* Temperature Tracking */}
      {bbtData.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{localT('tempTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
            {filtered.some(r => r.basalBodyTemp !== null)
              ? localT('tempBbtDesc')
              : localT('tempWristDesc')
            }
              </p>
            </div>
            <AISummaryButton title={localT('tempTitle')} description={filtered.some(r => r.basalBodyTemp !== null) ? localT('tempBbtDesc') : localT('tempWristDesc')} chartData={bbtData} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <ScatterChart margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDateCompact} />
                <YAxis dataKey="temp" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <ZAxis range={[15, 25]} />
                <Tooltip content={<ChartTooltip formatter={(v) => [`${v}°C`, localT('tempLabel')]} />} />
                <Scatter data={bbtData} fill={COLORS.orange} opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Flow Timeline */}
      {flowTimeline.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{localT('flowTimelineTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{localT('flowTimelineDesc')}</p>
            </div>
            <AISummaryButton title={localT('flowTimelineTitle')} description={localT('flowTimelineDesc')} chartData={flowTimeline} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <ScatterChart margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDateCompact} />
                <YAxis
                  dataKey="intensity"
                  domain={[0, 3.5]}
                  ticks={[1, 2, 3]}
                  tickFormatter={(v) => ['', localT('light'), localT('medium'), localT('heavy')][v] || ''}
                  tick={{ fontSize: 10, fill: ct.tick }}
                />
                <ZAxis range={[30, 50]} />
                <Tooltip
                  content={<ChartTooltip formatter={(v) => {
                    const label = v === 1 ? localT('light') : v === 2 ? localT('medium') : v === 3 ? localT('heavy') : localT('unspecified')
                    return [label, localT('flow')]
                  }} />}
                />
                <Scatter data={flowTimeline} fill={CYCLE_COLORS.flow} opacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
