export type FiscalDocumentType = 'nfse' | 'nfe' | 'nfce';
export type FiscalEnvironment = 'homologation' | 'production';
export interface FiscalIssueRequest { idempotencyKey:string; companyId:string; serviceOrderId:string; documentType:FiscalDocumentType; environment:FiscalEnvironment; payload:Record<string,unknown>; }
export interface FiscalIssueResult { providerReference:string; status:'processing'|'authorized'|'rejected'; number?:string; series?:string; accessKey?:string; protocol?:string; xml?:string; pdfUrl?:string; errorCode?:string; errorMessage?:string; }
export interface FiscalGateway { issue(request:FiscalIssueRequest):Promise<FiscalIssueResult>; cancel(providerReference:string,reason:string):Promise<FiscalIssueResult>; status(providerReference:string):Promise<FiscalIssueResult>; }
export class FiscalGatewayNotConfigured implements FiscalGateway {
 async issue(_request:FiscalIssueRequest):Promise<FiscalIssueResult>{throw new Error('Gateway fiscal não configurado para esta empresa.');}
 async cancel(_providerReference:string,_reason:string):Promise<FiscalIssueResult>{throw new Error('Gateway fiscal não configurado para esta empresa.');}
 async status(_providerReference:string):Promise<FiscalIssueResult>{throw new Error('Gateway fiscal não configurado para esta empresa.');}
}
