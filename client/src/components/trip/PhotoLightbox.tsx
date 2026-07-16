import { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { tripUploadUrl } from '../../api/trips';
import type { TripRef } from '../../api/trips';
import type { TripPhoto } from '../../types/trip';

interface Props {
  photos: TripPhoto[];
  index: number;
  trip: TripRef;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function PhotoLightbox({ photos, index, trip, onClose, onNavigate }: Props) {
  const photo = photos[index];

  const goPrev = useCallback(() => {
    onNavigate(index > 0 ? index - 1 : photos.length - 1);
  }, [index, photos.length, onNavigate]);

  const goNext = useCallback(() => {
    onNavigate(index < photos.length - 1 ? index + 1 : 0);
  }, [index, photos.length, onNavigate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button type="button" className="lightbox-close btn-icon" onClick={onClose} aria-label="Zamknij">
        <X size={24} />
      </button>
      {photos.length > 1 && (
        <>
          <button type="button" className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); goPrev(); }} aria-label="Poprzednie">
            <ChevronLeft size={32} />
          </button>
          <button type="button" className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); goNext(); }} aria-label="Następne">
            <ChevronRight size={32} />
          </button>
        </>
      )}
      <img
        src={tripUploadUrl(trip, photo.filename)}
        alt=""
        className="lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
