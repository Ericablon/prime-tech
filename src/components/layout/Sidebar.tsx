import { BarChart3, Boxes, BriefcaseBusiness, Building2, CalendarDays, ChevronDown, CircleDollarSign, FileText, Gauge, Laptop, ReceiptText, Settings, ShieldCheck, Users, Wrench } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../lib/permissions';
import type { Permission } from '../../types/domain';

type Child={to:string;label:string;permission:Permission}; type Group={label:string;icon:typeof Gauge;permission:Permission;children:Child[]};
const groups:Group[]=[
 {label:'Atendimento',icon:Users,permission:'clients.view',children:[{to:'/clientes',label:'Clientes',permission:'clients.view'},{to:'/equipamentos',label:'Equipamentos',permission:'equipment.view'}]},
 {label:'Ordens de Serviço',icon:Wrench,permission:'orders.view',children:[{to:'/ordens',label:'Todas as OS',permission:'orders.view'},{to:'/ordens/nova',label:'Nova OS',permission:'orders.create'}]},
 {label:'Operação técnica',icon:Laptop,permission:'orders.tech',children:[{to:'/tecnico',label:'Meu painel',permission:'orders.tech'},{to:'/agenda',label:'Programação técnica',permission:'orders.view'}]},
 {label:'Comercial',icon:BriefcaseBusiness,permission:'orders.commercial',children:[{to:'/comercial',label:'Funil comercial',permission:'orders.commercial'}]},
 {label:'Estoque',icon:Boxes,permission:'stock.view',children:[{to:'/estoque',label:'Peças e materiais',permission:'stock.view'}]},
 {label:'Financeiro',icon:CircleDollarSign,permission:'finance.view',children:[{to:'/financeiro',label:'Visão financeira',permission:'finance.view'},{to:'/financeiro/dre',label:'DRE',permission:'finance.dre'}]},
 {label:'Fiscal',icon:FileText,permission:'fiscal.view',children:[{to:'/fiscal',label:'Painel fiscal',permission:'fiscal.view'}]},
 {label:'Relatórios',icon:BarChart3,permission:'reports.view',children:[{to:'/relatorios',label:'Indicadores',permission:'reports.view'}]},
 {label:'Administração',icon:Settings,permission:'settings.manage',children:[{to:'/administracao',label:'Configurações',permission:'settings.manage'},{to:'/administracao/permissoes',label:'Perfis e permissões',permission:'permissions.manage'}]},
];
export function Sidebar({mobile=false,onNavigate}:{mobile?:boolean;onNavigate?:()=>void}){const {user}=useAuth();const [open,setOpen]=useState<Record<string,boolean>>({});return <aside className={`sidebar ${mobile?'sidebar-mobile':''}`}>
 <div className="brand"><div className="brand-mark"><span>P</span></div><div><strong>CRONOS</strong><small>Prime Tech</small></div></div>
 <nav className="nav"><NavLink to="/" end onClick={onNavigate} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Gauge size={18}/><span>Dashboard</span></NavLink>
 {groups.filter(g=>can(user,g.permission)).map(g=>{const children=g.children.filter(c=>can(user,c.permission));if(!children.length)return null;const expanded=open[g.label]??false;const Icon=g.icon;return <div className="nav-group" key={g.label}><button className="nav-group-button" onClick={()=>setOpen(v=>({...v,[g.label]:!expanded}))}><span><Icon size={18}/>{g.label}</span><ChevronDown size={16} className={expanded?'rotate':''}/></button>{expanded&&<div className="nav-children">{children.map(c=><NavLink key={c.to} to={c.to} onClick={onNavigate} className={({isActive})=>`nav-child ${isActive?'active':''}`}>{c.label}</NavLink>)}</div>}</div>})}
 </nav><div className="sidebar-foot"><ShieldCheck size={15}/><span>Ambiente seguro · v0.3</span></div></aside>}
