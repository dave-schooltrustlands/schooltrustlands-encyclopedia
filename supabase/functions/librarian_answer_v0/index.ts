// librarian_answer_v0 — Site Update v57 Hello World backend for the
// AI Librarian on /reference-desk/.
//
// Flow:
//   1. Authenticate caller via the Library Card session (Supabase Auth).
//      Returns 401 if no valid Bearer token is presented.
//   2. Per-patron daily rate limit: 10 queries per rolling 24h window.
//      Returns 429 when the cap is reached.
//   3. Embed the user's query via OpenAI text-embedding-3-small.
//   4. Vector-search public.librarian_chunks for the top-K most similar
//      chunks via the match_librarian_chunks RPC.
//   5. Build a context block from the retrieved chunks and call Claude
//      Sonnet 4.6 (claude-sonnet-4-6) on the Anthropic Messages API.
//   6. Log the Q&A row to public.librarian_query_log (patron, query,
//      response, chunks_used, token counts).
//   7. Return { response, chunks_used: [{ url, title }, …] } as JSON.
//
// Hello World scope (v57): minimal system prompt (no guardrails),
// non-streaming response, no clickable-citation rendering. Production
// hardening waits for v57b–v57e.
//
// Deployment:
//   supabase functions deploy librarian_answer_v0 --no-verify-jwt
//
//   --no-verify-jwt is correct: this function reads the Authorization
//   header itself and calls supabase.auth.getUser, so Supabase's
//   automatic JWT verification would only get in the way.
//
// Required Edge Function secrets (Supabase Dashboard → Edge Functions
// → librarian_answer_v0 → Secrets):
//   ANTHROPIC_API_KEY        Anthropic Messages API key (Dave-provided)
//   OPENAI_API_KEY           OpenAI embeddings key (Dave-provided)
//   SUPABASE_URL             auto-populated by Supabase
//   SUPABASE_SERVICE_ROLE_KEY  auto-populated by Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DAILY_CAP = 10;
const TOP_K = 8;
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const EMBED_MODEL = "text-embedding-3-small";

const SYSTEM_PROMPT = `You are the Librarian of America's School Trust Library. Answer the user's question about America's school trust lands using the provided Library content below. Be brief. When you make a factual claim, mention which source URL it came from. If the provided content doesn't cover the question, say so plainly. Do not invent facts.

This is the Library's Hello World version of you. You have minimal instructions and no guardrails. Do your best.`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Authenticate via the Library Card session token.
  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const patronId = userData.user.id;

  // 2. Daily rate-limit check (rolling 24h window).
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: countErr } = await supabase
    .from("librarian_query_log")
    .select("id", { count: "exact", head: true })
    .eq("patron_id", patronId)
    .gte("created_at", dayAgo);
  if (countErr) {
    return jsonResponse({ error: `rate-limit lookup failed: ${countErr.message}` }, 500);
  }
  if (typeof count === "number" && count >= DAILY_CAP) {
    return jsonResponse(
      { error: "Daily query cap reached (10 / day). Try again tomorrow." },
      429,
    );
  }

  // 3. Parse the request body.
  let query: string;
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch {
    return jsonResponse({ error: "Bad JSON" }, 400);
  }
  if (!query) {
    return jsonResponse({ error: "Empty query" }, 400);
  }

  // 4. Embed the query.
  const embedResp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: query }),
  });
  if (!embedResp.ok) {
    const text = await embedResp.text();
    return jsonResponse({ error: `embedding failed: ${embedResp.status} ${text}` }, 502);
  }
  const embedData = await embedResp.json();
  const queryEmbedding = embedData.data?.[0]?.embedding;
  if (!Array.isArray(queryEmbedding)) {
    return jsonResponse({ error: "embedding response malformed" }, 502);
  }

  // 5. Vector-search the chunks table.
  const { data: chunks, error: matchErr } = await supabase.rpc("match_librarian_chunks", {
    query_embedding: queryEmbedding,
    match_count: TOP_K,
  });
  if (matchErr) {
    return jsonResponse({ error: `vector search failed: ${matchErr.message}` }, 500);
  }
  const matched = (chunks ?? []) as Array<{
    id: number;
    chunk_text: string;
    source_url: string;
    source_title: string;
    source_room: string;
    similarity: number;
  }>;

  const contextText = matched
    .map((c, i) => `[Source ${i + 1}: ${c.source_url} — ${c.source_title}]\n${c.chunk_text}`)
    .join("\n\n");

  // 6. Call Claude Sonnet 4.6.
  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Question: ${query}\n\nLibrary content:\n\n${contextText}`,
      }],
    }),
  });
  if (!anthropicResp.ok) {
    const text = await anthropicResp.text();
    return jsonResponse({ error: `Anthropic call failed: ${anthropicResp.status} ${text}` }, 502);
  }
  const claudeData = await anthropicResp.json();
  const responseText: string = claudeData?.content?.[0]?.text ?? "";
  const usage = claudeData?.usage ?? {};

  // 7. Log the Q&A and respond.
  const { error: logErr } = await supabase.from("librarian_query_log").insert({
    patron_id: patronId,
    query_text: query,
    response_text: responseText,
    chunks_used: matched.map((c) => c.id),
    tokens_input: usage.input_tokens ?? null,
    tokens_output: usage.output_tokens ?? null,
  });
  if (logErr) {
    // Log-write failure is not fatal to the patron's request — they
    // still get the answer. Surface it in the response so v57b can
    // notice if the table or RLS drifts.
    console.error("librarian_query_log insert failed:", logErr.message);
  }

  return jsonResponse({
    response: responseText,
    chunks_used: matched.map((c) => ({ url: c.source_url, title: c.source_title })),
  });
});
