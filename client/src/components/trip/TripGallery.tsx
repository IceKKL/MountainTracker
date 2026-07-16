import { useEffect, useRef, useState } from 'react';
import { ImagePlus, StickyNote, Trash2 } from 'lucide-react';
import { deleteTripPhoto, tripUploadUrl, uploadTripPhotos } from '../../api/trips';
import type { TripRef } from '../../api/trips';
import type { TripPhoto } from '../../types/trip';
import PhotoLightbox from './PhotoLightbox';

interface Props {
  trip: TripRef;
  photos: TripPhoto[];
  notes: string | null;
  onChange: (photos: TripPhoto[]) => void;
  onSaveNotes: (notes: string | null) => Promise<void>;
}

export default function TripGallery({ trip, photos, notes, onChange, onSaveNotes }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState(notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState('');

  useEffect(() => {
    setNotesDraft(notes ?? '');
  }, [notes]);

  const notesDirty = (notesDraft.trim() || null) !== (notes?.trim() || null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const added = await uploadTripPhotos(trip, Array.from(files));
      onChange([...photos, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd uploadu');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(photoId: number) {
    try {
      await deleteTripPhoto(trip, photoId);
      onChange(photos.filter((p) => p.id !== photoId));
      setLightboxIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd usuwania');
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesError('');
    try {
      await onSaveNotes(notesDraft.trim() || null);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Błąd zapisu notatek');
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <section className="trip-details-section card">
      <div className="section-header">
        <h2>Zdjęcia</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={16} />
          {uploading ? 'Wgrywanie...' : 'Dodaj zdjęcia'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={handleUpload}
        />
      </div>

      {error && <p className="error-msg">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-muted">Brak zdjęć. Dodaj zdjęcia z wycieczki.</p>
      ) : (
        <div className="photo-gallery">
          {photos.map((photo, i) => (
            <div key={photo.id} className="photo-thumb-wrap">
              <button
                type="button"
                className="photo-thumb"
                onClick={() => setLightboxIndex(i)}
              >
                <img src={tripUploadUrl(trip, photo.filename)} alt="" loading="lazy" />
              </button>
              <button
                type="button"
                className="photo-delete btn-icon danger"
                onClick={() => handleDelete(photo.id)}
                aria-label="Usuń zdjęcie"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="photo-notes">
        <h3>
          <StickyNote size={16} />
          Notatki
        </h3>
        <textarea
          className="photo-notes-input"
          rows={4}
          placeholder="Wrażenia, opis trasy, uwagi do zdjęć…"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
        />
        {notesError && <p className="error-msg">{notesError}</p>}
        <div className="photo-notes-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!notesDirty || savingNotes}
            onClick={handleSaveNotes}
          >
            {savingNotes ? 'Zapisywanie...' : 'Zapisz notatki'}
          </button>
        </div>
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          trip={trip}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </section>
  );
}
