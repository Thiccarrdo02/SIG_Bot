# SIG — Frontend (descriptions)

## Top-level notes

Source files: PDF “SIG CHATBOT FRONTEND DESCRIPTION” and exported site HTML. All UI visuals have been described in words and the fields/actions enumerated so a backend can recreate endpoints, event names, and expected data structures.  

---

## Page: Command Center (aka Dashboard)

**Purpose:** Real-time triage and capital-allocation metrics.

**Top bar actions**

* Export button (top-right): exports lead data to CSV with columns `Name,Location,Niche,Budget,Path,Status,Phone`. Trigger: `exportData()` which generates `sig_leads_export.csv`. 
* Add Lead button (top-right): opens **Add New Lead** modal (fields listed below). 

**Active_leads cards (non-clickable)**

* Cards show counts (example values): `Active Book Leads: 215`, `Active Sourcing Leads: 42`, `Active FBA Leads: 18`, `Active Trading Leads: 128`. Each card displays an icon and a small label (e.g., “VIP”, “+18%” etc). 

**Action Required panel**

* Shows up to three rows, each row contains:

  * Title (e.g., "Call Requested", "Ready to Pay", "Compliance Alert")
  * Short detail (example: "Zoya Ahmed • Path B • Needs Consultation")
  * Action button per case:

    * Schedule (opens external WA link)
    * Send Link (opens WA prefilled payment message)
    * Warn/Block (compliance action)
* Cases defined:

  1. User wants to speak to mentor — action: Schedule a call.
  2. User willing to enroll/purchase — action: Send payment link.
  3. Non-compliance alert (requests for replicas etc.) — action: Warn/Block. 

**Sourcing Mix**

* Horizontal bars representing percentages by category:

  * Electronics — example 48%
  * Modest Fashion — example 32%
  * Home Décor — example 20% 

**Query Distribution**

* Pie/donut chart (representative slices):

  * Trading — 30%
  * Sourcing — 25%
  * FBA Brand — 20%
  * Hudood — 15% 

**Lead Intelligence table**

* Filters: `All`, `VIP`, `High Intent`, `Low Budget` (buttons).
* Table columns:

  * Profile & Location (name + location + small avatar)
  * Designated Path (Path A/B/C/D badge)
  * Score (center)
  * Budget (right)
  * Action (right)
* Row click opens lead detail modal. Example filter function: `filterTable('VIP')` toggles button states. 

---

## Add New Lead modal (used from multiple pages)

**Modal title:** Add New Lead

**Fields**

* Name (text)
* Location (text)
* Contact number (phone with +91 placeholder)
* Budget (number; shown in INR)
* Path (dropdown: Sourcing | FBA | Trading | Hudood / e.g., "Sourcing")
* Interest / Niche (text)

**Primary action**

* Save to Database (green button) — expected to POST a lead object.

**Notes:** The same modal UI appears on multiple pages (Command Center, FBA, Sourcing, Trading). 

---

## Lead Modal / Lead Detail (opened from lists)

**Top section**

* Lead name header and close button.

**Left main column**

* Timeline/progress track with step states (e.g., Inquiry → Fee → Factory → Report → Done). Visual timeline converted to discrete `status` field.
* Small cards: `Capital`, `Bot Score`, `Contact` (these map to lead data fields).

  * Example sample placeholders: `Capital: ₹1,250,000`, `Contact: +971 50 123 4567`, `Bot Score: --`.
* AI Context block: a text area showing an AI-generated transcript/notes (italic, small).

**Right column (membership actions / utilities)**

* Membership action buttons (conditionally visible):

  * Mark Pending Fee
  * Confirm Enrollment
* Open WhatsApp button (green) to start conversation with lead via WA link.

**Repeated UI cards**

* Capital, Bot Score, Contact displayed as boxes (read-only). 

---

## Page: Demographics

**Purpose:** interactive breakdown of audience.

**Main cards (clickable)**

1. Age Distribution

   * Filters: `All`, `18-24`, `25-40`, `41-55`, `Others`
   * Visual representation replaced by bar values:

     * 18–24: 35%
     * 25–40: 45%
     * 41–55: 15%
     * Others: 5% 

