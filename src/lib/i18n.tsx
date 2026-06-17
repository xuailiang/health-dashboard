import { createContext, useContext, useState, type ReactNode } from 'react'

/** 
 * 支持的语言类型：英文 (en) 或 简体中文 (zh) 
 */
export type Language = 'en' | 'zh'

/**
 * 语言 Context 的属性接口
 */
interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

/**
 * 核心全局词典，包含公共界面的翻译
 */
const DICTIONARY: Record<Language, Record<string, string>> = {
  en: {
    // 菜单
    'nav.menu': 'Navigation',
    'nav.overview': 'Overview',
    'nav.score': 'Health Score',
    'nav.health': 'Health',
    'nav.fitness': 'Fitness Activities',
    'nav.analysis': 'Analysis',
    // 子项
    'tab.overview': 'Overview',
    'tab.score': 'Score',
    'tab.cardio': 'Cardio',
    'tab.body': 'Body',
    'tab.sleep': 'Sleep',
    'tab.menstrual': 'Cycle',
    'tab.daylight': 'Daylight',
    'tab.audio': 'Audio',
    'tab.mobility': 'Mobility',
    'tab.running': 'Running',
    'tab.garmin-training': 'Training',
    'tab.load': 'Training Load',
    'tab.calendar': 'Calendar',
    'tab.trainings': 'Trainings',
    'tab.compare': 'Compare',
    'tab.heatmap': 'Heatmap',
    'tab.correlations': 'Correlations',
    'tab.yearly': 'Yearly',
    // 控制面板
    'ctrl.range': 'Range',
    'ctrl.granularity': 'Granularity',
    'ctrl.1w': '1W',
    'ctrl.3m': '3M',
    'ctrl.6m': '6M',
    'ctrl.1y': '1Y',
    'ctrl.all': 'All',
    'ctrl.daily': 'Daily',
    'ctrl.weekly': 'Weekly',
    'ctrl.monthly': 'Monthly',
    // 导入页面
    'upload.title': 'Apple Health Dashboard',
    'upload.desc': 'A privacy-first, client-side dashboard for visualizing your Apple Health export.',
    'upload.hint': 'Drop the unzipped folder, get interactive charts. Nothing leaves your browser.',
    'upload.selectBtn': 'Select Export Folder',
    'upload.drop': 'or drop the unzipped folder here',
    'upload.secTitle': 'How it works',
    'upload.step1': 'On iPhone: Health App → Profile Icon → Export All Health Data',
    'upload.step2': 'Unzip the export.zip somewhere on your computer',
    'upload.step3': 'Click the button above or drag the unzipped folder here',
    'upload.step4': 'Optional: Garmin Connect export folders are also supported',
    'upload.garminTip': ' Garmin mode parses DI_CONNECT/*.json for ATL/CTL and more.',
    'upload.privacy': 'Your data never leaves your computer. No servers, no tracking, 100% local.',
    'upload.modeApple': 'Apple Health Export',
    'upload.modeGarmin': 'Garmin Connect Export',
    'upload.parsing': 'Parsing health data...',
    'upload.elapsed': 'Elapsed',
    'upload.eta': 'ETA',
    'upload.completed': 'Completed!',
    'upload.records': 'records',
    // 错误分类提示
    'error.noApple': "Couldn't find an Apple Health export in that folder.",
    'error.noAppleHint': 'Make sure you unzipped the export and selected the folder that contains export.xml (not the zip itself).',
    'error.noGarmin': "Couldn't find Garmin data in that folder.",
    'error.noGarminHint': 'Select the unzipped export folder — the one that contains the DI_CONNECT directory with .json files.',
    'error.quota': 'Your browser ran out of storage for the cached parse.',
    'error.quotaHint': 'Free up some space in this site’s storage and try again, or use a different browser.',
    'error.failGarmin': "Couldn't parse the Garmin export.",
    'error.failGarminHint': 'Some files in the export may be corrupted or in an unexpected format. Try re-downloading from Garmin.',
    'error.generic': 'Something went wrong while parsing your data.',
    'error.btn': 'Try Again',
    // 仪表盘通用
    'db.latest': 'Latest',
    'db.avg': '30d Avg',
    'db.total': 'Total',
    'db.active': 'Active',
    'db.trend': 'Trends',
    'db.insight': 'AI Insights',
    'db.loading': 'Loading...',
    'db.settings': 'Settings',
    'db.reset': 'New Import',
    'db.theme': 'Theme Toggle',
    'db.changeLang': 'Switch Language',
    'db.days': 'days',
  },
  zh: {
    // 菜单
    'nav.menu': '导航菜单',
    'nav.overview': '总览',
    'nav.score': '健康评分',
    'nav.health': '健康指标',
    'nav.fitness': '运动健身',
    'nav.analysis': '趋势分析',
    // 子项
    'tab.overview': '仪表盘总览',
    'tab.score': '评分明细',
    'tab.cardio': '心肺耐力',
    'tab.body': '身体成分',
    'tab.sleep': '睡眠分析',
    'tab.menstrual': '生理周期',
    'tab.daylight': '日光暴露',
    'tab.audio': '听力与噪声',
    'tab.mobility': '移动能力',
    'tab.running': '跑步动态',
    'tab.garmin-training': '佳明训练',
    'tab.load': '训练负荷',
    'tab.calendar': '训练日历',
    'tab.trainings': '历史训练',
    'tab.compare': '路线对比',
    'tab.heatmap': '路线热力图',
    'tab.correlations': '指标关联分析',
    'tab.yearly': '年度数据回顾',
    // 控制面板
    'ctrl.range': '时间范围',
    'ctrl.granularity': '数据粒度',
    'ctrl.1w': '1周',
    'ctrl.3m': '3月',
    'ctrl.6m': '6月',
    'ctrl.1y': '1年',
    'ctrl.all': '全部',
    'ctrl.daily': '按天',
    'ctrl.weekly': '按周',
    'ctrl.monthly': '按月',
    // 导入页面
    'upload.title': 'Apple Health 个人健康看板',
    'upload.desc': '隐私优先、纯客户端运行的 Apple 个人健康数据可视化工具。',
    'upload.hint': '拖入解压后的健康数据目录，即刻获取交互图表，所有数据不会离开你的浏览器。',
    'upload.selectBtn': '选择解压的数据文件夹',
    'upload.drop': '或直接将解压后的文件夹拖拽到此处',
    'upload.secTitle': '如何获取健康数据？',
    'upload.step1': '在 iPhone 上：打开健康 App → 右上角头像 → 导出所有健康数据',
    'upload.step2': '将导出的 export.zip 文件解压至电脑的任意位置',
    'upload.step3': '点击上方按钮或拖拽解压后的“apple_health_export”文件夹到本页面',
    'upload.step4': '可选：同样支持 Garmin Connect 佳明导出文件夹',
    'upload.garminTip': ' Garmin 模式将解析 DI_CONNECT/*.json 目录，提供 CTL/ATL 负荷趋势。',
    'upload.privacy': '你的隐私至关重要。所有数据解析与渲染完全在浏览器本地进行，绝不上传至任何服务器。',
    'upload.modeApple': 'Apple Health 导出包',
    'upload.modeGarmin': 'Garmin Connect 导出包',
    'upload.parsing': '正在本地解析数据...',
    'upload.elapsed': '已用时间',
    'upload.eta': '预计剩余',
    'upload.completed': '解析完成！',
    'upload.records': '条记录',
    // 错误分类提示
    'error.noApple': "在所选文件夹中未找到 Apple Health 导出数据。",
    'error.noAppleHint': '请确保你已解压了 zip 文件，且选中的是包含 export.xml 的那个文件夹（而不是 zip 包本身）。',
    'error.noGarmin': "在所选文件夹中未找到佳明 Garmin 数据。",
    'error.noGarminHint': '请选择解压后的 Garmin 导出目录——即包含 DI_CONNECT 目录且其中存有多个 .json 文件的文件夹。',
    'error.quota': '浏览器配额空间不足，无法写入 IndexedDB 缓存。',
    'error.quotaHint': '请清理此站点的存储空间，或尝试使用其他主流浏览器。',
    'error.failGarmin': "佳明数据包解析失败。",
    'error.failGarminHint': '导出文件可能损坏或格式不匹配，建议在 Garmin 官网重新发起并下载导出包。',
    'error.generic': '解析数据时发生了一些未知错误。',
    'error.btn': '重新尝试',
    // 仪表盘通用
    'db.latest': '最新',
    'db.avg': '30天均值',
    'db.total': '累计',
    'db.active': '活跃',
    'db.trend': '趋势分析',
    'db.insight': 'AI 深度洞察',
    'db.loading': '加载中...',
    'db.settings': '设置',
    'db.reset': '重新导入',
    'db.theme': '切换主题',
    'db.changeLang': '切换语言',
    'db.days': '天',
  },
}

/**
 * 语言 Context 的 Provider 组件
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('health-dashboard-lang')
    if (stored === 'en' || stored === 'zh') return stored
    return 'zh' // 默认使用中文
  })

  const setLanguage = (lang: Language) => {
    localStorage.setItem('health-dashboard-lang', lang)
    setLanguageState(lang)
  }

  const t = (key: string): string => {
    return DICTIONARY[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

/**
 * 方便调用国际化的 React Hook
 * @returns 包含当前语言类型、切换语言函数和翻译 `t` 方法的对象
 */
export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}
