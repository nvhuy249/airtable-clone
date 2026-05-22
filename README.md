# Airtable Clone

An Airtable-inspired web application for creating, viewing, and managing structured table data through a spreadsheet-like interface. The project focuses on practical database-backed workflows, dynamic fields and records, editable grid interactions, saved views, and the trade-offs involved in building a usable product MVP under time constraints.

## What This Project Demonstrates

This project is intended to show practical full-stack engineering ability for a junior software engineering role:

- Building a real CRUD product with authentication, persistent data, and user-owned resources
- Modelling dynamic user-defined tables in a relational database
- Designing tRPC APIs with validation, authorization checks, and server-side query logic
- Managing complex React state across editable cells, optimistic UI, saved views, filters, sorts, and search
- Using virtualization and server-side pagination so large tables remain usable
- Optimizing a slow 100k-row creation path by moving from client loops/ORM-style batching to set-based PostgreSQL inserts
- Debugging production-style performance issues across database indexes, API queries, React rendering, and browser memory
- Making pragmatic trade-offs between feature completeness, correctness, performance, and delivery time

## Live Demo

The app is deployed on Vercel:

https://airtable-clone-omega-two.vercel.app/

## Why I Built This

I built this project to practise rapid full-stack product delivery: turning an open-ended product idea into working CRUD flows, modelling user-created table structures, and connecting a spreadsheet-style frontend to persistent backend data.

The core goal was to build enough of an Airtable-style experience to demonstrate product engineering judgement: prioritising the main user flow, making dynamic data structures manageable, and keeping the interface responsive as records and fields change.

## Tech Stack

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Data fetching/API:** tRPC, TanStack React Query, Zod
- **Table UI:** TanStack Table, TanStack Virtual
- **Backend:** Next.js server routes and server components
- **Database:** PostgreSQL, Prisma ORM
- **Auth:** NextAuth.js with Prisma adapter and Google provider
- **UI libraries:** Lucide React, React Icons, Heroicons, Framer Motion
- **Tooling:** ESLint, Prettier, TypeScript

## Features

- Authenticated dashboard for viewing a user's bases
- Create, rename, duplicate, delete, and open bases
- Create, rename, delete, and switch between tables inside a base
- Spreadsheet-like table UI with editable cells
- Dynamic fields/columns backed by database metadata
- Three typed field values: text, number, and boolean
- Add, rename, and delete fields
- Add and delete records
- Persistent cell values with field-type-specific storage
- Grid views with saved configuration
- Create, rename, duplicate, delete, reorder, and switch views
- Hide/show fields per view
- Filter records by field conditions
- Sort records by one or more fields
- Global search within the current view
- Infinite record loading and virtualized row rendering for larger tables
- `Add 100k rows` action for stress-testing large data changes, scrolling, and responsiveness
- Optimistic UI updates for common table interactions

## Product / Engineering Focus

The hardest part of the project was modelling flexible table data without hardcoding columns. Bases contain tables, tables contain field definitions, records represent rows, and cells store values for each record/field pair. This keeps table structure editable at runtime while still allowing records to persist in PostgreSQL.

The frontend also has to stay flexible as fields are added, hidden, filtered, sorted, or deleted. The grid is built from metadata rather than a fixed schema, so table state, query state, optimistic edits, and persisted view configuration all need to stay in sync.

Another focus area was large-table behaviour. The app includes a dedicated `Add 100k rows` control so I could test how the UI, database writes, pagination, filtering, sorting, search, and virtualized scrolling behave under heavier data volume. This became the main performance exercise in the project: the first implementation was safe but slow because it created records in small client-driven batches. The final version moves the heavy work into PostgreSQL and keeps the frontend focused on rendering only the visible records.

## Key Technical Decisions

- Used a normalized Prisma data model for bases, tables, fields, records, cells, and views so user-created structures can change dynamically.
- Stored typed cell values across `valueText`, `valueNumber`, and `valueBoolean` columns to support text, number, and boolean fields while keeping one cell table.
- Kept table metadata, record fetching, and view configuration behind tRPC routers instead of coupling database calls directly to UI components.
- Used TanStack Table and TanStack Virtual to support spreadsheet-like rendering and larger record sets.
- Added server-side filtering, sorting, global search, and pagination so the UI does not need to load every record at once.
- Seeded large test datasets with set-based PostgreSQL inserts from the backend, avoiding thousands of client/server round trips for the `Add 100k rows` stress test.
- Added indexed record positions so the grid can jump directly to high row numbers without relying on slow large-offset scans.
- Kept virtual scrolling bounded to one active record window so large jumps do not force the browser to hold or render the full 100k-row dataset.
- Used optimistic updates and a small queued cell-update flow so rapid edits can update the UI immediately while writes are sent to the backend.
- Prioritised core table CRUD, view state, and persistence before deeper Airtable features such as collaboration, permissions, imports, and automations.

