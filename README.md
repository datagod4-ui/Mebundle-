# Mebundle

A Ghana-focused mobile data marketplace built with Next.js, Supabase and Vercel.

## Rebuild principles

- Preserve the existing Supabase production project and all existing customer, order, payment, bundle and reseller data.
- Keep payment verification server-side. A browser redirect never marks an order as paid.
- Dispatch a supplier order only after verified payment and through an idempotent claim.
- Keep public tracking private to the matching tracking code and recipient phone number.
- Keep admin and reseller actions authenticated and authorized server-side.
- Never commit secrets or service-role credentials.

## Stack

- Next.js App Router + TypeScript
- React
- Supabase Auth, Postgres and Edge Functions
- Paystack checkout
- Vercel deployment

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the public Supabase URL and publishable/anon key.
3. Install dependencies with `npm install`.
4. Start with `npm run dev`.

Do not run database resets, seed commands, or destructive migrations against the production Supabase project.

## Current production backend

The existing Supabase project is maintained separately from this repository. Edge Functions and database migrations must be brought under version control after source review. Do not redeploy or replace payment/supplier functions until they have been tested against the existing schema and secrets.
