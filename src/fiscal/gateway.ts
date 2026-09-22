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

export interface FiscalGateway {
  issue(documentId: string): Promise<FiscalGatewayResult>;
  status(documentId: string): Promise<FiscalGatewayResult>;
  cancel(documentId: string, reason: string): Promise<FiscalGatewayResult>;
}

async function invoke(action: 'issue' | 'status' | 'cancel', documentId: string, reason?: string) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.functions.invoke('fiscal-gateway', {
    body: { action, documentId, reason },
  });
  if (error) throw error;
  const result = data as FiscalGatewayResult & { error?: string };
  if (result?.error) throw new Error(result.error);
  return result;
}

export class SupabaseFiscalGateway implements FiscalGateway {
  issue(documentId: string) {
    return invoke('issue', documentId);
  }

  status(documentId: string) {
    return invoke('status', documentId);
  }

  cancel(documentId: string, reason: string) {
    if (reason.trim().length < 15 || reason.trim().length > 255) {
      throw new Error('A justificativa deve ter entre 15 e 255 caracteres.');
    }
    return invoke('cancel', documentId, reason.trim());
  }
}

export const fiscalGateway = new SupabaseFiscalGateway();
