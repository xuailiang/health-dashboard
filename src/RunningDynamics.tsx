import { useMemo } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, ReferenceArea, ComposedChart, Line,
} from 'recharts'
import type { RunningDynamicsRecord } from './types'
import { StatBox, chartMargin, COLORS, shortDate, AISummaryButton, TabHeader, Legend, fmt, useChartTheme, ChartTooltip } from './ui'

interface Props {
  runningDynamics: RunningDynamicsRecord[]
  cutoffDate: string
  granularity: 'daily' | 'weekly' | 'monthly'
}

function weeklyAvg(data: { date: string; value: number }[]): { week: string; value: number }[] {
  if (data.length === 0) return []
  const result: { week: string; value: number }[] = []
  let weekStart = data[0].date
  let vals: number[] = []
  for (const d of data) {
    const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
    if (diff >= 7) {
      if (vals.length > 0) result.push({ week: weekStart, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 })
      weekStart = d.date
      vals = []
    }
    vals.push(d.value)
  }
  if (vals.length > 0) result.push({ week: weekStart, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 })
  return result
}

// Convert m/s to min/km pace
function msToPace(ms: number): string {
  if (ms <= 0) return '--'
  const secPerKm = 1000 / ms
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

import { useTranslation } from './lib/i18n'

const tDict = {
  en: {
    title: 'Running Dynamics',
    desc: 'Power, pace, cadence efficiency, and form metrics captured during runs by your Apple Watch.',
    avgPower: 'Avg Power',
    avgPace: 'Avg Pace',
    vertOscillation: 'Vert. Oscillation',
    groundContact: 'Ground Contact',
    strideLength: 'Stride Length',
    sub30d: '30d avg',
    noData: 'No running dynamics data found.',
    powerTitle: 'Running Power',
    powerDesc: 'Watts output during runs. Increasing power at the same pace indicates improving fitness.',
    paceTitle: 'Running Pace',
    paceDesc: 'Weekly average speed. Higher speed = faster pace.',
    strideTitle: 'Stride Length',
    strideDesc: 'Average stride during runs. Longer strides at the same cadence = faster pace.',
    vertOscTitle: 'Vertical Oscillation',
    vertOscDesc: 'Bounce per stride. Less bounce = more efficient running form. Elite runners: 6-8 cm.',
    gctTitle: 'Ground Contact Time',
    gctDesc: 'Time each foot spends on the ground. Shorter = more efficient. Elite: 160-200 ms.',
    formTitle: 'Running Form Overview',
    formDesc: 'Power, ground contact time, and vertical oscillation together — trends in form efficiency over time.',
    legendPower: 'Power (W)',
    legendGct: 'Ground Contact (ms)',
    legendVert: 'Vert. Osc. (cm)',
    tooltipPower: 'Power',
    tooltipSpeed: 'Speed',
    tooltipStride: 'Stride',
    tooltipOsc: 'Oscillation',
    tooltipGct: 'Ground Contact',
  },
  zh: {
    title: '跑步动态',
    desc: 'Apple Watch 在跑步期间记录的功率、配速、步频效率和跑姿指标。',
    avgPower: '平均功率',
    avgPace: '平均配速',
    vertOscillation: '垂直振幅',
    groundContact: '触地时间',
    strideLength: '步幅',
    sub30d: '30天均值',
    noData: '未发现跑步动态数据。',
    powerTitle: '跑步功率',
    powerDesc: '跑步期间的输出功率（瓦特）。在相同配速下，输出功率增加通常意味着体能有所提升。',
    paceTitle: '跑步配速',
    paceDesc: '每周平均跑步速度。速度越快，配速越短。',
    strideTitle: '步幅',
    strideDesc: '跑步期间的平均步长。在相同步频下，步长较长意味着速度更快。',
    vertOscTitle: '垂直振幅',
    vertOscDesc: '每一步的身体垂直起伏高度。起伏越小，说明跑姿效率越高。精英跑者：6-8 厘米。',
    gctTitle: '触地时间',
    gctDesc: '每一步脚掌接触地面的时间。时间越短，跑步效率越高。精英跑者：160-200 毫秒。',
    formTitle: '跑步跑姿总览',
    formDesc: '综合展示功率、触地时间与垂直振幅——反映跑姿效率随时间变化的趋势。',
    legendPower: '功率 (W)',
    legendGct: '触地时间 (ms)',
    legendVert: '垂直振幅 (cm)',
    tooltipPower: '功率',
    tooltipSpeed: '速度',
    tooltipStride: '步幅',
    tooltipOsc: '垂直振幅',
    tooltipGct: '触地时间',
  }
}

export default function RunningDynamics({ runningDynamics, cutoffDate }: Props) {
  const { language } = useTranslation()
  const t = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]
  const ct = useChartTheme()
  const filtered = useMemo(() => {
    if (!cutoffDate) return runningDynamics
    return runningDynamics.filter(d => d.date >= cutoffDate)
  }, [runningDynamics, cutoffDate])

  const extract = (key: keyof RunningDynamicsRecord) =>
    filtered.filter(d => d[key] !== null).map(d => ({ date: d.date, value: d[key] as number }))

  const powerData = useMemo(() => extract('power'), [filtered])
  const speedData = useMemo(() => extract('speed'), [filtered])
  const vertOscData = useMemo(() => extract('verticalOscillation'), [filtered])
  const gctData = useMemo(() => extract('groundContactTime'), [filtered])
  const strideLenData = useMemo(() => extract('strideLength'), [filtered])

  const weeklyPower = useMemo(() => weeklyAvg(powerData), [powerData])
  const weeklySpeed = useMemo(() => weeklyAvg(speedData), [speedData])
  const weeklyVertOsc = useMemo(() => weeklyAvg(vertOscData), [vertOscData])
  const weeklyGCT = useMemo(() => weeklyAvg(gctData), [gctData])
  const weeklyStride = useMemo(() => weeklyAvg(strideLenData), [strideLenData])

  // Running Efficiency: combined power + GCT + vert osc overlay
  const efficiencyOverlay = useMemo(() => {
    const powerMap = new Map(weeklyPower.map(d => [d.week, d.value]))
    const gctMap = new Map(weeklyGCT.map(d => [d.week, d.value]))
    const vertMap = new Map(weeklyVertOsc.map(d => [d.week, d.value]))
    const allWeeks = [...new Set([...powerMap.keys(), ...gctMap.keys(), ...vertMap.keys()])].sort()
    return allWeeks.map(w => ({
      week: w,
      power: powerMap.get(w) ?? null,
      gct: gctMap.get(w) ?? null,
      vertOsc: vertMap.get(w) ?? null,
    }))
  }, [weeklyPower, weeklyGCT, weeklyVertOsc])

  // Summary stats
  const recent30 = filtered.slice(-30)
  const avgOf = (key: keyof RunningDynamicsRecord) => {
    const vals = recent30.map(d => d[key]).filter((v): v is number => typeof v === 'number' && v > 0)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : null
  }

  const avgPower = avgOf('power')
  const avgSpeed = avgOf('speed')
  const avgVertOsc = avgOf('verticalOscillation')
  const avgGCT = avgOf('groundContactTime')
  const avgStride = avgOf('strideLength')

  const hasData = powerData.length > 0 || speedData.length > 0 || vertOscData.length > 0

  if (!hasData) {
    return <div className="text-zinc-500 text-center py-20">{t('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={t('title')} description={t('desc')} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {avgPower !== null && <StatBox label={t('avgPower')} value={fmt(avgPower, 0)} unit="W" color={COLORS.orange} sub={t('sub30d')} />}
        {avgSpeed !== null && <StatBox label={t('avgPace')} value={msToPace(avgSpeed)} unit="min/km" color={COLORS.blue} sub={t('sub30d')} />}
        {avgVertOsc !== null && <StatBox label={t('vertOscillation')} value={fmt(avgVertOsc, 1)} unit="cm" color={COLORS.purple} sub={t('sub30d')} />}
        {avgGCT !== null && <StatBox label={t('groundContact')} value={fmt(avgGCT, 0)} unit="ms" color={COLORS.green} sub={t('sub30d')} />}
        {avgStride !== null && <StatBox label={t('strideLength')} value={fmt(avgStride, 2)} unit="m" color={COLORS.cyan} sub={t('sub30d')} />}
      </div>

      {/* Running Power */}
      {weeklyPower.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('powerTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('powerDesc')}</p>
            </div>
            <AISummaryButton title={t('powerTitle')} description={t('powerDesc')} chartData={weeklyPower} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={chartMargin} data={weeklyPower}>
                <defs>
                  <linearGradient id="runPowerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(v) => [`${v} W`, t('tooltipPower')]} />} />
                <Area type="monotone" dataKey="value" stroke={COLORS.orange} fill="url(#runPowerGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Running Speed / Pace */}
        {weeklySpeed.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('paceTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('paceDesc')}</p>
              </div>
              <AISummaryButton title={t('paceTitle')} description={t('paceDesc')} chartData={weeklySpeed} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklySpeed}>
                  <defs>
                    <linearGradient id="runSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} m/s (${msToPace(v as number)}/km)`, t('tooltipSpeed')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.blue} fill="url(#runSpeedGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Stride Length */}
        {weeklyStride.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('strideTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('strideDesc')}</p>
              </div>
              <AISummaryButton title={t('strideTitle')} description={t('strideDesc')} chartData={weeklyStride} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyStride}>
                  <defs>
                    <linearGradient id="strideGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} m`, t('tooltipStride')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.cyan} fill="url(#strideGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Vertical Oscillation */}
        {weeklyVertOsc.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('vertOscTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('vertOscDesc')}</p>
              </div>
              <AISummaryButton title={t('vertOscTitle')} description={t('vertOscDesc')} chartData={weeklyVertOsc} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyVertOsc}>
                  <defs>
                    <linearGradient id="vertOscGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceArea y1={6} y2={8} fill="#22c55e" fillOpacity={0.05} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} cm`, t('tooltipOsc')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.purple} fill="url(#vertOscGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Ground Contact Time */}
        {weeklyGCT.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('gctTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('gctDesc')}</p>
              </div>
              <AISummaryButton title={t('gctTitle')} description={t('gctDesc')} chartData={weeklyGCT} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyGCT}>
                  <defs>
                    <linearGradient id="gctGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceArea y1={160} y2={200} fill="#22c55e" fillOpacity={0.05} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ms`, t('tooltipGct')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.green} fill="url(#gctGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Running Form Overview (multi-metric overlay) */}
      {efficiencyOverlay.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('formTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('formDesc')}</p>
            </div>
            <AISummaryButton title={t('formTitle')} description={t('formDesc')} chartData={efficiencyOverlay} />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <ComposedChart margin={chartMargin} data={efficiencyOverlay}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis yAxisId="power" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <YAxis yAxisId="gct" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(v, name) => {
                  if (name === 'power') return [`${v} W`, t('tooltipPower')]
                  if (name === 'gct') return [`${v} ms`, t('tooltipGct')]
                  return [`${v} cm`, t('tooltipOsc')]
                }} />} />
                <Line yAxisId="power" type="monotone" dataKey="power" stroke={COLORS.orange} strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="gct" type="monotone" dataKey="gct" stroke={COLORS.green} strokeWidth={1.5} dot={false} connectNulls />
                <Line yAxisId="gct" type="monotone" dataKey="vertOsc" stroke={COLORS.purple} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-2">
            <Legend color={COLORS.orange} label={t('legendPower')} />
            <Legend color={COLORS.green} label={t('legendGct')} />
            <Legend color={COLORS.purple} label={t('legendVert')} dashed />
          </div>
        </div>
      )}
    </div>
  )
}