## Large Data Handling

The `Add 100k rows` button is intentionally included as a performance and resilience test. It exercises the system across several layers:

- Backend record and cell creation using set-based PostgreSQL inserts
- PostgreSQL persistence for a normalized row/cell model
- Paginated record reads through tRPC and React Query
- Infinite loading for normal scrolling
- Position-based window loading for direct jumps into large tables
- Virtualized row rendering so the table does not mount every row at once
- Server-side filtering, sorting, and search against larger datasets
- UI responsiveness while new records are being inserted and fetched

For the large-row path, the app avoids treating 100,000 inserts as a frontend loop. The backend creates records and related cells in bulk SQL, and records have a `position` value indexed with `tableId` so jumps such as row 50,000 or row 80,000 can be resolved by the database quickly. The frontend then renders only the visible slice with TanStack Virtual instead of loading the entire table into React state.

The important lesson from this part of the project was that normal CRUD patterns are not always enough. Prisma is still used for most application logic, but the bulk-create path uses raw SQL because the database can create large sets of rows much faster than the app can send thousands of repeated insert requests. For scrolling, the app combines server-side pagination, indexed row positions, and virtual rendering so the scrollbar can represent a large table without requiring every row to be fetched first.

## Architecture Notes

- **Dynamic schema model:** user-created fields are stored as metadata, while records and cells store the actual row values.
- **Typed cell storage:** text, number, and boolean values are stored in separate nullable columns so values can be validated and queried by field type.
- **API boundary:** tRPC routers keep database access, authorization, filtering, sorting, search, pagination, and bulk actions on the server.
- **Frontend grid:** TanStack Table handles column/cell structure, while TanStack Virtual keeps row rendering bounded.
- **Large-table strategy:** normal scrolling uses incremental loading; direct jumps use indexed `position` lookups; React only receives the active record window.
- **Optimistic UX:** common interactions update immediately in the UI, then persist through queued server writes where needed.

## Screenshots

![Dashboard / base list](./docs/dashboard.jpeg)
![Table view](./docs/table-view.jpeg)

## Running Locally

Prerequisites:

- Node.js and npm
- PostgreSQL, or Docker/Podman for the included local database script
- Google OAuth credentials for NextAuth

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

The app currently expects these environment variables:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/airtable-clone"
AUTH_SECRET="your-nextauth-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_URL_INTERNAL="http://localhost:3000"
```

Start a local PostgreSQL database if needed:

```bash
./start-database.sh
```

On Windows, run the database script from WSL as described in the script comments.

Apply the Prisma schema locally:

```bash
npm run db:generate
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

Useful commands:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run db:studio
```

## Current Status

This is a deployed MVP / portfolio version. The main base, table, field, record, view, filtering, sorting, search, and persistence flows are implemented and have been tested through repeated manual use and external feedback from peers, mentors, and reviewers.

The project is not intended to be a complete Airtable replacement. It is a focused engineering project that prioritizes a believable data model, a usable spreadsheet-like workflow, and clear performance work around large record sets.

## Limitations

- Field types are currently limited to text, number, and boolean.
- Collaboration and real-time multi-user editing are not implemented.
- Role-based sharing and workspace permissions are not implemented.
- Some toolbar actions are present visually but not fully wired to product behavior.
- Import/export workflows are not implemented.
- Mobile responsiveness and visual polish still need work.
- Automated test coverage is limited.
- Deployment configuration could be documented in more detail.
- The large-row seed feature is a development/performance test tool, not a polished end-user import workflow.

## Future Improvements

- Add more field types such as date, select, attachment, and linked records
- Add CSV import/export
- Improve validation and empty/error states
- Add undo/redo for table edits
- Add record detail views and row history
- Add workspace sharing and role-based access
- Add automated tests for routers, data modelling, and key UI flows
- Improve production environment and deployment documentation

## What I Learned

- Designing flexible data models for dynamic user-created structures
- Building spreadsheet-like UI interactions on top of persistent backend data
- Keeping frontend state, optimistic updates, and server state aligned
- Handling filtering, sorting, search, and pagination for dynamic fields
- Testing large data paths with virtualized rendering, bulk SQL inserts, and indexed window loading
- Prioritising core product flows under time constraints
- Documenting implementation decisions and trade-offs clearly
