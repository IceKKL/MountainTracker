export const KGP_PEAK_URLS: Record<number, string> = {
  1: 'https://kgp.info.pl/wykaz-szczytow/rysy/',
  2: 'https://kgp.info.pl/wykaz-szczytow/babia-gora-2/',
  3: 'https://kgp.info.pl/wykaz-szczytow/sniezka-2/',
  4: 'https://kgp.info.pl/wykaz-szczytow/snieznik-2/',
  5: 'https://kgp.info.pl/wykaz-szczytow/tarnica-2/',
  6: 'https://kgp.info.pl/wykaz-szczytow/turbacz-2/',
  7: 'https://kgp.info.pl/wykaz-szczytow/radziejowa-2/',
  8: 'https://kgp.info.pl/wykaz-szczytow/skrzyczne-2/',
  9: 'https://kgp.info.pl/wykaz-szczytow/mogielica/',
  10: 'https://kgp.info.pl/wykaz-szczytow/wysoka-kopa/',
  11: 'https://kgp.info.pl/wykaz-szczytow/rudawiec-2/',
  12: 'https://kgp.info.pl/wykaz-szczytow/orlica-2/',
  13: 'https://kgp.info.pl/wykaz-szczytow/wysoka-2/',
  14: 'https://kgp.info.pl/wykaz-szczytow/wielka-sowa/',
  15: 'https://kgp.info.pl/wykaz-szczytow/lackowa-2/',
  16: 'https://kgp.info.pl/wykaz-szczytow/kowadlo-2/',
  17: 'https://kgp.info.pl/wykaz-szczytow/jagodna-2/',
  18: 'https://kgp.info.pl/wykaz-szczytow/skalnik-2/',
  19: 'https://kgp.info.pl/wykaz-szczytow/waligora-2/',
  20: 'https://kgp.info.pl/wykaz-szczytow/czupel-2/',
  21: 'https://kgp.info.pl/wykaz-szczytow/szczeliniec-wielki/',
  22: 'https://kgp.info.pl/wykaz-szczytow/lubomir/',
  23: 'https://kgp.info.pl/wykaz-szczytow/biskupia-kopa/',
  24: 'https://kgp.info.pl/wykaz-szczytow/chelmiec/',
  25: 'https://kgp.info.pl/wykaz-szczytow/klodzka-gora/',
  26: 'https://kgp.info.pl/wykaz-szczytow/skopiec/',
  27: 'https://kgp.info.pl/wykaz-szczytow/sleza/',
  28: 'https://kgp.info.pl/wykaz-szczytow/gory-swietokrzyskie-lysica/',
};

export function getKgpUrl(peakId: number): string | null {
  return KGP_PEAK_URLS[peakId] ?? null;
}

export function withKgpUrl<T extends { id: number }>(
  peak: T
): T & { kgp_url: string | null } {
  return { ...peak, kgp_url: getKgpUrl(peak.id) };
}
