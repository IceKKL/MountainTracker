import type Database from 'better-sqlite3';

const KGP_PEAKS = [
  { id: 1, name: 'Rysy', mountain_range: 'Tatry', elevation_m: 2499 },
  { id: 2, name: 'Babia Góra', mountain_range: 'Beskid Żywiecki', elevation_m: 1725 },
  { id: 3, name: 'Śnieżka', mountain_range: 'Karkonosze', elevation_m: 1603 },
  { id: 4, name: 'Śnieżnik', mountain_range: 'Masyw Śnieżnika', elevation_m: 1425 },
  { id: 5, name: 'Tarnica', mountain_range: 'Bieszczady', elevation_m: 1346 },
  { id: 6, name: 'Turbacz', mountain_range: 'Gorce', elevation_m: 1310 },
  { id: 7, name: 'Radziejowa', mountain_range: 'Beskid Sądecki', elevation_m: 1262 },
  { id: 8, name: 'Skrzyczne', mountain_range: 'Beskid Śląski', elevation_m: 1257 },
  { id: 9, name: 'Mogielica', mountain_range: 'Beskid Wyspowy', elevation_m: 1171 },
  { id: 10, name: 'Wysoka Kopa', mountain_range: 'Góry Izerskie', elevation_m: 1126 },
  { id: 11, name: 'Rudawiec', mountain_range: 'Góry Bialskie', elevation_m: 1106 },
  { id: 12, name: 'Orlica', mountain_range: 'Góry Orlickie', elevation_m: 1084 },
  { id: 13, name: 'Wysoka', mountain_range: 'Pieniny', elevation_m: 1050 },
  { id: 14, name: 'Wielka Sowa', mountain_range: 'Góry Sowie', elevation_m: 1015 },
  { id: 15, name: 'Lackowa', mountain_range: 'Beskid Niski', elevation_m: 997 },
  { id: 16, name: 'Kowadło', mountain_range: 'Góry Złote', elevation_m: 989 },
  { id: 17, name: 'Jagodna', mountain_range: 'Góry Bystrzyckie', elevation_m: 977 },
  { id: 18, name: 'Skalnik', mountain_range: 'Rudawy Janowickie', elevation_m: 945 },
  { id: 19, name: 'Waligóra', mountain_range: 'Góry Kamienne', elevation_m: 934 },
  { id: 20, name: 'Czupel', mountain_range: 'Beskid Mały', elevation_m: 930 },
  { id: 21, name: 'Szczeliniec Wielki', mountain_range: 'Góry Stołowe', elevation_m: 919 },
  { id: 22, name: 'Lubomir', mountain_range: 'Beskid Makowski', elevation_m: 904 },
  { id: 23, name: 'Biskupia Kopa', mountain_range: 'Góry Opawskie', elevation_m: 890 },
  { id: 24, name: 'Chełmiec', mountain_range: 'Góry Wałbrzyskie', elevation_m: 851 },
  { id: 25, name: 'Kłodzka Góra', mountain_range: 'Góry Bardzkie', elevation_m: 757 },
  { id: 26, name: 'Skopiec', mountain_range: 'Góry Kaczawskie', elevation_m: 721 },
  { id: 27, name: 'Ślęża', mountain_range: 'Masyw Ślęży', elevation_m: 718 },
  { id: 28, name: 'Łysica', mountain_range: 'Góry Świętokrzyskie', elevation_m: 613 }
] as const;

export function seedKgpPeaks(db: Database.Database): void {
  const upsert = db.prepare(
    `INSERT INTO kgp_peak (id, name, mountain_range, elevation_m)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mountain_range = excluded.mountain_range,
       elevation_m = excluded.elevation_m`
  );

  const seed = db.transaction(() => {
    for (const peak of KGP_PEAKS) {
      upsert.run(peak.id, peak.name, peak.mountain_range, peak.elevation_m);
    }
  });

  seed();
}
