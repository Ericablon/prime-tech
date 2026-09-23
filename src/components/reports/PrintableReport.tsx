import { Printer, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { brandLogo } from '../../lib/brand';
import type { CompanySettings } from '../../types/domain';

type Filter = {
  label: string;
  value: string;
};

interface PrintableReportProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  company?: CompanySettings | null;
  generatedBy?: string | null;
  filters?: Filter[];
  children: ReactNode;
}

export function PrintableReport({
  open,
  onClose,
  title,
  subtitle,
  company,
  generatedBy,
  filters = [],
  children,
}: PrintableReportProps) {
  if (!open) return null;

  const generatedAt = new Date().toLocaleString('pt-BR');

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .cronos-print-root, .cronos-print-root * { visibility: visible !important; }
          .cronos-print-root {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .cronos-print-toolbar { display: none !important; }
          .cronos-print-page {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { size: A4; margin: 11mm; }
        }
      `}</style>

      <div
        className="cronos-print-root"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          background: 'rgba(1, 7, 16, .78)',
          backdropFilter: 'blur(10px)',
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="cronos-print-toolbar"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,.1)',
            background: '#081426',
          }}
        >
          <strong>{title}</strong>
          <div className="quick-actions">
            <button type="button" className="primary-button" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir / Salvar PDF
            </button>
            <button type="button" className="ghost-button" onClick={onClose}>
              <X size={16} /> Fechar
            </button>
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
          <article
            className="cronos-print-page"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 840,
              minHeight: 1120,
              overflow: 'hidden',
              padding: 30,
              color: '#111827',
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 24px 70px rgba(0,0,0,.35)',
              fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <img
              src={brandLogo}
              alt=""
              aria-hidden="true"
              className="cronos-print-watermark"
              style={{
                position: 'absolute',
                left: '50%',
                top: '54%',
                width: 430,
                height: 430,
                transform: 'translate(-50%, -50%)',
                objectFit: 'cover',
                borderRadius: '50%',
                opacity: 0.035,
                filter: 'grayscale(1)',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 0,
              }}
            />

            <header
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 24,
                paddingBottom: 16,
                marginBottom: 16,
                borderBottom: '2px solid #0f172a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={brandLogo}
                  alt="Prime Tech"
                  style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '50%' }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: 16 }}>
                    {company?.trade_name || 'Prime Tech'}
                  </strong>
                  {company?.legal_name && <div>{company.legal_name}</div>}
                  {company?.document && <div>CNPJ/CPF: {company.document}</div>}
                  {company?.phone && <div>Telefone: {company.phone}</div>}
                </div>
              </div>

              <div style={{ textAlign: 'right', maxWidth: 360 }}>
                <div style={{ fontSize: 19, fontWeight: 800 }}>{title}</div>
                {subtitle && <div style={{ marginTop: 3, color: '#475569' }}>{subtitle}</div>}
                <div style={{ marginTop: 7, color: '#64748b', fontSize: 11 }}>
                  Emitido em {generatedAt}
                </div>
                {generatedBy && (
                  <div style={{ color: '#64748b', fontSize: 11 }}>Por: {generatedBy}</div>
                )}
              </div>
            </header>

            {filters.length > 0 && (
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '5px 16px',
                  padding: '9px 12px',
                  marginBottom: 16,
                  border: '1px solid #dbe3ee',
                  borderRadius: 7,
                  background: '#f8fafc',
                }}
              >
                {filters.map((filter) => (
                  <span key={`${filter.label}-${filter.value}`}>
                    <strong>{filter.label}:</strong> {filter.value}
                  </span>
                ))}
              </div>
            )}

            <div style={{ position: 'relative', zIndex: 1 }}>
              {children}
            </div>

            <footer
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 28,
                paddingTop: 9,
                borderTop: '1px solid #dbe3ee',
                color: '#64748b',
                fontSize: 10,
              }}
            >
              <span>Cronos • Prime Tech • Relatório gerencial</span>
              <span>{company?.email ?? company?.footer_text ?? ''}</span>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}
