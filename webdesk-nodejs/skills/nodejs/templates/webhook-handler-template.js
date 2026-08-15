/**
 * Store-side webhook handler template (BigCommerce / Shopify style).
 *
 * Copy to `src/controllers/<store>-webhook-controller.js` and wire its route
 * with the RAW body parser (see the route note at the bottom).
 *
 * This is a CONTROLLER: it does HTTP-only work — verify the signature, dedupe,
 * validate the payload shape, and hand off to a service. It contains NO business
 * logic and NO DB access. The real work (upserting the order, decrementing
 * inventory, pushing to the ERP) lives in a service, which calls repositories.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS HANDLER GUARANTEES:
 *
 *  • HMAC verification with a CONSTANT-TIME compare (node:crypto.timingSafeEqual)
 *    over the RAW request body — a JSON-parsed body will not reproduce the bytes
 *    the store signed, so the route MUST use express.raw, not express.json.
 *    Bad/missing signature → early 401, before any work (NODE-005).
 *
 *  • IDEMPOTENCY (NODE-102). At-least-once delivery is the norm: stores resend.
 *    We dedupe on a stable event id. A duplicate → early 200 (ack so the store
 *    stops retrying) without re-processing. The dedupe store is a repository,
 *    checked + recorded via the service — never from the controller directly.
 *
 *  • CENTRALIZED ERRORS. We throw typed errors and forward with next(err); we
 *    never console.log errors (NODE-007) and never swallow them (NODE-006).
 *    The centralized handler maps them to status codes.
 *
 *  • EARLY RETURNS, no deep nesting.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";
import { config } from "../config/index.js";
import { ValidationError } from "../lib/errors.js";
import * as storeWebhookService from "../services/store-webhook-service.js";

/**
 * Minimal shape validation of the webhook envelope. Reject anything that does
 * not at least carry an id, an event/topic, and a data object (NODE-005).
 * Tighten per-topic inside the service where the canonical mapping happens.
 */
const webhookEnvelopeSchema = z.object({
  // Stable, store-assigned event id — the idempotency key for dedupe (NODE-102).
  id: z.union([z.string(), z.number()]).transform(String),
  // e.g. 'store/order/created', 'orders/create'.
  topic: z.string().min(1),
  data: z.record(z.unknown()),
});

/**
 * Constant-time comparison of two signatures. Returns false (never throws) on
 * any length/format mismatch so timing does not leak which check failed.
 * @param {string} expectedHex
 * @param {string} providedHex
 * @returns {boolean}
 */
function signaturesMatch(expectedHex, providedHex) {
  if (typeof providedHex !== "string" || providedHex.length === 0) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  // timingSafeEqual throws if lengths differ — guard first to keep it constant-time-ish.
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * Compute the expected HMAC-SHA256 of the raw body using the shared webhook secret.
 * The secret comes from env, never inline (NODE-004).
 * @param {Buffer} rawBody
 * @returns {string} hex digest
 */
function computeSignature(rawBody) {
  const secret = config.storeWebhookSecret; // add to config schema: STORE_WEBHOOK_SECRET
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * POST /webhooks/store — handle one inbound store webhook.
 *
 * Requires `express.raw({ type: 'application/json' })` on this route so that
 * `req.body` is a Buffer (the exact signed bytes).
 *
 * @type {import('express').RequestHandler}
 */
export async function handleStoreWebhook(req, res, next) {
  try {
    // req.body is a Buffer here (express.raw). If it isn't, the route is misconfigured.
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      // Misconfiguration is a 400, not a 500 — but it's our bug; surface it clearly.
      throw new ValidationError("Webhook route must use express.raw; raw body missing");
    }

    // 1) Verify HMAC signature FIRST. Bad/absent signature → 401, do nothing else.
    const providedSignature = req.get("x-webhook-signature") ?? "";
    const expectedSignature = computeSignature(rawBody);
    if (!signaturesMatch(expectedSignature, providedSignature)) {
      // Do NOT reveal why; just reject. Early return (no nesting).
      return res
        .status(401)
        .json({ error: { code: "INVALID_SIGNATURE", message: "unauthorized" } });
    }

    // 2) Parse + validate the payload shape now that authenticity is established.
    const parsed = webhookEnvelopeSchema.safeParse(JSON.parse(rawBody.toString("utf8")));
    if (!parsed.success) {
      throw new ValidationError("Malformed webhook payload");
    }
    const envelope = parsed.data;

    // Tenant resolution: which client this webhook belongs to. Derive from a
    // route param, a configured store→tenant map, or a header — NOT from the
    // untrusted body alone. Shown here as a placeholder the service validates.
    const tenantId = req.params.tenantId;

    // 3) IDEMPOTENCY (NODE-102). Ask the service whether we've already processed
    //    this event id. The service checks the dedupe REPOSITORY (the
    //    idempotency store) — the controller never queries the DB itself (NODE-003).
    //    Duplicate → 200 immediately so the store stops retrying, no re-processing.
    const alreadyProcessed = await storeWebhookService.isDuplicate(tenantId, envelope.id);
    if (alreadyProcessed) {
      return res.status(200).json({ status: "duplicate", id: envelope.id });
    }

    // 4) Hand off the real work to the service (idempotent: it records the event
    //    id in the dedupe repository inside the same transaction as the effect,
    //    so a crash between effect and ack still de-dupes on the next delivery).
    await storeWebhookService.process(tenantId, {
      eventId: envelope.id,
      topic: envelope.topic,
      data: envelope.data,
    });

    // 5) Ack. Stores treat any 2xx as "delivered"; anything else triggers retry.
    return res.status(200).json({ status: "accepted", id: envelope.id });
  } catch (err) {
    // Centralized error path — never console.log, never swallow (NODE-006/007).
    // The centralized handler maps typed errors to status codes. If we throw a
    // 5xx here the store will retry, which is correct for transient failures.
    return next(err);
  }
}

/*
 * ─── Route wiring (in src/routes/index.js) ──────────────────────────────────
 *
 *   import express, { Router } from 'express';
 *   import { handleStoreWebhook } from '../controllers/store-webhook-controller.js';
 *
 *   const webhookRouter = Router();
 *
 *   // RAW body, scoped to this route ONLY. The global express.json() in app.js
 *   // must NOT run for this path, or the HMAC bytes won't match.
 *   webhookRouter.post(
 *     '/:tenantId/store',
 *     express.raw({ type: 'application/json', limit: '1mb' }),
 *     handleStoreWebhook,
 *   );
 *
 *   router.use('/webhooks', webhookRouter);
 *
 * Mount the webhook router BEFORE the global express.json() middleware, or mount
 * express.json() with a `type` that excludes the webhook content type.
 */
