export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <div className="space-y-6"><div><h1 className="pt-page-title">{title}</h1><p className="pt-page-subtitle">{description}</p></div><div className="pt-card"><p className="text-sm leading-7 text-muted">Módulo previsto na arquitetura. O núcleo funcional deste starter prioriza o fluxo Atendimento → Técnico → Aprovação → Manutenção → Entrega.</p></div></div>;
}
