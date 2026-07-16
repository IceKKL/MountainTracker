import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useMouseHistoryNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    let lastNavAt = 0;

    function handleHistoryButton(e: MouseEvent) {
      if (e.button !== 3 && e.button !== 4) return;

      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastNavAt < 80) return;
      lastNavAt = now;

      navigate(e.button === 3 ? -1 : 1);
    }

    document.addEventListener('auxclick', handleHistoryButton, true);

    return () => {
      document.removeEventListener('auxclick', handleHistoryButton, true);
    };
  }, [navigate]);
}
