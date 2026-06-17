import { useMemo } from 'react'
import {
  ResponsiveContainer, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, AreaChart, Area, BarChart, Bar, ReferenceLine,
} from 'recharts'
import type { DailyAudio } from './types'
import type { Granularity } from './analysis'
import { StatBox, AISummaryButton, TabHeader, ChartTooltip, useChartTheme, chartMargin, COLORS, shortDate, shortMonth, avg } from './ui'
import { useTranslation } from './lib/i18n'

// WHO/NIOSH safe exposure thresholds
const SAFE_HEADPHONE_DB = 80 // 80 dB for prolonged exposure
const LOUD_ENV_DB = 85

interface Props {
  dailyAudio: DailyAudio[]
  cutoffDate: string
  granularity: Granularity
}

export default function AudioExposure({ dailyAudio, cutoffDate, granularity: _granularity }: Props) {
  const { language } = useTranslation()
  const ct = useChartTheme()

  const tDict = {
    en: {
      title: 'Audio Exposure',
      desc: 'Headphone audio levels and environmental noise exposure to help protect your hearing.',
      hpAvg: 'Headphone Avg',
      envAvg: 'Environment Avg',
      days80Db: 'Days > 80 dB',
      days85Db: 'Days > 85 dB',
      hpExposure: 'Headphone exposure',
      environmental: 'Environmental',
      loudEvents: 'Loud Events',
      limitAlerts: 'Momentary limit alerts',
      hpTime: 'Headphone Time',
      totalListening: 'Total listening',
      noData: 'No audio data found.',
      last30d: 'Last 30 days',
      hpTitle: 'Headphone Audio Levels (weekly)',
      hpDesc: 'Average and peak levels. WHO safe limit: 80 dB for prolonged exposure.',
      envTitle: 'Environmental Noise (weekly)',
      envDesc: 'Average and peak ambient noise from Apple Watch. Safe limit: 85 dB.',
      monthlyTitle: 'Monthly Exposure Time (hours)',
      limit80: '80 dB limit',
      limit85: '85 dB limit',
      average: 'Average',
      peak: 'Peak',
      headphone: 'Headphone'
    },
    zh: {
      title: '听力与噪声',
      desc: '耳机音量水平与环境噪声暴露分贝，帮助保护你的听力健康。',
      hpAvg: '耳机日均音量',
      envAvg: '环境日均噪声',
      days80Db: '耳机超标天数 (>80 dB)',
      days85Db: '环境超标天数 (>85 dB)',
      hpExposure: '耳机噪音暴露',
      environmental: '环境噪音暴露',
      loudEvents: '高分贝事件',
      limitAlerts: '瞬时限制警报',
      hpTime: '耳机听歌时长',
      totalListening: '累计听歌',
      noData: '未发现噪音与听力相关数据。',
      last30d: '最近 30 天均值',
      hpTitle: '耳机音频音量监测 (每周趋势)',
      hpDesc: '包含平均音量与峰值音量。世卫组织 (WHO) 听力安全限值：长期暴露不超过 80 分贝。',
      envTitle: '环境噪声水平监测 (每周趋势)',
      envDesc: 'Apple Watch 监测到的环境环境噪声。安全限值：85 分贝。',
      monthlyTitle: '月度听力暴露时长 (小时)',
      limit80: '80分贝安全线',
      limit85: '85分贝警告线',
      average: '平均音量',
      peak: '峰值音量',
      headphone: '耳机音频'
    }
  }
  const localT = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]
  const filtered = useMemo(() => {
    if (!cutoffDate) return dailyAudio
    return dailyAudio.filter(d => d.date >= cutoffDate)
  }, [dailyAudio, cutoffDate])

  // Weekly headphone levels
  const weeklyHeadphone = useMemo(() => {
    const data = filtered.filter(d => d.headphoneAvg !== null)
    if (data.length === 0) return []
    const result: { week: string; avg: number; max: number }[] = []
    let weekStart = data[0].date
    let avgs: number[] = [], maxs: number[] = []
    for (const d of data) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        if (avgs.length > 0) result.push({ week: weekStart, avg: Math.round(avg(avgs)), max: Math.round(Math.max(...maxs)) })
        weekStart = d.date
        avgs = []; maxs = []
      }
      avgs.push(d.headphoneAvg!)
      if (d.headphoneMax) maxs.push(d.headphoneMax)
    }
    if (avgs.length > 0) result.push({ week: weekStart, avg: Math.round(avg(avgs)), max: Math.round(Math.max(...maxs)) })
    return result
  }, [filtered])

  // Weekly environmental levels
  const weeklyEnv = useMemo(() => {
    const data = filtered.filter(d => d.envAvg !== null)
    if (data.length === 0) return []
    const result: { week: string; avg: number; max: number }[] = []
    let weekStart = data[0].date
    let avgs: number[] = [], maxs: number[] = []
    for (const d of data) {
      const diff = (new Date(d.date).getTime() - new Date(weekStart).getTime()) / 86400000
      if (diff >= 7) {
        if (avgs.length > 0) result.push({ week: weekStart, avg: Math.round(avg(avgs)), max: Math.round(Math.max(...maxs)) })
        weekStart = d.date
        avgs = []; maxs = []
      }
      avgs.push(d.envAvg!)
      if (d.envMax) maxs.push(d.envMax)
    }
    if (avgs.length > 0) result.push({ week: weekStart, avg: Math.round(avg(avgs)), max: Math.round(Math.max(...maxs)) })
    return result
  }, [filtered])

  // Days above safe threshold
  const daysAboveHeadphone = filtered.filter(d => d.headphoneAvg !== null && d.headphoneAvg > SAFE_HEADPHONE_DB).length
  const daysAboveEnv = filtered.filter(d => d.envAvg !== null && d.envAvg > LOUD_ENV_DB).length
  const totalEvents = filtered.reduce((s, d) => s + d.eventsAboveLimit, 0)

  // Monthly exposure time
  const monthlyExposure = useMemo(() => {
    const map = new Map<string, { hp: number; env: number }>()
    for (const d of filtered) {
      const month = d.date.substring(0, 7)
      const existing = map.get(month) || { hp: 0, env: 0 }
      existing.hp += d.headphoneMinutes
      existing.env += d.envMinutes
      map.set(month, existing)
    }
    return Array.from(map.entries())
      .map(([month, data]) => ({
        month,
        headphone: Math.round(data.hp / 60),
        env: Math.round(data.env / 60),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [filtered])

  // Summary stats
  const recent = filtered.slice(-30)
  const avgHeadphone = recent.filter(d => d.headphoneAvg !== null).map(d => d.headphoneAvg!)
  const avgEnv = recent.filter(d => d.envAvg !== null).map(d => d.envAvg!)
  const totalHpHours = Math.round(filtered.reduce((s, d) => s + d.headphoneMinutes, 0) / 60)

  if (filtered.length === 0) {
    return <div className="text-zinc-500 text-center py-20">{localT('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={localT('title')} description={localT('desc')} />
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {avgHeadphone.length > 0 && (
          <StatBox
            label={localT('hpAvg')}
            value={`${Math.round(avg(avgHeadphone))}`}
            unit="dB"
            color={avg(avgHeadphone) > SAFE_HEADPHONE_DB ? COLORS.red : COLORS.green}
            sub={localT('last30d')}
          />
        )}
        {avgEnv.length > 0 && (
          <StatBox
            label={localT('envAvg')}
            value={`${Math.round(avg(avgEnv))}`}
            unit="dB"
            color={avg(avgEnv) > LOUD_ENV_DB ? COLORS.red : COLORS.green}
            sub={localT('last30d')}
          />
        )}
        <StatBox
          label={localT('days80Db')}
          value={`${daysAboveHeadphone}`}
          sub={localT('hpExposure')}
          color={daysAboveHeadphone > 0 ? COLORS.red : COLORS.green}
        />
        <StatBox
          label={localT('days85Db')}
          value={`${daysAboveEnv}`}
          sub={localT('environmental')}
          color={daysAboveEnv > 0 ? COLORS.red : COLORS.green}
        />
        <StatBox label={localT('loudEvents')} value={`${totalEvents}`} sub={localT('limitAlerts')} />
        <StatBox label={localT('hpTime')} value={`${totalHpHours}`} unit={language === 'zh' ? '小时' : 'hrs'} sub={localT('totalListening')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Headphone levels */}
        {weeklyHeadphone.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{localT('hpTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{localT('hpDesc')}</p>
              </div>
              <AISummaryButton title={localT('hpTitle')} description={localT('hpDesc')} chartData={weeklyHeadphone} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyHeadphone}>
                  <defs>
                    <linearGradient id="hpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={SAFE_HEADPHONE_DB} stroke={COLORS.red} strokeDasharray="3 3" label={{ value: localT('limit80'), position: 'right', fill: ct.tick, fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip formatter={(v, name) => [`${v} dB`, name === 'avg' ? localT('average') : localT('peak')]} />} />
                  <Area type="monotone" dataKey="max" stroke={COLORS.purple} fill="url(#hpGrad)" strokeWidth={1} strokeOpacity={0.4} dot={false} />
                  <Line type="monotone" dataKey="avg" stroke={COLORS.purple} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Environmental levels */}
        {weeklyEnv.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-medium text-zinc-300">{localT('envTitle')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{localT('envDesc')}</p>
              </div>
              <AISummaryButton title={localT('envTitle')} description={localT('envDesc')} chartData={weeklyEnv} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weeklyEnv}>
                  <defs>
                    <linearGradient id="envGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <ReferenceLine y={LOUD_ENV_DB} stroke={COLORS.red} strokeDasharray="3 3" label={{ value: localT('limit85'), position: 'right', fill: ct.tick, fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip formatter={(v, name) => [`${v} dB`, name === 'avg' ? localT('average') : localT('peak')]} />} />
                  <Area type="monotone" dataKey="max" stroke={COLORS.orange} fill="url(#envGrad)" strokeWidth={1} strokeOpacity={0.4} dot={false} />
                  <Line type="monotone" dataKey="avg" stroke={COLORS.orange} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Monthly listening time */}
      {monthlyExposure.length > 1 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{localT('monthlyTitle')}</h3>
            </div>
            <AISummaryButton title={localT('monthlyTitle')} chartData={monthlyExposure} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <BarChart margin={chartMargin} data={monthlyExposure}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortMonth} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(v, name) => [`${v}h`, name === 'headphone' ? localT('headphone') : localT('environmental')]} />} />
                <Bar dataKey="headphone" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
