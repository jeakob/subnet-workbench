// visual-v4.jsx — IPv4 Visual Subnet Calculator (split/join/notes/colors)

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

// Pull initial state from URL hash if present, else local default
function vsLoadInitial() {
  try {
    const h = window.location.hash;
    if (h && h.startsWith('#v4=')) {
      const data = JSON.parse(atob(decodeURIComponent(h.slice(4))));
      return {
        ip: data.root.ip,
        prefix: data.root.prefix,
        tree: NetLib.vs_deserialize(data),
      };
    }
  } catch (e) {}
  const ip = NetLib.v4_parse('10.0.0.0');
  return { ip, prefix: 16, tree: NetLib.vs_make_root(ip, 16) };
}

function VisualV4() {
  const initial = React.useMemo(vsLoadInitial, []);
  const [networkStr, setNetworkStr] = React.useState(NetLib.v4_format(initial.ip));
  const [prefixStr, setPrefixStr] = React.useState(String(initial.prefix));
  const [tree, setTree] = React.useState(initial.tree);
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

  // Persist tree to URL hash for shareable links
  React.useEffect(() => {
    const data = NetLib.vs_serialize(tree);
    const enc = btoa(JSON.stringify(data));
    history.replaceState(null, '', '#v4=' + enc);
  }, [tree]);

  function applyNetwork() {
    setError('');
    const ip = NetLib.v4_parse(networkStr);
    const p = parseInt(prefixStr, 10);
    if (ip === null) { setError('Invalid IP address'); return; }
    if (!Number.isFinite(p) || p < 0 || p > 32) { setError('Prefix must be 0–32'); return; }
    const aligned = NetLib.v4_network(ip, p) >>> 0;
    if (aligned !== ip) {
      setNetworkStr(NetLib.v4_format(aligned));
    }
    setTree(NetLib.vs_make_root(aligned, p));
  }

  function reset() {
    if (!confirm('Reset all subnet divisions?')) return;
    const ip = NetLib.v4_parse(networkStr) || NetLib.v4_parse('10.0.0.0');
    const p = parseInt(prefixStr, 10) || 16;
    setTree(NetLib.vs_make_root(NetLib.v4_network(ip, p), p));
  }

  function splitAt(path) {
    const node = NetLib.vs_at_path(tree, path);
    if (!node || !node.leaf || node.prefix >= 32) return;
    setTree(NetLib.vs_replace(tree, path, NetLib.vs_split(node)));
  }

  function joinAt(path) {
    const node = NetLib.vs_at_path(tree, path);
    if (!node || !NetLib.vs_can_join(node)) return;
    setTree(NetLib.vs_replace(tree, path, NetLib.vs_join(node)));
  }

  function setLeafProp(path, prop, value) {
    const node = NetLib.vs_at_path(tree, path);
    if (!node || !node.leaf) return;
    setTree(NetLib.vs_replace(tree, path, { ...node, [prop]: value }));
  }

  function exportData() {
    const data = NetLib.vs_serialize(tree);
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subnets-${networkStr}-${prefixStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function shareLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }

  // Collect leaves into rendering rows
  const rows = [];
  NetLib.vs_walk_leaves(tree, (leaf, path) => {
    rows.push({ leaf, path });
  });

  // Stats
  const totalAddresses = NetLib.v4_size(tree.prefix);
  const subnetCount = rows.length;

  return (
    <div className="stack">
      <PageHead
        title="Visual Subnet Calculator"
        sub="Recursively split or join subnets, annotate them with notes and colors, and share the layout via URL."
      />

      <div className="card">
        <div className="card-h">
          <h2>Network</h2>
          <span className="muted">{NetLib.v4_format(tree.ip)}/{tree.prefix}</span>
        </div>
        <div className="card-body">
          <div className="form-row" style={{ alignItems: 'end' }}>
            <Field label="Network address">
              <div className="input-row">
                <input
                  value={networkStr}
                  onChange={e => setNetworkStr(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyNetwork()}
                  placeholder="10.0.0.0"
                  spellCheck={false}
                />
              </div>
            </Field>
            <Field label="Prefix">
              <div className="input-row">
                <span className="slash">/</span>
                <input
                  className="prefix-input"
                  value={prefixStr}
                  onChange={e => setPrefixStr(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onKeyDown={e => e.key === 'Enter' && applyNetwork()}
                />
              </div>
            </Field>
            <Field label=" ">
              <div className="btn-group">
                <button className="btn btn-primary" onClick={applyNetwork}>Update</button>
                <button className="btn btn-ghost" onClick={reset}>Reset</button>
              </div>
            </Field>
          </div>
          {error && <div className="pill bad" style={{ marginTop: 12 }}>{error}</div>}
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <Stat label="Subnets" value={subnetCount} mode="accent" />
            <Stat label="Total addresses" value={totalAddresses.toLocaleString()} />
            <Stat label="Netmask" value={NetLib.v4_format(NetLib.v4_mask(tree.prefix))} />
            <Stat label="Wildcard" value={NetLib.v4_format(NetLib.v4_wildcard(tree.prefix))} />
          </div>
        </div>
      </div>

      <div className="card">
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
          <div className="vs-tb-r">
            <button className="btn btn-sm btn-ghost" onClick={shareLink}>Copy share link</button>
            <button className="btn btn-sm btn-ghost" onClick={exportData}>Export JSON</button>
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
                const total = NetLib.v4_size(leaf.prefix);
                const colorClass = leaf.color ? `colored tint-${leaf.color}` : '';
                const canSplit = leaf.prefix < 32;
                // Check if joinable: parent must exist & sibling must be a leaf
                let canJoin = false;
                if (path.length > 0) {
                  const parentPath = path.slice(0, -1);
                  const parent = NetLib.vs_at_path(tree, parentPath);
                  if (parent && !parent.leaf && parent.left.leaf && parent.right.leaf) canJoin = true;
                }
                return (
                  <tr key={path.join('') + '-' + leaf.prefix + '-' + leaf.ip} className={colorClass}>
                    {cols.subnet && (
                      <td>
                        <div className="vs-cell vs-subnet">
                          <span>{NetLib.v4_format(net)}</span>
                          <span className="vs-prefix">/{leaf.prefix}</span>
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
                          onChange={e => setLeafProp(path, 'note', e.target.value)}
                          placeholder="add a note"
                        />
                      </td>
                    )}
                    {cols.color && (
                      <td>
                        <div className="vs-color">
                          <span
                            className={'vs-swatch clear' + (!leaf.color ? ' active' : '')}
                            onClick={() => setLeafProp(path, 'color', undefined)}
                            title="No color"
                          >×</span>
                          {VS_COLORS.map(c => (
                            <span
                              key={c.key}
                              className={'vs-swatch' + (leaf.color === c.key ? ' active' : '')}
                              style={{ background: c.css }}
                              onClick={() => setLeafProp(path, 'color', c.key)}
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
                          onClick={() => splitAt(path)}
                          disabled={!canSplit}
                          title={canSplit ? `Split into 2 × /${leaf.prefix + 1}` : 'Cannot split /32'}
                        >Divide</button>
                        <button
                          className="vs-act"
                          onClick={() => joinAt(path.slice(0, -1))}
                          disabled={!canJoin}
                          title="Join with sibling"
                        >Join</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="foot">
        Layout persists in the URL — bookmark or share the page to save.
        Inspired by the original <a href="https://www.davidc.net/sites/default/subnets/subnets.html" target="_blank" rel="noopener">davidc.net</a> Visual Subnet Calculator.
      </div>
    </div>
  );
}

window.VisualV4 = VisualV4;
