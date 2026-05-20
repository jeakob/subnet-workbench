// visual-v4.jsx — IPv4 Visual Subnet Calculator with multi-network workspace,
// split/join/detach, notes, colors, and shareable URL state.

const VS_COLORS = [
  { key: 'red',    css: '#e88a8a' },
  { key: 'orange', css: '#f0aa64' },
  { key: 'yellow', css: '#f0c674' },
  { key: 'green',  css: '#7dd47d' },
  { key: 'cyan',   css: '#6ee7e7' },
  { key: 'blue',   css: '#8caaeb' },
  { key: 'purple', css: '#be96eb' },
  { key: 'pink',   css: '#eb96c8' },
  { key: 'gray',   css: '#666' },
];

const VS_DEFAULT_COLS = {
  subnet: true,
  netmask: false,
  range: true,
  useable: true,
  hosts: true,
  note: true,
  color: true,
};

let _vsId = 0;
function _nextId() { return 'n' + (++_vsId) + '_' + Date.now().toString(36); }

// ── URL persistence ─────────────────────────────────────────────────────────
// New multi-network format: #v4m=base64( [{id, tree-serialized}, ...] )
// Legacy single-tree format (#v4=) is read for backwards compatibility.
function vsLoadInitial() {
  try {
    const h = window.location.hash;
    if (h && h.startsWith('#v4m=')) {
      const arr = JSON.parse(atob(decodeURIComponent(h.slice(5))));
      const nets = arr.map(d => ({ id: _nextId(), tree: NetLib.vs_deserialize(d) }));
      if (nets.length) return nets;
    }
    if (h && h.startsWith('#v4=')) {
      const data = JSON.parse(atob(decodeURIComponent(h.slice(4))));
      return [{ id: _nextId(), tree: NetLib.vs_deserialize(data) }];
    }
  } catch (e) {}
  const ip = NetLib.v4_parse('10.0.0.0');
  return [{ id: _nextId(), tree: NetLib.vs_make_root(ip, 16) }];
}

