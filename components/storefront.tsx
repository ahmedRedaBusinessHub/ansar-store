"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUpLeft, ChevronDown, Heart, PackageCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Star, Truck, X } from "lucide-react";
import type { StoreData } from "@/lib/types";
import { ReviewHighlights } from "./review-highlights";
import { AppPromo } from "./app-promo";
import { StoreShell } from "./store-shell";
import { MatchesStrip } from "./matches-strip";
import { productPriceRange } from "@/lib/cart";
import { formatAverage, reviewCountLabel } from "@/lib/reviews";
import { offerFor } from "@/lib/offer";

const price = (value: number) => new Intl.NumberFormat("en-SA").format(value);

/** `initialStore` comes from the server (app/page.tsx). Null means the server could not reach web-api, so load in the browser. */
export default function Storefront({ initialStore }: { initialStore: StoreData | null }) {
  const [store, setStore] = useState<StoreData | null>(initialStore);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (store) return;
    const controller = new AbortController();
    setFailed(false);
    fetch("/api/store", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("catalog unavailable"); return response.json(); })
      .then(setStore)
      .catch(error => { if (error.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
    // `store` is deliberately not a dependency: once loaded, the store is never refetched here.
  }, [attempt]);

  if (!store) return <main className="initial-state" aria-busy={!failed}>
    <img src="/images/logo.svg" alt="نادي الأنصار" width="180" height="70" />
    {failed ? <><h1>تعذّر تحميل المتجر</h1><p>حاول مرة أخرى بعد لحظات.</p><button className="button button-primary" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={18} />إعادة المحاولة</button></> : <><span className="loading-line" /><p role="status">نجهز لك مجموعة الأنصار…</p></>}
  </main>;
  return <Shop store={store} />;
}

