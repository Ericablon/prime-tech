import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Mantém rascunhos temporários durante a sessão do navegador.
 * O conteúdo sobrevive à troca de rota/aba do Cronos, mas é removido
 * quando o usuário conclui ou cancela explicitamente o formulário.
 */
export function useSessionDraft<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const storageKey = `cronos:draft:${key}`;

  const [value, setValueInternal] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) return initialValue;
      return JSON.parse(stored) as T;
    } catch {
      return initialValue;
    }
  });

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setValueInternal((current) => {
        const resolved = typeof next === 'function'
          ? (next as (previous: T) => T)(current)
          : next;

        try {
          sessionStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {
          // Falha de storage não pode impedir o preenchimento do formulário.
        }

        return resolved;
      });
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // noop
    }
    setValueInternal(initialValue);
  }, [initialValue, storageKey]);

  return [value, setValue, clear];
}
