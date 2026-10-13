// Moyasar Payment Form loader for the ticket pay page. The order pay page keeps its own copy on purpose,
// so the order checkout is untouched by the ticket feature.
declare global {
  interface Window { Moyasar?: { init(config: Record<string, unknown>): void } }
}

const MPF_VERSION = "1.14.0";

export function loadMoyasar(): Promise<void> {
  if (window.Moyasar) return Promise.resolve();
  if (!document.querySelector("link[data-moyasar]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://cdn.moyasar.com/mpf/${MPF_VERSION}/moyasar.css`;
    link.dataset.moyasar = "1";
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://cdn.moyasar.com/mpf/${MPF_VERSION}/moyasar.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("moyasar"));
    document.body.appendChild(script);
  });
}
