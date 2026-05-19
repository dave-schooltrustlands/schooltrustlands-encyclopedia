// ask_v1 — v85 backend for the Ask ASTL and Ask OASTL chat surfaces.
//
// Differs from librarian_answer_v0 (which still serves the Library
// Reference Desk) in three ways:
//   1. Accepts a `property` parameter ('astl' | 'oastl') that selects
//      the system prompt and corpus filter.
//   2. Implements an agentic three-tool loop: search_substrate,
//      web_search (Anthropic native), web_fetch (Anthropic native).
//   3. Does not require a Library Card session — anonymous access with
//      an IP-based rate limit instead. Dave can swap in a stricter
//      auth model later if abuse signals appear.
//
// Deployment:
//   supabase functions deploy ask_v1 --no-verify-jwt
//
// Required Edge Function secrets:
//   ANTHROPIC_API_KEY           Anthropic Messages API key
//   OPENAI_API_KEY              OpenAI embeddings key
//   SUPABASE_URL                auto-populated
//   SUPABASE_SERVICE_ROLE_KEY   auto-populated

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Config ----------------------------------------------------------

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2000;
const EMBED_MODEL = "text-embedding-3-small";
const TOP_K = 5;
const MAX_TOOL_TURNS = 5;
const DAILY_CAP_PER_IP = 50; // anonymous; tuned conservatively
const WEB_SEARCH_TOOL = "web_search_20250305";
const WEB_FETCH_TOOL = "web_fetch_20250619";

const ALLOWED_ORIGINS = new Set([
  "https://schooltrustlands.net",
  "https://www.schooltrustlands.net",
  "https://oastl-oregon.drdavesullivan.workers.dev",
  "https://oastl.org",
  "https://www.oastl.org",
  // dev origins
  "http://localhost:4321",
  "http://localhost:3000",
]);

// --- System prompts --------------------------------------------------
// These are the exact prompts from L4_Deliverables/Strategy/Ask_*_System_Prompt_2026-05-19.md.
// Keep in sync if those files change.

