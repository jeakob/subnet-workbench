// summary.jsx — Subnet/Route Summarization tool.
// Handles arbitrary lists of CIDRs (v4 + v6), produces:
//   • Single supernet (smallest covering CIDR) — the classic "summary route"
//   • Optimal aggregation (minimal disjoint CIDR set covering exactly the union)
//   • Overlap + over-coverage analysis
//   • Cisco-style "ip route" / "ipv6 route" snippets and prefix-list output

const SUMMARY_EXAMPLES = {
  contig_v4: `# Four adjacent /24s that summarize to a /22
192.168.0.0/24
192.168.1.0/24
192.168.2.0/24
192.168.3.0/24`,
  discontig_v4: `# Discontiguous — note the over-coverage in the summary
10.1.1.0/24
10.1.3.0/24
10.1.7.0/24`,
  mixed_v4: `# Mixed prefix lengths + overlap
172.16.0.0/16
172.16.64.0/18
172.17.0.0/24
172.18.0.0/23
172.18.2.0/24`,
  v6_block: `# IPv6 — adjacent /48s summarize to a /46
2001:db8:0::/48
2001:db8:1::/48
2001:db8:2::/48
2001:db8:3::/48`,
};

function SubnetSummary() {
  const [text, setText] = React.useState(SUMMARY_EXAMPLES.contig_v4);
  const [mode, setMode] = React.useState('auto'); // auto | v4 | v6

  // Detect family
  const detected = React.useMemo(() => {
    if (mode !== 'auto') return mode;
    return /:/.test(text) ? 'v6' : 'v4';
  }, [text, mode]);

  if (detected === 'v6') {
    return (
      <SummaryShell text={text} setText={setText} mode={mode} setMode={setMode} family="v6">
        <SummaryV6 text={text} />
      </SummaryShell>
    );
  }
  return (
    <SummaryShell text={text} setText={setText} mode={mode} setMode={setMode} family="v4">
      <SummaryV4 text={text} />
    </SummaryShell>
  );
}