function Shop({ store }: { store: StoreData }) {
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState(store.products);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Product pages link back with ?favorites=1 or ?q=… (components/product-page.tsx).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("favorites") === "1") setFavoritesOnly(true);
    const q = params.get("q");
    if (q) setQuery(q.slice(0, 100));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams({ category, sort, q: query, limit: "24" });
      fetch(`/api/products?${params}`, { signal: controller.signal })
        .then(response => { if (!response.ok) throw new Error("catalog unavailable"); return response.json(); })
        .then(data => setProducts(data.products))
        .catch(error => { if (error.name !== "AbortError") setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [category, sort, query, retry]);

  const browse = (id = "all", favorites = false) => {
    setCategory(id); setFavoritesOnly(favorites);
    if (favorites) setQuery("");
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <StoreShell
    store={store}
    nav={{ onShopAll: () => browse(), onFavorites: () => browse("all", true), storyHref: "#our-story", isShopAllActive: !favoritesOnly && category === "all" }}
    search={{ query, onQueryChange: setQuery, onSubmit: () => browse(category) }}
  >
    {({ shop, toggleFavorite, openPolicy }) => {
      const visible = favoritesOnly ? products.filter(product => shop.wishlist.includes(product.id)) : products;
      return <main id="main-content">
        <section className="hero" aria-label="مجموعة الموسم الجديد">
          <img className="hero-photo" src={store.hero.image} alt="طقم الأنصار الأخضر والأبيض في شوارع المدينة" fetchPriority="high" />
          <div className="hero-content">
            <div className="eyebrow"><span />{store.hero.eyebrow}</div>
            <h1>{store.hero.title}<span>حكاية نرتديها.</span></h1>
            <p>{store.hero.description}</p>
            <button className="button button-primary hero-button" onClick={() => browse()}>اكتشف أطقم الموسم <ArrowLeft size={20} /></button>
            <div className="hero-season"><span>المجموعة الجديدة</span><b dir="ltr">{store.season}</b></div>
          </div>
          <div className="hero-caption" dir="ltr"><span>ROOTED IN MADINAH.</span><span>MADE FOR THE NEXT CHAPTER.</span></div>
          <a className="scroll-cue" href="#collection" aria-label="اكتشف المجموعة"><ArrowDown size={17} /></a>
        </section>

        <div className="manifesto"><span>نادي واحد. مدينة واحدة. انتماء لا ينتهي.</span><img src="/images/crest.svg" width="26" height="30" alt="" /><span dir="ltr">ONE CLUB. ONE CITY. ALWAYS ANSAR.</span></div>

        <MatchesStrip />

        <section className="catalog-section section-shell" id="collection">
          <div className="section-heading"><div><span className="section-kicker">ألواننا تجمعنا</span><h2>{favoritesOnly ? "اختياراتك المفضلة" : "ارتدِ الانتماء"}<span className="heading-dot">.</span></h2><p>{favoritesOnly ? "قطع اخترتها، وحكاية تشبهك." : "أطقم الموسم الجديد، لكل من يحمل الأنصار في قلبه."}</p></div><span className="collection-edition" dir="ltr">THE {store.season}<br /><b>COLLECTION</b></span></div>
          <div className="catalog-toolbar">
            <div className="category-tabs" aria-label="تصنيف المنتجات">{store.categories.map(item => <button key={item.id} aria-pressed={category === item.id && !favoritesOnly} className={category === item.id && !favoritesOnly ? "selected" : ""} onClick={() => { setCategory(item.id); setFavoritesOnly(false); }}>{item.label}{item.id === "all" && <span>{store.products.length}</span>}</button>)}{favoritesOnly && <button className="selected" onClick={() => setFavoritesOnly(false)}>المفضلة <X size={14} /></button>}</div>
            {store.products.length > 1 && <label className="sort-control"><SlidersHorizontal size={16} /><span className="sort-label">الترتيب:</span><select value={sort} onChange={e => setSort(e.target.value)} aria-label="ترتيب المنتجات"><option value="featured">مختاراتنا لك</option><option value="price-asc">السعر: الأقل أولًا</option><option value="price-desc">السعر: الأعلى أولًا</option></select><ChevronDown size={14} /></label>}
          </div>
          {query && <div className="search-summary">نتائج البحث عن «{query}»<button className="text-button" onClick={() => setQuery("")}>مسح <X size={13} /></button></div>}
          <div aria-live="polite" className="sr-only">{loading ? "جارٍ تحميل المنتجات" : `${visible.length} منتجات`}</div>
          {error ? <div className="empty-state"><RefreshCw size={32} /><h3>تعذّر تحديث المنتجات</h3><button className="button button-primary" onClick={() => setRetry(n => n + 1)}>إعادة المحاولة</button></div> : visible.length === 0 && !loading ? <div className="empty-state">{favoritesOnly ? <Heart size={36} /> : <Search size={36} />}<h3>{favoritesOnly ? "مفضلتك تنتظر أول اختيار" : "لم نجد منتجات مطابقة"}</h3><p>{favoritesOnly ? "اضغط على القلب بجانب القطعة التي تحبها." : "جرّب كلمة مختلفة أو تصنيفًا آخر."}</p><button className="button button-outline" onClick={() => { setFavoritesOnly(false); setCategory("all"); setQuery(""); }}>اكتشف كل المنتجات <ArrowLeft size={17} /></button></div> : <div className={`product-grid ${loading ? "is-loading" : ""}`} aria-busy={loading}>{visible.map(product => {
            const range = productPriceRange(product);
            const offer = offerFor(product, range.minimum);
            const href = `/products/${product.id}`;
            return <article className="product-card" key={product.id}>
              <div className="product-media"><Link className="product-image-button" href={href} aria-label={`عرض ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" /><span className="product-discover">اكتشف التفاصيل <ArrowUpLeft size={18} /></span></Link><span className="product-badge">{product.badge || `موسم ${store.season}`}</span><button className={`product-favorite icon-button ${shop.wishlist.includes(product.id) ? "saved" : ""}`} aria-label={`${shop.wishlist.includes(product.id) ? "إزالة من" : "إضافة إلى"} المفضلة: ${product.name}`} title="المفضلة" aria-pressed={shop.wishlist.includes(product.id)} onClick={() => toggleFavorite(product.id)}><Heart size={19} fill={shop.wishlist.includes(product.id) ? "currentColor" : "none"} /></button></div>
              <div className="product-info"><span className="product-subtitle">{product.subtitle}</span><Link className="product-title" href={href}>{product.name}</Link>{product.rating && <span className="product-rating" role="img" aria-label={`${formatAverage(product.rating.average)} من 5، ${reviewCountLabel(product.rating.count)}`}><Star size={12} fill="currentColor" aria-hidden="true" /><b>{formatAverage(product.rating.average)}</b><span>({product.rating.count})</span></span>}<div className="product-bottom"><div className="price">{range.variable && <small>يبدأ من</small>}<b>{price(range.minimum)}</b><span>ر.س</span>{offer && <><del aria-label={`السعر قبل العرض ${price(offer.original)} ر.س`}>{price(offer.original)}</del><em className="offer-badge">وفّر {offer.percentOff}٪</em></>}</div><div className="color-swatches">{product.colors.map(color => <span key={color.value} style={{ background: color.value }} title={color.name} aria-label={color.name} />)}</div></div><Link className="quick-add" href={href}><ShoppingBag size={16} />{product.optionGroups.length > 0 ? "اختر خياراتك" : "أضف إلى السلة"}<ArrowLeft size={16} /></Link></div>
            </article>;
          })}</div>}
          <div className="catalog-note"><span>كل قطعة، حكاية انتماء.</span><span>الأسعار المعروضة تشمل الضريبة</span></div>
        </section>

        <ReviewHighlights products={store.products} />

        <AppPromo />

        <section className="story" id="our-story">
          <img src="/images/kit-campaign.webp" alt="تفاصيل شعار الأنصار المطرز على قماش الطقم" loading="lazy" />
          <div className="story-content"><span className="section-kicker">من المدينة، بكل فخر</span><h2>جذور راسخة.<br />وشغف يتجدد.</h2><p>ألوان نحملها، ومدينة نحملها في قلوبنا.<br />مجموعة تستلهم روح الأنصار وتفاصيل المدينة،<br className="desktop-break" /> لترافقك في كل يوم، وفي كل مدرج.</p><button className="button button-white" onClick={() => browse()}>اكتشف المجموعة <ArrowLeft size={19} /></button><span className="story-signature" dir="ltr">ANSAR. MORE THAN A CLUB.</span></div>
        </section>

        <section className="benefits section-shell" aria-label="خدمات المتجر"><div><Truck /><h3>من المدينة إلى بابك</h3><p>نوصل طلبك إلى العنوان الذي تختاره</p></div><div><PackageCheck /><h3>اختيار يناسبك</h3><p>اختر المقاس والخيارات قبل الإضافة</p></div><div><RefreshCw /><h3>تسوق باطمئنان</h3><button onClick={() => openPolicy(store.policies.find(p => p.id === "returns") || store.policies[0])}>اطّلع على سياسة الاستبدال</button></div><div><ShieldCheck /><h3>هوية نعتز بها</h3><p>تفاصيل من روح نادي الأنصار</p></div></section>
      </main>;
    }}
  </StoreShell>;
}
