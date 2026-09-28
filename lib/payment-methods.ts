export type MethodFlags = { stcPay: boolean; applePay: boolean };
export type MoyasarMethodConfig = {
  methods: string[];
  supported_networks: string[];
  apple_pay?: { country: string; label: string; validate_merchant_url: string; supported_countries: string[] };
};

const on = (value: string | undefined) => value === "1" || value?.toLowerCase() === "true";
const off = (value: string | undefined) => value === "0" || value?.toLowerCase() === "false";

/** STC Pay is on unless explicitly "0"/"false"; Apple Pay is off unless "1"/"true" (needs HTTPS + a domain registered at Moyasar). */
export function readMethodFlags(env: { stcPay?: string; applePay?: string }): MethodFlags {
  return { stcPay: !off(env.stcPay), applePay: on(env.applePay) };
}

export function moyasarMethodConfig(flags: MethodFlags, applePayLabel: string): MoyasarMethodConfig {
  const methods = ["creditcard", ...(flags.stcPay ? ["stcpay"] : []), ...(flags.applePay ? ["applepay"] : [])];
  return {
    methods,
    supported_networks: ["mada", "visa", "mastercard", "amex"],
    ...(flags.applePay ? { apple_pay: {
      country: "SA",
      label: applePayLabel.trim() || "نادي الأنصار",
      validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate",
      supported_countries: ["SA"],
    } } : {}),
  };
}
