// v16 ALPHA — Build-time remark plugin that strips [VERIFY...] markers
// from rendered markdown. Substrate keeps the markers in source as authoring
// flags; rendered output drops them. See Site_Update_v16 handoff §ALPHA.
//
// Strategy: walk the mdast tree and:
//   1. Strip the marker pattern from string-valued node properties
//      (`alt` on images, `title` on links/images/definitions, `value` on
//      `inlineCode` and `code` nodes — these don't have children, so the
//      child-array walker can't reach them).
//   2. Inside child arrays, handle markers that span across inline siblings
//      (e.g., `[VERIFY: foo *bar* baz]` becomes text + emphasis + text in
//      the AST). The walker tracks an "inMarker" state across siblings so
//      it strips the entire span, including any inline children between
//      the open and close brackets.
//   3. If an `inlineCode` node's value reduces to empty after stripping,
//      mark the node for removal so the parent walker drops it cleanly
//      (avoids leaving empty `<code></code>` in rendered HTML).
//
// Limitations: does not handle markers spanning across block boundaries
// (extremely uncommon — the smoke test asserts zero leftover `[VERIFY`).

const MARKER_RE = /\s*\[VERIFY[^\]]*\]/g;

export default function remarkStripVerify() {
  return (tree) => {
    walk(tree);
  };
}

function stripFromString(value) {
  if (typeof value !== 'string') return value;
  return value.replace(MARKER_RE, '');
}

function walk(node) {
  if (!node || typeof node !== 'object') return;

  // 1. Strip from common string-valued properties on this node.
  if (typeof node.alt === 'string') {
    node.alt = stripFromString(node.alt);
  }
  if (typeof node.title === 'string') {
    node.title = stripFromString(node.title);
  }

  // 2. inlineCode and code nodes hold the marker as their `value`.
  if ((node.type === 'inlineCode' || node.type === 'code')
      && typeof node.value === 'string') {
    const stripped = stripFromString(node.value);
    if (stripped !== node.value) {
      node.value = stripped;
      if (stripped.trim() === '') {
        node._removeMe = true;
      }
    }
  }

  // 3. Walk children with marker-spanning logic.
  if (!Array.isArray(node.children) || node.children.length === 0) return;

  // First pass: recurse so each child's own props (alt/title/value) get
  // processed before we make sibling-level decisions.
  for (const child of node.children) {
    walk(child);
  }

  const newChildren = [];
  let inMarker = false;

  for (const child of node.children) {
    if (child._removeMe) continue;

    if (inMarker) {
      // Inside a marker — drop everything until we find a closing `]`.
      if (child.type === 'text' && typeof child.value === 'string') {
        const closeIdx = child.value.indexOf(']');
        if (closeIdx >= 0) {
          const after = child.value.slice(closeIdx + 1);
          inMarker = false;
          if (after.length > 0) {
            child.value = after;
            newChildren.push(child);
          }
        }
        // else: drop this text node (still inside marker)
      }
      // Non-text inline node inside marker — drop it.
      continue;
    }

    if (child.type === 'text' && typeof child.value === 'string') {
      // First pass: strip complete in-string markers (greedy up to `]`).
      let value = child.value.replace(MARKER_RE, '');
      // Second pass: if an unclosed `[VERIFY` remains, strip from there
      // onward and enter inMarker mode for subsequent siblings.
      const openIdx = value.indexOf('[VERIFY');
      if (openIdx >= 0) {
        value = value.slice(0, openIdx).replace(/[ \t]+$/, '');
        inMarker = true;
      }
      if (value.length > 0) {
        child.value = value;
        newChildren.push(child);
      }
    } else {
      newChildren.push(child);
    }
  }

  node.children = newChildren;
}
