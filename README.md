# Ansar Storefront

Arabic RTL storefront for Al Ansar built with Next.js App Router, React, TypeScript and Lucide. It has no database of its own: catalog, members, orders and payments come from `apps/web-api` (see below).

## Run

From this directory:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3017. For a different port: `npx next dev --hostname 127.0.0.1 --port 3018`.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Requires Node.js 20.9+ and npm. The application is independent of the root npm workspaces and other Ansar apps.

## Connect to web-api

The catalog, sign-in, orders and payments come from `apps/web-api`. Copy `.env.example` to `.env.local` and set the values, then start web-api first:

```sh
cd ../web-api && npm run dev        # http://localhost:3000
cd ../storefront && npm run dev     # http://127.0.0.1:3017
```

The browser only calls this app's `/api/*` routes; they call web-api server-to-server, so web-api needs no CORS change. The member token is kept in the `httpOnly` cookie `ansar_session`. In non-production web-api every OTP is `1111`.

## Edit Content

`data/store.json` holds only the site chrome: `name`, `season`, `hero` (eyebrow, title, description, image under `public/images`), the cart's `shipping` estimate (`fee`, `freeAbove`) and the `policies` texts. It is read on each request to `/api/store`.

Products, prices, options, member-only visibility, discounts and the real shipping fee all come from web-api — edit them in the web-api admin dashboard, not here. The catalog is cached for 60 seconds.

## API

The browser only talks to these routes; they call web-api server-to-server.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/store` | Site content + current catalog |
| `GET /api/products` | `{ products, total, page, pages }` — `q`, `category=all`, `sort=featured\|price-asc\|price-desc`, `page`, `limit` (1-48) |
| `GET /api/products/[id]` | One product |
| `POST /api/auth/request-otp`, `verify-otp`, `register`; `GET /api/auth/me`; `POST /api/auth/logout` | OTP sign-in; sets/clears the `ansar_session` cookie |
| `GET /api/shipping-zones` | Delivery zones (when shipping is enabled in web-api) |
| `POST /api/checkout/preview` | Totals: discounts, coupon, shipping |
| `POST /api/checkout` | Creates the order (and the payment intent when payment is due) |
| `POST /api/payments/intent`, `POST /api/payments/[id]/sync`, `GET /api/payments/[id]` | Moyasar payment for an order |
| `GET /api/orders`, `GET /api/orders/[id]` | The member's orders |

Invalid input returns 400, unknown ids 404, a signed-out caller 401, and web-api being unreachable 503. Error bodies are `{ error }` codes only; web-api internals are never forwarded.

## Shopping

- Catalog, search and ordering come from web-api (regular products only).
- Product dialogs show images, details and option groups; required groups must be chosen before adding to the bag.
- Cart and favorites are saved in this browser and re-checked against the live catalog on load and again at checkout.
- Checkout needs a signed-in member. web-api prices every order itself; the browser never sends a price.
- Payment uses the Moyasar form on `/checkout/pay`; `/checkout/result` confirms the outcome with web-api. Orders are listed on `/orders`.

## Payment methods

| Method | Env var / control |
| --- | --- |
| Card (mada / Visa / Mastercard / **Amex**) | always on (Moyasar form networks) |
| STC Pay | `NEXT_PUBLIC_STCPAY_ENABLED` (default on; set `0` to disable) |
| Apple Pay | `NEXT_PUBLIC_APPLE_PAY_ENABLED` (default off; `1` to enable) |
| Tamara instalments | web-api `TAMARA_WEB_RETURN_URL_BASE` (must equal this storefront's origin) + the `tamara_enabled` app-config flag |

`NEXT_PUBLIC_APPLE_PAY_LABEL` configures the merchant name shown on the Apple Pay sheet (default `نادي الأنصار`).

### Apple Pay

1. Serve the storefront over HTTPS on its final hostname.
2. Moyasar Dashboard → Settings → Apple Pay Domains → add that exact hostname → **Download Association**.
3. Save the downloaded file as `public/.well-known/apple-developer-merchantid-domain-association` (no extension) and deploy it.
4. Dashboard → **Validate** → **Register**.
5. Set `NEXT_PUBLIC_APPLE_PAY_ENABLED=1` and rebuild (NEXT_PUBLIC_ vars are baked at build time).

The button only appears in Safari / on Apple devices with a card in Wallet; it never works on `http://127.0.0.1`. Do NOT invent the association file's content and do NOT create a placeholder file (an invalid file breaks validation).

### Tamara

The pay page asks `/api/payments/instalments/eligibility` → shows "قسّمها مع تمارا" when eligible → POST `/api/payments/instalments/checkout` → redirect to Tamara's hosted checkout (https `*.tamara.co` only) → Tamara returns the shopper to `/checkout/tamara/{success|failure|cancel}/<paymentId>/<orderId>` → success redirects to `/checkout/result`, which settles the payment through web-api's sync (it asks web-api, never trusts the URL).

Locally the Tamara webhook cannot reach a dev machine; the result page's sync call is what settles the payment.

## Assets

Club logos and Almarai fonts are copied from existing repository assets. Campaign photographs come from the reference club storefront https://alansarksa.com/ (Salla CDN). Use these only for the club's authorized storefront; verify publication rights before reuse elsewhere.

Browser rendering verification depends on the local computer-use policy. Recorded verification is in the root `.ai/task/execution.md`.
# ansar-store
