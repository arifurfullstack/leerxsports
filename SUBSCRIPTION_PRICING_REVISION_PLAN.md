# LEER Sports: Subscription Pricing & Flow Revision Plan

**Author:** Senior Full-Stack Architect & QA Lead  
**Status:** Pending User Approval (Analysis & Planning Complete)  
**Date:** 2026-08-18

---

## Executive Summary

This engineering plan outlines the surgical changes required to:
1. **Simplify Subscription Flow:** Transition from a multi-duration tier selector (1, 3, 12 months) to a clean, friction-free **Single Monthly Auto-Recurring Subscription**.
2. **Enable Flexible Trainer Subscription Pricing:** Remove legacy `$19.99` hardcoded fallbacks and expand the trainer pricing range to **`$4.99` minimum** and **`$499.99` maximum**, enforced across both frontend UI and backend Zod/database validators.

---

## Task 1 — Simplify Subscription Flow

### 1. Current Implementation
- **Frontend Dialog ([`unlock-checkout-dialog.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/components/unlock-checkout-dialog.tsx)):**
  - Uses `useState(1)` for `durationMonths`.
  - Renders `[1, 3, 12]` duration selector buttons.
  - Multiplies `subscriptionPrice * durationMonths` to calculate checkout total.
- **Backend API ([`checkout-functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/checkout-functions.ts)):**
  - Accepts `durationMonths: z.number().int().min(1).max(12).default(1)`.
  - Calculates `amount = Math.round(monthlyPrice * data.durationMonths * 100) / 100`.
  - Inserts `duration_months` into `payment_orders`.
- **Database Settlement (`20260728150000_payment_orders_wallet_checkout.sql`):**
  - `complete_payment_order()` calculates period end as `v_period_end := v_period_start + make_interval(months => v_order.duration_months)`.
- **Stripe Checkout ([`payment-checkout.server.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/payment-checkout.server.ts)):**
  - Currently initialized with `mode: "payment"`.

### 2. Files & Components Involved
1. [`src/components/unlock-checkout-dialog.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/components/unlock-checkout-dialog.tsx)
2. [`src/lib/checkout-functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/checkout-functions.ts)
3. [`src/lib/payment-checkout.server.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/payment-checkout.server.ts)
4. [`src/lib/webhook-processors.server.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/webhook-processors.server.ts)
5. [`src/components/checkout-dialog.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/components/checkout-dialog.tsx)
6. [`src/routes/pricing.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/routes/pricing.tsx)

### 3. Backend / API Changes Required
- In `checkout-functions.ts`:
  - Enforce `durationMonths` strictly to `1` (or maintain backward compatibility with default `1`).
  - Calculate `amount = Math.round(monthlyPrice * 100) / 100`.
  - Pass `1` as `duration_months` to `payment_orders`.

### 4. Database Changes Required
- **No DDL schema migration required.**
- `payment_orders.duration_months` already has `DEFAULT 1 CHECK (duration_months BETWEEN 1 AND 12)`.
- `complete_payment_order()` works natively with `duration_months = 1`.

### 5. Stripe Changes Required
- In `payment-checkout.server.ts`:
  - When `order.kind === "subscription"`:
    - Set `mode: "subscription"`.
    - Provide `line_items[0][price_data][recurring][interval] = "month"` with `interval_count = 1`.
    - Attach `subscription_data[metadata][payment_order_id] = order.id`.
- In `webhook-processors.server.ts`:
  - Support `checkout.session.completed` and subscription events for recurring renewal settlement.

### 6. Frontend / UI Changes Required
- In `unlock-checkout-dialog.tsx`:
  - Remove `durationMonths` state and the `[1, 3, 12]` month selector buttons.
  - Simplify dialog to display:
    - Creator Avatar, Name, Verified Badge.
    - Clear monthly price: `$XX.XX / month`.
    - Auto-recurring subtitle: `"Auto-renews monthly · Cancel anytime in settings"`.
    - Single consolidated "Subscribe with Card" action button.
- In `checkout-dialog.tsx` and `pricing.tsx`:
  - Remove multi-tier assumptions and update text to reflect monthly recurring subscriptions.

### 7. Validation / Security Changes Required
- Backend validation ensures no client can inject `durationMonths !== 1` or alter the calculated monthly fee.

### 8. Migration Concerns & Impact on Existing Subscriptions
- **Zero Impact on Existing Subscriptions:** Subscriptions in the `subscriptions` table store absolute `current_period_end` timestamps. Any user who previously purchased a 3-month or 12-month tier will continue to enjoy uninterrupted access until their stored `current_period_end` date.

### 9. Possible Breaking Changes
- None for end users. The API interface remains compatible while enforcing `durationMonths = 1`.

---

## Task 2 — Flexible Trainer Subscription Pricing

### 1. Current Implementation
- **Trainer Settings ([`trainer.profile.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/routes/_authenticated/trainer.profile.tsx)):**
  - Input min is `1`, max is `299.99`.
  - Helper copy states `"Recommended range: $4.99 – $49.99 / month."`
- **Trainer Onboarding ([`onboarding.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/routes/_authenticated/onboarding.tsx)):**
  - Default value is `19.99`.
  - Preset buttons: `["9.99", "19.99", "29.99", "49.99", "99.99"]`.
- **Zod Schemas ([`schemas.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/schemas.ts) & [`trainer-profile-edit.functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/trainer-profile-edit.functions.ts)):**
  - `trainerApplicationSchema`: `requested_price: z.coerce.number().min(0).max(999).optional().default(19.99)`.
  - `updateSchema`: `subscription_price: z.number().min(0).max(999)`.
- **Platform Defaults ([`payments-functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/payments-functions.ts)):**
  - Defaults: `min_subscription_price: 5`, `max_subscription_price: 200`.
