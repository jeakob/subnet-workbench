// visual-v6.jsx — IPv6 Subnet Calculator

function VisualV6() {
  const [input, setInput] = React.useState('2001:db8::/48');
  const [splitTo, setSplitTo] = React.useState('64');
  const [parsed, setParsed] = React.useState(null);
  const [error, setError] = React.useState('');
  const [mac, setMac] = React.useState('00:1a:2b:3c:4d:5e');

  React.useEffect(() => {
    const c = NetLib.v6_parse_cidr(input);
    if (!c) { setParsed(null); setError(input ? 'Invalid IPv6 CIDR' : ''); return; }
    setParsed(c); setError('');
  }, [input]);

  if (!parsed) {
    return (
      <div className="stack">
        <PageHead title="IPv6 Subnet Calculator" sub="Parse, normalize, and split IPv6 prefixes." />
        <div className="card"><div className="card-body">
          <Field label="IPv6 CIDR">
            <div className="input-row">
              <input value={input} onChange={e => setInput(e.target.value)} spellCheck={false} placeholder="2001:db8::/48" />
            </div>
          </Field>
          {error && <div className="pill bad" style={{ marginTop: 12 }}>{error}</div>}
        </div></div>
      </div>
    );
  }

  const net = NetLib.v6_network(parsed.ip, parsed.prefix);
  const last = NetLib.v6_last(parsed.ip, parsed.prefix);
  const splitN = parseInt(splitTo, 10);
  const valid = Number.isFinite(splitN) && splitN >= parsed.prefix && splitN <= 128;
  const newSubnetCount = valid ? (1n << BigInt(splitN - parsed.prefix)) : 0n;

  // Generate first 16 subnets at split prefix as preview
  const previews = [];
  if (valid) {
    const step = NetLib.v6_size(splitN);
    const max = newSubnetCount > 16n ? 16n : newSubnetCount;
    let cur = net;
    for (let i = 0n; i < max; i++) {
      previews.push({ ip: cur, prefix: splitN });
      cur = cur + step;
    }
  }

  // EUI-64
  const ifid = NetLib.v6_eui64(mac);

  return (
    <div className="stack">
      <PageHead title="IPv6 Subnet Calculator" sub="Parse, normalize, split prefixes, and derive EUI-64 interface IDs." />

      <div className="card">
        <div className="card-h">
          <h2>Prefix</h2>
          <span className="muted">{NetLib.v6_format(net)}/{parsed.prefix}</span>
        </div>
        <div className="card-body">
          <Field label="IPv6 CIDR">
            <div className="input-row">
              <input value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
            </div>
          </Field>
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <Stat label="Compressed" value={NetLib.v6_format(net) + '/' + parsed.prefix} mode="accent" lg />
            <Stat label="Expanded" value={NetLib.v6_format(net, { full: true })} />
            <Stat label="First address" value={NetLib.v6_format(net)} />
            <Stat label="Last address" value={NetLib.v6_format(last)} />
            <Stat label="Address space" value={NetLib.v6_size_human(parsed.prefix)} />
            <Stat label="Type" value={NetLib.v6_type(parsed.ip)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Split into smaller prefixes</h2>
          <span className="muted">/ {parsed.prefix} → / {valid ? splitN : '?'}</span>
        </div>
        <div className="card-body">
          <div className="form-row" style={{ alignItems: 'end' }}>
            <Field label="New prefix length" hint={`Allowed: /${parsed.prefix} – /128`}>
              <div className="input-row">
                <span className="slash">/</span>
                <input
                  className="prefix-input"
                  value={splitTo}
                  onChange={e => setSplitTo(e.target.value.replace(/\D/g, '').slice(0, 3))}
                />
              </div>
            </Field>
            <Field label="Number of new subnets">
              <div className="result-block" style={{ padding: '9px 12px' }}>
                {valid ? (newSubnetCount <= 1000000n ? newSubnetCount.toLocaleString() : '2^' + (splitN - parsed.prefix)) : '—'}
              </div>
            </Field>
          </div>
          {valid && previews.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="label">First {previews.length} of {newSubnetCount.toLocaleString ? (newSubnetCount <= 1000000n ? newSubnetCount.toLocaleString() : '2^' + (splitN - parsed.prefix)) : 'many'} subnets</div>
              <div className="result-block">
                {previews.map((s, i) => (
                  <div key={i}>
                    <span className="dim">{String(i).padStart(3, '0')}</span>{'  '}
                    <span className="accent">{NetLib.v6_format(s.ip)}</span>/{s.prefix}
                  </div>
                ))}
                {newSubnetCount > 16n && <div className="dim">… {(newSubnetCount - 16n).toLocaleString ? '+' + (newSubnetCount - 16n).toString() : '…'} more</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>EUI-64 interface ID from MAC</h2>
          <span className="muted">RFC 4291 modified EUI-64</span>
        </div>
        <div className="card-body">
          <Field label="MAC address" hint="Any common formatting accepted (00:1a:2b:3c:4d:5e, 001a.2b3c.4d5e, etc.)">
            <div className="input-row">
              <input value={mac} onChange={e => setMac(e.target.value)} spellCheck={false} />
            </div>
          </Field>
          {ifid && (
            <div className="stat-grid" style={{ marginTop: 16 }}>
              <Stat label="Interface ID" value={ifid} mode="accent" />
              <Stat label="Full address (with prefix above)" value={
                NetLib.v6_format(net | NetLib.v6_parse('::' + ifid))
              } />
            </div>
          )}
          {!ifid && mac && <div className="pill bad" style={{ marginTop: 12 }}>Invalid MAC address</div>}
        </div>
      </div>
    </div>
  );
}

window.VisualV6 = VisualV6;
