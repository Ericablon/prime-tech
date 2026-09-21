/**
 * Arquivo legado neutralizado no rework v0.3.
 * Os catálogos serão migrados para configuração multiempresa.
 */
export const catalogLabels = {} as const;

export type CatalogKind = never;

export const catalogSeeds: never[] = [];

export const businessDay = (
  date: string | Date = new Date(),
) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(date));
