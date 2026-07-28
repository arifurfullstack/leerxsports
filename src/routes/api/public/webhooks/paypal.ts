import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/paypal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        const {
          loadGateway,
          verifyPaypalSignature,
          isDuplicateEvent,
          processPaypalEvent,
          recordWebhookEvent,
        } = await import("@/lib/webhook-processors.server");

        const gateway = await loadGateway("paypal");
        if (!gateway || !gateway.enabled) {
          return new Response("paypal gateway disabled", { status: 503 });
        }
        const cfg = gateway.config ?? {};
        const verify = await verifyPaypalSignature({
          rawBody,
          headers: request.headers,
          clientId: cfg.client_id ?? "",
          clientSecret: cfg.client_secret ?? "",
          webhookId: cfg.webhook_id ?? "",
          mode: gateway.mode,
        });
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

        if (await isDuplicateEvent("paypal", eventId)) {
          return new Response("duplicate", { status: 200 });
        }

        const result = await processPaypalEvent(event);
        await recordWebhookEvent({
          provider: "paypal",
          event_id: eventId,
          event_type: String(event?.event_type ?? "unknown"),
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