function VisualV4() {
  const [networks, setNetworks] = React.useState(vsLoadInitial);
  const [networkStr, setNetworkStr] = React.useState('10.0.0.0');
  const [prefixStr, setPrefixStr] = React.useState('16');
  const [cols, setCols] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('vs-cols') || 'null');
      return stored || VS_DEFAULT_COLS;
    } catch (e) { return VS_DEFAULT_COLS; }
  });
  const [error, setError] = React.useState('');

  // Persist columns
  React.useEffect(() => {
    localStorage.setItem('vs-cols', JSON.stringify(cols));
  }, [cols]);

  // Persist networks to URL hash
  React.useEffect(() => {
    const arr = networks.map(n => NetLib.vs_serialize(n.tree));
    const enc = btoa(JSON.stringify(arr));
    history.replaceState(null, '', '#v4m=' + enc);
  }, [networks]);

  // ── input → primary network ──────────────────────────────────────────────
  function parseNetInputs() {
    let netInput = networkStr;
    let prefInput = prefixStr;
    if (netInput.includes('/')) {
      const [ipPart, prefPart = ''] = netInput.split('/');
      netInput = ipPart.trim();
      if (prefPart.trim() !== '') prefInput = prefPart.trim();
      setNetworkStr(netInput);
      setPrefixStr(prefInput);
    }
    const ip = NetLib.v4_parse(netInput);
    const p = parseInt(prefInput, 10);
    if (ip === null) return { error: 'Invalid IP address' };
    if (!Number.isFinite(p) || p < 0 || p > 32) return { error: 'Prefix must be 0–32' };
    const aligned = NetLib.v4_network(ip, p) >>> 0;
    if (aligned !== ip) setNetworkStr(NetLib.v4_format(aligned));
    return { ip: aligned, prefix: p };
  }

  function applyPrimary() {
    setError('');
    const r = parseNetInputs();
    if (r.error) { setError(r.error); return; }
    setNetworks(ns => {
      const head = { id: ns[0]?.id || _nextId(), tree: NetLib.vs_make_root(r.ip, r.prefix) };
      return [head, ...ns.slice(1)];
    });
  }

  function addAsNew() {
    setError('');
    const r = parseNetInputs();
    if (r.error) { setError(r.error); return; }
    setNetworks(ns => [...ns, { id: _nextId(), tree: NetLib.vs_make_root(r.ip, r.prefix) }]);
  }

  function removeNetwork(idx) {
    if (networks.length <= 1) return;
    if (!confirm(`Remove network ${idx + 1}?`)) return;
    setNetworks(ns => ns.filter((_, i) => i !== idx));
  }

  function resetNetwork(idx) {
    if (!confirm('Reset all subnet divisions for this network?')) return;
    setNetworks(ns => ns.map((n, i) => {
      if (i !== idx) return n;
      return { ...n, tree: NetLib.vs_make_root(n.tree.ip, n.tree.prefix) };
    }));
  }

  // ── tree operations ──────────────────────────────────────────────────────
  function updateTree(idx, fn) {
    setNetworks(ns => ns.map((n, i) => i === idx ? { ...n, tree: fn(n.tree) } : n));
  }

  function splitAt(idx, path) {
    updateTree(idx, tree => {
      const node = NetLib.vs_at_path(tree, path);
      if (!node || !node.leaf || node.prefix >= 32) return tree;
      return NetLib.vs_replace(tree, path, NetLib.vs_split(node));
    });
  }

  function joinAt(idx, path) {
    updateTree(idx, tree => {
      const node = NetLib.vs_at_path(tree, path);
      if (!node || !NetLib.vs_can_join(node)) return tree;
      return NetLib.vs_replace(tree, path, NetLib.vs_join(node));
    });
  }

  function setLeafProp(idx, path, prop, value) {
    updateTree(idx, tree => {
      const node = NetLib.vs_at_path(tree, path);
      if (!node || !node.leaf) return tree;
      return NetLib.vs_replace(tree, path, { ...node, [prop]: value });
    });
  }

  // Detach: copy the leaf out as a new top-level network, and mark the original
  // leaf as detached (dimmed) so the original plan still shows the allocation.
  function detachAt(idx, path) {
    const tree = networks[idx].tree;
    const node = NetLib.vs_at_path(tree, path);
    if (!node || !node.leaf) return;
    if (node.detached) return;
    // Mark original as detached
    const marked = NetLib.vs_replace(tree, path, { ...node, detached: true });
    const newNet = { id: _nextId(), tree: NetLib.vs_make_root(node.ip, node.prefix) };
    setNetworks(ns => {
      const next = ns.slice();
      next[idx] = { ...next[idx], tree: marked };
      next.push(newNet);
      return next;
    });
  }

  function reattachAt(idx, path) {
    updateTree(idx, tree => {
      const node = NetLib.vs_at_path(tree, path);
      if (!node || !node.leaf || !node.detached) return tree;
      const { detached, ...rest } = node;
      return NetLib.vs_replace(tree, path, rest);
    });
  }

  function shareLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }

  function exportAll() {
    const data = networks.map((n, i) => ({
      index: i,
      root: NetLib.v4_format(n.tree.ip) + '/' + n.tree.prefix,
      tree: NetLib.vs_serialize(n.tree),
    }));
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subnets-workspace.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack">
      <PageHead
        title="Visual Subnet Calculator"
        sub="Recursively split or join subnets, annotate them with notes and colors, and share the layout via URL."
      />

      <div className="card">
        <div className="card-h">
          <h2>Add network</h2>
          <span className="muted">{networks.length} network{networks.length === 1 ? '' : 's'} in workspace</span>
        </div>
        <div className="card-body">
          <div className="form-row" style={{ alignItems: 'end' }}>
            <Field label="Network address">
              <div className="input-row">
                <input
                  value={networkStr}
                  onChange={e => {
                    const raw = e.target.value;
                    setNetworkStr(raw);
                    if (raw.includes('/')) {
                      const prefPart = raw.split('/')[1] || '';
                      const digits = prefPart.replace(/\D/g, '').slice(0, 2);
                      if (digits !== '') setPrefixStr(digits);
                      return;
                    }
                    const m = raw.match(/^\s*(\S+)[\s,]+(\S+)\s*$/);
                    if (m) {
                      const maskPrefix = NetLib.v4_parse_mask(m[2]);
                      if (maskPrefix !== null) {
                        setNetworkStr(m[1]);
                        setPrefixStr(String(maskPrefix));
                      }
                    }
                  }}
                  onKeyDown={e => e.key === 'Enter' && applyPrimary()}
                  placeholder="10.0.0.0/8"
                  spellCheck={false}
                />
              </div>
            </Field>
            <Field label="Prefix or mask">
              <div className="input-row">
                <span className="slash">/</span>
                <input
                  className="prefix-input"
                  value={prefixStr}
                  placeholder="24"
                  onChange={e => {
                    const v = e.target.value.replace(/[^\d.]/g, '').slice(0, 15);
                    if (v.includes('.')) {
                      const maskPrefix = NetLib.v4_parse_mask(v);
                      if (maskPrefix !== null) { setPrefixStr(String(maskPrefix)); return; }
                      setPrefixStr(v);
                      return;
                    }
                    setPrefixStr(v);
                  }}
                  onBlur={() => {
                    if (prefixStr.includes('.')) {
                      const maskPrefix = NetLib.v4_parse_mask(prefixStr);
                      if (maskPrefix !== null) setPrefixStr(String(maskPrefix));
                    }
                  }}
                  onKeyDown={e => e.key === 'Enter' && applyPrimary()}
                />
              </div>
            </Field>
            <Field label=" ">
              <div className="btn-group">
                <button className="btn btn-primary" onClick={applyPrimary} title="Replace network #1 with this">
                  {networks.length > 1 ? 'Update #1' : 'Update'}
                </button>
                <button className="btn" onClick={addAsNew} title="Add a separate top-level network">+ Add network</button>
                <button className="btn btn-ghost" onClick={shareLink} title="Copy share link">Share</button>
                <button className="btn btn-ghost" onClick={exportAll} title="Export all networks as JSON">Export</button>
              </div>
            </Field>
          </div>
          {error && <div className="pill bad" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </div>

      <VsColumnsToolbar cols={cols} setCols={setCols} />

      {networks.map((n, idx) => (
        <NetworkBlock
          key={n.id}
          idx={idx}
          tree={n.tree}
          cols={cols}
          canRemove={networks.length > 1}
          onSplit={path => splitAt(idx, path)}
          onJoin={path => joinAt(idx, path)}
          onLeafProp={(path, prop, value) => setLeafProp(idx, path, prop, value)}
          onDetach={path => detachAt(idx, path)}
          onReattach={path => reattachAt(idx, path)}
          onRemove={() => removeNetwork(idx)}
          onReset={() => resetNetwork(idx)}
        />
      ))}

      <div className="foot">
        Workspace state persists in the URL — bookmark or share the page to save.
        Inspired by the original <a href="https://www.davidc.net/sites/default/subnets/subnets.html" target="_blank" rel="noopener">davidc.net</a> Visual Subnet Calculator.
      </div>
    </div>
  );
}

