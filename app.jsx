// app.jsx — top-level shell: tab switcher, theme/Tweaks panel.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#6ee7e7",
  "density": "regular"
}/*EDITMODE-END*/;

const TABS = [
  { id: 'visual',   label: 'Visual',         comp: 'VisualV4' },
  { id: 'ipv6',     label: 'IPv6',           comp: 'VisualV6' },
  { id: 'cidr',     label: 'CIDR ↔ Mask',    comp: 'CidrMask' },
  { id: 'acl',      label: 'Wildcard / ACL', comp: 'AclBuilder' },
  { id: 'check',    label: 'IP Check',       comp: 'IpChecker' },
  { id: 'compare',  label: 'Compare',        comp: 'SubnetCompare' },
  { id: 'range',    label: 'Range → CIDR',   comp: 'RangeToCidr' },
  { id: 'vlsm',     label: 'VLSM',           comp: 'VlsmPlanner' },
  { id: 'summary',  label: 'Summarise',      comp: 'SubnetSummary' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = React.useState(() => {
    const h = window.location.hash;
    const m = h.match(/^#tab=([a-z0-9]+)/);
    if (m && TABS.find(x => x.id === m[1])) return m[1];
    if (h.startsWith('#v4=')) return 'visual';
    return 'visual';
  });

  // Apply theme + accent
  React.useEffect(() => {
    document.body.dataset.theme = t.theme;
    document.body.dataset.density = t.density;
    document.documentElement.style.setProperty('--accent', t.accent);
    // Derive a slightly stronger accent for hovers
    document.documentElement.style.setProperty('--accent-strong', t.accent);
  }, [t.theme, t.accent, t.density]);

  // Tab persistence (only when not on visual which uses #v4=)
  function selectTab(id) {
    setTab(id);
    if (id !== 'visual') history.replaceState(null, '', '#tab=' + id);
  }

  const TabComp = window[TABS.find(x => x.id === tab).comp];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            {/* connection lines from central hub to 4 outer nodes */}
            <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.55" fill="none">
              <line x1="16" y1="16" x2="6" y2="6"/>
              <line x1="16" y1="16" x2="26" y2="6"/>
              <line x1="16" y1="16" x2="6" y2="26"/>
              <line x1="16" y1="16" x2="26" y2="26"/>
            </g>
            {/* 4 outer nodes (subnets) */}
            <g fill="currentColor" opacity="0.85">
              <circle cx="6" cy="6" r="3"/>
              <circle cx="26" cy="6" r="3"/>
              <circle cx="6" cy="26" r="3"/>
              <circle cx="26" cy="26" r="3"/>
            </g>
            {/* central hub */}
            <circle cx="16" cy="16" r="4.5" fill="currentColor"/>
            <circle cx="16" cy="16" r="1.8" fill="var(--bg)"/>
          </svg>
          <span>Subnet Workbench</span>
          <sub>v1</sub>
        </div>
        <nav className="tabs">
          {TABS.map(x => (
            <button
              key={x.id}
              className="tab"
              data-active={x.id === tab ? '1' : '0'}
              onClick={() => selectTab(x.id)}
            >{x.label}</button>
          ))}
        </nav>
        <div className="topbar-r">
          <button
            className="icon-btn"
            title="Toggle theme"
            onClick={() => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark')}
          >{t.theme === 'dark' ? '☾' : '☼'}</button>
        </div>
      </header>
      <main className="main">
        {TabComp ? <TabComp /> : <div className="empty-hint">Tab not found</div>}
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={['dark', 'light']}
          onChange={v => setTweak('theme', v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={v => setTweak('density', v)}
        />
        <TweakColor
          label="Accent"
          value={t.accent}
          onChange={v => setTweak('accent', v)}
        />
        <TweakSection label="Quick presets" />
        <TweakButton label="Cyan (default)" onClick={() => setTweak('accent', '#6ee7e7')} secondary />
        <TweakButton label="Amber" onClick={() => setTweak('accent', '#f0c674')} secondary />
        <TweakButton label="Mint" onClick={() => setTweak('accent', '#7dd47d')} secondary />
        <TweakButton label="Coral" onClick={() => setTweak('accent', '#e88a8a')} secondary />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
