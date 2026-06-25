# FOUNDRY MANAGEMENT SYSTEM
## Project Scope Document

### 1. Project Overview

#### 1.1 System Description
The Foundry Management System is a web and mobile application that enables a foundry organisation to manage its pattern master data, product specifications, order lifecycle, customer interactions, and management reporting from a single integrated platform.

#### 1.2 Project Objectives
* Establish a centralised digital repository for all Pattern and Product master data.
* Enable accurate tracking of pattern sub-units, cavity configurations, and match plate details.
* Support customer-facing features including order placement, status tracking, and self-service data access.
* Provide management with consolidated dashboards and reports on pattern utilisation and production performance.
* Ensure the system is accessible across web browsers and mobile devices.

#### 1.3 Target Users
| No. | Use Case | Actor(s) | Description |
|---|---|---|---|
| 1 | Admin / Management | Internal organisation staff | Full access to all modules; system configuration and reporting. |
| 2 | Customer | External clients of the foundry | View own patterns and products; place and track orders; manage their account. |

---

### 2. Scope of Work

#### 2.1 In-Scope Modules
The following modules are included in the current version of the Foundry Management System:

| No. | Module | Key Capabilities |
|---|---|---|
| 1 | Pattern Master Management | Create, edit, view, and manage Pattern records including Pattern Code, Pattern Name, Pattern Customer Code, Pattern Owner (Customer or Internal), Pattern Category (Hand Moulding / Machine Moulding), Pattern Sub-Units (Top, Bottom, Core Box), and associated products with cavity counts. |
| 2 | Product Master Management | Define and manage Product records linked to patterns, including Product Code, Product Name, Customer, Weight, and cavity multiplier per pattern. |
| 3 | Match Plate & Weight Configuration | Capture Pattern Match Plate Type (Wooden, Cast Iron, None), Good Casting Weight (with Read-Only enforcement), Total Box Weight, and Yield Percentage per pattern-product combination. |
| 4 | Order Management | Allow customers to raise new casting orders referencing specific patterns and products; enable admin to review, process, and update order status. |
| 5 | Customer Portal | Provide authenticated customers with the ability to view their pattern and product records, track active order status, and raise new orders through a self-service interface. |
| 6 | Remarks & Audit Trail | Capture free-text remarks at the pattern and order level; maintain a system audit log for key data creation and modification events. |
| 7 | Reporting & Dashboard | Provide management with dashboards covering pattern utilisation, product-wise casting summaries, order volume trends, and yield analytics. |
| 8 | User & Access Management | Manage user accounts, roles (Admin, Customer), and access permissions; support secure login, password management, and session control. |
| 9 | Production Scheduling | Allow admins to assign received/in-progress orders to specific dates across Moulding, Melting, and Fettling process stages via a visual calendar. |

---

### 3. Functional Scope

#### 3.1 Pattern Master Management
Each pattern record in the system shall maintain the following attributes:

| Attribute | Notes |
|---|---|
| Pattern Code | Unique identifier; system-generated or manually entered. |
| Pattern Name | Descriptive name of the pattern. |
| Pattern Customer Code | Customer-assigned reference code for the pattern. |
| Pattern Owner | Indicates ownership: Customer or Internal. |
| Pattern Category | Moulding process: Hand Moulding or Machine Moulding. |
| Pattern Sub-Units | Enumerated components: 1 – Top, 2 – Bottom, 3 – Core Box 1 (extensible). |
| Pattern Match Plate Type | Material type: Wooden, Cast Iron, or None. |
| Good Casting Weight | Weight of acceptable casting; marked Read-Only after initial entry. |
| Total Box Weight | Aggregate weight of the complete casting box. |
| Yield Percentage | Calculated ratio of good casting weight to total box weight. |
| Remarks | Free-text field for operational notes. |
| Pattern Products | One or more products linked to the pattern with individual cavity counts. |

#### 3.2 Product Master Management
Each product record shall maintain the following attributes:

| Attribute | Notes |
|---|---|
| Product Code | Unique identifier for the product. |
| Product Name | Descriptive name of the product. |
| Customer | Customer to whom this product belongs. |
| Weight | Unit weight of the product casting. |
| Cavity Count | Number of cavities assigned to this product per pattern (e.g., Product A x 2, Product B x 4). |

#### 3.3 Order Management
Customers shall be able to raise casting orders by selecting an existing pattern and specifying the required product, quantity, and delivery expectations. The system shall support the following order lifecycle:
* Order creation by customer via the customer portal.
* Order receipt and review by admin.
* Status updates at defined stages: Received, In Progress, Completed, Dispatched.
* Notification of status change visible to the customer on their portal.

