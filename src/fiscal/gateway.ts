import { supabase } from '../lib/supabase';

export type FiscalDocumentType = 'nfse' | 'nfe' | 'nfce';
export type FiscalEnvironment = 'homologation' | 'production';
export type FiscalGatewayStatus = 'draft' | 'processing' | 'authorized' | 'cancelled' | 'error';

export interface FiscalGatewayResult {
  documentId: string;
  providerReference?: string;
  status: FiscalGatewayStatus;
  number?: string;
  series?: string;
  accessKey?: string;
  protocol?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  error?: string;
}

export interface FiscalCertificateInfo {
  status: 'stored' | 'ready' | 'expired' | 'revoked' | 'error';
  subjectName?: string | null;
  issuerName?: string | null;
  serialNumber?: string | null;
  certificateDocument?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  commonName?: string | null;
  error?: string;
}

export interface FiscalGateway {
  certificateInfo(companyId: string, certificatePassword?: string): Promise<FiscalCertificateInfo>;
  issue(documentId: string, certificatePassword?: string): Promise<FiscalGatewayResult>;
  status(documentId: string, certificatePassword?: string): Promise<FiscalGatewayResult>;
  cancel(documentId: string, reason: string, certificatePassword?: string): Promise<FiscalGatewayResult>;
}

async function invoke<T>(body: Record<string, unknown>) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.functions.invoke('fiscal-gateway', { body });
  if (error) throw error;
  const result = data as T & { error?: string };
  if (result?.error) throw new Error(result.error);
  return result;
}

export class SupabaseFiscalGateway implements FiscalGateway {
  certificateInfo(companyId: string, certificatePassword?: string) {
    return invoke<FiscalCertificateInfo>({ action: 'certificate_info', companyId, certificatePassword });
  }

  issue(documentId: string, certificatePassword?: string) {
    return invoke<FiscalGatewayResult>({ action: 'issue', documentId, certificatePassword });
  }

  status(documentId: string, certificatePassword?: string) {
    return invoke<FiscalGatewayResult>({ action: 'status', documentId, certificatePassword });
  }

  cancel(documentId: string, reason: string, certificatePassword?: string) {
    if (reason.trim().length < 15 || reason.trim().length > 255) {
      throw new Error('A justificativa deve ter entre 15 e 255 caracteres.');
    }
    return invoke<FiscalGatewayResult>({
      action: 'cancel',
      documentId,
      reason: reason.trim(),
      certificatePassword,
    });
  }
}

export const fiscalGateway = new SupabaseFiscalGateway();
