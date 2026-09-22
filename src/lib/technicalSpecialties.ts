import type { TechnicalSpecialtyCode } from '../types/domain';

export interface TechnicalSpecialtyOption {
  code: TechnicalSpecialtyCode;
  label: string;
  shortLabel: string;
  description: string;
}

export const defaultTechnicalSpecialties: TechnicalSpecialtyOption[] = [
  {
    code: 'impressoras',
    label: 'Técnica de Impressoras',
    shortLabel: 'Impressoras',
    description: 'Impressoras, multifuncionais, scanners, plotters e equipamentos de impressão.',
  },
  {
    code: 'computadores',
    label: 'Técnica de Computadores',
    shortLabel: 'Computadores',
    description: 'Desktops, notebooks, workstations, servidores e equipamentos de informática.',
  },
];

export function technicalSpecialtyLabel(code?: string | null) {
  if (!code) return 'Especialidade não definida';
  return defaultTechnicalSpecialties.find((item) => item.code === code)?.shortLabel
    ?? code.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function inferTechnicalSpecialty(category?: string | null): TechnicalSpecialtyCode | null {
  const value = (category ?? '').trim().toLowerCase();

  if (/impress|multifunc|plotter|scanner|copiadora/.test(value)) {
    return 'impressoras';
  }

  if (/comput|notebook|desktop|laptop|\bpc\b|workstation|servidor/.test(value)) {
    return 'computadores';
  }

  return null;
}
