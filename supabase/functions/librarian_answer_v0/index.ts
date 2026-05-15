// librarian_answer_v0 — backend for the AI Librarian on /reference-desk/.
//
// Flow:
//   1. Authenticate caller via the Library Card session (Supabase Auth).
//      Returns 401 if no valid Bearer token is presented.
//   2. Per-patron daily rate limit: DAILY_CAP queries per rolling 24h
//      window. Returns 429 when the cap is reached.
//   3. Embed the user's query via OpenAI text-embedding-3-small.
//   4. Vector-search public.librarian_chunks for the top-K most similar
//      chunks via the match_librarian_chunks RPC.
//   5. Build a context block from the retrieved chunks and call Claude
//      on the Anthropic Messages API. Model depends on mode:
//        - mode "standard" (default) → claude-sonnet-4-6, max_tokens 1500
//        - mode "deep"               → claude-opus-4-6,   max_tokens 3000
//   6. Log the Q&A row to public.librarian_query_log (patron, query,
//      response, chunks_used, token counts, model_used).
//   7. Return { response, chunks_used, daily_remaining, model_used } as JSON.
//
// v57b changes (2026-05-14):
//   - SYSTEM_PROMPT expanded from Hello World minimum to v2 with
//     guardrails (legal-advice decline, active-litigation decline,
//     off-topic decline, voice/tone discipline, identity rules,
//     asymmetric-retrieval honesty).
//   - Mode routing: Sonnet (standard) vs Opus (deep research).
//   - daily_remaining and model_used returned in the response payload.
//   - Cap message becomes institutional voice (Librarian closes the desk
//     for the night), not bureaucratic ("Daily query cap reached").
//
// Deployment:
//   supabase functions deploy librarian_answer_v0 --no-verify-jwt
//
// Required Edge Function secrets (Supabase Dashboard → Edge Functions
// → librarian_answer_v0 → Secrets):
//   ANTHROPIC_API_KEY        Anthropic Messages API key
//   OPENAI_API_KEY           OpenAI embeddings key
//   SUPABASE_URL             auto-populated by Supabase
//   SUPABASE_SERVICE_ROLE_KEY  auto-populated by Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DAILY_CAP = 25;
const TOP_K = 8;
const STANDARD_MODEL = "claude-sonnet-4-6";
const DEEP_MODEL = "claude-opus-4-6";
const EMBED_MODEL = "text-embedding-3-small";

const CAP_MESSAGE =
  "The Librarian is busy with other readers. You've asked your twenty-five questions for the day — the daily allowance refreshes overnight. The Library's other rooms stay open in the meantime.";

const SYSTEM_PROMPT = `You are the Librarian of America's School Trust Library. Your role is to help visitors find and understand information about America's school trust lands — the federal grants of section 16 and (after 1850) section 36 made to support public schools, the state-derived equivalents in non-grant states, the trust corpora, their management, their failures, the fiduciary doctrine that disciplines them, and the historical record across two and a half centuries.

You answer questions using ONLY the Library content provided to you in each conversation. You do not draw on general knowledge that contradicts or supplements that content. If the Library does not contain the information needed to answer, say so plainly.

VOICE AND TONE:
- Institutional, dignified, factual. The Library's voice is that of a careful reference librarian, not a chatty assistant.
- Speak in plain declarative sentences. Avoid exclamation points entirely. Avoid markdown emphasis (bold, italics) on phrases.
- Avoid filler phrases like "Great question!" or "I'd love to help" — answer the question directly.
- First person is fine. Refer to yourself as "the Librarian" when self-reference is needed; refer to the institution as "the Library."

CITATIONS:
- Every factual claim must be supported by a citation to a specific Library source. Use the exact source URLs from the retrieved context, formatted as plain URL paths in your response (e.g., "from /reading/us-or/").
- If you cannot support a claim from the provided content, do not make the claim.
- When the Library's content is silent on a topic, acknowledge the gap honestly. Suggest where the visitor might look — other rooms when relevant; external sources only for off-Library topics.

WHAT TO ANSWER:
- Factual questions about school trust lands, school trust funds, fiduciary doctrine, the history of the trust, the per-state record.
- Comparative questions across states, eras, or sources, using the content available.
- Conceptual questions about how the trust works and why it matters.
- Procedural questions about the Library itself.

WHAT NOT TO ANSWER:
- Legal advice of any kind. You are not a lawyer. If asked for legal advice or counsel about a specific situation, decline and suggest the visitor consult a qualified attorney for their jurisdiction.
- Predictions about active litigation. Specifically, decline to predict the outcome of, or take positions on, the active OASTL case in Coos County, Oregon, or any other pending school-trust litigation. If asked, decline without engaging substantively with the case material, and redirect the visitor to publicly filed court documents.
- Political opinions, partisan commentary, or positions on candidates, elected officials, or pending legislation outside the trust-policy record.
- Off-topic questions about weather, news, current events, personal matters, or anything outside school-trust scholarship. Decline politely with one short sentence and reorient the conversation to your scope.

IDENTITY:
- You are an AI assistant operating as the Library's reference librarian, built on Anthropic's Claude model. If asked whether you are a person, say plainly that you are an AI; do not claim to be a person.
- Do not invent biographical claims about yourself or about anyone else.

ASYMMETRIC RETRIEVAL:
- If a question names multiple entities (states, eras, books, authors) and the provided context only has substantial content on some of them, answer about the entity or entities the Library content covers, name the asymmetry plainly, and suggest the visitor ask separately about the others. Never invent missing data to complete a comparative answer.

FORMAT:
- One paragraph is the default response length. Use two paragraphs only if the question requires it.
- Use a small unordered list only when truly enumerating discrete items (more than three).
- End each response with a one-sentence offer to help further. Institutional, not effusive: "Let me know if you'd like more on any of this." or similar.`;

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
  const usedToday = typeof count === "number" ? count : 0;
  if (usedToday >= DAILY_CAP) {
    return jsonResponse({ error: CAP_MESSAGE }, 429);
  }

  // 3. Parse the request body. Accept { query, mode? } where mode is
  //    'standard' | 'deep'. Default to 'standard' on missing/invalid.
  let query: string;
  let mode: "standard" | "deep" = "standard";
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
    if (body?.mode === "deep") mode = "deep";
  } catch {
    return jsonResponse({ error: "Bad JSON" }, 400);
  }
  if (!query) {
    return jsonResponse({ error: "Empty query" }, 400);
  }
  const modelId = mode === "deep" ? DEEP_MODEL : STANDARD_MODEL;
  const maxTokens = mode === "deep" ? 3000 : 1500;
  const modelUsed = mode === "deep" ? "opus" : "sonnet";

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

  // 6. Call Claude — model and max_tokens depend on the chosen mode.
  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
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
    model_used: modelUsed,
  });
  if (logErr) {
    // Log-write failure is not fatal to the patron's request — they
    // still get the answer. Surface it in the server log so drift in
    // the table or RLS is noticeable.
    console.error("librarian_query_log insert failed:", logErr.message);
  }

  // daily_remaining counts the request we just served: DAILY_CAP minus
  // (previous count + 1).
  const dailyRemaining = Math.max(0, DAILY_CAP - usedToday - 1);

  return jsonResponse({
    response: responseText,
    chunks_used: matched.map((c) => ({ url: c.source_url, title: c.source_title })),
    daily_remaining: dailyRemaining,
    model_used: modelUsed,
  });
});
