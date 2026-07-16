import {
  Backpack,
  Cross,
  Droplets,
  Flashlight,
  Footprints,
  Hand,
  HardHat,
  Layers,
  Mountain,
  MoveVertical,
  Package,
  PersonStanding,
  Shirt,
  Snowflake,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const GEAR_CATEGORY_CODZIENNE = 'Codzienne';

export const GEAR_CATEGORIES = [
  { value: 'Kurtka / Softshell', icon: Shirt },
  { value: 'Koszulka', icon: Shirt },
  { value: 'Spodnie', icon: PersonStanding },
  { value: 'Bielizna termiczna', icon: Layers },
  { value: 'Polar', icon: Snowflake },
  { value: 'Skarpety', icon: Footprints },
  { value: 'Buty', icon: Footprints },
  { value: 'Czapka / Buff / Kask', icon: HardHat },
  { value: 'Rękawice', icon: Hand },
  { value: 'Plecak', icon: Backpack },
  { value: 'Kijki', icon: MoveVertical },
  { value: 'Raki / sprzęt techniczny', icon: Mountain },
  { value: 'Czołówka', icon: Flashlight },
  { value: 'Filtr do wody', icon: Droplets },
  { value: 'Apteczka / bezpieczeństwo', icon: Cross },
  { value: 'Codzienne', icon: Wallet },
  { value: 'Inne', icon: Package },
] as const;

export const GEAR_SEASONS = [
  { value: 'lato', label: 'Lato' },
  { value: 'zima', label: 'Zima' },
  { value: 'uniwersalny', label: 'Uniwersalny' },
] as const;

export function getCategoryIcon(category: string): LucideIcon {
  const found = GEAR_CATEGORIES.find((c) => c.value === category);
  return found?.icon ?? Package;
}

export function getSeasonLabel(season: string): string {
  const found = GEAR_SEASONS.find((s) => s.value === season);
  return found?.label ?? season;
}

export function isCodzienneCategory(category: string): boolean {
  return category === GEAR_CATEGORY_CODZIENNE;
}
