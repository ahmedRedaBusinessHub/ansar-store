"use client";

import { useEffect, useState } from "react";

export type TabbyConfig = {
  enabled: boolean;
  publicKey: string | null;
  merchantCode: string | null;
};

let configPromise: Promise<TabbyConfig> | null = null;
let resolvedConfig: TabbyConfig | null = null;

function fetchTabbyConfig(): Promise<TabbyConfig> {
  if (resolvedConfig !== null) {
    return Promise.resolve(resolvedConfig);
  }
  if (!configPromise) {
    configPromise = fetch("/api/tabby-config")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TabbyConfig>;
      })
      .then((data) => {
        resolvedConfig = {
          enabled: Boolean(data?.enabled),
          publicKey: typeof data?.publicKey === "string" ? data.publicKey : null,
          merchantCode: typeof data?.merchantCode === "string" ? data.merchantCode : null,
        };
        return resolvedConfig;
      })
      .catch(() => {
        resolvedConfig = {
          enabled: false,
          publicKey: null,
          merchantCode: null,
        };
        return resolvedConfig;
      });
  }
  return configPromise;
}

export function useTabbyConfig(): TabbyConfig | null {
  const [config, setConfig] = useState<TabbyConfig | null>(resolvedConfig);

  useEffect(() => {
    let mounted = true;
    if (resolvedConfig !== null) {
      if (config !== resolvedConfig) {
        setConfig(resolvedConfig);
      }
      return;
    }
    fetchTabbyConfig().then((data) => {
      if (mounted) {
        setConfig(data);
      }
    });
    return () => {
      mounted = false;
    };
  }, [config]);

  return config;
}
