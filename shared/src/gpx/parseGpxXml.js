import { estimateDurationMin } from '../trip/duration.js';
const EARTH_RADIUS_KM = 6371;
const ELEVATION_GAIN_THRESHOLD_M = 2;
function computeSmoothedElevationGain(points) {
    let refEle = null;
    let gain = 0;
    for (const point of points) {
        if (point.ele == null)
            continue;
        if (refEle == null) {
            refEle = point.ele;
            continue;
        }
        const diff = point.ele - refEle;
        if (diff >= ELEVATION_GAIN_THRESHOLD_M) {
            gain += diff;
            refEle = point.ele;
        }
        else if (diff <= -ELEVATION_GAIN_THRESHOLD_M) {
            refEle = point.ele;
        }
    }
    return gain;
}
function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function parseGpxPoints(xml) {
    const points = [];
    const trkptRe = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;
    let match;
    while ((match = trkptRe.exec(xml)) !== null) {
        const attrs = match[1];
        const inner = match[2];
        const latMatch = /lat="([^"]+)"/i.exec(attrs);
        const lonMatch = /lon="([^"]+)"/i.exec(attrs);
        if (!latMatch || !lonMatch)
            continue;
        const lat = parseFloat(latMatch[1]);
        const lon = parseFloat(lonMatch[1]);
        const eleMatch = /<ele>([^<]+)<\/ele>/i.exec(inner);
        const timeMatch = /<time>([^<]+)<\/time>/i.exec(inner);
        if (Number.isNaN(lat) || Number.isNaN(lon))
            continue;
        const point = { lat, lon };
        if (eleMatch) {
            const ele = parseFloat(eleMatch[1]);
            if (!Number.isNaN(ele))
                point.ele = ele;
        }
        if (timeMatch)
            point.time = timeMatch[1];
        points.push(point);
    }
    return points;
}
function downsample(arr, maxPoints) {
    if (arr.length <= maxPoints)
        return arr;
    const step = (arr.length - 1) / (maxPoints - 1);
    const result = [];
    for (let i = 0; i < maxPoints; i++) {
        result.push(arr[Math.round(i * step)]);
    }
    return result;
}
function buildResult(points) {
    if (points.length < 2) {
        return {
            distance_km: 0,
            elevation_gain_m: 0,
            duration_min: null,
            duration_field: null,
            duration_estimated: false,
            profile: [],
            track: [],
        };
    }
    let totalKm = 0;
    const profile = [[0, points[0].ele ?? 0]];
    const track = [[points[0].lat, points[0].lon]];
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        totalKm += haversineKm(prev.lat, prev.lon, curr.lat, curr.lon);
        profile.push([Math.round(totalKm * 1000) / 1000, curr.ele ?? profile[profile.length - 1][1]]);
        track.push([curr.lat, curr.lon]);
    }
    const distance_km = Math.round(totalKm * 100) / 100;
    const elevation_gain_m = Math.round(computeSmoothedElevationGain(points));
    const start = points[0].time;
    const end = points[points.length - 1].time;
    const hasTimestamps = !!(start && end);
    let duration_min = null;
    let duration_field = null;
    let duration_estimated = false;
    if (hasTimestamps) {
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        if (diffMs > 0) {
            duration_min = Math.round(diffMs / 60000);
            duration_field = 'actual_duration_min';
        }
    }
    else {
        duration_min = estimateDurationMin(distance_km, elevation_gain_m);
        duration_field = 'estimated_duration_min';
        duration_estimated = true;
    }
    return {
        distance_km,
        elevation_gain_m,
        duration_min,
        duration_field,
        duration_estimated,
        profile: downsample(profile, 500),
        track: downsample(track, 500),
    };
}
export function parseGpxXml(xml) {
    return buildResult(parseGpxPoints(xml));
}