#### 3.4 Customer Portal
Authenticated customers shall have access to the following capabilities:
* View all patterns and products associated with their account (read-only master data).
* Track the current status of active and past orders.
* Raise new casting orders against their registered patterns.
* Access order history with filtering by date range and product.

#### 3.5 Reporting & Dashboard
The management dashboard shall provide the following views and reports:
* Pattern Utilisation Summary - active patterns, moulding category breakdown, and sub-unit inventory.
* Product-wise Casting Report - quantity produced per product across a selected date range.
* Order Volume Trend - number of orders received and completed over time.
* Yield Analytics - average yield percentage by pattern and by customer.

---

### 4. Key Functional Use Cases

| No. | Use Case | Actor(s) | Description |
|---|---|---|---|
| 1 | Create Pattern Record | Admin | Admin creates a new pattern with all master attributes, sub-units, and linked products with cavity counts. |
| 2 | Edit Pattern Record | Admin | Admin modifies pattern details. |
| 3 | View Pattern Details | Admin, Customer | User views full pattern information including match plate type, sub-units, weight data, and linked products. |
| 4 | Create Product Record | Admin | Admin registers a new product with its code, name, weight, and cavity assignment. |
| 5 | Link Product to Pattern | Admin | Admin assigns one or more products to a pattern with individual cavity count per product. |
| 6 | Place New Order | Customer | Customer selects a pattern and product, specifies required quantity, and submits a casting order. |
| 7 | Track Order Status | Customer | Customer views the real-time status of their submitted orders on the customer portal. |
| 8 | Update Order Status | Admin | Admin progresses an order through a lifecycle and logs remarks where applicable. |
| 9 | View Management Dashboard | Admin | Admin reviews consolidated production metrics, yield analytics, and pattern utilisation on the dashboard. |
| 10 | Export Reports | Admin | Admin exports any dashboard report as a PDF or Excel file. |
| 11 | Manage User Accounts | Admin | Admin creates, edits, activates, or deactivates user accounts and assigns roles. |
| 12 | Customer Login & Self-Service | Customer | Customer authenticates to the portal, views their data, and raises or tracks orders independently. |
| 13 | Schedule Production | Admin | Admin schedules orders across Moulding, Melting, and Fettling stages via a visual calendar interface. |

---

### 5. Out of Scope
The following items are explicitly excluded from the current phase of the Foundry Management System. They may be considered for inclusion in future releases.

| No. | Feature / Process | Reason for Exclusion |
|---|---|---|
| 1 | Heat Treatment Management | Deferred to a future phase of the system. |
| 2 | Quality Control / Inspection Module | QC workflows and non-conformance reporting are deferred. |
| 3 | ERP / Accounting Integration | Integration with external financial or ERP systems is not included. |
| 4 | Inventory & Raw Material Management | Sand, metal alloy, and consumable inventory are not covered. |
| 5 | Machine Maintenance Scheduling | Equipment maintenance tracking is out of scope. |
| 6 | HR & Payroll Management | Human resource functions are not part of this system. |

---

### 6. Assumptions & Constraints

#### 6.1 Assumptions
* Pattern and product data will be entered by the Admin; no automated data migration is assumed.
* Each customer will be registered in the system by the Admin prior to accessing the portal.
* The Good Casting Weight field will be set once and thereafter treated as read-only in the UI.
* Cavity count per product-pattern combination is fixed at the time of record creation and manually updated if changed.
* The system will be hosted on a cloud infrastructure accessible via standard web browsers and mobile devices.
* Internet connectivity is assumed for all users of the system.

#### 6.2 Constraints
* The system must be compatible with modern web browsers (Chrome, Firefox, Edge, Safari) and iOS/Android mobile platforms.
* The system must support a minimum of two concurrent user roles: Admin and Customer.

---

### 7. Project Deliverables
The following deliverables are expected upon completion of this phase:

| No. | Deliverable | Description |
|---|---|---|
| 1 | Web Application | Fully functional browser-based FMS accessible on desktop and laptop devices. |
| 2 | Mobile Application | Responsive mobile interface or native app for iOS and Android platforms. |
| 3 | Admin Dashboard | Management reporting interface with key metrics and export functionality. |
| 4 | Customer Portal | Self-service interface for customers to view data, place, and track orders. |
| 5 | User Documentation | Administrator and end-user guides for the system. |
| 6 | Deployment Package | Configured and deployable build of the system for production hosting. |
