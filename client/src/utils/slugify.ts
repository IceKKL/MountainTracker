export { slugify, tripSlug, parseTripIdFromSlug } from '@mountain-tracker/shared';
import { tripSlug } from '@mountain-tracker/shared';

export function tripPath(id: number, name: string): string {
  return `/wycieczki/${tripSlug(id, name)}`;
}
