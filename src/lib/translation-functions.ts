import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";

const inputSchema = z.object({
  text: z.string().min(1).max(5000),
  target_lang: z.string().min(2).max(10),
  source_lang: z.string().min(2).max(10).optional(),
});

function hashText(text: string, targetLang: string): string {
  return createHash("sha256").update(`${targetLang}\n${text}`).digest("hex");
}

export const translateText = createServerFn({ method: "POST" })
  .validator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sourceHash = hashText(data.text, data.target_lang);

    // Check cache via Data API
    const cacheRes = await fetch(
      `${url}/rest/v1/translations_cache?source_hash=eq.${sourceHash}&target_lang=eq.${encodeURIComponent(data.target_lang)}&select=translated_text&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (cacheRes.ok) {
      const rows = (await cacheRes.json()) as Array<{ translated_text: string }>;
      if (rows[0]?.translated_text) {
        return { translated_text: rows[0].translated_text, cached: true };
      }
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a translation engine. Translate the user's text into the requested target language. Output ONLY the translated text with no preface, notes, or quotes. Preserve line breaks and formatting.",
          },
          {
            role: "user",
            content: `Target language: ${data.target_lang}\n\nText:\n${data.text}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Translation failed (${resp.status}): ${detail.slice(0, 200)}`);
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const translated = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!translated) throw new Error("Empty translation response");

    // Best-effort cache write via service role
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("translations_cache").upsert(
        {
          source_hash: sourceHash,
          target_lang: data.target_lang,
          source_lang: data.source_lang ?? null,
          translated_text: translated,
        },
        { onConflict: "source_hash, target_lang" },
      );
    } catch {
      /* cache write failure is non-fatal */
    }

    return { translated_text: translated, cached: false };
  });