"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Heart, Menu, Search, ShieldCheck, ShoppingBag, UserRound, X } from "lucide-react";
import type { StoreData } from "@/lib/types";
import { useShop } from "@/hooks/use-shop";
import { useSession } from "@/hooks/use-session";
import { CartDialog, InfoDialog } from "./shop-dialogs";
import { AuthDialog } from "./auth-dialog";
import { CheckoutDialog } from "./checkout-dialog";

export type StorePolicy = StoreData["policies"][number];

/** What page content can do through the shell. Handed to the `children` render function. */
export type StoreShellApi = {
  shop: ReturnType<typeof useShop>;
  session: ReturnType<typeof useSession>;
  /** Adds a cart line; on success shows a toast and opens the cart drawer. False at the per-product limit. */
  addToCart: (id: string, optionIds: string[]) => boolean;
  toggleFavorite: (id: string) => void;
  showToast: (message: string) => void;
  openAuth: () => void;
  openPolicy: (policy: StorePolicy) => void;
};

export type StoreShellNav = {
  onShopAll: () => void;
  onFavorites: () => void;
  storyHref: string;
  isShopAllActive: boolean;
};

export type StoreShellSearch = {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
};

type StoreShellProps = {
  store: StoreData;
  nav: StoreShellNav;
  search: StoreShellSearch;
  children: (api: StoreShellApi) => ReactNode;
};

