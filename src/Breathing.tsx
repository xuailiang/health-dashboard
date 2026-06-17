import { useMemo } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, AreaChart, Area, ReferenceLine, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import type { DailyBreathing } from './types'
import { StatBox, AISummaryButton, TabHeader, ChartTooltip, useChartTheme, chartMargin, COLORS, shortDate, avg } from './ui'
import { useTranslation } from './lib/i18n'

// Apple's thresholds for breathing disturbances
// < 5: not elevated, 5-14.9: mildly elevated, 15-29.9: moderately elevated, >= 30: severely elevated
function disturbanceCategory(val: number): { label: string; color: string } {
  if (val < 5) return { label: 'Normal', color: '#22c55e' }
  if (val < 15) return { label: 'Mildly Elevated', color: '#f97316' }
  if (val < 30) return { label: 'Moderately Elevated', color: '#ef4444' }
  return { label: 'Severely Elevated', color: '#dc2626' }
}

interface Props {
  dailyBreathing: DailyBreathing[]
  cutoffDate: string
}

export default function Breathing({ dailyBreathing, cutoffDate }: Props) {
  const { language } = useTranslation()
  const ct = useChartTheme()

  const tDict = {
    en: {
      title: 'Breathing',
      desc: 'Blood oxygen levels, respiratory rate, and breathing disturbances tracked during sleep.',
      disturbances: 'Disturbances',
      elevatedNights: 'Elevated Nights',
      nightsOfLast: 'of last',
      nights: 'nights',
      respiratoryRate: 'Respiratory Rate',
      spo2: 'SpO2',
      minSpo2: 'Min SpO2',
      dataPoints: 'Data Points',
      nightsTracked: 'nights tracked',
      noData: 'No breathing data found.',
      avgLast30d: 'Avg last 30 days',
      belowNormal: 'Below normal',
      normal: 'Normal',
      mildlyElevated: 'Mildly Elevated',
      moderatelyElevated: 'Moderately Elevated',
      severelyElevated: 'Severely Elevated',
      disturbTitle: 'Breathing Disturbances (weekly avg)',
      disturbDesc: 'Events per hour during sleep. Under 5/hr is normal. Elevated may indicate sleep apnea.',
      respRateTitle: 'Respiratory Rate (weekly avg)',
      respRateDesc: 'Normal adult: 12-20 breaths/min at rest',
      spo2Title: 'Blood Oxygen (weekly avg)',
      spo2Desc: 'Normal: 95-100%. Below 90% is concerning.',
      disturbVsSpo2Title: 'Disturbances vs Blood Oxygen',
      disturbVsSpo2Desc: 'Higher disturbances often correlate with lower SpO2 — a hallmark of sleep apnea.',
      mild: 'Mild',
      moderate: 'Moderate',
      trend: 'Trend',
      brMin: 'br/min',
      disturbancesHour: 'Disturbances'
    },
    zh: {
      title: '睡眠呼吸',
      desc: '睡眠期间监测的血氧水平、呼吸频率以及呼吸紊乱情况。',
      disturbances: '呼吸紊乱指数',
      elevatedNights: '紊乱偏高天数',
      nightsOfLast: '过去',
      nights: '夜内',
      respiratoryRate: '睡眠呼吸率',
      spo2: '血氧饱和度 (SpO2)',
      minSpo2: '最低血氧饱和度',
      dataPoints: '记录数据点',
      nightsTracked: '天睡眠记录',
      noData: '未发现睡眠呼吸相关数据。',
      avgLast30d: '最近 30 天均值',
      belowNormal: '低于正常',
      normal: '正常',
      mildlyElevated: '轻度偏高',
      moderatelyElevated: '中度偏高',
      severelyElevated: '重度偏高',
      disturbTitle: '呼吸紊乱指数 (每周均值)',
      disturbDesc: '睡眠期间每小时发生的紊乱次数。低于 5 次/小时为正常，偏高可能预示睡眠呼吸暂停风险。',
      respRateTitle: '呼吸频率 (每周均值)',
      respRateDesc: '正常成年人：静息状态下每分钟呼吸 12-20 次',
      spo2Title: '血氧饱和度 (每周均值)',
      spo2Desc: '正常范围：95-100%。低于 90% 需引起警惕。',
      disturbVsSpo2Title: '呼吸紊乱与血氧关联分析',
      disturbVsSpo2Desc: '呼吸紊乱指数偏高通常与血氧饱和度下降高度相关，这是睡眠呼吸暂停的典型指征。',
      mild: '轻度',
      moderate: '中度',
      trend: '趋势',
      brMin: '次/分',
      disturbancesHour: '呼吸紊乱'
    }
  }
  const localT = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]

  const translateDisturbance = (label: string) => {
    const map: Record<string, string> = {
      'Normal': localT('normal'),
      'Mildly Elevated': localT('mildlyElevated'),
      'Moderately Elevated': localT('moderatelyElevated'),
      'Severely Elevated': localT('severelyElevated')
    }
    return map[label] || label
  }

  const filtered = useMemo(() => {
    if (!cutoffDate) return dailyBreathing
    return dailyBreathing.filter(d => d.date >= cutoffDate)
  }, [dailyBreathing, cutoffDate])

  // Weekly disturbances
  const weeklyDisturbances = useMemo(() => {
    const data = filtered.filter(d => d.disturbances !== null)
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
  }, [filtered])

  // Weekly respiratory rate
  const weeklyRespRate = useMemo(() => {
    const data = filtered.filter(d => d.respiratoryRate !== null)
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
  }, [filtered])

  // Weekly SpO2
  const weeklySpo2 = useMemo(() => {
    const data = filtered.filter(d => d.spo2 !== null)
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
  }, [filtered])

  // Disturbance vs SpO2 correlation scatter
  const distVsSpo2 = useMemo(() => {
    return filtered
      .filter(d => d.disturbances !== null && d.spo2 !== null)
      .map(d => ({
        disturbances: d.disturbances!,
        spo2: d.spo2!,
      }))
  }, [filtered])

  // Summary stats (last 30 days)
  const recent = filtered.slice(-30)
  const recentDist = recent.filter(d => d.disturbances !== null).map(d => d.disturbances!)
  const avgDist = recentDist.length > 0 ? avg(recentDist) : null
  const distCategory = avgDist !== null ? disturbanceCategory(avgDist) : null

  const recentRR = recent.filter(d => d.respiratoryRate !== null).map(d => d.respiratoryRate!)
  const avgRR = recentRR.length > 0 ? avg(recentRR) : null

  const recentSpo2 = recent.filter(d => d.spo2 !== null).map(d => d.spo2!)
  const avgSpo2Val = recentSpo2.length > 0 ? avg(recentSpo2) : null
  const minSpo2 = recentSpo2.length > 0 ? Math.min(...recentSpo2) : null

  const elevatedNights = recentDist.filter(v => v >= 5).length

  const hasData = weeklyDisturbances.length > 0 || weeklyRespRate.length > 0 || weeklySpo2.length > 0

  if (!hasData) {
    return <div className="text-zinc-500 text-center py-20">{localT('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={localT('title')} description={localT('desc')} />
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {avgDist !== null && (
          <StatBox
            label={localT('disturbances')}
            value={`${avgDist.toFixed(1)}`}
            unit="/hr"
            color={distCategory?.color}
            sub={distCategory?.label ? translateDisturbance(distCategory.label) : undefined}
          />
        )}
        {elevatedNights > 0 && (
          <StatBox
            label={localT('elevatedNights')}
            value={`${elevatedNights}`}
            sub={`${localT('nightsOfLast')} ${recentDist.length} ${localT('nights')}`}
            color={elevatedNights > 5 ? COLORS.red : '#f97316'}
          />
        )}
        {avgRR !== null && (
          <StatBox
            label={localT('respiratoryRate')}
            value={`${avgRR.toFixed(1)}`}
            unit={localT('brMin')}
            color={COLORS.blue}
            sub={localT('avgLast30d')}
          />
        )}
        {avgSpo2Val !== null && (
          <StatBox
            label={localT('spo2')}
            value={`${avgSpo2Val.toFixed(1)}`}
            unit="%"
            color={avgSpo2Val >= 95 ? COLORS.green : COLORS.red}
            sub={localT('avgLast30d')}
          />
        )}
        {minSpo2 !== null && (
          <StatBox
            label={localT('minSpo2')}
            value={`${minSpo2.toFixed(1)}`}
            unit="%"
            color={minSpo2 >= 90 ? COLORS.green : COLORS.red}
            sub={minSpo2 < 90 ? localT('belowNormal') : localT('normal')}
          />
        )}
        <StatBox label={localT('dataPoints')} value={`${filtered.length}`} sub={localT('nightsTracked')} />
      </div>

      {/* Breathing disturbances */}
      {weeklyDisturbances.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{localT('disturbTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{localT('disturbDesc')}</p>
            </div>
            <AISummaryButton title={localT('disturbTitle')} description={localT('disturbDesc')} chartData={weeklyDisturbances} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={chartMargin} data={weeklyDisturbances}>
                <defs>
                  <linearGradient id="distGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <ReferenceLine y={5} stroke="#f97316" strokeDasharray="3 3" label={{ value: localT('mild'), position: 'right', fill: ct.tick, fontSize: 10 }} />
                <ReferenceLine y={15} stroke={COLORS.red} strokeDasharray="3 3" label={{ value: localT('moderate'), position: 'right', fill: ct.tick, fontSize: 10 }} />
                <Tooltip content={<ChartTooltip formatter={(v) => [`${v}/hr`, localT('disturbancesHour')]} />} />
                <Area type="monotone" dataKey="value" stroke={COLORS.red} fill="url(#distGrad2)" strokeWidth={1.5} dot={false} />
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
                <h3 className="text-sm font-medium text-zinc-300">{localT('respRateTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{localT('respRateDesc')}</p>
              </div>
              <AISummaryButton title={localT('respRateTitle')} description={localT('respRateDesc')} chartData={weeklyRespRate} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyRespRate}>
                  <defs>
                    <linearGradient id="respRateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={12} stroke="#71717a" strokeDasharray="3 3" />
                  <ReferenceLine y={20} stroke="#71717a" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${localT('brMin')}`, localT('respiratoryRate')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.blue} fill="url(#respRateGrad)" strokeWidth={1.5} dot={false} />
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
                <h3 className="text-sm font-medium text-zinc-300">{localT('spo2Title')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{localT('spo2Desc')}</p>
              </div>
              <AISummaryButton title={localT('spo2Title')} description={localT('spo2Desc')} chartData={weeklySpo2} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklySpo2}>
                  <defs>
                    <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 100]} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={95} stroke="#71717a" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v}%`, localT('spo2')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.green} fill="url(#spo2Grad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Disturbances vs SpO2 scatter */}
      {distVsSpo2.length > 10 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{localT('disturbVsSpo2Title')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{localT('disturbVsSpo2Desc')}</p>
            </div>
            <AISummaryButton title={localT('disturbVsSpo2Title')} description={localT('disturbVsSpo2Desc')} chartData={distVsSpo2} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <ScatterChart margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="disturbances" name={language === 'zh' ? '呼吸紊乱' : 'Disturbances'} unit="/hr" tick={{ fontSize: 10, fill: ct.tick }} />
                <YAxis dataKey="spo2" name={language === 'zh' ? '血氧' : 'SpO2'} unit="%" domain={['auto', 100]} tick={{ fontSize: 10, fill: ct.tick }} />
                <ZAxis range={[20, 40]} />
                <Tooltip
                  content={<ChartTooltip
                    formatter={(v, name) => [
                      name === (language === 'zh' ? '呼吸紊乱' : 'Disturbances') ? `${v}/hr` : `${v}%`,
                      name as string,
                    ]}
                  />}
                />
                <Scatter data={distVsSpo2} fill={COLORS.red} opacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
