// checkers.jsx — IP-in-Subnet, Subnet Compare, Range → CIDR

function IpChecker() {
  const [ip, setIp] = React.useState('192.168.1.42');
  const [cidr, setCidr] = React.useState('192.168.0.0/16');

  const ipParsed = NetLib.v4_parse(ip);
  const cidrParsed = NetLib.v4_parse_cidr(cidr);

  let result = null;
  if (ipParsed !== null && cidrParsed) {
    const net = NetLib.v4_network(cidrParsed.ip, cidrParsed.prefix);
    const bcast = NetLib.v4_broadcast(cidrParsed.ip, cidrParsed.prefix);
    const inRange = ipParsed >= net && ipParsed <= bcast;
    const isNet = ipParsed === net;
    const isBcast = ipParsed === bcast && cidrParsed.prefix < 31;
    result = {
      inRange, isNet, isBcast,
      net, bcast,
      offset: ipParsed - net,
    };
  }

  return (
    <div className="stack">
      <PageHead title="IP-in-Subnet Checker" sub="Verify whether an IP address belongs to a given subnet, and see its position within the range." />
      <div className="card"><div className="card-body">
        <div className="form-row">
          <Field label="IP address">
            <div className="input-row"><input value={ip} onChange={e => setIp(e.target.value)} spellCheck={false} /></div>
          </Field>
          <Field label="Subnet CIDR">
            <div className="input-row"><input value={cidr} onChange={e => setCidr(e.target.value)} spellCheck={false} /></div>
          </Field>
        </div>
        {result && (
          <div className="stat-grid" style={{ marginTop: 18 }}>
            <Stat
              label="Verdict"
              value={result.inRange ? '✓ in subnet' : '✗ outside subnet'}
              mode={result.inRange ? 'good' : 'bad'}
              lg
            />
            <Stat label="Subnet network" value={NetLib.v4_format(result.net)} />
            <Stat label="Subnet broadcast" value={NetLib.v4_format(result.bcast)} />
            <Stat label="Position" value={result.inRange ? `${result.offset.toLocaleString()} of ${(result.bcast - result.net).toLocaleString()}` : '—'} mode="dim" />
            <Stat label="Network address?" value={result.isNet ? 'yes' : 'no'} mode={result.isNet ? 'warn' : 'dim'} />
            <Stat label="Broadcast address?" value={result.isBcast ? 'yes' : 'no'} mode={result.isBcast ? 'warn' : 'dim'} />
          </div>
        )}
        {(ip && ipParsed === null) && <div className="pill bad" style={{ marginTop: 12 }}>Invalid IP address</div>}
        {(cidr && !cidrParsed) && <div className="pill bad" style={{ marginTop: 12 }}>Invalid CIDR</div>}
      </div></div>
    </div>
  );
}

function SubnetCompare() {
  const [a, setA] = React.useState('10.0.0.0/16');
  const [b, setB] = React.useState('10.0.5.0/24');
  const A = NetLib.v4_parse_cidr(a);
  const B = NetLib.v4_parse_cidr(b);

  let verdict = null;
  if (A && B) {
    const overlaps = NetLib.v4_overlaps(A, B);
    const aContainsB = NetLib.v4_contains(A, B);
    const bContainsA = NetLib.v4_contains(B, A);
    const equal = aContainsB && bContainsA;
    let label, mode;
    if (equal) { label = 'Identical'; mode = 'accent'; }
    else if (aContainsB) { label = 'A contains B'; mode = 'good'; }
    else if (bContainsA) { label = 'B contains A'; mode = 'good'; }
    else if (overlaps) { label = 'Overlap (partial)'; mode = 'bad'; }
    else { label = 'Disjoint'; mode = 'dim'; }
    verdict = { label, mode, overlaps };
  }

  return (
    <div className="stack">
      <PageHead title="Subnet Compare" sub="Check whether two subnets overlap, contain each other, or are disjoint — useful for VPC peering and ACL design." />
      <div className="card"><div className="card-body">
        <div className="form-row">
          <Field label="Subnet A">
            <div className="input-row"><input value={a} onChange={e => setA(e.target.value)} spellCheck={false} /></div>
          </Field>
          <Field label="Subnet B">
            <div className="input-row"><input value={b} onChange={e => setB(e.target.value)} spellCheck={false} /></div>
          </Field>
        </div>
        {verdict && A && B && (
          <div className="stat-grid" style={{ marginTop: 18 }}>
            <Stat label="Relationship" value={verdict.label} mode={verdict.mode} lg />
            <Stat label="A range" value={`${NetLib.v4_format(NetLib.v4_network(A.ip, A.prefix))} – ${NetLib.v4_format(NetLib.v4_broadcast(A.ip, A.prefix))}`} />
            <Stat label="B range" value={`${NetLib.v4_format(NetLib.v4_network(B.ip, B.prefix))} – ${NetLib.v4_format(NetLib.v4_broadcast(B.ip, B.prefix))}`} />
            <Stat label="A size" value={NetLib.v4_size(A.prefix).toLocaleString()} mode="dim" />
            <Stat label="B size" value={NetLib.v4_size(B.prefix).toLocaleString()} mode="dim" />
          </div>
        )}
      </div></div>
    </div>
  );
}

function RangeToCidr() {
  const [start, setStart] = React.useState('192.168.1.10');
  const [end, setEnd] = React.useState('192.168.3.200');
  const result = NetLib.v4_range_to_cidrs(start, end);

  return (
    <div className="stack">
      <PageHead title="Range → CIDR" sub="Aggregate an arbitrary IP range into the smallest set of CIDR blocks. Useful for route summarization and firewall rules." />
      <div className="card"><div className="card-body">
        <div className="form-row">
          <Field label="Start IP">
            <div className="input-row"><input value={start} onChange={e => setStart(e.target.value)} spellCheck={false} /></div>
          </Field>
          <Field label="End IP">
            <div className="input-row"><input value={end} onChange={e => setEnd(e.target.value)} spellCheck={false} /></div>
          </Field>
        </div>
        {!result && (start || end) && <div className="pill bad" style={{ marginTop: 12 }}>Invalid range (start must be ≤ end and both must be valid IPs)</div>}
        {result && (
          <div style={{ marginTop: 18 }}>
            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <Stat label="CIDR blocks" value={result.length} mode="accent" lg />
              <Stat label="Total addresses" value={result.reduce((s, b) => s + NetLib.v4_size(b.prefix), 0).toLocaleString()} />
            </div>
            <div className="card-h" style={{ borderTop: '1px solid var(--line)' }}>
              <h2>Aggregated CIDRs</h2>
              <CopyBtn text={result.map(b => `${NetLib.v4_format(b.ip)}/${b.prefix}`).join('\n')} />
            </div>
            <div className="result-block" style={{ borderRadius: 0 }}>
              {result.map((b, i) => (
                <div key={i}>
                  <span className="dim">{String(i + 1).padStart(2, '0')}</span>{'  '}
                  <span className="accent">{NetLib.v4_format(b.ip)}/{b.prefix}</span>
                  <span className="dim">  ({NetLib.v4_size(b.prefix).toLocaleString()} addresses)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div></div>
    </div>
  );
}

window.IpChecker = IpChecker;
window.SubnetCompare = SubnetCompare;
window.RangeToCidr = RangeToCidr;
