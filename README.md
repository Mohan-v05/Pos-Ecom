# Techloom POS & E-Commerce

**Live application:** [https://pos-ecom-seven.vercel.app/](https://pos-ecom-seven.vercel.app/)

Techloom is a shared-inventory commerce prototype. It provides a customer-facing E-commerce storefront and a shop-admin POS workspace backed by one product catalog, so stock changes are reflected across both sales channels.

## Scope

### Customer storefront

- Browse products with category, price, search, and availability filters.
- Open product details and manage a multi-item cart.
- Complete a mock payment and create an online order.
- View personal order history and itemised order details.
- Request order cancellation; this becomes a refund request for shop review.

### Shop admin

- Create, edit, search, and delete catalog products.
- Add products to a POS cart and complete a mock in-store sale.
- View today's combined paid POS and online sales.
- Track online orders, inspect their line items, and review refund requests.
- Approve or decline customer refund requests.

### Shared inventory rules

- POS selections create a server-side draft order and reserve stock immediately.
- Reserved stock is unavailable to E-commerce while the hold is active.
- Removing items or clearing a POS cart releases the reservation.
- Successful POS payment converts reservations into a completed sale.
- E-commerce payment validates stock before deducting it; approved refunds restore it.
- Reservations expire after five minutes when expiry cleanup runs on the next relevant API request.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| HTTP client | Axios |
| Backend | Node.js, Express 5 |
| Database | Supabase / PostgreSQL |
| Deployment | Vercel (frontend) |

## Folder structure

```text
techloom-assessment/
├── README.md
├── schema.sql                    # PostgreSQL / Supabase schema
├── Seeddata.sql                  # Sample product and order data
└── taks1/
    ├── backend/
    │   ├── index.js              # Express application entry point
    │   ├── supabaseClient.js     # Supabase client configuration
    │   ├── routes/
    │   │   ├── products.js       # Product catalog CRUD API
    │   │   ├── task01.js         # POS drafts, reservations, and payments
    │   │   └── task02.js         # Online orders, payments, and refunds
    │   └── services/
    │       └── orderService.js   # Shared validation and reservation helpers
    └── frontend/
        ├── src/
        │   ├── App.jsx           # Routes and application shell
        │   ├── components/
        │   │   └── Navbar.jsx
        │   ├── pages/
        │   │   ├── EcomPage.jsx  # Customer storefront
        │   │   ├── PosPage.jsx   # Shop POS and online-order tracker
        │   │   └── ProductsPage.jsx # Admin product management
        │   └── services/
        │       └── api.js        # Frontend API client
        └── .env                  # VITE_API_URL configuration
```

## Local setup

1. Create a Supabase project and run `schema.sql`, followed by `Seeddata.sql`.
2. Create `taks1/backend/.env`:

   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_service_key
   PORT=5000
   ```

3. Create `taks1/frontend/.env`:

   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. Run the API and frontend in separate terminals:

   ```bash
   cd taks1/backend
   npm install
   npm run dev
   ```

   ```bash
   cd taks1/frontend
   npm install
   npm run dev
   ```

## API areas

- `GET /api/products` — catalog search and filters.
- `POST`, `PUT`, `DELETE /api/products` — admin product management.
- `/api/task01` — POS drafts, draft-item stock holds, reservations, and POS payments.
- `/api/task02` — E-commerce orders, mock payments, cancellation requests, and admin refund decisions.

## Future implementation

- UI refinements: mobile navigation, loading skeletons, richer empty/error states, confirmation dialogs, and keyboard-accessible modals.
- Product images: add an `image_url` field to `products`, store assets in Supabase Storage or a CDN, and render product photos in catalog cards, carts, and order details.
- Authentication and roles: replace the demo customer/admin identifiers with Supabase Auth and role-based API authorization.
- Background reservation expiry: run a scheduled Supabase Edge Function or cron job so expired stock holds are released exactly on time, even with no API traffic.
- Payments: replace mock payments with a provider such as Stripe, including webhook-based payment state updates.
- Reporting: add date ranges, channel comparisons, best-selling products, exportable reports, and inventory-low alerts.
- Order fulfilment: introduce shipping, fulfilment, partial refunds, cancellation reasons, and notification emails.
