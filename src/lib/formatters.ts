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
