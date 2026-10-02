import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OFFER_ENDPOINTS = [
  "https://multi-akciok.vercel.app/api/offers",
  "https://multi-akciok-fasi-sandor-s-projects.vercel.app/api/offers",
  "https://multi-akciok-git-main-fasi-sandor-s-projects.vercel.app/api/offers",
];

async function rpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${name}: ${response.status} ${text.slice(0, 500)}`);
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function loadOffers() {
  const errors: string[] = [];

  for (const url of OFFER_ENDPOINTS) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MULTI-AKCIOK-Supabase-Snapshot/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        errors.push(`${url}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (!Array.isArray(data?.offers)) {
        errors.push(`${url}: invalid payload`);
        continue;
      }

      return { url, data };
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST required", { status: 405 });

  let started = false;
  try {
    started = Boolean(await rpc("multi_akciok_try_begin_refresh", { p_min_minutes: 45 }));
    if (!started) return Response.json({ ok: true, skipped: true, reason: "recent_refresh" });

    const { url, data } = await loadOffers();
    const today = new Date().toISOString().slice(0, 10);

    const rows = data.offers
      .filter((offer: any) =>
        offer &&
        typeof offer.id === "string" &&
        typeof offer.store === "string" &&
        typeof offer.name === "string" &&
        typeof offer.category === "string" &&
        Number.isFinite(Number(offer.price)) &&
        Number(offer.price) > 0
      )
      .slice(0, 5000)
      .map((offer: any) => ({
        observed_date: today,
        offer_key: String(offer.id).slice(0, 220),
        store: String(offer.store).slice(0, 80),
        name: String(offer.name).slice(0, 320),
        category: String(offer.category).slice(0, 140),
        price: Math.round(Number(offer.price)),
        old_price: Number.isFinite(Number(offer.oldPrice)) ? Math.round(Number(offer.oldPrice)) : null,
        unit_label: String(offer.unitLabel || "1 db").slice(0, 120),
        unit_price: Number.isFinite(Number(offer.unitPrice)) ? Number(offer.unitPrice) : null,
        valid_to: /^\d{4}-\d{2}-\d{2}$/.test(String(offer.validTo || "")) ? offer.validTo : null,
        condition_text: offer.conditionText ? String(offer.conditionText).slice(0, 220) : null,
        source_url: offer.sourceUrl ? String(offer.sourceUrl).slice(0, 1200) : null,
      }));

    const stored = Number(await rpc("multi_akciok_upsert_snapshots", { p_rows: rows })) || 0;

    await rpc("multi_akciok_finish_refresh", {
      p_status: "success",
      p_count: stored,
      p_error: null,
    });

    return Response.json({
      ok: true,
      skipped: false,
      source: url,
      offers_received: data.offers.length,
      stored,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (started) {
      try {
        await rpc("multi_akciok_finish_refresh", {
          p_status: "error",
          p_count: 0,
          p_error: message,
        });
      } catch {}
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