2. Gender (donut)

   * Filters: `Male`, `Female`
   * Example value: Male 70% (visual donut shows 70% male). 

3. Occupation

   * Categories & example percentages:

     * Salaried: 50%
     * Business: 30%
     * Student: 15%
     * Inv/Ret (Investor/Retired): 5% 

**Global Footprint Intelligence**

* Shows top countries/cities per category. Non-clickable summary boxes:

  * Overall Leaders (countries): India 45%, UAE 30%, UK 15%
  * Trading Hubs (cities): Mumbai 40%, Bangalore 35%, Pune 15%
  * FBA Capital (cities): London 50%, Dubai 30%, Surat 10%
  * Sourcing HQ: Dubai 45%, Delhi 35%, Riyadh 15%
  * Hudood Users: Hyderabad 40%, Kerala 35%, Blackburn 15% 

**Demographics details view**

* When a demographic card is clicked, it opens a details view with:

  * Back button
  * Filter buttons (dynamically generated for that dimension)
  * Table columns: `User Profile`, `Gender`, `Age`, `Occupation`, `Budget`
  * Rows clickable to open lead modal. (Rendering code available in HTML.) 

---

## Page: Path A — Sourcing (Sourcing Vault)

**Header tools**

* Cost Calculator button (top-right) — opens a **Landed Cost Estimator** popup.

  * **Landed Cost Estimator fields:** Product Cost (INR), Shipping (INR), Customs % (default 10), GST % (default 18). Calculate button returns landed cost. 
* Add Inquiry / New Inquiry button (top-right) — opens **Log New Sourcing Inquiry** modal.

**Top stat cards**

* New Inquiries (example 12)
* Pending Fee (example 5) — shows the fee amount ₹1,999
* Factory Search (example 8)
* Reports Ready (example 3)

**Active Requests table**

* Columns: Client & Product, Type (Broadcast/Custom), Stage, Target Price (monetary), Actions (Request Fee / Generate Report).
* Each row click opens lead modal. Buttons include:

  * Request Fee (opens WA payment link for that lead)
  * Generate Report (opens `openReportModal(client, product)`)

**Log New Sourcing Inquiry modal**

* Fields/actions:

  * Client Name
  * Product Category
  * Request Type: Broadcast Deal | Custom Search
  * Compliance checkbox: Confirmed NOT a Replica/Fake
  * Add Inquiry button to save. 

---

## Page: Path B — FBA Brand

**Header tools**

* FBA Profit Analyzer / FBA Calc (popup):

  * Fields: Selling Price ($), Landed Cost ($), FBA Fees ($ example 5.00), PPC ($/unit example 3.00)
  * Calculate Net Margin button. 
* Enroll Student (button) — opens Add New Lead modal with Path preselected.

**Top stat cards**

* FBA Mentorship Enquiries (example 42)
* Qualified VIPs (> ₹8L) (example 12)
* Enrolled Students (example 8)
* Pending Payment (example 3)

**FBA Leads table**

* Filters: All, VIP (8L+), Students, Low Cap
* Columns: Profile & Intent, Qualification, Capital, Action
* Rows generate badges:

  * Enrolled Student
  * Prime Investor (>8L)
  * Low Capital
* Clicking row opens lead profile modal which also exposes membership actions (Mark Pending Fee, Confirm Enrollment). 

---

## Page: Path C — Trading (Halal Trading)

**Header tools**

* Add Student (top-right) — opens Add New Lead modal.

**Top stat cards**

* Mentorship Enquiries (example 82)
* Trader's Guide Enquiries (example 215)
* Enrolled Students (example 45)
* Pending Payment (example 12)

**Trading Leads table**

* Filters: All, Mentorship (VIP), Guidebook, General, Students
* Columns: Lead Profile, Interest Type, Experience, Action
* Rows show interest badges (Mentorship, Guidebook), experience (like Beginner), and `View Profile` button which opens lead modal. Membership actions apply here as well. 

---

## Page: Path D — Hudood

**Purpose:** Shariah compliance logs and auto-redirects.

**Header**

