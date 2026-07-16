const DAILY_PARAMS =
  'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,wind_speed_10m_max';

export interface Coordinates {
  lat: number;
  lon: number;
}

export async function geocodePeak(name: string): Promise<Coordinates | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', name);
  url.searchParams.set('count', '10');
  url.searchParams.set('language', 'pl');

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: { latitude: number; longitude: number; feature_code?: string }[];
  };

  if (!data.results || data.results.length === 0) return null;

  const mountainCodes = ['MT', 'PK', 'MTS'];
  const mountain = data.results.find(
    (item) => item.feature_code && mountainCodes.includes(item.feature_code)
  );

  const target = mountain || data.results[0];

  return { lat: target.latitude, lon: target.longitude };
}

export async function fetchForecast(lat: number, lon: number): Promise<unknown> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('daily', DAILY_PARAMS);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('windspeed_unit', 'kmh');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Nie udało się pobrać prognozy pogody');
  return res.json();
}

export async function fetchArchive(
  lat: number,
  lon: number,
  date: string
): Promise<unknown> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('start_date', date);
  url.searchParams.set('end_date', date);
  url.searchParams.set('daily', DAILY_PARAMS);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('windspeed_unit', 'kmh');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Nie udało się pobrać danych pogodowych archiwalnych');
  return res.json();
}

interface OpenMeteoDailyPayload {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
  };
}

export function extractMaxTempForDate(weather: unknown, date: string): number | null {
  const data = weather as OpenMeteoDailyPayload;
  const idx = data.daily?.time?.indexOf(date) ?? -1;
  if (idx < 0) return null;
  const temp = data.daily?.temperature_2m_max?.[idx];
  return temp != null && !Number.isNaN(temp) ? temp : null;
}
