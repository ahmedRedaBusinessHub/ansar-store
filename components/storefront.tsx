"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUpLeft, Check, ChevronDown, Heart, Menu, PackageCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Truck, UserRound, X } from "lucide-react";
import type { Product, StoreData } from "@/lib/types";
import { useShop } from "@/hooks/use-shop";
import { CartDialog, InfoDialog, ProductDialog } from "./shop-dialogs";
import { AuthDialog } from "./auth-dialog";
import { CheckoutDialog } from "./checkout-dialog";
import { useSession } from "@/hooks/use-session";
import { productPriceRange } from "@/lib/cart";

const price = (value: number) => new Intl.NumberFormat("en-SA").format(value);

export default function Storefront() {
  const [store, setStore] = useState<StoreData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch("/api/store", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("catalog unavailable"); return response.json(); })
      .then(setStore)
      .catch(error => { if (error.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
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
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [policy, setPolicy] = useState<StoreData["policies"][number] | null>(null);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const shop = useShop(store.products, store.shipping);
  const session = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [resumeCheckout, setResumeCheckout] = useState(false);
  const startCheckout = () => {
    setCartOpen(false);
    if (session.user) setCheckoutOpen(true);
    else { setResumeCheckout(true); setAuthOpen(true); }
  };
  const requireSignIn = useCallback(() => { setCheckoutOpen(false); setResumeCheckout(true); setAuthOpen(true); }, []);
  const count = shop.cart.reduce((sum, item) => sum + item.quantity, 0);

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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const browse = (id = "all", favorites = false) => {
    setCategory(id); setFavoritesOnly(favorites); setMenuOpen(false);
    if (favorites) setQuery("");
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const add = (id: string, optionIds: string[]) => {
    const added = shop.addItem(id, optionIds);
    if (added) {
      setToast("أضفنا اختيارك إلى السلة");
      setSelected(null);
      setCartOpen(true);
    }
    return added;
  };
  const toggleFavorite = (id: string) => {
    const saved = shop.wishlist.includes(id);
    shop.toggleWishlist(id);
    setToast(saved ? "تمت الإزالة من المفضلة" : "احتفظنا به في مفضلتك");
  };
  const visible = favoritesOnly ? products.filter(product => shop.wishlist.includes(product.id)) : products;

  return <>
    <a className="skip-link" href="#collection">انتقل إلى المنتجات</a>
    <div className="announcement"><span>من المدينة… إلى باب بيتك</span><span><ShieldCheck size={15} /> دفع إلكتروني آمن عبر مدى وفيزا وماستركارد</span><span className="announcement-season">مجموعة {store.season}</span></div>
    <header className="header">
      <a className="brand" href="#" aria-label="متجر الأنصار - الرئيسية"><img src="/images/logo.svg" alt="الأنصار" width="152" height="62" /><span>المتجر</span></a>
      <nav className="desktop-nav" aria-label="التنقل الرئيسي">
        <button className={!favoritesOnly && category === "all" ? "active" : ""} onClick={() => browse()}>تسوق الكل</button>
        <a href="/orders">طلباتي</a>
        <a href="#our-story">حكايتنا</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button mobile-menu-toggle" title="القائمة" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X /> : <Menu />}</button>
        <button className="icon-button" title="البحث" aria-label="البحث" aria-expanded={searchOpen} onClick={() => setSearchOpen(v => !v)}>{searchOpen ? <X /> : <Search />}</button>
        <button className="icon-button" title={session.user ? "طلباتي" : "تسجيل الدخول"} aria-label={session.user ? `طلباتي، ${session.user.name}` : "تسجيل الدخول"} onClick={() => session.user ? window.location.assign("/orders") : setAuthOpen(true)}><UserRound /></button>
        <button className="icon-button favorite-header" title="المفضلة" aria-label={`المفضلة، ${shop.wishlist.length} منتجات`} onClick={() => browse("all", true)}><Heart />{shop.wishlist.length > 0 && <span className="small-dot" />}</button>
        <span className="action-divider" />
        <button className="cart-trigger" title="سلة التسوق" aria-label={`سلة التسوق، ${count} منتجات`} onClick={() => setCartOpen(true)}><ShoppingBag size={21} /><span className="cart-word">السلة</span><span className="cart-count">{count}</span></button>
      </div>
    </header>
    {menuOpen && <nav className="mobile-nav" aria-label="قائمة الموبايل"><button onClick={() => browse()}>تسوق الكل <ArrowLeft size={17} /></button><a href="/orders">طلباتي <ArrowLeft size={17} /></a>{session.user ? <button onClick={() => void session.logout()}>تسجيل الخروج</button> : <button onClick={() => { setMenuOpen(false); setAuthOpen(true); }}>تسجيل الدخول</button>}<button onClick={() => browse("all", true)}>المفضلة <Heart size={17} /></button></nav>}
    {searchOpen && <div className="search-bar"><Search size={20} /><input ref={searchRef} value={query} maxLength={100} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") browse(category); if (e.key === "Escape") setSearchOpen(false); }} placeholder="ابحث عن طقمك القادم…" aria-label="ابحث في المنتجات" />{query && <button className="icon-button" aria-label="مسح البحث" title="مسح البحث" onClick={() => setQuery("")}><X size={18} /></button>}<button className="text-button" onClick={() => browse(category)}>عرض النتائج <ArrowLeft size={16} /></button></div>}

    <main>
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
          return <article className="product-card" key={product.id}>
          <div className="product-media"><button className="product-image-button" onClick={() => setSelected(product)} aria-label={`عرض ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" /><span className="product-discover">اكتشف التفاصيل <ArrowUpLeft size={18} /></span></button><span className="product-badge">{product.badge || `موسم ${store.season}`}</span><button className={`product-favorite icon-button ${shop.wishlist.includes(product.id) ? "saved" : ""}`} aria-label={`${shop.wishlist.includes(product.id) ? "إزالة من" : "إضافة إلى"} المفضلة: ${product.name}`} title="المفضلة" aria-pressed={shop.wishlist.includes(product.id)} onClick={() => toggleFavorite(product.id)}><Heart size={19} fill={shop.wishlist.includes(product.id) ? "currentColor" : "none"} /></button></div>
          <div className="product-info"><span className="product-subtitle">{product.subtitle}</span><button className="product-title" onClick={() => setSelected(product)}>{product.name}</button><div className="product-bottom"><div className="price">{range.variable && <small>يبدأ من</small>}<b>{price(range.minimum)}</b><span>ر.س</span>{product.originalPrice && <del>{price(product.originalPrice)}</del>}</div><div className="color-swatches">{product.colors.map(color => <span key={color.value} style={{ background: color.value }} title={color.name} aria-label={color.name} />)}</div></div><button className="quick-add" onClick={() => setSelected(product)}><ShoppingBag size={16} />{product.optionGroups.length > 0 ? "اختر خياراتك" : "أضف إلى السلة"}<ArrowLeft size={16} /></button></div>
        </article>;
        })}</div>}
        <div className="catalog-note"><span>كل قطعة، حكاية انتماء.</span><span>الأسعار المعروضة تشمل الضريبة</span></div>
      </section>

      <section className="story" id="our-story">
        <img src="/images/kit-campaign.webp" alt="تفاصيل شعار الأنصار المطرز على قماش الطقم" loading="lazy" />
        <div className="story-content"><span className="section-kicker">من المدينة، بكل فخر</span><h2>جذور راسخة.<br />وشغف يتجدد.</h2><p>ألوان نحملها، ومدينة نحملها في قلوبنا.<br />مجموعة تستلهم روح الأنصار وتفاصيل المدينة،<br className="desktop-break" /> لترافقك في كل يوم، وفي كل مدرج.</p><button className="button button-white" onClick={() => browse()}>اكتشف المجموعة <ArrowLeft size={19} /></button><span className="story-signature" dir="ltr">ANSAR. MORE THAN A CLUB.</span></div>
      </section>

      <section className="benefits section-shell" aria-label="خدمات المتجر"><div><Truck /><h3>من المدينة إلى بابك</h3><p>نوصل طلبك إلى العنوان الذي تختاره</p></div><div><PackageCheck /><h3>اختيار يناسبك</h3><p>اختر المقاس والخيارات قبل الإضافة</p></div><div><RefreshCw /><h3>تسوق باطمئنان</h3><button onClick={() => setPolicy(store.policies.find(p => p.id === "returns") || store.policies[0])}>اطّلع على سياسة الاستبدال</button></div><div><ShieldCheck /><h3>هوية نعتز بها</h3><p>تفاصيل من روح نادي الأنصار</p></div></section>
    </main>

    <footer className="footer"><div className="footer-main section-shell"><div className="footer-brand"><img src="/images/crest.svg" width="56" height="66" alt="شعار الأنصار" /><h2>الأنصار يجمعنا.</h2><p>من قلب المدينة، إلى كل قلب أنصاري.</p></div><div className="footer-links"><h3>تسوق الأنصار</h3><button onClick={() => browse()}>المجموعة كاملة</button><a href="/orders">طلباتي</a><button onClick={() => browse("all", true)}>مفضلتي</button></div><div className="footer-links"><h3>نحن معك</h3>{store.policies.map(p => <button key={p.id} onClick={() => setPolicy(p)}>{p.title}</button>)}</div><div className="footer-message"><span>وعدنا واحد</span><p>كلنا أنصار.<br />دائمًا وأبدًا.</p><span dir="ltr">ROOTED IN MADINAH.</span></div></div><div className="footer-bottom section-shell"><span>© {new Date().getFullYear()} متجر الأنصار</span><span>الأسعار تشمل ضريبة القيمة المضافة</span><span dir="ltr">SAUDI ARABIA · SAR</span></div></footer>
    <ProductDialog product={selected} onClose={() => setSelected(null)} onAdd={add} wishlist={shop.wishlist} onToggleWishlist={toggleFavorite} />
    <CartDialog open={cartOpen} onClose={() => setCartOpen(false)} products={store.products} cart={shop.cart} totals={shop.totals} onQuantity={shop.setQuantity} onCheckout={startCheckout} />
    <CheckoutDialog open={checkoutOpen} onClose={() => setCheckoutOpen(false)} products={store.products} cart={shop.cart} user={session.user} onRequireSignIn={requireSignIn} />
    <AuthDialog open={authOpen} onClose={() => { setAuthOpen(false); setResumeCheckout(false); }} onSignedIn={(user) => { session.setUser(user); setAuthOpen(false); setToast(`أهلًا ${user.name || ""}`.trim()); if (resumeCheckout) { setResumeCheckout(false); setCheckoutOpen(true); } }} />
    <InfoDialog policy={policy} onClose={() => setPolicy(null)} />
    <div className={`toast ${toast ? "visible" : ""}`} role="status"><Check size={18} />{toast}</div>
  </>;
}
