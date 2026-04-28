// converters.jsx — CIDR↔Mask + Wildcard / ACL builder + binary view

function CidrMask() {
  const [input, setInput] = React.useState('192.168.1.0/24');
  const parsed = NetLib.v4_parse_cidr(input);

  if (!parsed) {
    return (
      <div className="stack">
        <PageHead title="CIDR ↔ Subnet Mask" sub="Two-way conversion between prefix length and dotted-decimal mask, with binary breakdown." />
        <div className="card"><div className="card-body">
          <Field label="CIDR or IP / mask">
            <div className="input-row">
              <input value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
            </div>
          </Field>
          <div className="pill bad" style={{ marginTop: 12 }}>Invalid input. Try <code>10.0.0.0/16</code></div>
        </div></div>
      </div>
    );
  }

  const net = NetLib.v4_network(parsed.ip, parsed.prefix);
  const mask = NetLib.v4_mask(parsed.prefix);
  const wc = NetLib.v4_wildcard(parsed.prefix);
  const bcast = NetLib.v4_broadcast(parsed.ip, parsed.prefix);
  const klass = NetLib.v4_class(net);
  const priv = NetLib.v4_is_private(net);
  const special = NetLib.v4_is_special(net);

  // Reference table (common prefixes)
  const refs = [];
  for (let p = 8; p <= 32; p++) refs.push(p);

  return (
    <div className="stack">
      <PageHead title="CIDR ↔ Subnet Mask" sub="Two-way conversion with binary breakdown, address class, and special-range identification." />

      <div className="card">
        <div className="card-h">
          <h2>Input</h2>
          <span className="muted">{NetLib.v4_format(net)}/{parsed.prefix}</span>
        </div>
        <div className="card-body">
          <Field label="CIDR notation">
            <div className="input-row">
              <input value={input} onChange={e => setInput(e.target.value)} spellCheck={false} placeholder="10.0.0.0/24" />
            </div>
          </Field>
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <Stat label="Network" value={NetLib.v4_format(net) + '/' + parsed.prefix} mode="accent" lg />
            <Stat label="Subnet mask" value={NetLib.v4_format(mask)} />
            <Stat label="Wildcard mask" value={NetLib.v4_format(wc)} />
            <Stat label="Broadcast" value={NetLib.v4_format(bcast)} />
            <Stat label="Total addresses" value={NetLib.v4_size(parsed.prefix).toLocaleString()} />
            <Stat label="Usable hosts" value={NetLib.v4_usable(parsed.prefix).toLocaleString()} />
            <Stat label="Class" value={klass} mode="dim" />
            <Stat label="Range type" value={priv ? `Private (${priv})` : (special || 'Public')} mode={priv || special ? 'good' : 'dim'} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Binary breakdown</h2><span className="muted">network · host bits</span></div>
        <div className="card-body">
          <div className="binview">
            <div className="lab">Address</div>
            <div className="val">
              <span className="net">{NetLib.v4_to_binary(net).replace(/\./g, '·').slice(0, parsed.prefix + Math.floor(parsed.prefix / 8))}</span>
              <span className="host">{NetLib.v4_to_binary(net).replace(/\./g, '·').slice(parsed.prefix + Math.floor(parsed.prefix / 8))}</span>
            </div>
            <div className="lab">Mask</div>
            <div className="val">
              {NetLib.v4_to_binary(mask).split('').map((c, i) => (
                <span key={i} className={c === '1' ? 'mask-1' : (c === '.' ? '' : 'mask-0')}>{c}</span>
              ))}
            </div>
            <div className="lab">Wildcard</div>
            <div className="val">
              {NetLib.v4_to_binary(wc).split('').map((c, i) => (
                <span key={i} className={c === '1' ? 'mask-1' : (c === '.' ? '' : 'mask-0')}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Quick reference</h2><span className="muted">/8 – /32</span></div>
        <div className="vs-wrap">
          <table className="vs-table">
            <thead>
              <tr>
                <th>CIDR</th><th>Subnet mask</th><th>Wildcard</th><th style={{ textAlign: 'right' }}>Addresses</th><th style={{ textAlign: 'right' }}>Usable</th>
              </tr>
            </thead>
            <tbody>
              {refs.map(p => (
                <tr key={p} style={{ background: p === parsed.prefix ? 'var(--accent-bg)' : undefined }}>
                  <td><div className="vs-cell">/{p}</div></td>
                  <td><div className="vs-cell vs-mask">{NetLib.v4_format(NetLib.v4_mask(p))}</div></td>
                  <td><div className="vs-cell vs-mask">{NetLib.v4_format(NetLib.v4_wildcard(p))}</div></td>
                  <td><div className="vs-cell vs-hosts">{NetLib.v4_size(p).toLocaleString()}</div></td>
                  <td><div className="vs-cell vs-hosts">{NetLib.v4_usable(p).toLocaleString()}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AclBuilder() {
  const [input, setInput] = React.useState('192.168.10.0/24');
  const [action, setAction] = React.useState('permit');
  const [proto, setProto] = React.useState('ip');
  const [destination, setDestination] = React.useState('any');
  const [port, setPort] = React.useState('');
  const [number, setNumber] = React.useState('');
  const parsed = NetLib.v4_parse_cidr(input);

  let lines = [];
  if (parsed) {
    const subnet = { ip: NetLib.v4_network(parsed.ip, parsed.prefix), prefix: parsed.prefix };
    lines = NetLib.acl_lines(action, subnet, { proto, destination, port, number });
  }

  return (
    <div className="stack">
      <PageHead title="Wildcard / ACL Builder" sub="Generate Cisco-style wildcard masks and ready-to-paste extended ACL lines." />

      <div className="card">
        <div className="card-body">
          <div className="form-row">
            <Field label="Source CIDR">
              <div className="input-row">
                <input value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
              </div>
            </Field>
            <Field label="Action">
              <div className="input-row">
                <select
                  value={action}
                  onChange={e => setAction(e.target.value)}
                  style={{ flex: 1, border: 0, background: 'transparent', padding: '9px 12px', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none', color: 'var(--fg)' }}
                >
                  <option value="permit">permit</option>
                  <option value="deny">deny</option>
                </select>
              </div>
            </Field>
            <Field label="Protocol">
              <div className="input-row">
                <select
                  value={proto}
                  onChange={e => setProto(e.target.value)}
                  style={{ flex: 1, border: 0, background: 'transparent', padding: '9px 12px', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none', color: 'var(--fg)' }}
                >
                  <option>ip</option>
                  <option>tcp</option>
                  <option>udp</option>
                  <option>icmp</option>
                </select>
              </div>
            </Field>
            <Field label="Destination">
              <div className="input-row">
                <input value={destination} onChange={e => setDestination(e.target.value)} spellCheck={false} placeholder="any | host x.x.x.x | x.x.x.x y.y.y.y" />
              </div>
            </Field>
            <Field label="Port (optional)" hint="e.g. 22, 80, 443">
              <div className="input-row">
                <input value={port} onChange={e => setPort(e.target.value)} spellCheck={false} />
              </div>
            </Field>
            <Field label="ACL line number (optional)">
              <div className="input-row">
                <input value={number} onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} spellCheck={false} placeholder="10" />
              </div>
            </Field>
          </div>
        </div>
      </div>

      {parsed && (
        <div className="card">
          <div className="card-h">
            <h2>Generated ACL</h2>
            <CopyBtn text={lines.join('\n')} label="Copy lines" />
          </div>
          <div className="card-body">
            <div className="result-block">
              <div className="accent">{lines[0]}</div>
              <div className="dim">{lines[1]}</div>
            </div>
            <div className="stat-grid" style={{ marginTop: 16 }}>
              <Stat label="Source CIDR" value={NetLib.v4_format(NetLib.v4_network(parsed.ip, parsed.prefix)) + '/' + parsed.prefix} />
              <Stat label="Wildcard mask" value={NetLib.v4_format(NetLib.v4_wildcard(parsed.prefix))} mode="accent" />
              <Stat label="Subnet mask" value={NetLib.v4_format(NetLib.v4_mask(parsed.prefix))} mode="dim" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.CidrMask = CidrMask;
window.AclBuilder = AclBuilder;
