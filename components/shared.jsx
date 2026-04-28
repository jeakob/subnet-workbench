// shared.jsx — small reusable components used across tabs

function Stat({ label, value, mode, lg }) {
  const cls = ['stat-v'];
  if (lg) cls.push('lg');
  if (mode) cls.push(mode);
  return (
    <div className="stat">
      <div className="stat-l">{label}</div>
      <div className={cls.join(' ')}>{value}</div>
    </div>
  );
}

function CopyBtn({ text, label }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      className="btn btn-sm btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch (e) {}
      }}
    >{done ? 'copied' : (label || 'copy')}</button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="form-cell">
      <label className="label">{label}</label>
      {children}
      {hint && <div style={{ color: 'var(--fg-dim)', fontSize: 11, marginTop: 4, fontFamily: 'var(--mono)' }}>{hint}</div>}
    </div>
  );
}

function PageHead({ title, sub }) {
  return (
    <div className="page-h">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
    </div>
  );
}

Object.assign(window, { Stat, CopyBtn, Field, PageHead });
