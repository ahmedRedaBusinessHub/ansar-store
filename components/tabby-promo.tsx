"use client";

import { useEffect, useState } from "react";
import { useTabbyConfig } from "@/hooks/use-tabby-config";
import { loadTabbyScript } from "@/lib/tabby-script";

export function TabbyPromo({ priceSar, source }: { priceSar: number; source: "product" | "cart" }) {
  const config = useTabbyConfig();
  const [failed, setFailed] = useState(false);
  const [prevPrice, setPrevPrice] = useState(priceSar);

  if (priceSar !== prevPrice) {
    setPrevPrice(priceSar);
    setFailed(false);
  }

  useEffect(() => {
    if (!config?.enabled || !config.publicKey || !config.merchantCode || priceSar <= 0) {
      return;
    }
    const { publicKey, merchantCode } = config;
    let cancelled = false;

    async function init() {
      try {
        await loadTabbyScript("https://checkout.tabby.ai/tabby-promo.js");
        if (cancelled) return;
        new (window as any).TabbyPromo({
          selector: `#tabby-promo-${source}`,
          currency: "SAR",
          price: priceSar.toFixed(2),
          lang: "ar",
          source,
          publicKey,
          merchantCode,
          shouldInheritBg: false,
        });
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [priceSar, source, config?.enabled, config?.publicKey, config?.merchantCode]);

  if (!config?.enabled || priceSar <= 0 || failed) {
    return null;
  }

  return <div id={`tabby-promo-${source}`} className="tabby-promo-slot" />;
}