* Auto-Redirect indicator (Auto-Redirect Active)

**Top stat cards**

* Total queries (example 156)
* Redirected (example 142)
* Pending action (example 14)

**Recent Queries list**

* Non-clickable table showing:

  * Name, snippet of query (e.g., "Is Zomato stock halal?"), Topic, Status (Redirected / Pending)
* Status badges: `Redirected` (green) or `Pending` (orange).
* Backend should redirect relevant queries to official Hudood channel when status is Redirected. 

---

## Shared Components & Behavior (explicit)

**Navigation & view switching**

* Sidebar buttons call `switchView('dashboard'|'demographics'|'sourcing'|'fba'|'trading'|'hudood')`. This toggles `.view-section.active`. Ensure backend knows route names. 

**Lead list rendering & data model**

* Example `leads` array fields used in HTML/JS:

  * `name`, `location`, `niche`, `budget`, `path` (e.g., 'Path B'), `status` (e.g., 'Enrolled' / 'Pending Fee'), `phone`, `interest` etc.
* CSV export header: `Name,Location,Niche,Budget,Path,Status,Phone`. Export function generates CSV from `leads` list. 

**Modal & popup identifiers**

* `#inquiryModal`, `#reportModal`, `openModal(lead)`, `openReportModal(client, product)`, `openCalculator()`, `openFbaCalc()` — backend should expose these actions as API/commands or map them to frontend events. 

**Filter & button states**

* Buttons follow consistent CSS classes: `.filter-btn`, `.fba-filter-btn`, `.trading-filter-btn`, `.demo-filter-btn`. Clicking updates display and toggles active styles, and calls corresponding render functions (e.g., `renderLeads('VIP')`, `renderTradingLeads('All')`). 

**AI Context**

* Each lead modal includes an `AI Context` block (`modalTranscript`) to store a short transcript / model output. Backend should support storing/returning this field for each lead. 

---

## Data contracts (recommended JSON schema)

Use these as baseline payloads for backend endpoints:

**Lead (example)**

```json
{
  "id": "uuid",
  "name": "Ibrahim Sheikh",
  "location": "Surat, IN",
  "phone": "+919876543210",
  "budget": 85000,
  "path": "Path A",         // or "Path B", "Path C", "Path D"
  "niche": "USB Cables",
  "status": "Pending Fee",  // or "Enrolled", "Factory Search", "Report Ready", "Done"
  "interest": "Broadcast Deal",
  "bot_score": 72,
  "ai_context": "Transcript string...",
  "created_at": "ISO8601"
}
```

**Sourcing Inquiry**

```json
{
  "client_name": "Ibrahim Sheikh",
  "product_category": "Electronics",
  "request_type": "Broadcast Deal", // or "Custom Search"
  "compliance_confirmed": true,
  "target_price_per_unit": 85
}
```

**Cost estimator request**

```json
{
  "product_cost": 1000,
  "shipping": 200,
  "customs_percent": 10,
  "gst_percent": 18
}
```

**FBA profit calc request**

```json
{
  "selling_price": 25.0,
  "landed_cost": 10.0,
  "fba_fees": 5.0,
  "ppc_per_unit": 3.0
}
```

---

## Suggested API endpoints (minimal)

* `GET /leads` — query params: `path`, `filter` (VIP, HighIntent, LowBudget), `page`, `limit`
* `POST /leads` — create lead (Add New Lead modal)
* `GET /leads/{id}` — lead detail
* `PATCH /leads/{id}` — update status (e.g., mark pending fee, confirm enrollment)
* `POST /inquiries/sourcing` — log sourcing inquiry
* `POST /reports/generate` — generate report for client/product
* `POST /calc/landed-cost` — landed cost calc
* `POST /calc/fba-profit` — FBA calc
* `GET /demographics` — returns age/gender/occupation breakdowns and lists
* `GET /footprint` — returns geo breakdowns (Overall Leaders, Trading Hubs, FBA Capital, Sourcing HQ, Hudood Users)
* `GET /hudood/queries` — returns Hudood queries and status
* `GET /export/leads.csv` — trigger CSV download or return CSV content. 

---