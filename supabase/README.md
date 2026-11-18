# Supabase production backend

This repository mirrors the existing production Supabase project `xvyougrmtjjkhqzubrtr`.

- Edge Function sources under `functions/` were retrieved from the currently deployed functions.
- `types/database.ts` is generated from the live production schema.
- `config.toml` records the deployed JWT-verification settings.
- Production migrations are recorded in the Supabase project; do not reset or reseed production.

Before deploying function changes, compare the source with the live function version, check all required secrets in Supabase, test in a separate environment, and confirm idempotent payment/supplier behavior. Never commit secret values.

Known integration issue to resolve before production: the deployed `paystack-webhook` currently submits to Hubnet, while `mebundle-payment` implements the DataMart purchase flow. Align these before using live payments. Do not dispatch supplier orders twice.
