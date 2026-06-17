import { useMemo } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, ScatterChart, Scatter, ZAxis, ReferenceArea,
} from 'recharts'
import type { DailyMobility } from './types'
import { StatBox, chartMargin, ChartTooltip, COLORS, shortDate, AISummaryButton, TabHeader, fmt, useChartTheme } from './ui'

interface Props {
  dailyMobility: DailyMobility[]
  cutoffDate: string
  granularity: 'daily' | 'weekly' | 'monthly'
}

function weeklyAvgMobility(data: DailyMobility[], key: keyof DailyMobility): { week: string; value: number }[] {
  const valid = data.filter(d => d[key] !== null && d[key] !== undefined && (d[key] as number) > 0)
  if (valid.length === 0) return []
  const result: { week: string; value: number }[] = []
  let weekStart = valid[0].date
  let vals: number[] = []
  for (const d of valid) {
    const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
    if (diff >= 7) {
      if (vals.length > 0) result.push({ week: weekStart, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 })
      weekStart = d.date
      vals = []
    }
    vals.push(d[key] as number)
  }
  if (vals.length > 0) result.push({ week: weekStart, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 })
  return result
}

import { useTranslation } from './lib/i18n'

const tDict = {
  en: {
    title: 'Mobility & Gait',
    desc: 'Walking speed, step length, gait symmetry, stair climbing, and balance metrics — key indicators of functional fitness and aging.',
    walkingSpeed: 'Walking Speed',
    stepLength: 'Step Length',
    doubleSupport: 'Double Support',
    asymmetry: 'Asymmetry',
    flights: 'Flights',
    steadiness: 'Steadiness',
    sixMinWalk: '6-Min Walk',
    avg30d: '30d avg',
    last30d: 'Last 30d',
    latest: 'Latest',
    normal: 'Normal',
    elevated: 'Elevated',
    noData: 'No mobility data found.',
    walkingSpeedDesc: 'Weekly average. Higher walking speed is associated with better overall health and longevity.',
    stepLengthDesc: 'Longer strides indicate better mobility and leg strength.',
    doubleSupportDesc: '% of walking time with both feet on ground. Lower = better balance and confidence.',
    asymmetryDesc: 'Left/right leg imbalance. Under 10% is normal; higher may indicate injury risk or compensation.',
    flightsDesc: 'Weekly total floors. Stair climbing is excellent for lower body strength and cardio.',
    doubleSupportTitle: 'Double Support Time',
    stairSpeed: 'Stair Speed',
    stairSpeedDesc: 'How quickly you climb and descend stairs. An important functional mobility metric.',
    ascent: 'Ascent',
    descent: 'Descent',
    steadinessDesc: "Apple's fall-risk assessment. Higher is better. Below 60% is flagged as low.",
    sixMinTitle: 'Six-Minute Walk Test',
    sixMinDesc: 'Clinical fitness test. 400-700m is typical for healthy adults. Higher = better endurance.',
    distance: 'Distance',
  },
  zh: {
    title: '移动能力与步态',
    desc: '步行速度、步长、步行对称性、爬楼梯以及平衡指标——反映身体机能与老龄化程度的关键健康指标。',
    walkingSpeed: '步行速度',
    stepLength: '步行步长',
    doubleSupport: '双足支撑比例',
    asymmetry: '步行非对称性',
    flights: '爬楼层数',
    steadiness: '步行稳定性',
    sixMinWalk: '六分钟步行测试',
    avg30d: '30天均值',
    last30d: '最近30天',
    latest: '最新',
    normal: '正常',
    elevated: '偏高',
    noData: '未发现移动能力数据。',
    walkingSpeedDesc: '每周平均步行速度。较快的步行速度与更好的整体健康状况和长寿密切相关。',
    stepLengthDesc: '步幅较长表明下肢力量和移动能力较好。',
    doubleSupportDesc: '双脚同时着地的步行时间占比。比值越低代表平衡感越好、步态越自信。',
    asymmetryDesc: '左右腿步态不平衡度。低于 10% 属于正常；数值偏高可能提示有受伤风险或代偿性步态。',
    flightsDesc: '每周累计爬楼层数。爬楼梯对于锻炼下肢力量和心肺耐力非常有益。',
    doubleSupportTitle: '双足支撑比例',
    stairSpeed: '爬楼梯速度',
    stairSpeedDesc: '上楼梯与下楼梯的速度。这是一项重要的身体功能移动性指标。',
    ascent: '上楼速度',
    descent: '下楼速度',
    steadinessDesc: 'Apple 的跌倒风险评估指标。分值越高越好，低于 60% 会被标记为低稳定性。',
    sixMinTitle: '六分钟步行测试',
    sixMinDesc: '临床体能测试指标。健康成年人的典型范围为 400-700 米。数值越高代表耐力越好。',
    distance: '步行距离',
  }
}

