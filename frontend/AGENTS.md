<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Voting Platform Admin Dashboard

## Overview

Build a modern admin dashboard for a digital entertainment competition platform.

The frontend is built with:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query
- Axios

The backend is a FastAPI application and is the only service that communicates with the database and external APIs.

The frontend must never communicate directly with Supabase or third-party services.

---

## Authentication

Pages:
- Login
- Sign Up

Features:
- Email and password
- Google Sign-In
- Forgot Password
- Remember Me
- JWT authentication handled by the backend

---

## Dashboard

Display summary statistics.

Cards include:
- Active Event
- Total Participants
- Total Votes
- Total Revenue
- Recent Payments
- Recent Activity

The dashboard should be responsive.

---

## Events

Manage competitions.

Each event has:
- Name
- Description
- Banner
- Start Date
- End Date
- Status

Status:
- Upcoming
- Ongoing
- Expired

Allow:
- Create
- Edit
- Delete
- View

---

## Participants

Display contestants.

Fields:
- Name
- Category
- Social Media Platform
- Video URL
- Status
- Votes

Support:
- Search
- Filter
- Pagination

---

## Payments

Display payment history.

Fields:
- Reference
- Contestant
- Amount
- Payment Method
- Status
- Date

Status:
- Pending
- Successful
- Failed

---

## Social Media Router

Display synchronization status.

The frontend only displays data.

Synchronization is handled entirely by the backend.

Supported platforms:
- TikTok
- Facebook
- Instagram
- YouTube

Possible statuses:
- Connected
- Syncing
- Failed
- Disconnected

---

## Navigation

Sidebar

- Dashboard
- Events
- Participants
- Payments
- Social Router
- Settings

Top Navigation

- Notifications
- Search
- User Profile

---

## Design

Requirements:
- Modern
- Minimal
- Responsive
- Accessible

Use:
- Cards
- Tables
- Dialogs
- Drawers
- Badges
- Skeleton loaders
- Toast notifications

Avoid flashy animations.

---

## Code Style

- Use TypeScript.
- Use functional components.
- Keep components small.
- Reuse UI components.
- Keep business logic outside UI components.
- Use React Query for API requests.
- Use Axios for HTTP.
- Organize code into reusable components.
<!-- END:nextjs-agent-rules -->
