import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { demoClients, demoCompany, demoEquipment, demoFinance, demoOrders, demoStock } from "../data/demoSeed";
import type {
  Client,
  CompanySettings,
  CreateClientInput,
  CreateEquipmentInput,
  CreateOrderInput,
  Equipment,
  FinancialEntry,
  OrderStatus,
  ServiceOrder,
  ServiceOrderItem,
  StockItem,
} from "../types/domain";

interface PrimeTechContextValue {
  clients: Client[];
  equipment: Equipment[];
  orders: ServiceOrder[];
  stock: StockItem[];
  finance: FinancialEntry[];
  company: CompanySettings;
  loading: boolean;
  error: string;
  createClient: (input: CreateClientInput) => Promise<Client>;
  createEquipment: (input: CreateEquipmentInput) => Promise<Equipment>;
  createOrder: (input: CreateOrderInput) => Promise<ServiceOrder>;
  updateTechnical: (id: string, diagnosis: string, estimatedDays: number, items: Omit<ServiceOrderItem, "id" | "service_order_id">[], submit?: boolean) => Promise<void>;
  transitionOrder: (id: string, status: OrderStatus, notes?: string) => Promise<void>;
  updateCompany: (input: Partial<CompanySettings>) => Promise<void>;
  refresh: () => Promise<void>;
  addFinancialEntry: (entry: Omit<FinancialEntry, 'id'>) => Promise<void>;
  addStockItem: (item: Omit<StockItem, 'id'>) => Promise<void>;
}

const PrimeTechContext = createContext<PrimeTechContextValue | undefined>(undefined);
const STORAGE_KEY = "prime-tech-demo-data-v1";

interface DemoState {
  clients: Client[];
  equipment: Equipment[];
  orders: ServiceOrder[];
  stock: StockItem[];
  finance: FinancialEntry[];
  company: CompanySettings;
}