/** Store chrome shared by the home page and product pages: header, menus, search, footer, cart, checkout, sign-in, toast. */
export function StoreShell({ store, nav, search, children }: StoreShellProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [policy, setPolicy] = useState<StorePolicy | null>(null);
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
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const closeMenuThen = (action: () => void) => () => { setMenuOpen(false); action(); };

  const api: StoreShellApi = {
    shop,
    session,
    addToCart: (id, optionIds) => {
      const added = shop.addItem(id, optionIds);
      if (added) {
        setToast("أضفنا اختيارك إلى السلة");
        setCartOpen(true);
      }
      return added;
    },
    toggleFavorite: (id) => {
      const saved = shop.wishlist.includes(id);
      shop.toggleWishlist(id);
      setToast(saved ? "تمت الإزالة من المفضلة" : "احتفظنا به في مفضلتك");
    },
    showToast: setToast,
    openAuth: () => setAuthOpen(true),
    openPolicy: setPolicy,
  };

  return <>
    <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
    <div className="announcement"><span>من المدينة… إلى باب بيتك</span><span><ShieldCheck size={15} /> دفع إلكتروني آمن عبر مدى وفيزا وماستركارد</span><span className="announcement-season">مجموعة {store.season}</span></div>
    <header className="header">
      <a className="brand" href="/" aria-label="متجر الأنصار - الرئيسية"><img src="/images/logo.svg" alt="الأنصار" width="152" height="62" /><span>المتجر</span></a>
      <nav className="desktop-nav" aria-label="التنقل الرئيسي">
        <button className={nav.isShopAllActive ? "active" : ""} onClick={nav.onShopAll}>تسوق الكل</button>
        <a href="/matches">تذاكر المباريات</a>
        <a href="/orders">طلباتي</a>
        <a href="/tickets">تذاكري</a>
        <a href={nav.storyHref}>حكايتنا</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button mobile-menu-toggle" title="القائمة" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X /> : <Menu />}</button>
        <button className="icon-button" title="البحث" aria-label="البحث" aria-expanded={searchOpen} onClick={() => setSearchOpen(v => !v)}>{searchOpen ? <X /> : <Search />}</button>
        <button className="icon-button" title={session.user ? "طلباتي" : "تسجيل الدخول"} aria-label={session.user ? `طلباتي، ${session.user.name}` : "تسجيل الدخول"} onClick={() => session.user ? window.location.assign("/orders") : setAuthOpen(true)}><UserRound /></button>
        <button className="icon-button favorite-header" title="المفضلة" aria-label={`المفضلة، ${shop.wishlist.length} منتجات`} onClick={nav.onFavorites}><Heart />{shop.wishlist.length > 0 && <span className="small-dot" />}</button>
        <span className="action-divider" />
        <button className="cart-trigger" title="سلة التسوق" aria-label={`سلة التسوق، ${count} منتجات`} onClick={() => setCartOpen(true)}><ShoppingBag size={21} /><span className="cart-word">السلة</span><span className="cart-count">{count}</span></button>
      </div>
    </header>
    {menuOpen && <nav className="mobile-nav" aria-label="قائمة الموبايل"><button onClick={closeMenuThen(nav.onShopAll)}>تسوق الكل <ArrowLeft size={17} /></button><a href="/matches">تذاكر المباريات <ArrowLeft size={17} /></a><a href="/orders">طلباتي <ArrowLeft size={17} /></a><a href="/tickets">تذاكري <ArrowLeft size={17} /></a>{session.user ? <button onClick={() => void session.logout()}>تسجيل الخروج</button> : <button onClick={closeMenuThen(() => setAuthOpen(true))}>تسجيل الدخول</button>}<button onClick={closeMenuThen(nav.onFavorites)}>المفضلة <Heart size={17} /></button></nav>}
    {searchOpen && <div className="search-bar"><Search size={20} /><input ref={searchRef} value={search.query} maxLength={100} onChange={e => search.onQueryChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") search.onSubmit(); if (e.key === "Escape") setSearchOpen(false); }} placeholder="ابحث عن طقمك القادم…" aria-label="ابحث في المنتجات" />{search.query && <button className="icon-button" aria-label="مسح البحث" title="مسح البحث" onClick={() => search.onQueryChange("")}><X size={18} /></button>}<button className="text-button" onClick={search.onSubmit}>عرض النتائج <ArrowLeft size={16} /></button></div>}

    {children(api)}

    <footer className="footer"><div className="footer-main section-shell"><div className="footer-brand"><img src="/images/crest.svg" width="56" height="66" alt="شعار الأنصار" /><h2>الأنصار يجمعنا.</h2><p>من قلب المدينة، إلى كل قلب أنصاري.</p></div><div className="footer-links"><h3>تسوق الأنصار</h3><button onClick={nav.onShopAll}>المجموعة كاملة</button><a href="/orders">طلباتي</a><button onClick={nav.onFavorites}>مفضلتي</button></div><div className="footer-links"><h3>نحن معك</h3>{store.policies.map(p => <button key={p.id} onClick={() => setPolicy(p)}>{p.title}</button>)}</div><div className="footer-message"><span>وعدنا واحد</span><p>كلنا أنصار.<br />دائمًا وأبدًا.</p><span dir="ltr">ROOTED IN MADINAH.</span></div></div><div className="footer-bottom section-shell"><span>© {new Date().getFullYear()} متجر الأنصار</span><span>الأسعار تشمل ضريبة القيمة المضافة</span><span dir="ltr">SAUDI ARABIA · SAR</span></div></footer>
    <CartDialog open={cartOpen} onClose={() => setCartOpen(false)} products={store.products} cart={shop.cart} totals={shop.totals} onQuantity={shop.setQuantity} onCheckout={startCheckout} />
    <CheckoutDialog open={checkoutOpen} onClose={() => setCheckoutOpen(false)} products={store.products} cart={shop.cart} user={session.user} onRequireSignIn={requireSignIn} />
    <AuthDialog open={authOpen} onClose={() => { setAuthOpen(false); setResumeCheckout(false); }} onSignedIn={(user) => { session.setUser(user); setAuthOpen(false); setToast(`أهلًا ${user.name || ""}`.trim()); if (resumeCheckout) { setResumeCheckout(false); setCheckoutOpen(true); } }} />
    <InfoDialog policy={policy} onClose={() => setPolicy(null)} />
    <div className={`toast ${toast ? "visible" : ""}`} role="status"><Check size={18} />{toast}</div>
  </>;
}
