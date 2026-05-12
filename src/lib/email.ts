// Email send helper — wraps Resend with a tiny file-loaded template system.
//
// v30 inlined a one-off Resend send inside src/pages/api/feedback.ts. v31
// introduces four more transactional templates, so the send logic moves
// here and the API endpoints call sendTemplateEmail({ template, to, variables }).
//
// Templates live as plain .txt files under src/emails/ with the first line
// taking the form `Subject: {{whatever}}` and the rest being the body.
// Variable substitution is a simple `{{name}}` string-replace.
//
// All sends are best-effort: if RESEND_API_KEY is absent or the Resend call
// fails, sendTemplateEmail resolves with { sent: false, reason } rather than
// throwing — callers should never treat email failure as a request failure.

const TEMPLATES = {
  ticket_response: () =>
    import('../emails/ticket_response.txt?raw').then((m) => m.default),
  librarian_application_received: () =>
    import('../emails/librarian_application_received.txt?raw').then((m) => m.default),
  librarian_application_approved: () =>
    import('../emails/librarian_application_approved.txt?raw').then((m) => m.default),
  librarian_application_declined: () =>
    import('../emails/librarian_application_declined.txt?raw').then((m) => m.default),
  correction_received: () =>
    import('../emails/correction_received.txt?raw').then((m) => m.default),
  review_published: () =>
    import('../emails/review_published.txt?raw').then((m) => m.default),
  discussion_reply: () =>
    import('../emails/discussion_reply.txt?raw').then((m) => m.default),
  state_co_lib_application_received: () =>
    import('../emails/state_co_lib_application_received.txt?raw').then((m) => m.default),
  state_co_lib_application_accepted: () =>
    import('../emails/state_co_lib_application_accepted.txt?raw').then((m) => m.default),
  state_co_lib_application_declined: () =>
    import('../emails/state_co_lib_application_declined.txt?raw').then((m) => m.default),
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export type SendResult =
  | { sent: true; id?: string }
  | { sent: false; reason: string };

function substitute(source: string, vars: Record<string, string>): string {
  // Substitute every `{{name}}` token. Missing variables collapse to the
  // empty string so a half-populated template degrades gracefully.
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '';
  });
}

function splitSubjectAndBody(rendered: string): { subject: string; body: string } {
  // The first non-empty line must begin with `Subject:`. Everything else is
  // the plain-text body. We strip a single blank line between subject and
  // body if present.
  const lines = rendered.split(/\r?\n/);
  let subjectIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    if (/^subject:\s*/i.test(lines[i])) {
      subjectIdx = i;
      break;
    }
    break;
  }
  if (subjectIdx < 0) {
    return { subject: '(no subject)', body: rendered };
  }
  const subject = lines[subjectIdx].replace(/^subject:\s*/i, '').trim();
  let bodyStart = subjectIdx + 1;
  if (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart += 1;
  const body = lines.slice(bodyStart).join('\n').replace(/\s+$/, '') + '\n';
  return { subject, body };
}

export async function sendTemplateEmail(opts: {
  template: TemplateName;
  to: string;
  variables: Record<string, string>;
}): Promise<SendResult> {
  const resendKey = import.meta.env.RESEND_API_KEY;
  if (!resendKey) return { sent: false, reason: 'no RESEND_API_KEY' };
  if (!opts.to) return { sent: false, reason: 'no recipient' };

  let raw: string;
  try {
    raw = await TEMPLATES[opts.template]();
  } catch (e) {
    return { sent: false, reason: `template load failed: ${(e as Error).message}` };
  }
  const rendered = substitute(raw, opts.variables);
  const { subject, body } = splitSubjectAndBody(rendered);

  const fromAddress =
    import.meta.env.FEEDBACK_FROM_EMAIL || 'library@schooltrusts.net';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: opts.to,
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { sent: false, reason: `resend ${res.status}: ${errText.slice(0, 120)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}