function initialDemoState(): DemoState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return {
    clients: demoClients,
    equipment: demoEquipment,
    orders: demoOrders,
    stock: demoStock,
    finance: demoFinance,
    company: demoCompany,
  };
}

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function PrimeTechProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const [state, setState] = useState<DemoState>(() => mode === "demo" ? initialDemoState() : {
    clients: [],
    equipment: [],
    orders: [],
    stock: [],
    finance: [],
    company: demoCompany,
  });
  const [loading, setLoading] = useState(mode === "supabase");
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => {
    if (mode === "demo") localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [mode, state]);

  const refresh = async () => {
    if (mode !== "supabase" || !supabase || !user) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const [clientsRes, equipmentRes, ordersRes, stockRes, financeRes, companyRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("equipment").select("*").order("created_at", { ascending: false }),
        supabase.from("service_orders").select("*, items:service_order_items(*)").order("created_at", { ascending: false }),
        supabase.from("stock_items").select("*").order("name"),
        supabase.from("financial_entries").select("*").order("occurred_at", { ascending: false }),
        supabase.from("company_settings").select("*").limit(1).maybeSingle(),
      ]);
      const errors = [clientsRes.error, equipmentRes.error, ordersRes.error, stockRes.error, financeRes.error, companyRes.error].filter(Boolean);
      if (errors.length) throw errors[0];
      if (version !== requestVersion.current) return;
      setState({
        clients: (clientsRes.data ?? []) as Client[],
        equipment: (equipmentRes.data ?? []) as Equipment[],
        orders: (ordersRes.data ?? []) as ServiceOrder[],
        stock: (stockRes.data ?? []) as StockItem[],
        finance: (financeRes.data ?? []) as FinancialEntry[],
        company: (companyRes.data as CompanySettings | null) ?? demoCompany,
      });
    } catch (cause) {
      if (version === requestVersion.current) setError("Não foi possível carregar os dados. Atualize a página para tentar novamente.");
      throw cause;
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== "supabase") return;
    ++requestVersion.current;
    setState({ clients: [], equipment: [], orders: [], stock: [], finance: [], company: demoCompany });
    if (user) void refresh().catch(() => {});
    else setLoading(false);
    return () => { ++requestVersion.current; };
  }, [mode, user?.id, user?.permissions?.join(",")]);

  const api = useMemo<PrimeTechContextValue>(() => ({
    ...state,
    loading,
    error,
    refresh,
    async addFinancialEntry(entry) {
      if (!Number.isFinite(entry.amount) || entry.amount <= 0) throw new Error("Informe um valor positivo.");
      if (mode === "supabase" && supabase) { const { error } = await supabase.from("financial_entries").insert({ ...entry, created_by: user?.id }); if (error) throw error; await refresh(); }
      else setState(s => ({ ...s, finance: [{ ...entry, id: uuid() }, ...s.finance] }));
    },
    async addStockItem(item) {
      if (mode === "supabase" && supabase) { const { error } = await supabase.from("stock_items").insert(item); if (error) throw error; await refresh(); }
      else setState(s => ({ ...s, stock: [{ ...item, id: uuid() }, ...s.stock] }));
    },
    async createClient(input) {
      if (mode === "supabase" && supabase) {
        const { data, error } = await supabase.from("clients").insert(input).select().single();
        if (error) throw error;
        await refresh();
        return data as Client;
      }
      const client: Client = { id: uuid(), created_at: now(), ...input };
      setState((s) => ({ ...s, clients: [...s.clients, client] }));
      return client;
    },
    async createEquipment(input) {
      if (mode === "supabase" && supabase) {
        const { data, error } = await supabase.from("equipment").insert(input).select().single();
        if (error) throw error;
        await refresh();
        return data as Equipment;
      }
      const item: Equipment = { id: uuid(), created_at: now(), ...input };
      setState((s) => ({ ...s, equipment: [item, ...s.equipment] }));
      return item;
    },
    async createOrder(input) {
      if (mode === "supabase" && supabase) {
        const { data, error } = await supabase
          .from("service_orders")
          .insert({ ...input, status: "waiting_technician", approval_status: "pending" })
          .select()
          .single();
        if (error) throw error;
        await refresh();
        return data as ServiceOrder;
      }
      const nextNumber = Math.max(0, ...state.orders.map((o) => o.order_number)) + 1;
      const order: ServiceOrder = {
        id: uuid(),
        order_number: nextNumber,
        ...input,
        status: "waiting_technician",
        approval_status: "pending",
        total_services: 0,
        total_parts: 0,
        total_amount: 0,
        created_at: now(),
        updated_at: now(),
      };
      setState((s) => ({ ...s, orders: [order, ...s.orders] }));
      return order;
    },
    async updateTechnical(id, diagnosis, estimatedDays, items, submit = true) {
      const totals = items.reduce(
        (acc, item) => {
          const total = item.quantity * item.unit_price;
          if (item.kind === "service") acc.services += total;
          else acc.parts += total;
          return acc;
        },
        { services: 0, parts: 0 },
      );
      if (mode === "supabase" && supabase) {
        const current = state.orders.find((order) => order.id === id);
        const { error } = await supabase.rpc("save_technical_quote", {
          p_order_id: id, p_diagnosis: diagnosis, p_days: estimatedDays,
          p_items: items, p_submit: submit, p_expected_updated_at: current?.updated_at,
        });
        if (error) throw error;
        await refresh();
        return;
      }
      setState((s) => ({
        ...s,
        orders: s.orders.map((order) => order.id === id ? {
          ...order,
          diagnosis,
          estimated_days: estimatedDays,
          items: items.map((item) => ({ ...item, id: uuid(), service_order_id: id })),
          total_services: totals.services,
          total_parts: totals.parts,
          total_amount: totals.services + totals.parts,
          status: submit ? "waiting_customer" : order.status,
          updated_at: now(),
        } : order),
      }));
    },
    async transitionOrder(id, status, notes) {
      if (mode === "supabase" && supabase) {
        const { error } = await supabase.rpc("transition_service_order", { p_order_id: id, p_new_status: status, p_notes: notes ?? null });
        if (error) throw error;
        await refresh();
        return;
      }
      setState((s) => ({
        ...s,
        orders: s.orders.map((order) => {
          if (order.id !== id) return order;
          return {
            ...order,
            status,
            approval_status: status === "approved" ? "approved" : status === "cancelled" ? "rejected" : order.approval_status,
            approval_notes: notes ?? order.approval_notes,
            approved_at: status === "approved" ? now() : order.approved_at,
            updated_at: now(),
          };
        }),
      }));
    },
    async updateCompany(input) {
      if (mode === "supabase" && supabase) {
        const { error } = await supabase.from("company_settings").upsert({ ...state.company, ...input });
        if (error) throw error;
        await refresh();
        return;
      }
      setState((s) => ({ ...s, company: { ...s.company, ...input } }));
    },
  }), [state, loading, error, mode, user?.id]);

  return <PrimeTechContext.Provider value={api}>{children}</PrimeTechContext.Provider>;
}

export function usePrimeTech() {
  const ctx = useContext(PrimeTechContext);
  if (!ctx) throw new Error("usePrimeTech deve ser usado dentro de PrimeTechProvider");
  return ctx;
}
