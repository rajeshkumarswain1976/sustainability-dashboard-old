export function locationRows(nodes) {
  const byParent = new Map();
  const identities=new Set(nodes.map(node=>node.node_id));
  for (const node of nodes) {
    const key = identities.has(node.parent_id)?node.parent_id:null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }
  const rows = [], visited = new Set();
  const walk = (parent, depth, ancestors) => {
    const children = (byParent.get(parent) || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const node of children) {
      if (visited.has(node.node_id)) continue;
      visited.add(node.node_id);
      rows.push({ ...node, depth, path: [...ancestors, node.label].join(' / ') });
      walk(node.node_id, depth + 1, [...ancestors, node.label]);
    }
  };
  walk(null, 0, []);
  for (const node of nodes) if (!visited.has(node.node_id)) rows.push({ ...node, depth: 0, path: node.label });
  return rows;
}
