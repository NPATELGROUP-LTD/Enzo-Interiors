# apps/portal — Client Portal

React and TypeScript application giving Enzo Interiors clients self-service access to their projects, quotes, documents and invoices.

## Purpose

Provides clients with real-time project visibility and direct communication with the Enzo team, reducing manual status updates and administration.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- PWA with installable manifest, service worker, offline shell and push notifications

## Core Modules

- Dashboard with appointments, unread messages, documents, invoices and project timeline.
- My Projects with progress and current status.
- Project Detail with timeline, mood boards, documents and design approval.
- My Quotes with accept, decline and request revision actions.
- Real-time Messages with the Enzo team.
- Documents with filtering and secure downloads.
- Invoices for viewing status only; there are no in-app payments.
- Settings for profile, notifications, security and theme preferences.

## Authentication and RBAC

Uses `/auth/portal/login` with JWT authentication. Clients can access only records belonging to their own `client_id`. Access control is enforced by `apps/api`.

## Design Approval Flow

Selecting Request Changes on a project sends feedback to the staff team and moves the project back into the appropriate Admin workflow stage.

## API Dependency

All data access goes through `apps/api`. This app must not access PostgreSQL or object storage directly.
