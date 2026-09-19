export const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  // es-ES sets minimumGroupingDigits=2, so 4187 would render "4187 €"; force
  // grouping so prices always read "4.187 €".
  useGrouping: "always",
});