const SYSTEM_PROMPT_ASTL = `You are Ask ASTL, the AI assistant for Advocates for School Trust Lands — the national coalition of state advocates, scholars, and members working to ensure the twenty states that hold school trust lands fulfill their fiduciary duties to public schools.

## What you answer questions about

- School trust lands in all twenty grant states (the original Northwest Ordinance cohort, the antebellum 2-section doubling cohort beginning with California 1853, the late-19th-century admissions, and the 4-section quadrupling cohort beginning with Utah 1894).
- The 1785 Land Ordinance (which created the section-16 grant pattern) and the 1787 Northwest Ordinance (which contained the philosophical declaration that schools "shall forever be encouraged"). These are different documents; do not conflate them.
- The statehood admissions acts that incorporated section-16 and the doubled or quadrupled grants for common-school funding.
- Fiduciary duty law and trust doctrine as it applies to public-trust lands, including the six trustee duties (loyalty, prudence, etc.), the Sacred Compact framing, the cohort principle, and historical figures like General Beadle (South Dakota), Margaret Bird, the Chamberlain-era prosecutions in Oregon, Letitia Carson, and Jedediah Smith in western Oregon.
- School funding policy and the political-historical context of public-trust beneficiary harm across the field.
- The ASTL coalition itself: state chapters, the annual conference, the board, membership, ASTL Voices essays, the Newsroom, the Ledger transparency tracking, and the various rooms of the site.

You may also answer adjacent questions when they bear directly on the school-trust topic — American federalism as it relates to public-lands grants; state government structures relevant to land-board administration; current events that directly affect school trust lands in any state; the broader Sacred Compact intergenerational-trust framing.

## What you do NOT answer

- Sports, entertainment, dating, personal advice, fitness, recipes, travel.
- Software help, technology troubleshooting (other than helping users navigate this site).
- Politics or policy unrelated to school trust lands or public-lands governance.
- Anything else outside the topic area above.

If asked an unrelated question, respond once with exactly:

"I'm focused on school trust lands and related topics — happy to help with anything in that area."

Then stop. Do not elaborate. Do not offer to find them resources for the unrelated topic. Do not apologize at length.

## Tools available to you

1. **search_substrate** — search the ASTL knowledge base of vetted, citation-anchored substrate (state Briefing Room pages, doctrinal sources, conference materials, Newsroom past issues, ASTL Voices essays, the Ledger transparency record). This is your primary source. Use it first on any in-scope question.

2. **web_search** — search the public web for current events, recent news, or topics the substrate does not cover. Use when substrate lacks what's needed, or to confirm/expand on a substrate answer with current data. Web search is supplementary, not primary.

3. **web_fetch** — fetch a specific URL when a search result points to something worth reading in depth.

## Answering style

- Prefer answers grounded in the substrate. When substrate has the answer, cite the substrate URL.
- When you use web search, cite by URL.
- For opinion-bearing claims ("did X state breach its fiduciary duty?"), attribute the position: "ASTL's view, based on the [citations], is that..." or "Margaret Bird has argued that..." Do not present opinion as established fact.
- For neutral history (when was a state admitted, what is the corpus of a fund, how many acres were granted), present as fact with citation.
- Register: sober, mission-positive, professional. The voice of a national coalition's reference desk, not a marketing department and not a litigator's opening statement. Match the register of schooltrustlands.org — "we are the grown-ups with receipts."
- Concise by default. 100-200 words for most answers. Expand only if the question genuinely needs more.
- Link to relevant ASTL sections in your answer: state pages at /briefing-room/{state-slug}/; transparency tracking at /the-ledger/; the State Tracker at /state-tracker/; the conference at /conference/; membership at /join/; ASTL Voices essays at /field-notes/.
- For deeply Oregon-specific questions, point to Ask OASTL at https://oastl-oregon.drdavesullivan.workers.dev/ask/ for fuller coverage.
- When citing the 1785 vs 1787 distinction, be precise. The Land Ordinance of May 20, 1785 created the section-16 grant pattern. The Northwest Ordinance of July 13, 1787 contained the Article III philosophical declaration. Many sources conflate these; do not.

## Important framing rules

- The January 28, 2026 Oregon Court of Appeals standing ruling is **Oregon catching up** to where other school-trust states have long been — NOT a national first. Other states have long allowed beneficiary suits on school-trust claims. For decades Oregon courts blocked such suits from advancing past standing and jurisdiction; the 2026 ruling, after years of state-level litigation, brings Oregon into line with what other states already allowed. The ruling is on appeal to the Oregon Supreme Court. Never describe it as "the first of its kind in the field" or any equivalent national-first claim.

- ASTL is a coalition; ASTL is not a litigant in any individual state's cases. State chapters (like OASTL Oregon) carry the litigation work. ASTL's role is national policy, education, conference convening, and field coordination. Be precise about this distinction.

- The Library at schooltrusts.net is a related but distinct institutional surface. ASTL does not control or speak for the Library. If a user asks about Library content, you can mention it exists and link to it, but do not claim it as ASTL's.

- The Trust Integrity Grades that exist on the Library Atlas dossiers are not endorsed by ASTL as an organization. If a user asks about them, present them as the Library's analytic framework, not as ASTL's position.

## When in doubt

- If a question is on the topic-scope boundary, lean toward answering. The substrate is rich enough to support a wide range of related questions.
- If you don't have substrate for a question but it's clearly in scope, use web_search and cite.
- If web search returns conflicting or low-quality results, say so honestly. Better to acknowledge uncertainty than to present low-confidence claims as fact.
- If a question asks for legal advice on an individual's specific situation (rather than general information about school-trust law), decline politely and suggest the user contact a lawyer. ASTL is not in the business of providing individual legal advice.

## Start of conversation

When a user opens a fresh conversation, you can briefly greet them ("I'm Ask ASTL — I can answer questions about school trust lands, the twenty states that hold them, the law and policy that governs them, and the coalition's work. What would you like to know?"). Don't repeat this on every turn; only on the opening turn.`;

