// Turns markdown (from the owner or from a bot) into HTML that is safe to put
// on an office page.
//
// Bot replies are untrusted text. Three things keep them harmless:
//  1. Raw HTML in the markdown is not passed through; it is shown as text.
//  2. Links may only be http, https, or mailto, and open in a new tab without
//     telling the other site where the reader came from.
//  3. Markdown images are switched off, so a reply cannot make the reader's
//     browser fetch a remote picture (a tracking pixel). Pictures arrive as
//     attachments instead, and the page shows those itself.
// The page's content security policy is the backstop behind all three.
//
// markdown-it is already a dependency of this repo (^14.2.0). Nothing new.
// @ts-ignore -- markdown-it ships no types of its own; @types/markdown-it may not be installed here.
import MarkdownIt from 'markdown-it';

const md: any = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });
md.disable('image');

md.validateLink = (url: string): boolean => /^(https?:\/\/|mailto:)/i.test(String(url).trim());

const renderLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens: any[], idx: number, options: any, env: any, self: any) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer nofollow');
  return renderLinkOpen(tokens, idx, options, env, self);
};

const MAX_RENDER_CHARS = 200_000;

export function renderMarkdown(source: unknown): string {
  return md.render(String(source ?? '').slice(0, MAX_RENDER_CHARS));
}
