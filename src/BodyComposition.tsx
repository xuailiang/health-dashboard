import { useMemo } from 'react'
import {
  ResponsiveContainer, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, AreaChart, Area,
} from 'recharts'
import type { BodyRecord } from './types'
import type { Granularity } from './analysis'
import { StatBox, chartMargin, COLORS, shortDate, Legend, AISummaryButton, TabHeader, useChartTheme, ChartTooltip } from './ui'
import { useTranslation } from './lib/i18n'

export default function BodyComposition({ bodyRecords, cutoffDate, granularity: _granularity }: { bodyRecords: BodyRecord[]; cutoffDate: string; granularity: Granularity }) {
  const { language } = useTranslation()
  const ct = useChartTheme()

  const tDict = {
    en: {
      title: 'Body Composition',
      desc: 'Weight, body fat percentage, BMI, and lean mass trends over time.',
      currentWeight: 'Current Weight',
      bodyFat: 'Body Fat',
      leanMass: 'Lean Mass',
      bmi: 'BMI',
      dataPoints: 'Data Points',
      noData: 'No body composition data found in your export.',
      total: 'total',
      latest: 'Latest',
      weightVsLeanMass: 'Weight vs Lean Mass',
      weight: 'Weight',
      fatMass: 'Fat Mass',
      underweight: 'Underweight',
      normal: 'Normal',
      overweight: 'Overweight',
      obese: 'Obese',
      leanBodyMass: 'Lean Body Mass'
    },
    zh: {
      title: '身体成分',
      desc: '体重、体脂率、BMI 及去脂体重等指标的长期变化趋势。',
      currentWeight: '当前体重',
      bodyFat: '体脂率',
      leanMass: '去脂体重',
      bmi: '身体质量指数 (BMI)',
      dataPoints: '记录数据点',
      noData: '在你的导出数据中未发现身体成分相关数据。',
      total: '累计',
      latest: '最新',
      weightVsLeanMass: '体重与去脂体重对比',
      weight: '体重',
      fatMass: '脂肪重量',
      underweight: '偏瘦',
      normal: '正常',
      overweight: '偏胖',
      obese: '肥胖',
      leanBodyMass: '去脂体重'
    }
  }
  const localT = (key: keyof typeof tDict['en']) => tDict[language as 'en' | 'zh']?.[key] || tDict['en'][key]

  const filtered = useMemo(() => {
    if (!cutoffDate) return bodyRecords
    return bodyRecords.filter(r => r.date >= cutoffDate)
  }, [bodyRecords, cutoffDate])

  const hasWeight = filtered.some(r => r.weight !== null)
  const hasBodyFat = filtered.some(r => r.bodyFat !== null)
  const hasLeanMass = filtered.some(r => r.leanMass !== null)
  const hasBmi = filtered.some(r => r.bmi !== null)

  // Chart data: only include records that have at least one measurement
  const weightData = useMemo(() =>
    filtered.filter(r => r.weight !== null).map(r => ({
      date: r.date,
      weight: Math.round(r.weight! * 10) / 10,
    })),
    [filtered]
  )

  const bodyFatData = useMemo(() =>
    filtered.filter(r => r.bodyFat !== null).map(r => ({
      date: r.date,
      bodyFat: Math.round(r.bodyFat! * 10) / 10,
    })),
    [filtered]
  )

  const leanMassData = useMemo(() =>
    filtered.filter(r => r.leanMass !== null).map(r => ({
      date: r.date,
      leanMass: Math.round(r.leanMass! * 10) / 10,
    })),
    [filtered]
  )

  const bmiData = useMemo(() =>
    filtered.filter(r => r.bmi !== null).map(r => ({
      date: r.date,
      bmi: Math.round(r.bmi! * 10) / 10,
    })),
    [filtered]
  )

  // Combined chart: weight + lean mass on same axis
  const compositionData = useMemo(() => {
    const dateSet = new Set<string>()
    filtered.forEach(r => dateSet.add(r.date))
    const dates = Array.from(dateSet).sort()
    const byDate = new Map(filtered.map(r => [r.date, r]))

    return dates.map(date => {
      const r = byDate.get(date)!
      return {
        date,
        weight: r.weight ? Math.round(r.weight * 10) / 10 : null,
        leanMass: r.leanMass ? Math.round(r.leanMass * 10) / 10 : null,
        fatMass: r.weight && r.bodyFat ? Math.round((r.weight * r.bodyFat / 100) * 10) / 10 : null,
      }
    }).filter(d => d.weight || d.leanMass)
  }, [filtered])

  // Summary stats
  const latest = filtered[filtered.length - 1]
  const earliest = filtered[0]

  const weightChange = latest?.weight && earliest?.weight
    ? Math.round((latest.weight - earliest.weight) * 10) / 10
    : null

  const leanChange = hasLeanMass
    ? (() => {
      const first = filtered.find(r => r.leanMass !== null)
      const last = [...filtered].reverse().find(r => r.leanMass !== null)
      return first?.leanMass && last?.leanMass
        ? Math.round((last.leanMass - first.leanMass) * 10) / 10
        : null
    })()
    : null

  if (!hasWeight && !hasBodyFat && !hasLeanMass && !hasBmi) {
    return <div className="text-zinc-500 text-center py-20">{localT('noData')}</div>
  }

  return (
    <div className="space-y-6">
      <TabHeader title={localT('title')} description={localT('desc')} />
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {latest?.weight && (
          <StatBox
            label={localT('currentWeight')}
            value={`${latest.weight.toFixed(1)}`}
            unit="kg"
            color={COLORS.orange}
            sub={weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange} kg ${language === 'zh' ? '累计' : 'total'}` : undefined}
          />
        )}
        {latest?.bodyFat && (
          <StatBox label={localT('bodyFat')} value={`${latest.bodyFat.toFixed(1)}`} unit="%" color={COLORS.red} sub={localT('latest')} />
        )}
        {latest?.leanMass && (
          <StatBox
            label={localT('leanMass')}
            value={`${latest.leanMass.toFixed(1)}`}
            unit="kg"
            color={COLORS.green}
            sub={leanChange !== null ? `${leanChange > 0 ? '+' : ''}${leanChange} kg ${language === 'zh' ? '累计' : 'total'}` : undefined}
          />
        )}
        {latest?.bmi && (
          <StatBox label={localT('bmi')} value={`${latest.bmi.toFixed(1)}`} color={COLORS.purple} sub={bmiCategory(latest.bmi, language)} />
        )}
        <StatBox label={language === 'zh' ? '数据记录点' : 'Data Points'} value={`${filtered.length}`} sub={`${earliest?.date} — ${latest?.date}`} />
      </div>

      {/* Weight + Lean Mass combined */}
      {compositionData.length > 1 && hasLeanMass && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-300">{localT('weightVsLeanMass')}</h3>
            <AISummaryButton title={localT('weightVsLeanMass')} chartData={compositionData} />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
              <AreaChart margin={chartMargin} data={compositionData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                <Tooltip content={<ChartTooltip formatter={(value, name) => {
                    const label = name === 'weight' ? localT('weight') : name === 'leanMass' ? localT('leanMass') : localT('fatMass')
                    return [`${value} kg`, label]
                  }} />} />
                <Area type="monotone" dataKey="weight" stroke={COLORS.orange} fill="url(#weightGrad)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line type="monotone" dataKey="leanMass" stroke={COLORS.green} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                {compositionData.some(d => d.fatMass) && (
                  <Line type="monotone" dataKey="fatMass" stroke={COLORS.red} strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 1.5 }} connectNulls />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-2">
            <Legend color={COLORS.orange} label={localT('weight')} />
            <Legend color={COLORS.green} label={localT('leanMass')} />
            {compositionData.some(d => d.fatMass) && <Legend color={COLORS.red} label={localT('fatMass')} dashed />}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weight trend (if no lean mass, show standalone) */}
        {weightData.length > 1 && !hasLeanMass && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-300">{localT('weight')}</h3>
              <AISummaryButton title={localT('weight')} chartData={weightData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={weightData}>
                  <defs>
                    <linearGradient id="weightStandaloneGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} kg`, localT('weight')]} />} />
                  <Area type="monotone" dataKey="weight" stroke={COLORS.orange} fill="url(#weightStandaloneGrad)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Body Fat % */}
        {bodyFatData.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-300">{localT('bodyFat')}</h3>
              <AISummaryButton title={localT('bodyFat')} chartData={bodyFatData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={bodyFatData}>
                  <defs>
                    <linearGradient id="bodyFatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v}%`, localT('bodyFat')]} />} />
                  <Area type="monotone" dataKey="bodyFat" stroke={COLORS.red} fill="url(#bodyFatGrad)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* BMI */}
        {bmiData.length > 1 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-300">BMI</h3>
              <AISummaryButton title="BMI" chartData={bmiData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={bmiData}>
                  <defs>
                    <linearGradient id="bmiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v}`, 'BMI']} />} />
                  <ReferenceLine y={18.5} stroke="#71717a" strokeDasharray="3 3" label={{ value: '18.5', position: 'left', fill: ct.tick, fontSize: 10 }} />
                  <ReferenceLine y={25} stroke="#71717a" strokeDasharray="3 3" label={{ value: '25', position: 'left', fill: ct.tick, fontSize: 10 }} />
                  <Area type="monotone" dataKey="bmi" stroke={COLORS.purple} fill="url(#bmiGrad)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Lean Mass standalone (if weight not available) */}
        {leanMassData.length > 1 && !hasWeight && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-300">{localT('leanBodyMass')}</h3>
              <AISummaryButton title={localT('leanBodyMass')} chartData={leanMassData} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart margin={chartMargin} data={leanMassData}>
                  <defs>
                    <linearGradient id="leanMassGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickFormatter={shortDate} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: ct.tick }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => [`${v} kg`, localT('leanMass')]} />} />
                  <Area type="monotone" dataKey="leanMass" stroke={COLORS.green} fill="url(#leanMassGrad)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function bmiCategory(bmi: number, lang?: string): string {
  if (bmi < 18.5) return lang === 'zh' ? '偏瘦' : 'Underweight'
  if (bmi < 25) return lang === 'zh' ? '正常' : 'Normal'
  if (bmi < 30) return lang === 'zh' ? '偏胖' : 'Overweight'
  return lang === 'zh' ? '肥胖' : 'Obese'
}

