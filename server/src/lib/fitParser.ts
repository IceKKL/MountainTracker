import fs from 'fs';
import { Decoder, Stream } from '@garmin/fitsdk';

export interface FitParseResult {
  actual_duration_min: number | null;
  total_calories: number | null;
  total_water_ml: number | null;
}

const SESSION_MESG_NUM = 18;
const SESSION_FIELD_FLUID_CONSUMED = 179;
const SESSION_FIELD_EST_SWEAT_LOSS = 178;

const FLUID_CONSUMED_KEYS = [
  'totalFluidConsumed',
  'total_fluid_consumed',
  'fluidConsumed',
  String(SESSION_FIELD_FLUID_CONSUMED),
] as const;

const EST_DEHYDRATION_KEYS = [
  'restSweatLoss',
  'estSweatLoss',
  'estimatedSweatLoss',
  'est_sweat_loss',
  String(SESSION_FIELD_EST_SWEAT_LOSS),
] as const;

export function parseFitFile(filePath: string): FitParseResult {
  const buffer = fs.readFileSync(filePath);
  const stream = Stream.fromBuffer(buffer);

  if (!Decoder.isFIT(stream)) {
    throw new Error('Nieprawidłowy plik FIT');
  }

  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read({ includeUnknownData: true });

  if (errors.length > 0) {
    console.warn(
      'Ostrzeżenia parsowania FIT:',
      errors.map((e: Error) => e.message).join('; ')
    );
  }

  const sessions = messages.sessionMesgs ?? [];
  const session = sessions[sessions.length - 1];
  if (!session) {
    throw new Error('Brak danych sesji w pliku FIT');
  }

  const movingTimeSec = session.totalMovingTime ?? session.totalTimerTime ?? null;
  const actual_duration_min =
    movingTimeSec != null && movingTimeSec > 0 ? Math.round(movingTimeSec / 60) : null;
  const total_calories =
    session.totalCalories != null && session.totalCalories > 0
      ? Math.round(session.totalCalories)
      : null;

  const nativeWater =
    extractSessionWaterMl(session, messages.fieldDescriptionMesgs ?? []) ??
    extractEventWaterMl(messages.eventMesgs ?? []);

  const total_water_ml = resolveWaterMl(nativeWater, total_calories);

  return { actual_duration_min, total_calories, total_water_ml };
}

function resolveWaterMl(nativeWater: number | null, calories: number | null): number | null {
  if (nativeWater != null && nativeWater > 0) return Math.round(nativeWater);
  if (calories != null && calories > 0) return Math.round(calories * 1.5);
  return null;
}

function extractSessionWaterMl(
  session: Record<string, unknown>,
  fieldDescriptions: Array<Record<string, unknown>>
): number | null {
  const fromFluid = pickPositiveField(session, FLUID_CONSUMED_KEYS);
  if (fromFluid != null) return fromFluid;

  const fromDehydration = pickPositiveField(session, EST_DEHYDRATION_KEYS);
  if (fromDehydration != null) return fromDehydration;

  return extractDeveloperWaterMl(session, fieldDescriptions);
}

function extractDeveloperWaterMl(
  session: Record<string, unknown>,
  fieldDescriptions: Array<Record<string, unknown>>
): number | null {
  const devFields = session.developerFields as Record<string, unknown> | undefined;
  if (!devFields) return null;

  const candidates: Array<{ key: string; priority: number }> = [];

  for (const desc of fieldDescriptions) {
    if (desc.nativeMesgNum != null && desc.nativeMesgNum !== SESSION_MESG_NUM) continue;

    const name = String(desc.fieldName ?? '').toLowerCase();
    if (!/(fluid|hydration|water|sweat|dehydrat|odwodn)/i.test(name)) continue;

    const key = desc.key;
    if (key == null) continue;

    const priority = /(total_fluid|fluid_consum|consumed)/i.test(name)
      ? 0
      : /(sweat|dehydrat|odwodn)/i.test(name)
        ? 1
        : 2;
    candidates.push({ key: String(key), priority });
  }

  candidates.sort((a, b) => a.priority - b.priority);

  for (const { key } of candidates) {
    const value = readPositiveNumber(devFields[key]);
    if (value != null) return Math.round(value);
  }

  return null;
}

function pickPositiveField(
  source: Record<string, unknown>,
  keys: readonly string[]
): number | null {
  for (const key of keys) {
    const value = readPositiveNumber(source[key]);
    if (value != null) return Math.round(value);
  }
  return null;
}

function readPositiveNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function extractEventWaterMl(
  events: Array<{ event?: string; eventType?: string; data?: number }>
): number | null {

  let totalMl = 0;
  let found = false;

  for (const event of events) {
    const label = `${event.event ?? ''} ${event.eventType ?? ''}`.toLowerCase();
    if (!label.includes('hydration') && !label.includes('fluid')) continue;
    if (event.data == null || event.data <= 0) continue;
    totalMl += event.data;
    found = true;
  }

  return found ? Math.round(totalMl) : null;
}
