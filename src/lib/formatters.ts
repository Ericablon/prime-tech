export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const shortDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

export const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function orderCode(orderNumber: number) {
  return `OS #${String(orderNumber).padStart(6, "0")}`;
}

export function equipmentCode(number?: number) { return number ? `TEC-${String(number).padStart(4, "0")}` : "Sem código técnico"; }
export const paymentMethods: Record<string,string> = { cash: "Dinheiro", pix: "Pix", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", boleto: "Boleto", transfer: "Transferência" };