function VsColumnsToolbar({ cols, setCols }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="vs-toolbar">
        <div className="vs-tb-l">
          <span style={{ fontSize: 11, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Columns</span>
          {[
            ['subnet','Subnet'],
            ['netmask','Netmask'],
            ['range','Range'],
            ['useable','Usable'],
            ['hosts','Hosts'],
            ['note','Notes'],
            ['color','Color'],
          ].map(([k, lbl]) => (
            <label key={k} className="col-toggle">
              <input
                type="checkbox"
                checked={!!cols[k]}
                onChange={e => setCols({ ...cols, [k]: e.target.checked })}
              />
              {lbl}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function NetworkBlock({ idx, tree, cols, canRemove, onSplit, onJoin, onLeafProp, onDetach, onReattach, onRemove, onReset }) {
  const rows = [];
  NetLib.vs_walk_leaves(tree, (leaf, path) => rows.push({ leaf, path }));
  const totalAddresses = NetLib.v4_size(tree.prefix);
  const detachedCount = rows.filter(r => r.leaf.detached).length;
  const activeCount = rows.length - detachedCount;

  return (
    <div className="card">
      <div className="card-h">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="net-badge">#{idx + 1}</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{NetLib.v4_format(tree.ip)}/{tree.prefix}</span>
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="muted">{activeCount} subnet{activeCount === 1 ? '' : 's'}{detachedCount ? ` · ${detachedCount} separated` : ''}</span>
          <button className="btn btn-sm btn-ghost" onClick={onReset} title="Collapse all divisions">Reset</button>
          {canRemove && <button className="btn btn-sm btn-ghost" onClick={onRemove} title="Remove this network">Remove</button>}
        </div>
      </div>

      <div className="card-body" style={{ paddingBottom: 0 }}>
        <div className="stat-grid">
          <Stat label="Subnets" value={activeCount} mode="accent" />
          <Stat label="Total addresses" value={totalAddresses.toLocaleString()} />
          <Stat label="Netmask" value={NetLib.v4_format(NetLib.v4_mask(tree.prefix))} />
          <Stat label="Wildcard" value={NetLib.v4_format(NetLib.v4_wildcard(tree.prefix))} />
        </div>
      </div>

      <div className="vs-wrap">
        <table className="vs-table">
          <thead>
            <tr>
              {cols.subnet  && <th>Subnet address</th>}
              {cols.netmask && <th>Netmask</th>}
              {cols.range   && <th>Range</th>}
              {cols.useable && <th>Usable hosts</th>}
              {cols.hosts   && <th style={{ textAlign: 'right' }}># Hosts</th>}
              {cols.note    && <th>Note</th>}
              {cols.color   && <th>Color</th>}
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ leaf, path }) => {
              const net = leaf.ip;
              const bcast = NetLib.v4_broadcast(net, leaf.prefix);
              const first = NetLib.v4_first_host(net, leaf.prefix);
              const last = NetLib.v4_last_host(net, leaf.prefix);
              const usable = NetLib.v4_usable(leaf.prefix);
              const colorClass = leaf.color ? `colored tint-${leaf.color}` : '';
              const detachedClass = leaf.detached ? ' detached' : '';
              const canSplit = leaf.prefix < 32 && !leaf.detached;
              let canJoin = false;
              if (path.length > 0) {
                const parentPath = path.slice(0, -1);
                const parent = NetLib.vs_at_path(tree, parentPath);
                if (parent && !parent.leaf && parent.left.leaf && parent.right.leaf
                    && !parent.left.detached && !parent.right.detached) canJoin = true;
              }
              const canDetach = !leaf.detached;
              return (
                <tr key={path.join('') + '-' + leaf.prefix + '-' + leaf.ip} className={colorClass + detachedClass}>
                  {cols.subnet && (
                    <td>
                      <div className="vs-cell vs-subnet">
                        <span>{NetLib.v4_format(net)}</span>
                        <span className="vs-prefix">/{leaf.prefix}</span>
                        {leaf.detached && <span className="vs-tag" title="Carved out as a separate network below">separated</span>}
                      </div>
                    </td>
                  )}
                  {cols.netmask && (
                    <td><div className="vs-cell vs-mask">{NetLib.v4_format(NetLib.v4_mask(leaf.prefix))}</div></td>
                  )}
                  {cols.range && (
                    <td><div className="vs-cell vs-range">{NetLib.v4_format(net)} – {NetLib.v4_format(bcast)}</div></td>
                  )}
                  {cols.useable && (
                    <td><div className="vs-cell vs-host">
                      {leaf.prefix >= 31
                        ? `${NetLib.v4_format(net)} – ${NetLib.v4_format(bcast)}`
                        : `${NetLib.v4_format(first)} – ${NetLib.v4_format(last)}`}
                    </div></td>
                  )}
                  {cols.hosts && (
                    <td><div className="vs-cell vs-hosts">{usable.toLocaleString()}</div></td>
                  )}
                  {cols.note && (
                    <td>
                      <input
                        className="vs-note"
                        value={leaf.note || ''}
                        onChange={e => onLeafProp(path, 'note', e.target.value)}
                        placeholder="add a note"
                      />
                    </td>
                  )}
                  {cols.color && (
                    <td>
                      <div className="vs-color">
                        <span
                          className={'vs-swatch clear' + (!leaf.color ? ' active' : '')}
                          onClick={() => onLeafProp(path, 'color', undefined)}
                          title="No color"
                        >×</span>
                        {VS_COLORS.map(c => (
                          <span
                            key={c.key}
                            className={'vs-swatch' + (leaf.color === c.key ? ' active' : '')}
                            style={{ background: c.css }}
                            onClick={() => onLeafProp(path, 'color', c.key)}
                            title={c.key}
                          />
                        ))}
                      </div>
                    </td>
                  )}
                  <td>
                    <div className="vs-action">
                      <button
                        className="vs-act"
                        onClick={() => onSplit(path)}
                        disabled={!canSplit}
                        title={canSplit ? `Split into 2 × /${leaf.prefix + 1}` : (leaf.detached ? 'Subnet has been separated' : 'Cannot split /32')}
                      >Divide</button>
                      <button
                        className="vs-act"
                        onClick={() => onJoin(path.slice(0, -1))}
                        disabled={!canJoin}
                        title="Join with sibling"
                      >Join</button>
                      {canDetach
                        ? <button
                            className="vs-act"
                            onClick={() => onDetach(path)}
                            title="Carve out as its own top-level network in this workspace"
                          >Separate</button>
                        : <button
                            className="vs-act"
                            onClick={() => onReattach(path)}
                            title="Reattach into this network (does not remove the separated copy)"
                          >Reattach</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.VisualV4 = VisualV4;
