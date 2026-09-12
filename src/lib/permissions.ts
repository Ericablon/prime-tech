import type { RoleCode } from "../types/domain";

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

const permissions: Record<RoleCode, Permission[]> = {
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

export function can(role: RoleCode | undefined, permission: Permission) {
  return !!role && permissions[role].includes(permission);
}
