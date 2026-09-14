import type { RoleCode, UserProfile } from "../types/domain";

export type Permission =
  | "dashboard.view"
  | "clients.view"
  | "clients.manage"
  | "equipment.view"
  | "equipment.manage"
  | "orders.view"
  | "orders.create"
  | "orders.tech"
  | "orders.customer_approval"
  | "orders.delivery"
  | "stock.view"
  | "stock.manage"
  | "finance.view"
  | "finance.manage"
  | "fiscal.view"
  | "fiscal.manage"
  | "reports.view"
  | "admin.manage";

export const defaultPermissions: Record<RoleCode, Permission[]> = {
  atendimento: [
    "dashboard.view",
    "clients.view",
    "clients.manage",
    "equipment.view",
    "equipment.manage",
    "orders.view",
    "orders.create",
    "orders.customer_approval",
    "orders.delivery",
    "stock.view",
  ],
  tecnico: [
    "dashboard.view",
    "clients.view",
    "equipment.view",
    "orders.view",
    "orders.tech",
    "stock.view",
  ],
  gestor: [
    "dashboard.view",
    "clients.view",
    "clients.manage",
    "equipment.view",
    "equipment.manage",
    "orders.view",
    "orders.create",
    "orders.tech",
    "orders.customer_approval",
    "orders.delivery",
    "stock.view",
    "stock.manage",
    "finance.view",
    "finance.manage",
    "fiscal.view",
    "fiscal.manage",
    "reports.view",
    "admin.manage",
  ],
};

export function can(user: UserProfile | null | undefined, permission: Permission) {
  if (!user || user.active === false) return false;
  return (user.permissions ?? (user.id.startsWith("demo-") ? defaultPermissions[user.role_code] : [])).includes(permission);
}
