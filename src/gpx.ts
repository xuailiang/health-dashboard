import type { GpxPoint, GpxRoute } from './types'

const DEFAULT_CONCURRENCY = 4
const routeCache = new Map<string, GpxRoute | null>()

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function parseGpxText(text: string, filename: string): GpxRoute | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const trkpts = doc.querySelectorAll('trkpt')
  if (trkpts.length < 2) return null

  const points: GpxPoint[] = []
  trkpts.forEach(pt => {
    points.push({
      lat: parseFloat(pt.getAttribute('lat') || '0'),
      lon: parseFloat(pt.getAttribute('lon') || '0'),
      ele: parseFloat(pt.querySelector('ele')?.textContent || '0'),
      time: pt.querySelector('time')?.textContent || '',
      speed: parseFloat(pt.querySelector('speed')?.textContent || '0'),
    })
  })

  let totalDistance = 0
  let elevationGain = 0
  let maxSpeed = 0

  for (let i = 1; i < points.length; i++) {
    totalDistance += haversineDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
    const elevDiff = points[i].ele - points[i - 1].ele
    if (elevDiff > 0) elevationGain += elevDiff
    if (points[i].speed > maxSpeed) maxSpeed = points[i].speed
  }

  const startTime = points[0]?.time || ''
  const endTime = points[points.length - 1]?.time || ''
  const totalTime = startTime && endTime
    ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
    : 0
  const name = doc.querySelector('trk > name')?.textContent || filename

  return {
    name,
    filename,
    points,
    totalDistance: totalDistance / 1000,
    totalTime,
    elevationGain: Math.round(elevationGain),
    avgSpeed: totalTime > 0 ? (totalDistance / 1000) / (totalTime / 3600) : 0,
    maxSpeed: maxSpeed * 3.6,
    startTime,
  }
}

function cacheKey(filename: string, file: File): string {
  return `${filename}:${file.size}:${file.lastModified}`
}

export async function parseGpxFile(filename: string, file: File): Promise<GpxRoute | null> {
  const key = cacheKey(filename, file)
  if (routeCache.has(key)) return routeCache.get(key) ?? null
  try {
    const route = parseGpxText(await file.text(), filename)
    routeCache.set(key, route)
    return route
  } catch {
    routeCache.set(key, null)
    return null
  }
}

export async function loadParsedGpxRoutes(
  gpxFiles: Map<string, File>,
  options: { concurrency?: number; minPoints?: number } = {},
): Promise<GpxRoute[]> {
  const entries = Array.from(gpxFiles.entries())
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)
  const minPoints = options.minPoints ?? 2
  const routes: GpxRoute[] = []
  let cursor = 0

  async function worker() {
    while (cursor < entries.length) {
      const [filename, file] = entries[cursor++]
      const route = await parseGpxFile(filename, file)
      if (route && route.points.length >= minPoints) routes.push(route)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, () => worker()))
  return routes
}

export function sampleRoutePoints<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points
  const step = Math.max(1, Math.floor(points.length / maxPoints))
  return points.filter((_, i) => i % step === 0)
}