function SummaryShell({ text, setText, mode, setMode, family, children }) {
  return (
    <div className="stack">
      <PageHead
        title="Subnet Summary / Aggregation"
        sub="Aggregate a list of routes into a single supernet or an optimal CIDR set. Accepts CIDR, IP+mask, and range syntax — handles overlapping inputs, over-coverage, and IPv6."
      />

      <div className="card">
        <div className="card-h">
          <h2>Input</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="muted">detected: {family.toUpperCase()}</span>
            <div className="seg">
              {['auto', 'v4', 'v6'].map(m => (
                <button
                  key={m}
                  className={'seg-btn' + (mode === m ? ' active' : '')}
                  onClick={() => setMode(m)}
                >{m === 'auto' ? 'auto' : m.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="card-body">
          <textarea
            className="ta-mono"
            value={text}
            onChange={e => setText(e.target.value)}
            spellCheck={false}
            rows={8}
            placeholder={'10.0.0.0/24\n10.0.1.0/24\n10.0.2.0-10.0.2.255'}
          />
          <div className="example-row">
            <span className="muted">Examples:</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setText(SUMMARY_EXAMPLES.contig_v4)}>Contiguous /24s</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setText(SUMMARY_EXAMPLES.discontig_v4)}>Discontiguous</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setText(SUMMARY_EXAMPLES.mixed_v4)}>Overlapping</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setText(SUMMARY_EXAMPLES.v6_block)}>IPv6</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setText('')}>Clear</button>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

function SummaryV4({ text }) {
  const parsed = React.useMemo(() => NetLib.v4_parse_list(text), [text]);
  if (!parsed.ok.length) {
    return (
      <div className="card"><div className="card-body">
        <div className="pill dim">Enter at least one CIDR or IP/mask to compute a summary.</div>
        {parsed.bad.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ marginBottom: 6 }}>Unparseable lines:</div>
            {parsed.bad.map((b, i) => (
              <div key={i} className="pill bad" style={{ marginRight: 6, marginBottom: 6 }}>
                {b.raw} — {b.reason}
              </div>
            ))}
          </div>
        )}
      </div></div>
    );
  }

  const summary = NetLib.v4_summary(parsed.ok);
  const agg = NetLib.v4_aggregate(parsed.ok);
  const commonBits = NetLib.v4_common_bits(parsed.ok);

  const wastePct = summary.summary_size > 0 ? (summary.waste / summary.summary_size) * 100 : 0;
  const summaryStr = NetLib.v4_format(summary.ip) + '/' + summary.prefix;
  const summaryMask = NetLib.v4_format(NetLib.v4_mask(summary.prefix));
  const summaryWildcard = NetLib.v4_format(NetLib.v4_wildcard(summary.prefix));

  const ciscoRoutes = agg.cidrs.map(c =>
    `ip route ${NetLib.v4_format(c.ip)} ${NetLib.v4_format(NetLib.v4_mask(c.prefix))} <next-hop>`
  ).join('\n');
  const prefixList = agg.cidrs.map((c, i) =>
    `ip prefix-list AGG seq ${(i + 1) * 5} permit ${NetLib.v4_format(c.ip)}/${c.prefix}`
  ).join('\n');
  const summaryRouteLine = `ip route ${NetLib.v4_format(summary.ip)} ${summaryMask} <next-hop>`;

  return (
    <React.Fragment>
      {/* Single supernet */}
      <div className="card">
        <div className="card-h">
          <h2>Single supernet</h2>
          <CopyBtn text={summaryStr} label="Copy CIDR" />
        </div>
        <div className="card-body">
          <div className="hero-cidr">
            <div className="hero-cidr-main">{summaryStr}</div>
            <div className="hero-cidr-sub">
              {summary.exact
                ? <span className="pill good">exact — no over-coverage</span>
                : <span className="pill warn">{`covers extra ${summary.waste.toLocaleString()} address${summary.waste === 1 ? '' : 'es'} (${wastePct.toFixed(1)}%)`}</span>}
            </div>
          </div>
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <Stat label="Subnet mask" value={summaryMask} />
            <Stat label="Wildcard" value={summaryWildcard} mode="dim" />
            <Stat label="Range" value={`${NetLib.v4_format(summary.lo)} – ${NetLib.v4_format(summary.hi)}`} />
            <Stat label="Common leading bits" value={commonBits} mode="accent" />
            <Stat label="Inputs (lines)" value={parsed.ok.length} />
            <Stat label="Requested addresses" value={summary.requested_size.toLocaleString()} />
            <Stat label="Summary covers" value={summary.summary_size.toLocaleString()} />
            <Stat label="Over-coverage" value={summary.waste.toLocaleString()} mode={summary.waste === 0 ? 'good' : 'warn'} />
          </div>
          {agg.overlaps.length > 0 && (
            <div className="pill warn" style={{ marginTop: 12, display: 'inline-flex' }}>
              {`⚠ ${agg.overlaps.length} overlap${agg.overlaps.length === 1 ? '' : 's'} detected in input — see Aggregation section`}
            </div>
          )}
        </div>
      </div>

      {/* Optimal aggregation */}
      <div className="card">
        <div className="card-h">
          <h2>Optimal aggregation</h2>
          <span className="muted">{agg.cidrs.length} CIDR{agg.cidrs.length === 1 ? '' : 's'} — exact coverage of union</span>
        </div>
        <div className="card-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Minimal disjoint CIDR set whose union equals exactly the union of your inputs.
            Adjacent and overlapping inputs are merged; nothing extra is covered.
          </p>
          <div className="vs-wrap" style={{ border: '1px solid var(--line)', borderRadius: 8, marginTop: 12 }}>
            <table className="vs-table">
              <thead>
                <tr>
                  <th>Aggregate</th>
                  <th>Netmask</th>
                  <th>Range</th>
                  <th style={{ textAlign: 'right' }}># Addresses</th>
                </tr>
              </thead>
              <tbody>
                {agg.cidrs.map((c, i) => (
                  <tr key={i}>
                    <td><div className="vs-cell vs-subnet">
                      <span>{NetLib.v4_format(c.ip)}</span>
                      <span className="vs-prefix">/{c.prefix}</span>
                    </div></td>
                    <td><div className="vs-cell vs-mask">{NetLib.v4_format(NetLib.v4_mask(c.prefix))}</div></td>
                    <td><div className="vs-cell vs-range">
                      {NetLib.v4_format(c.ip)} – {NetLib.v4_format(NetLib.v4_broadcast(c.ip, c.prefix))}
                    </div></td>
                    <td><div className="vs-cell vs-hosts">{NetLib.v4_size(c.prefix).toLocaleString()}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {agg.overlaps.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ marginBottom: 6 }}>Overlapping inputs (merged automatically):</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {agg.overlaps.map((o, i) => (
                  <span key={i} className="pill warn">
                    {`${NetLib.v4_format(o.a.ip)}/${o.a.prefix} ∩ ${NetLib.v4_format(o.b.ip)}/${o.b.prefix}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cisco / Junos snippets */}
      <div className="card">
        <div className="card-h">
          <h2>Router config snippets</h2>
          <span className="muted">Cisco IOS-style</span>
        </div>
        <div className="card-body">
          <SnippetBlock label="Summary route (single supernet)" body={summaryRouteLine} />
          <SnippetBlock label={`Aggregated static routes (${agg.cidrs.length})`} body={ciscoRoutes} />
          <SnippetBlock label="Prefix-list (for BGP / route-map filtering)" body={prefixList} />
        </div>
      </div>

      {parsed.bad.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Unparseable lines</h2></div>
          <div className="card-body">
            {parsed.bad.map((b, i) => (
              <div key={i} className="pill bad" style={{ marginRight: 6, marginBottom: 6 }}>
                {b.raw} — {b.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

function SummaryV6({ text }) {
  // Simple v6 parser inline (no equivalent v6_parse_list in netlib yet)
  const parsed = React.useMemo(() => {
    const ok = [], bad = [];
    const lines = (text || '').split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    for (const raw of lines) {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      const c = NetLib.v6_parse_cidr(line);
      if (c) { ok.push({ ...c, raw }); continue; }
      // Bare IPv6 → /128
      const ip = NetLib.v6_parse(line);
      if (ip !== null) { ok.push({ ip, prefix: 128, raw }); continue; }
      bad.push({ raw, reason: 'unparseable IPv6' });
    }
    return { ok, bad };
  }, [text]);

  if (!parsed.ok.length) {
    return (
      <div className="card"><div className="card-body">
        <div className="pill dim">Enter at least one IPv6 CIDR.</div>
        {parsed.bad.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {parsed.bad.map((b, i) => (
              <div key={i} className="pill bad" style={{ marginRight: 6, marginBottom: 6 }}>
                {b.raw} — {b.reason}
              </div>
            ))}
          </div>
        )}
      </div></div>
    );
  }

  const summary = NetLib.v6_summary(parsed.ok);
  const summaryStr = NetLib.v6_format(summary.ip) + '/' + summary.prefix;
  // Format big numbers safely
  const fmtBig = n => n > 10n ** 18n ? n.toString().slice(0, 20) + '…' : n.toLocaleString('en-US');

  const ciscoRoute = `ipv6 route ${summaryStr} <next-hop>`;

  return (
    <React.Fragment>
      <div className="card">
        <div className="card-h">
          <h2>Single supernet</h2>
          <CopyBtn text={summaryStr} label="Copy CIDR" />
        </div>
        <div className="card-body">
          <div className="hero-cidr">
            <div className="hero-cidr-main">{summaryStr}</div>
            <div className="hero-cidr-sub">
              {summary.exact
                ? <span className="pill good">exact — no over-coverage</span>
                : <span className="pill warn">covers extra addresses (sparse input)</span>}
            </div>
          </div>
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <Stat label="Prefix" value={'/' + summary.prefix} mode="accent" />
            <Stat label="Range start" value={NetLib.v6_format(summary.lo)} />
            <Stat label="Range end" value={NetLib.v6_format(summary.hi)} />
            <Stat label="Inputs" value={parsed.ok.length} />
            <Stat label="Requested size" value={fmtBig(summary.requested_size)} />
            <Stat label="Summary size" value={fmtBig(summary.summary_size)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Router config snippet</h2><span className="muted">Cisco IOS-style</span></div>
        <div className="card-body">
          <SnippetBlock label="Summary route" body={ciscoRoute} />
        </div>
      </div>
    </React.Fragment>
  );
}

function SnippetBlock({ label, body }) {
  if (!body) return null;
  return (
    <div className="snippet">
      <div className="snippet-h">
        <span>{label}</span>
        <CopyBtn text={body} />
      </div>
      <pre className="snippet-body">{body}</pre>
    </div>
  );
}

window.SubnetSummary = SubnetSummary;
