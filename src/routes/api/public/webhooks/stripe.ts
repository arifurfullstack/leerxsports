import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sigHeader = request.headers.get("stripe-signature");

        const {
          loadGateway,
          verifyStripeSignature,
          isDuplicateEvent,
          processStripeEvent,
          recordWebhookEvent,
        } = await import("@/lib/webhook-processors.server");

        const gateway = await loadGateway("stripe");
        if (!gateway || !gateway.enabled) {
          return new Response("stripe gateway disabled", { status: 503 });
        }
        const secret = gateway.config?.webhook_secret ?? "";
        const verify = verifyStripeSignature(rawBody, sigHeader, secret);
        if (!verify.ok) {
          return new Response(`invalid signature: ${verify.reason}`, {
            status: 401,
          });
        }

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const eventId = String(event?.id ?? "");
        if (!eventId) return new Response("missing event id", { status: 400 });

        if (await isDuplicateEvent("stripe", eventId)) {
          return new Response("duplicate", { status: 200 });
        }

        const result = await processStripeEvent(event);
        await recordWebhookEvent({
          provider: "stripe",
          event_id: eventId,
          event_type: String(event?.type ?? "unknown"),
          verified: true,
          payload: event,
          result,
        });
        return new Response(JSON.stringify({ ok: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});