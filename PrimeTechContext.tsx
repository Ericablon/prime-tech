import type { ReactNode } from 'react';

/**
 * Compatibilidade temporária com a arquitetura anterior.
 * O rework v0.3 usa páginas e serviços desacoplados deste contexto legado.
 */
export function PrimeTechProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function usePrimeTech(): never {
  throw new Error('PrimeTechContext legado não é utilizado no Cronos v0.3.');
}
