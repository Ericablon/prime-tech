import type { Permission, RoleCode, UserProfile } from '../types/domain';

const base: Permission[] = ['dashboard.view'];
export const defaultPermissions: Record<RoleCode, Permission[]> = {
  admin: ['dashboard.view','clients.view','clients.manage','equipment.view','equipment.manage','orders.view','orders.create','orders.tech','orders.commercial','orders.approve','orders.deliver','stock.view','stock.reserve','stock.consume','stock.adjust','finance.view','finance.manage','finance.dre','fiscal.view','fiscal.issue','fiscal.cancel','fiscal.settings','reports.view','users.manage','permissions.manage','settings.manage','audit.view'],
  gestor: ['dashboard.view','clients.view','clients.manage','equipment.view','equipment.manage','orders.view','orders.create','orders.tech','orders.commercial','orders.approve','orders.deliver','stock.view','stock.reserve','stock.consume','stock.adjust','finance.view','finance.manage','finance.dre','fiscal.view','fiscal.issue','fiscal.cancel','reports.view','audit.view'],
  atendimento: [...base,'clients.view','clients.manage','equipment.view','equipment.manage','orders.view','orders.create','orders.deliver'],
  comercial: [...base,'clients.view','equipment.view','orders.view','orders.commercial','orders.approve','stock.view'],
  tecnico: [...base,'clients.view','equipment.view','orders.view','orders.tech','stock.view','stock.reserve','stock.consume'],
  estoque: [...base,'orders.view','stock.view','stock.reserve','stock.consume','stock.adjust'],
  financeiro: [...base,'orders.view','finance.view','finance.manage','finance.dre','fiscal.view'],
  fiscal: [...base,'orders.view','finance.view','fiscal.view','fiscal.issue','fiscal.cancel','fiscal.settings'],
};

export function can(user: UserProfile | null | undefined, permission: Permission) {
  if (!user || user.active === false) return false;
  return (user.permissions ?? defaultPermissions[user.role_code] ?? []).includes(permission);
}