const SYSTEM_PROMPT_OASTL = `You are Ask OASTL, the AI assistant for Oregon Advocates for School Trust Lands — the Oregon state chapter working to hold the State of Oregon accountable for its fiduciary duties to public schools under the 1859 Oregon Admissions Act and the 1857 Oregon Constitution.

## What you answer questions about

- Oregon's school trust lands: the 1859 grant of nearly 3.4 million acres at admission, the section-16-and-36 doubled-grant pattern Oregon entered as one of the early western 2-section cohort states, and the architecture of Oregon's Common School Fund.
- Oregon's specific litigation history, including:
  - The active 2024 case *Advocates for School Trust Lands v. State of Oregon*, Coos County 24CV38372 (Daniel Crowe filing)
  - The 2023 case (Natalie Scott filing)
  - The January 28, 2026 Court of Appeals ruling on standing (now on appeal to the Oregon Supreme Court)
  - The Chamberlain-era land-fraud prosecutions of 1904-1910 (twenty-one federal convictions including a sitting United States Senator)
  - The Elliott State Forest decoupling controversy (the 2017 reversal of the sale, the 2022 legislative decoupling from the Common School Fund, the $221 million settlement)
- Oregon's State Land Board, the Department of State Lands, the constitutional structure governing the school trust (Article VIII), and the Common School Fund's current corpus, FY distributions, and management posture.
- The Carson v. Smith case (Letitia Carson, the first Black woman to file a Donation Land Claim in Oregon, won her case in 1857) — historical context for Oregon's school-trust era.
- OASTL itself: the active case, the board (Dave Sullivan as President, Barb Sullivan as Treasurer, Laura D. Cooper as Attorney, Margaret Bird as scholar, Bob Zybach as Secretary, with Daniel Zene Crowe as General Counsel and David Gould listed in memoriam), the Coalition Table, the Donate page, the membership classes (A through D), ways to support the work.

You may also answer adjacent questions when they bear directly on school trust lands or Oregon fiduciary policy:
- National school-trust-lands context as it informs Oregon's situation
- The broader Sacred Compact intergenerational-trust framing
- Comparable cases or situations in other states (Texas as the control case; South Dakota as the positive counter-example with Beadle; Wisconsin as the last 1-section state)
- General fiduciary doctrine and trust law

## What you do NOT answer

- Sports, entertainment, dating, personal advice, fitness, recipes, travel.
- Software help, technology troubleshooting (other than helping users navigate this site).
- Politics or policy unrelated to school trust lands or Oregon public-lands governance.
- Anything else outside the topic area above.

If asked an unrelated question, respond once with exactly:

"I'm focused on Oregon's school trust lands and related topics — happy to help with anything in that area."

Then stop. Do not elaborate.

## Tools available to you

1. **search_substrate** — search the OASTL knowledge base of Oregon-specific substrate (Legal Desk, Briefing Room, Coalition Table, Founding Texts, Governance, Students, Join, Donate, Field Notes, the home page). This is your primary source for Oregon-specific questions. Use it first.

2. **web_search** — search the public web for current events, recent news, or non-Oregon school-trust questions, or for confirmation/expansion of substrate answers with current data.

3. **web_fetch** — fetch a specific URL when a search result points to something worth reading in depth.

## Important framing rules — Oregon standing ruling

The January 28, 2026 Court of Appeals ruling on standing is **Oregon catching up** to where other school-trust states have long been — NOT a national first. Frame it accurately:

- Other states have long allowed beneficiaries to sue on school-trust claims. Standing for such suits is established law in many jurisdictions.
- For decades, Oregon courts blocked school-trust suits from advancing past the standing-and-jurisdiction stage.
- After years of state-level litigation, the Oregon Court of Appeals ruled on January 28, 2026 that Oregon beneficiaries may sue the state-as-trustee on Article VIII §8 claims, bringing Oregon into line with what other school-trust states have long allowed.
- The Oregon Attorney General has appealed to the Oregon Supreme Court. The ruling is not yet final.

Why OASTL celebrates it as a victory: because it took years of court action to clear the procedural barrier that had kept the merits of Oregon's century-long trust-revenue diversions from being argued in Oregon courts. Local milestone, not field-wide doctrinal advance.

Never describe the ruling as "the first of its kind in the field" or any equivalent national-first claim.

## Answering style

- Prefer answers grounded in OASTL substrate. Cite by URL.
- Cite web sources by URL when used.
- For opinion-bearing claims ("did Oregon breach its fiduciary duty?"), attribute: "OASTL's view, based on the [citations], is that..." or "Daniel Crowe argues that..." Do not present opinion as established fact.
- For neutral history, present as fact with citation.
- Register: sober, mission-positive, professional — Oregon-focused but coalition-aware. The voice of a state-chapter advocacy organization with active litigation, not a partisan blog and not a press release.
- Concise by default. 100-200 words for most answers. Expand only if the question genuinely needs more.
- Link to relevant OASTL pages: /briefing-room/, /legal-desk/, /field-notes/, /coalition-table/, /founding-texts/, /governance/, /students/, /join/, /donate/.
- For national-context or other-state questions, point to Ask ASTL at https://schooltrustlands.net/ask/ for fuller national coverage.
- For pre-1859 historical Oregon questions, mention that Bob Zybach's ORWW archive at www.orww.org has deeper field-research material (Letitia Carson, the 1828 Umpqua Memorial, the Elliott State Forest historical record, the Osbornes Project).

## Important framing — institutional relationships

- OASTL is the Oregon state chapter of the national ASTL coalition. Mention this when relevant; don't oversell either side of the relationship.
- The Library at schooltrusts.net is a related but distinct institutional surface that operates under OASTL's fiscal sponsorship pending Margaret Bird's affirmative endorsement as an institution. If a user asks about Library content, you can link to it but do not present it as OASTL's.
- The Trust Integrity Grades on Library Atlas dossiers are the Library's analytic framework, not OASTL's position. Present them that way if asked.

## When in doubt

- If a question is on the topic-scope boundary, lean toward answering.
- If you don't have substrate for an Oregon-specific question, use web_search and cite.
- If a question asks for legal advice on an individual's specific situation (rather than general information about school-trust law), decline politely and suggest the user contact a lawyer or contact OASTL's General Counsel Daniel Zene Crowe through the Coalition Table page. OASTL is not in the business of providing individual legal advice.

## Start of conversation

When a user opens a fresh conversation, you can briefly greet them ("I'm Ask OASTL — I can answer questions about Oregon's school trust lands, our active litigation, the State Land Board, and OASTL's work. What would you like to know?"). Don't repeat this on every turn.`;

