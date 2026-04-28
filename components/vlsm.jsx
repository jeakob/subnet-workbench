// vlsm.jsx — VLSM Planner

function VlsmPlanner() {
  const [parent, setParent] = React.useState('10.0.0.0/16');
  const [reqs, setReqs] = React.useState([
    { name: 'HQ',         hosts: 500 },
    { name: 'Branch A',   hosts: 100 },
    { name: 'Branch B',   hosts: 50 },
    { name: 'Servers',    hosts: 25 },
    { name: 'Link to ISP', hosts: 2 },
  ]);

  const parsed = NetLib.v4_parse_cidr(parent);
  let alloc = null;
  if (parsed && reqs.length) {
    alloc = NetLib.v4_vlsm({ ip: NetLib.v4_network(parsed.ip, parsed.prefix), prefix: parsed.prefix }, reqs);
  }

  function setReq(i, field, value) {
    const next = [...reqs];
    next[i] = { ...next[i], [field]: value };
    setReqs(next);
  }
  function addReq() { setReqs([...reqs, { name: '', hosts: 10 }]); }
  function removeReq(i) { setReqs(reqs.filter((_, idx) => idx !== i)); }

  return (
    <div className="stack">
      <PageHead title="VLSM Planner" sub="Variable Length Subnet Masking — give your host requirements, get an optimal subnet allocation in the right block-size order." />
      <div className="card">
        <div className="card-h"><h2>Parent network</h2><span className="muted">{parent}</span></div>
        <div className="card-body">
          <Field label="Parent CIDR">
            <div className="input-row"><input value={parent} onChange={e => setParent(e.target.value)} spellCheck={false} /></div>
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Requirements</h2>
          <button className="btn btn-sm" onClick={addReq}>+ Add subnet</button>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: 8, marginBottom: 8 }}>
            <div className="label" style={{ margin: 0 }}>Name</div>
            <div className="label" style={{ margin: 0, textAlign: 'right' }}>Hosts</div>
            <div></div>
          </div>
          {reqs.map((r, i) => (
            <div key={i} className="vlsm-row">
              <input value={r.name} onChange={e => setReq(i, 'name', e.target.value)} placeholder="Department" />
              <input
                className="num-input"
                value={r.hosts}
                onChange={e => setReq(i, 'hosts', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
              />
              <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removeReq(i)} title="Remove">×</button>
            </div>
          ))}
        </div>
      </div>

      {alloc && alloc.error && (
        <div className="card"><div className="card-body">
          <div className="pill bad">{alloc.error}</div>
        </div></div>
      )}
      {alloc && alloc.allocations && (
        <div className="card">
          <div className="card-h"><h2>Allocation</h2>
            <span className="muted">{alloc.allocations.length} subnets · {alloc.used.toLocaleString()} / {alloc.total.toLocaleString()} addresses used</span>
          </div>
          <div className="vs-wrap">
            <table className="vlsm-table">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>CIDR</th><th>Mask</th><th>Range</th><th>Usable</th><th className="num">Hosts</th><th className="num">Block</th>
                </tr>
              </thead>
              <tbody>
                {alloc.allocations.map((a, i) => {
                  const bcast = NetLib.v4_broadcast(a.ip, a.prefix);
                  const first = NetLib.v4_first_host(a.ip, a.prefix);
                  const last = NetLib.v4_last_host(a.ip, a.prefix);
                  return (
                    <tr key={i}>
                      <td className="num">{i + 1}</td>
                      <td>{a.name || <span style={{ color: 'var(--fg-dim)' }}>(unnamed)</span>}</td>
                      <td><span style={{ color: 'var(--accent)' }}>{NetLib.v4_format(a.ip)}/{a.prefix}</span></td>
                      <td>{NetLib.v4_format(NetLib.v4_mask(a.prefix))}</td>
                      <td>{NetLib.v4_format(a.ip)} – {NetLib.v4_format(bcast)}</td>
                      <td>{a.prefix >= 31 ? `${NetLib.v4_format(a.ip)} – ${NetLib.v4_format(bcast)}` : `${NetLib.v4_format(first)} – ${NetLib.v4_format(last)}`}</td>
                      <td className="num">{NetLib.v4_usable(a.prefix).toLocaleString()}</td>
                      <td className="num">{a.size.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <div className="stat-grid">
              <Stat label="Used" value={alloc.used.toLocaleString()} mode="accent" />
              <Stat label="Free" value={alloc.free.toLocaleString()} mode="good" />
              <Stat label="Efficiency" value={((alloc.used / alloc.total) * 100).toFixed(1) + '%'} mode="dim" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.VlsmPlanner = VlsmPlanner;
