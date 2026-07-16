import fs from 'fs';
import { parseGpxXml } from '@mountain-tracker/shared';

export type {
  DurationField,
  GpxParseResult,
  GpxProfileCache,
} from '@mountain-tracker/shared';

export { parseGpxXml };

export function parseGpxFile(filePath: string) {
  return parseGpxXml(fs.readFileSync(filePath, 'utf-8'));
}
