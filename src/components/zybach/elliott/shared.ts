/**
 * Shared Zybach components come from ROOM at `src/components/zybach/*.astro`.
 * Until (or unless) they land, the Elliott pages fall back to equivalents
 * under `./fallback/` built to the same prop contracts in BUILD_SPEC.
 *
 * Resolution happens at build time through a glob, so no import breaks when
 * ROOM's file is absent, and the moment ROOM lands its version these pages
 * pick it up with no edit here.
 */

const ROOM = import.meta.glob('/src/components/zybach/*.astro', { eager: true }) as Record<
  string,
  { default?: any }
>;
const FALLBACK = import.meta.glob('./fallback/*.astro', { eager: true }) as Record<
  string,
  { default?: any }
>;

function pick(name: string): any {
  const room = ROOM[`/src/components/zybach/${name}.astro`]?.default;
  if (room) return room;
  const local = FALLBACK[`./fallback/${name}.astro`]?.default;
  if (local) return local;
  throw new Error(`Zybach shared component ${name} has no implementation`);
}

export function usingRoomComponent(name: string): boolean {
  return Boolean(ROOM[`/src/components/zybach/${name}.astro`]?.default);
}

export const ZybachMap = pick('ZybachMap');
export const CitationBlock = pick('CitationBlock');
export const ProvenanceBlock = pick('ProvenanceBlock');
export const ContentNote = pick('ContentNote');
export const ZybachNav = pick('ZybachNav');

export const SHARED_SOURCES = {
  ZybachMap: usingRoomComponent('ZybachMap') ? 'room' : 'elliott-fallback',
  CitationBlock: usingRoomComponent('CitationBlock') ? 'room' : 'elliott-fallback',
  ProvenanceBlock: usingRoomComponent('ProvenanceBlock') ? 'room' : 'elliott-fallback',
  ContentNote: usingRoomComponent('ContentNote') ? 'room' : 'elliott-fallback',
  ZybachNav: usingRoomComponent('ZybachNav') ? 'room' : 'elliott-fallback',
};
