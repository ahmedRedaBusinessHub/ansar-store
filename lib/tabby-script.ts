export type TabbyScriptSrc = "https://checkout.tabby.ai/tabby-promo.js" | "https://checkout.tabby.ai/tabby-card.js";

const cache = new Map<TabbyScriptSrc, Promise<void>>();

export function loadTabbyScript(src: TabbyScriptSrc): Promise<void> {
  const cached = cache.get(src);
  if (cached) return cached;

  if (typeof document === "undefined") {
    return Promise.reject(new Error("document is not defined"));
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    const promise = Promise.resolve();
    cache.set(src, promise);
    return promise;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      cache.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.body.appendChild(script);
  });
  cache.set(src, promise);
  return promise;
}