- **Checkout Enforcement ([`checkout-functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/checkout-functions.ts)):**
  - Validates `monthlyPrice < minimum || monthlyPrice > maximum` against platform settings.

### 2. Files & Components Involved
1. [`src/routes/_authenticated/trainer.profile.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/routes/_authenticated/trainer.profile.tsx)
2. [`src/routes/_authenticated/onboarding.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/routes/_authenticated/onboarding.tsx)
3. [`src/lib/trainer-profile-edit.functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/trainer-profile-edit.functions.ts)
4. [`src/lib/schemas.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/schemas.ts)
5. [`src/lib/payments-functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/payments-functions.ts)
6. [`src/lib/checkout-functions.ts`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/lib/checkout-functions.ts)
7. [`src/routes/_authenticated/admin/payments.tsx`](file:///Users/arifur/Desktop/projectnine/leerxsports/src/routes/_authenticated/admin/payments.tsx)

### 3. Backend / API Changes Required
- In `trainer-profile-edit.functions.ts`:
  - Set `subscription_price: z.number().min(4.99, "Price must be at least $4.99/mo").max(499.99, "Price cannot exceed $499.99/mo")`.
- In `schemas.ts`:
  - Set `requested_price: z.coerce.number().min(4.99).max(499.99).default(19.99)`.
- In `payments-functions.ts`:
  - Update platform fallback defaults: `min_subscription_price ?? 4.99` and `max_subscription_price ?? 499.99`.
- In `checkout-functions.ts`:
  - Ensure subscription orders validate that the trainer's `subscription_price` is within `[min_subscription_price, max_subscription_price]`.

### 4. Database Changes Required
- **No DDL schema changes required.**
- `trainer_profiles.subscription_price` is `NUMERIC(10,2)` which natively supports any value between `$4.99` and `$499.99`.

### 5. Stripe Changes Required
- Stripe dynamic price generation calculates `Math.round(monthlyPrice * 100)` for any unit amount in `[499, 49999]` cents.

### 6. Frontend / UI Changes Required
- In `trainer.profile.tsx`:
  - Input attributes: `min={4.99}`, `max={499.99}`, `step="0.01"`.
  - Helper copy: `"Set your monthly subscriber fee between $4.99 and $499.99 / month."`
- In `onboarding.tsx`:
  - Input attributes: `min={4.99}`, `max={499.99}`.
  - Preset buttons: `["4.99", "9.99", "19.99", "49.99", "99.99"]`.

### 7. Validation / Security Changes Required
- Server-side Zod validation prevents bypassing the `$4.99`–`$499.99` range via direct API calls.

---

## Step-by-Step Implementation Order

1. **Step 1: Backend Schemas & Pricing Limits**
   - Update `schemas.ts`, `trainer-profile-edit.functions.ts`, `payments-functions.ts`, and `checkout-functions.ts`.
2. **Step 2: Trainer Profile & Onboarding Settings UI**
   - Update `trainer.profile.tsx` and `onboarding.tsx` with `$4.99`–`$499.99` validation, helper copy, and presets.
3. **Step 3: Simplify Checkout UI Dialog**
   - Refactor `unlock-checkout-dialog.tsx` to remove 1/3/12 month duration buttons and present a clean single monthly auto-recurring checkout.
4. **Step 4: Stripe Recurring Checkout Integration**
   - Configure `payment-checkout.server.ts` to create Stripe Checkout Sessions with `mode: "subscription"` and `recurring: { interval: "month", interval_count: 1 }`.
5. **Step 5: Testing & QA Verification**
   - Add unit tests verifying price range validation and subscription checkout calculation.
   - Run typecheck and full test suite.

---

## Testing Checklist

- [ ] Trainer can set monthly price to `$4.99` and save successfully.
- [ ] Trainer can set monthly price to `$499.99` and save successfully.
- [ ] Trainer setting `$4.98` is blocked by frontend and API.
- [ ] Trainer setting `$500.00` is blocked by frontend and API.
- [ ] Onboarding application validates requested price in range `[$4.99, $499.99]`.
- [ ] Subscriber clicking "Unlock / Subscribe" sees clean single monthly price without 1/3/12 month buttons.
- [ ] Stripe checkout session is created with correct monthly recurring unit amount.
- [ ] Completing checkout activates subscription for 1 month period.
- [ ] Existing active subscriptions continue uninterrupted.
- [ ] All unit tests pass with `0` typecheck errors.

---

## Quick Summary

- **Files likely to change:** 8 files (`schemas.ts`, `trainer-profile-edit.functions.ts`, `payments-functions.ts`, `checkout-functions.ts`, `payment-checkout.server.ts`, `unlock-checkout-dialog.tsx`, `trainer.profile.tsx`, `onboarding.tsx`)
- **Database changes needed:** **No** (schema already supports `NUMERIC(10,2)` and `DEFAULT 1` duration)
- **Stripe changes needed:** **Yes** (set `mode: "subscription"` and `recurring: { interval: "month" }` for subscription line items)
- **Main risks:** Low. Existing multi-month subscribers retain access until their stored `current_period_end` expires.
- **Recommended implementation order:** Backend validation -> Trainer UI -> Checkout Dialog Simplification -> Stripe Recurring Session -> Unit Testing
- **Estimated complexity:** **Low – Medium**
