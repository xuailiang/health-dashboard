import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, ReferenceLine,
} from 'recharts'
import type { Granularity } from './analysis'
import { StatBox, AISummaryButton, TabHeader, ChartTooltip, useChartTheme, COLORS, shortDate, avg } from './ui'
import { useTranslation } from './lib/i18n'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Props {
  dailyDaylight: { date: string; minutes: number }[]
  cutoffDate: string
  granularity: Granularity
}

export default function Daylight({ dailyDaylight, cutoffDate, granularity: _granularity }: Props) {
  const { language } = useTranslation()
  const ct = useChartTheme()

  const tDict = {
    en: {
      title: 'Daylight',
      desc: 'Time spent in daylight — important for circadian rhythm, mood, and vitamin D.',
      dailyAvg: 'Daily Average',
      daysBelow20: 'Days < 20 min',
      daysAbove60: 'Days > 1 hr',
      bestDay: 'Best Day',
      totalDays: 'Total Days',
      goal: 'Goal',
      recDaily: 'Recommended daily',
      noData: 'No daylight data found.',
      min: 'min',
      days: 'days',
      withData: 'With daylight data',
      last30d: 'Last 30 days',
      ofLast: 'of last',
      weeklyAvgTitle: 'Daily Daylight Exposure (weekly avg)',
      weeklyAvgDesc: 'Minutes of outdoor light detected by Apple Watch. 30+ min/day supports circadian rhythm, vitamin D, and mood.',
      seasonalTitle: 'Seasonal Pattern',
      seasonalDesc: 'Average daily daylight by month (all years combined)',
      yoyTitle: 'Monthly Average Over Time',
      yoyDesc: 'Avg daily minutes per month — shows year-over-year trends',
      goalLabel: '30 min goal',
      avgDaylight: 'Avg Daylight'
    },
    zh: {
      title: '日光暴露',
      desc: '户外日光暴露时长——这对于调节昼夜节律、改善情绪和促进维生素 D 合成至关重要。',
      dailyAvg: '日均暴露时长',
      daysBelow20: '光照不足天数 (<20分)',
      daysAbove60: '充沛光照天数 (>1小时)',
      bestDay: '单日最高',
      totalDays: '累计记录天数',
      goal: '目标',
      recDaily: '每日建议标准',
      noData: '未发现日光暴露相关数据。',
      min: '分钟',
      days: '天',
      withData: '有效日光数据记录',
      last30d: '最近 30 天',
      ofLast: '过去',
      weeklyAvgTitle: '每日日光暴露时长 (每周均值)',
      weeklyAvgDesc: 'Apple Watch 监测到的户外日光暴露时长。每日保持 30 分钟以上的光照有助于改善情绪与生物钟。',
      seasonalTitle: '季节性日光特征',
      seasonalDesc: '各月份的日均日光暴露时长（历史年度汇总）',
      yoyTitle: '月度日光暴露均值趋势',
      yoyDesc: '各月份的日均暴露分钟数——反映年度间的日光特征对比',
      goalLabel: '30分钟目标线',
      avgDaylight: '平均日光时长'
    }
  }
  const localT = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]

  const filtered = useMemo(() => {
    if (!cutoffDate) return dailyDaylight
    return dailyDaylight.filter(d => d.date >= cutoffDate)
  }, [dailyDaylight, cutoffDate])

  // Weekly trend
  const weeklyData = useMemo(() => {
    if (filtered.length === 0) return []
    const result: { week: string; value: number }[] = []
    let weekStart = filtered[0].date
    let vals: number[] = []
    for (const d of filtered) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals)) })
        weekStart = d.date
        vals = []
      }
      vals.push(d.minutes)
    }
    if (vals.length > 0) result.push({ week: weekStart, value: Math.round(avg(vals)) })
    return result
  }, [filtered])

  // Monthly seasonal pattern — avg minutes per calendar month across all years
  const monthlyPattern = useMemo(() => {
    const byMonth: number[][] = Array.from({ length: 12 }, () => [])
    for (const d of dailyDaylight) { // Use all data, not filtered, for seasonal pattern
      const month = parseInt(d.date.substring(5, 7)) - 1
      byMonth[month].push(d.minutes)
    }
    return byMonth.map((vals, i) => ({
      month: language === 'zh' ? `${i + 1}月` : MONTHS[i],
      avg: vals.length > 0 ? Math.round(avg(vals)) : 0,
      days: vals.length,
    })).filter(m => m.days > 0)
  }, [dailyDaylight, language])

  // Monthly by year for year-over-year comparison
  const monthlyByYear = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const d of filtered) {
      const key = d.date.substring(0, 7) // YYYY-MM
      const arr = map.get(key) || []
      arr.push(d.minutes)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .map(([month, vals]) => ({ month, avg: Math.round(avg(vals)) }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [filtered])

  // Summary
  const recent = filtered.slice(-30)
  const avgRecent = recent.length > 0 ? avg(recent.map(d => d.minutes)) : 0
  const daysBelow20 = recent.filter(d => d.minutes < 20).length
  const daysAbove60 = recent.filter(d => d.minutes >= 60).length
  const maxDay = recent.length > 0 ? Math.max(...recent.map(d => d.minutes)) : 0
  const totalDays = filtered.length

  if (filtered.length === 0) {
    return <div className="text-zinc-500 text-center py-20">{localT('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={localT('title')} description={localT('desc')} />
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox
          label={localT('dailyAvg')}
          value={`${Math.round(avgRecent)}`}
          unit={localT('min')}
          color={avgRecent >= 30 ? '#22c55e' : avgRecent >= 15 ? '#f97316' : '#ef4444'}
          sub={localT('last30d')}
        />
        <StatBox
          label={localT('daysBelow20')}
          value={`${daysBelow20}`}
          sub={`${localT('ofLast')} ${recent.length} ${localT('days')}`}
          color={daysBelow20 > 15 ? '#ef4444' : '#f97316'}
        />
        <StatBox
          label={localT('daysAbove60')}
          value={`${daysAbove60}`}
          sub={`${localT('ofLast')} ${recent.length} ${localT('days')}`}
          color="#22c55e"
        />
        <StatBox label={localT('bestDay')} value={`${maxDay}`} unit={localT('min')} sub={localT('last30d')} />
        <StatBox label={localT('totalDays')} value={`${totalDays}`} sub={localT('withData')} />
        <StatBox
          label={localT('goal')}
          value="30+"
          unit={localT('min')}
          sub={localT('recDaily')}
          color="#71717a"
        />
      </div>

      {/* Weekly trend */}
      {weeklyData.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{localT('weeklyAvgTitle')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{localT('weeklyAvgDesc')}</p>
            </div>
            <AISummaryButton title={localT('weeklyAvgTitle')} description={localT('weeklyAvgDesc')} chartData={weeklyData} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={{ top: 5, right: 5, bottom: 0, left: -15 }} data={weeklyData}>
                <defs>
                  <linearGradient id="daylightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.yellow} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.yellow} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                <ReferenceLine y={30} stroke="#71717a" strokeDasharray="3 3" label={{ value: localT('goalLabel'), position: 'right', fill: ct.tick, fontSize: 10 }} />
                <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${localT('min')}`, localT('title')]} />} />
                <Area type="monotone" dataKey="value" stroke={COLORS.yellow} fill="url(#daylightGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Seasonal pattern */}
        {monthlyPattern.length > 6 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{localT('seasonalTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{localT('seasonalDesc')}</p>
              </div>
              <AISummaryButton title={localT('seasonalTitle')} description={localT('seasonalDesc')} chartData={monthlyPattern} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <BarChart margin={{ top: 5, right: 5, bottom: 0, left: -15 }} data={monthlyPattern}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.tick }} />
                  <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={30} stroke="#71717a" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${language === 'zh' ? '分钟/天' : 'min/day'}`, localT('avgDaylight')]} />} />
                  <Bar dataKey="avg" fill={COLORS.yellow} radius={[4, 4, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Monthly over time */}
        {monthlyByYear.length > 2 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{localT('yoyTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{localT('yoyDesc')}</p>
              </div>
              <AISummaryButton title={localT('yoyTitle')} description={localT('yoyDesc')} chartData={monthlyByYear} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <BarChart margin={{ top: 5, right: 5, bottom: 0, left: -15 }} data={monthlyByYear}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: ct.tick }}
                    tickFormatter={d => {
                      const parts = d.split('-')
                      const monthVal = parseInt(parts[1])
                      return language === 'zh'
                        ? `${parts[0]}年${monthVal}月`
                        : `${MONTHS[monthVal - 1]} '${parts[0].substring(2)}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={30} stroke="#71717a" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} ${language === 'zh' ? '分钟/天' : 'min/day'}`, localT('avgDaylight')]} />} />
                  <Bar dataKey="avg" fill={COLORS.yellow} radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