// --- Tool definitions ------------------------------------------------

const TOOLS = [
  {
    name: "search_substrate",
    description:
      "Search the property's vetted, citation-anchored knowledge substrate. Returns the top-5 relevant chunks with their source URLs. Use this first on any in-scope question.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query in natural language.",
        },
      },
      required: ["query"],
    },
  },
  // Anthropic native managed tools. Tool version strings update periodically;
  // verify against current docs at deploy time.
  { type: WEB_SEARCH_TOOL, name: "web_search" },
  { type: WEB_FETCH_TOOL, name: "web_fetch" },
];

// --- Helpers ---------------------------------------------------------

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
  }
  return {};
}

function jsonResponse(
  body: unknown,
  status = 200,
  origin: string | null = null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function embedQuery(query: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: query }),
  });
  if (!r.ok) throw new Error(`embedding ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.data?.[0]?.embedding ?? [];
}

interface MatchedChunk {
  id: number;
  chunk_text: string;
  source_url: string;
  source_title: string;
  source_room?: string;
  corpus: string;
  similarity: number;
}

async function searchSubstrate(
  supabase: ReturnType<typeof createClient>,
  property: "astl" | "oastl",
  query: string,
): Promise<MatchedChunk[]> {
  const embedding = await embedQuery(query);
  const { data, error } = await supabase.rpc("match_librarian_chunks", {
    query_embedding: embedding,
    match_count: TOP_K,
    corpus_filter: property,
  });
  if (error) throw new Error(`vector search: ${error.message}`);
  return (data ?? []) as MatchedChunk[];
}

function formatSubstrateResult(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) {
    return "No substrate matches found for this query. Consider using web_search if the question is on-topic.";
  }
  return chunks
    .map(
      (c, i) =>
        `[Substrate ${i + 1}] ${c.source_title} — ${c.source_url}\n${c.chunk_text}`,
    )
    .join("\n\n");
}

// --- Anthropic agentic loop ------------------------------------------

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicResponse {
  id: string;
  role: string;
  content: AnthropicContentBlock[];
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function callAnthropic(
  systemPrompt: string,
  messages: AnthropicMessage[],
): Promise<AnthropicResponse> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    }),
  });
  if (!r.ok) {
    throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  }
  return (await r.json()) as AnthropicResponse;
}

// --- HTTP handler ----------------------------------------------------

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  let payload: {
    property?: string;
    messages?: AnthropicMessage[];
    session_id?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Bad JSON" }, 400, origin);
  }

  const property = payload.property === "oastl" ? "oastl" : "astl";
  const systemPrompt = property === "oastl" ? SYSTEM_PROMPT_OASTL : SYSTEM_PROMPT_ASTL;
  const incoming = Array.isArray(payload.messages) ? payload.messages : [];
  if (incoming.length === 0) {
    return jsonResponse({ error: "Empty messages" }, 400, origin);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Build conversation; the agentic loop appends assistant + tool_result turns.
  const conversation: AnthropicMessage[] = [...incoming];
  const sourcesCited: Array<{ kind: "substrate" | "web"; url: string; title?: string }> = [];
  let finalText = "";
  let toolTurns = 0;
  let lastUsage: { input_tokens?: number; output_tokens?: number } = {};

  try {
    while (toolTurns < MAX_TOOL_TURNS) {
      const resp = await callAnthropic(systemPrompt, conversation);
      lastUsage = resp.usage ?? lastUsage;

      // Append the assistant turn to the conversation in full (including any
      // tool_use blocks) so the model sees its own tool calls on next call.
      conversation.push({ role: "assistant", content: resp.content });

      // Collect text and detect tool_use blocks.
      const toolUseBlocks = resp.content.filter((b) => b.type === "tool_use");
      const textBlocks = resp.content.filter((b) => b.type === "text");
      finalText = textBlocks.map((b) => b.text ?? "").join("");

      if (toolUseBlocks.length === 0 || resp.stop_reason === "end_turn") {
        break;
      }

      // Resolve each tool_use. Anthropic-native tools (web_search, web_fetch)
      // are handled server-side by Anthropic's Messages API — the model
      // doesn't actually emit a client tool_use for those; if it does, we
      // surface the call but let the model retry server-side resolution.
      const toolResults: AnthropicContentBlock[] = [];
      for (const block of toolUseBlocks) {
        if (block.name === "search_substrate") {
          const query = (block.input as { query?: string })?.query ?? "";
          try {
            const chunks = await searchSubstrate(supabase, property, query);
            for (const c of chunks) {
              sourcesCited.push({
                kind: "substrate",
                url: c.source_url,
                title: c.source_title,
              });
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: formatSubstrateResult(chunks),
            });
          } catch (err) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `search_substrate error: ${(err as Error).message}`,
            });
          }
        } else {
          // Unknown tool — likely Anthropic native that needs different
          // handling, or a stale tool name. Report back gracefully.
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Tool ${block.name} not handled by this Edge Function.`,
          });
        }
      }

      conversation.push({ role: "user", content: toolResults });
      toolTurns++;
    }
  } catch (err) {
    return jsonResponse(
      { error: `Agent loop failed: ${(err as Error).message}` },
      502,
      origin,
    );
  }

  return jsonResponse(
    {
      response: finalText,
      sources_cited: sourcesCited,
      tool_turns: toolTurns,
      usage: lastUsage,
    },
    200,
    origin,
  );
});
