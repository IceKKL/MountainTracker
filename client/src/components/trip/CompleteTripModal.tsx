import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Upload, Watch } from 'lucide-react';
import { uploadTripFit } from '../../api/trips';
import type { Trip } from '../../types/trip';
import { tripPath } from '../../utils/slugify';

interface Props {
  trip: Trip;
  onUploaded: () => void;
  onSkip: () => void;
}

export default function CompleteTripModal({ trip, onUploaded, onSkip }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.fit')) {
      setError('Dozwolony format: .fit');
      return;
    }
    setUploading(true);
    setError('');
    try {
      await uploadTripFit(trip, file);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd wgrywania pliku');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <CheckCircle size={22} />
          Wycieczka zrealizowana
        </h2>
        <p>
          Wycieczka <strong>{trip.name}</strong> została oznaczona jako zrealizowana.
        </p>
        <p className="text-muted">
          Wgraj plik telemetryczny z zegarka Garmin (.fit), aby zapisać czas i kalorie z aktywności.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".fit"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        <div className="complete-trip-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} />
            {uploading ? 'Wgrywanie...' : 'Wgraj plik .fit'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={uploading} onClick={onSkip}>
            <Watch size={16} />
            Pomiń na razie
          </button>
        </div>

        <p className="text-muted complete-trip-link">
          <Link to={tripPath(trip.id, trip.name)}>Przejdź do szczegółów wycieczki</Link>
        </p>

        {error && <p className="error-msg">{error}</p>}
      </div>
    </div>
  );
}
