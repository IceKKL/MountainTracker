export function computeAverage(scores) {
    if (!scores.length)
        return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}
