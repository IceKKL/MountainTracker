interface Props {
  tripName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteTripModal({ tripName, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2>Usuń wycieczkę</h2>
        <p>
          Czy chcesz usunąć wycieczkę <strong>{tripName}</strong>?
        </p>
        <p className="text-muted">
          Powiązane zdjęcia, pliki GPX/FIT oraz folder wycieczki na dysku zostaną trwale usunięte.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Anuluj
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Potwierdź
          </button>
        </div>
      </div>
    </div>
  );
}