export default function Mobility({ dailyMobility, cutoffDate }: Props) {
  const { language } = useTranslation()
  const t = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]
  const filtered = useMemo(() => {
    if (!cutoffDate) return dailyMobility
    return dailyMobility.filter(d => d.date >= cutoffDate)
  }, [dailyMobility, cutoffDate])

  const weeklySpeed = useMemo(() => weeklyAvgMobility(filtered, 'walkingSpeed'), [filtered])
  const weeklyStepLen = useMemo(() => weeklyAvgMobility(filtered, 'stepLength'), [filtered])
  const weeklyDoubleSupport = useMemo(() => weeklyAvgMobility(filtered, 'doubleSupportPct'), [filtered])
  const weeklyAsymmetry = useMemo(() => weeklyAvgMobility(filtered, 'asymmetryPct'), [filtered])
  const weeklyStairAscent = useMemo(() => weeklyAvgMobility(filtered, 'stairAscentSpeed'), [filtered])
  const weeklyStairDescent = useMemo(() => weeklyAvgMobility(filtered, 'stairDescentSpeed'), [filtered])

  // Flights climbed (weekly sum)
  const weeklyFlights = useMemo(() => {
    const withFlights = filtered.filter(d => d.flightsClimbed > 0)
    if (withFlights.length === 0) return []
    const result: { week: string; value: number }[] = []
    let weekStart = withFlights[0].date
    let sum = 0
    for (const d of withFlights) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        result.push({ week: weekStart, value: sum })
        weekStart = d.date
        sum = 0
      }
      sum += d.flightsClimbed
    }
    if (sum > 0) result.push({ week: weekStart, value: sum })
    return result
  }, [filtered])

  // Walking steadiness (sparse, use scatter)
  const steadinessData = useMemo(() =>
    filtered.filter(d => d.walkingSteadiness !== null).map(d => ({ date: d.date, value: d.walkingSteadiness! })),
    [filtered]
  )

  // Six minute walk (sparse, scatter)
  const sixMinData = useMemo(() =>
    filtered.filter(d => d.sixMinWalkDistance !== null).map(d => ({ date: d.date, value: Math.round(d.sixMinWalkDistance!) })),
    [filtered]
  )

  // Summary stats (last 30 days)
  const recent30 = filtered.slice(-30)
  const avgOf = (arr: DailyMobility[], key: keyof DailyMobility) => {
    const vals = arr.map(d => d[key]).filter((v): v is number => typeof v === 'number' && v > 0)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : null
  }

  const avgSpeed = avgOf(recent30, 'walkingSpeed')
  const avgStepLen = avgOf(recent30, 'stepLength')
  const avgDoubleSupport = avgOf(recent30, 'doubleSupportPct')
  const avgAsymmetry = avgOf(recent30, 'asymmetryPct')
  const totalFlights = recent30.reduce((s, d) => s + d.flightsClimbed, 0)
  const latestSteadiness = steadinessData.length > 0 ? steadinessData[steadinessData.length - 1].value : null
  const latestSixMin = sixMinData.length > 0 ? sixMinData[sixMinData.length - 1].value : null

  const ct = useChartTheme()

  const hasData = filtered.length > 0

  if (!hasData) {
    return <div className="text-zinc-500 text-center py-20">{t('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={t('title')} description={t('desc')} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {avgSpeed !== null && <StatBox label={t('walkingSpeed')} value={fmt(avgSpeed, 2)} unit="km/h" color={COLORS.blue} sub={t('avg30d')} />}
        {avgStepLen !== null && <StatBox label={t('stepLength')} value={fmt(avgStepLen, 1)} unit="cm" color={COLORS.green} sub={t('avg30d')} />}
        {avgDoubleSupport !== null && <StatBox label={t('doubleSupport')} value={fmt(avgDoubleSupport, 1)} unit="%" color={COLORS.orange} sub={t('avg30d')} />}
        {avgAsymmetry !== null && <StatBox label={t('asymmetry')} value={fmt(avgAsymmetry, 1)} unit="%" color={avgAsymmetry < 10 ? COLORS.green : COLORS.red} sub={avgAsymmetry < 10 ? t('normal') : t('elevated')} />}
        {totalFlights > 0 && <StatBox label={t('flights')} value={`${totalFlights}`} sub={t('last30d')} color={COLORS.cyan} />}
        {latestSteadiness !== null && <StatBox label={t('steadiness')} value={fmt(latestSteadiness, 0)} unit="%" color={latestSteadiness >= 80 ? COLORS.green : COLORS.orange} sub={t('latest')} />}
        {latestSixMin !== null && <StatBox label={t('sixMinWalk')} value={`${latestSixMin}`} unit="m" color={COLORS.purple} sub={t('latest')} />}
      </div>

      {/* Walking Speed */}
      {weeklySpeed.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('walkingSpeed')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('walkingSpeedDesc')}</p>
            </div>
            <AISummaryButton title={t('walkingSpeed')} description={language === 'zh' ? '每周平均步行速度' : 'Weekly average walking speed'} chartData={weeklySpeed} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={chartMargin} data={weeklySpeed}>
                <defs>
                  <linearGradient id="walkSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(v) => [`${v} km/h`, t('walkingSpeed')]} />} />
                <Area type="monotone" dataKey="value" stroke={COLORS.blue} fill="url(#walkSpeedGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Step Length */}
        {weeklyStepLen.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('stepLength')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('stepLengthDesc')}</p>
              </div>
              <AISummaryButton title={t('stepLength')} description={language === 'zh' ? '每周平均步长' : 'Weekly average step length'} chartData={weeklyStepLen} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyStepLen}>
                  <defs>
                    <linearGradient id="stepLenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} cm`, t('stepLength')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.green} fill="url(#stepLenGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Double Support % */}
        {weeklyDoubleSupport.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('doubleSupportTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('doubleSupportDesc')}</p>
              </div>
              <AISummaryButton title={t('doubleSupportTitle')} description={language === 'zh' ? '双脚同时着地的步行时间占比' : '% of walking with both feet down'} chartData={weeklyDoubleSupport} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyDoubleSupport}>
                  <defs>
                    <linearGradient id="dblSupportGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceArea y1={20} y2={30} fill="#22c55e" fillOpacity={0.05} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v}%`, t('doubleSupport')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.orange} fill="url(#dblSupportGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Walking Asymmetry */}
        {weeklyAsymmetry.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('asymmetry')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('asymmetryDesc')}</p>
              </div>
              <AISummaryButton title={t('asymmetry')} description={language === 'zh' ? '左右腿步态不平衡度 %' : 'Left/right leg imbalance %'} chartData={weeklyAsymmetry} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyAsymmetry}>
                  <defs>
                    <linearGradient id="asymGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceArea y1={0} y2={10} fill="#22c55e" fillOpacity={0.05} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v}%`, t('asymmetry')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.red} fill="url(#asymGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Flights Climbed */}
        {weeklyFlights.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('flights')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('flightsDesc')}</p>
              </div>
              <AISummaryButton title={t('flights')} description={language === 'zh' ? '每周累计爬楼层数' : 'Weekly total floors climbed'} chartData={weeklyFlights} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyFlights}>
                  <defs>
                    <linearGradient id="flightsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${language === 'zh' ? '层' : 'flights'}`, t('flights')]} />} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.cyan} fill="url(#flightsGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stair Speed */}
        {(weeklyStairAscent.length > 1 || weeklyStairDescent.length > 1) && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('stairSpeed')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('stairSpeedDesc')}</p>
              </div>
              <AISummaryButton title={t('stairSpeed')} description={language === 'zh' ? '上下楼梯速度' : 'Ascent and descent speed'} chartData={weeklyStairAscent.length > 0 ? weeklyStairAscent : weeklyStairDescent} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyStairAscent.length >= weeklyStairDescent.length ? weeklyStairAscent.map((d, i) => ({
                  week: d.week, ascent: d.value, descent: weeklyStairDescent[i]?.value ?? null
                })) : weeklyStairDescent.map((d, i) => ({
                  week: d.week, ascent: weeklyStairAscent[i]?.value ?? null, descent: d.value
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v, name) => [`${v} m/s`, name === 'ascent' ? t('ascent') : t('descent')]} />} />
                  <Area type="monotone" dataKey="ascent" stroke={COLORS.green} fill="none" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="descent" stroke={COLORS.orange} fill="none" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Walking Steadiness */}
        {steadinessData.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('steadiness')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('steadinessDesc')}</p>
              </div>
              <AISummaryButton title={t('steadiness')} description={language === 'zh' ? '防跌倒风险评估稳定性分数' : 'Fall-risk assessment score'} chartData={steadinessData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <ScatterChart margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <ReferenceArea y1={80} y2={100} fill="#22c55e" fillOpacity={0.05} />
                  <ReferenceArea y1={0} y2={60} fill="#ef4444" fillOpacity={0.05} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ZAxis range={[30, 50]} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v}%`, t('steadiness')]} />} />
                  <Scatter data={steadinessData} fill={COLORS.purple} opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Six Minute Walk Test */}
        {sixMinData.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{t('sixMinTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t('sixMinDesc')}</p>
              </div>
              <AISummaryButton title={t('sixMinTitle')} description={language === 'zh' ? '6分钟内步行距离' : 'Distance walked in 6 minutes'} chartData={sixMinData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <ScatterChart margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <ReferenceArea y1={400} y2={700} fill="#22c55e" fillOpacity={0.05} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ZAxis range={[40, 60]} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} m`, t('distance')]} />} />
                  <Scatter data={sixMinData} fill={COLORS.green} opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
