// ---- Archi3D core: tiny DSL parser + ELK graph builder + layout flattening ----
// Shared by the page and the node test.

const SHAPES = { component: 'box', service: 'box', database: 'db', db: 'db', queue: 'queue', external: 'ext', actor: 'ext', ui: 'box' };

function parseDSL(src) {
  const root = { id: '__root', name: 'root', kind: 'root', children: [], depth: -1, parent: null, isContainer: true };
  const byName = new Map();
  const edges = [];
  const errors = [];
  const stack = [root];
  const lines = src.split(/\r?\n/);

  const addNode = (n, ln) => {
    if (byName.has(n.name)) { errors.push({ line: ln, msg: `"${n.name}" is defined twice. Names must be unique.` }); return false; }
    byName.set(n.name, n); return true;
  };
  const list = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);

  lines.forEach((raw, i) => {
    const ln = i + 1;
    let line = raw.replace(/(#|\/\/).*$/, '').trim();
    if (!line) return;
    // closing braces (possibly several)
    while (line.startsWith('}')) {
      if (stack.length === 1) errors.push({ line: ln, msg: 'Unmatched "}".' }); else stack.pop();
      line = line.slice(1).trim();
    }
    if (!line) return;
    // edge:  A[.port] -> B[.port] [: label]
    let m = line.match(/^([\w-]+)(?:\.([\w-]+))?\s*(->|-->|=>|<-)\s*([\w-]+)(?:\.([\w-]+))?\s*(?::\s*(.+))?$/);
    if (m) {
      let [, a, ap, arrow, b, bp, label] = m;
      if (arrow === '<-') { [a, ap, b, bp] = [b, bp, a, ap]; }
      edges.push({ from: a, fromPort: ap || null, to: b, toPort: bp || null, label: label ? label.trim() : '', async: arrow === '=>' , line: ln });
      return;
    }
    // node / container:  kind Name [in: a,b] [out: c] [{]
    m = line.match(/^([\w-]+)\s+([\w-]+)(.*)$/);
    if (!m) { errors.push({ line: ln, msg: `Can't read "${line}". Expected "kind Name", "A -> B" or "}".` }); return; }
    const [, kind, name] = m; let rest = m[3].trim();
    const opens = rest.endsWith('{');
    if (opens) rest = rest.slice(0, -1).trim();
    const ins = list((rest.match(/\bin\s*:\s*([^:]*?)(?=\s+out\s*:|$)/) || [])[1]);
    const outs = list((rest.match(/\bout\s*:\s*([^:]*?)(?=\s+in\s*:|$)/) || [])[1]);
    const parent = stack[stack.length - 1];
    const node = { id: name, name, kind: kind.toLowerCase(), parent, depth: parent.depth + 1, children: [], ins, outs, isContainer: opens, line: ln };
    node.shape = SHAPES[node.kind] || 'box';
    if (!addNode(node, ln)) return;
    parent.children.push(node);
    if (opens) stack.push(node);
  });
  if (stack.length > 1) errors.push({ line: lines.length, msg: `"${stack[stack.length - 1].name}" is missing a closing "}".` });

  // resolve edges, auto-create undeclared ports
  const good = [];
  for (const e of edges) {
    const A = byName.get(e.from), B = byName.get(e.to);
    if (!A) { errors.push({ line: e.line, msg: `Unknown component "${e.from}".` }); continue; }
    if (!B) { errors.push({ line: e.line, msg: `Unknown component "${e.to}".` }); continue; }
    if (A === B) { errors.push({ line: e.line, msg: `"${e.from}" connects to itself.` }); continue; }
    if (A.isContainer || B.isContainer) {
      // container-level edge: attach to container without ports
      e.fromPort = null; e.toPort = null;
    } else {
      if (!e.fromPort) e.fromPort = A.outs[0] || '_out';
      if (!e.toPort) e.toPort = B.ins[0] || '_in';
      if (!A.outs.includes(e.fromPort)) { if (A.ins.includes(e.fromPort)) { /* allow using an in-port as source */ } else A.outs.push(e.fromPort); }
      if (!B.ins.includes(e.toPort)) { if (B.outs.includes(e.toPort)) { } else B.ins.push(e.toPort); }
    }
    e.A = A; e.B = B; good.push(e);
  }
  return { root, byName, edges: good, errors };
}

function portSide(node, p) { return node.ins.includes(p) ? 'WEST' : 'EAST'; }

function buildElk(model, opts = {}) {
  const dir = opts.direction || 'RIGHT';
  const toElk = n => {
    if (n.isContainer) {
      return {
        id: n.id,
        layoutOptions: { 'elk.padding': '[top=46,left=26,bottom=26,right=26]' },
        children: n.children.map(toElk)
      };
    }
    const portCount = Math.max(n.ins.filter(p => !p.startsWith('_')).length, n.outs.filter(p => !p.startsWith('_')).length, 1);
    const w = Math.max(120, n.name.length * 9 + 44);
    const h = Math.max(64, portCount * 24 + 24);
    const ports = [];
    n.ins.forEach(p => ports.push({ id: n.id + '.' + p, width: 10, height: 10, layoutOptions: { 'elk.port.side': 'WEST' } }));
    n.outs.forEach(p => ports.push({ id: n.id + '.' + p, width: 10, height: 10, layoutOptions: { 'elk.port.side': 'EAST' } }));
    return { id: n.id, width: w, height: h, ports, layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' } };
  };
  return {
    id: '__root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': dir,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.json.edgeCoords': 'ROOT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.spacing.nodeNode': '44',
      'elk.layered.spacing.edgeNodeBetweenLayers': '24',
      'elk.spacing.edgeEdge': '14',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.padding': '[top=30,left=30,bottom=30,right=30]'
    },
    children: model.root.children.map(toElk),
    edges: model.edges.map((e, i) => ({
      id: 'e' + i,
      sources: [e.fromPort ? e.A.id + '.' + e.fromPort : e.A.id],
      targets: [e.toPort ? e.B.id + '.' + e.toPort : e.B.id]
    }))
  };
}

// Flatten ELK output to absolute 2D boxes, port positions and edge polylines.
function flattenLayout(model, laid) {
  const boxes = new Map(), ports = new Map();
  const walk = (en, ox, oy) => {
    for (const c of en.children || []) {
      const x = ox + c.x, y = oy + c.y;
      boxes.set(c.id, { x, y, w: c.width, h: c.height });
      for (const p of c.ports || []) ports.set(p.id, { x: x + p.x + p.width / 2, y: y + p.y + p.height / 2 });
      walk(c, x, y);
    }
  };
  walk(laid, 0, 0);
  // elkjs reports edge sections relative to the lowest common container of both ends.
  const ancestors = n => { const a = []; let p = n.parent; while (p) { a.push(p); p = p.parent; } return a; };
  const routes = model.edges.map((e, i) => {
    const le = (laid.edges || []).find(x => x.id === 'e' + i);
    const s = le && le.sections && le.sections[0];
    if (!s) return null;
    const bset = new Set(ancestors(e.B));
    const lca = ancestors(e.A).find(x => bset.has(x));
    const o = (!lca || lca.id === '__root') ? { x: 0, y: 0 } : boxes.get(lca.id);
    return [s.startPoint, ...(s.bendPoints || []), s.endPoint].map(p => ({ x: p.x + o.x, y: p.y + o.y }));
  });
  return { boxes, ports, routes, width: laid.width, height: laid.height };
}

if (typeof module !== 'undefined') module.exports = { parseDSL, buildElk, flattenLayout };
