export function estimateDurationMin(distanceKm, elevationGainM) {
    const flatMin = (distanceKm / 4) * 60;
    const ascentMin = (elevationGainM / 100) * 10;
    return Math.round(flatMin + ascentMin);
}
