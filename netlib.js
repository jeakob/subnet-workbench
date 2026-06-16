// netlib.js — IPv4 + IPv6 math, CIDR helpers, ACL/wildcard, range/VLSM.
// Pure functions. No DOM, no React. Loaded as a plain <script>.
// IPv4 uses unsigned 32-bit ints (>>> 0). IPv6 uses BigInt (128-bit).

(function (global) {
  'use strict';

  // ─────────────────────── IPv4 ───────────────────────
  function v4_parse(str) {
    if (typeof str !== 'string') return null;
    const m = str.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    let n = 0;
    for (let i = 1; i <= 4; i++) {
      const o = +m[i];
      if (o < 0 || o > 255) return null;
      n = (n * 256) + o;
    }
    return n >>> 0;
  }
  function v4_format(n) {
    n = n >>> 0;
    return ((n >>> 24) & 255) + '.' + ((n >>> 16) & 255) + '.' + ((n >>> 8) & 255) + '.' + (n & 255);
  }
  function v4_mask(prefix) {
    if (prefix <= 0) return 0;
    if (prefix >= 32) return 0xFFFFFFFF >>> 0;
    return (0xFFFFFFFF << (32 - prefix)) >>> 0;
  }
  function v4_wildcard(prefix) { return (~v4_mask(prefix)) >>> 0; }
  function v4_network(ip, prefix) { return (ip & v4_mask(prefix)) >>> 0; }
  function v4_broadcast(ip, prefix) { return (v4_network(ip, prefix) | v4_wildcard(prefix)) >>> 0; }
  function v4_size(prefix) { return Math.pow(2, 32 - prefix); }
  function v4_usable(prefix) {
    if (prefix === 32) return 1;
    if (prefix === 31) return 2; // RFC 3021 point-to-point
    return Math.max(0, Math.pow(2, 32 - prefix) - 2);
  }
  function v4_first_host(ip, prefix) {
    if (prefix >= 31) return v4_network(ip, prefix);
    return (v4_network(ip, prefix) + 1) >>> 0;
  }
  function v4_last_host(ip, prefix) {
    if (prefix >= 31) return v4_broadcast(ip, prefix);
    return (v4_broadcast(ip, prefix) - 1) >>> 0;
  }
  function v4_parse_cidr(str) {
    if (!str) return null;
    const parts = str.trim().split('/');
    const ip = v4_parse(parts[0]);
    if (ip === null) return null;
    const p = parts.length === 2 ? parseInt(parts[1], 10) : 32;
    if (!Number.isFinite(p) || p < 0 || p > 32) return null;
    return { ip, prefix: p };
  }
  function v4_parse_mask(str) {
    const n = v4_parse(str);
    if (n === null) return null;
    // Validate contiguous mask
    const inv = (~n) >>> 0;
    if (((inv + 1) & inv) !== 0) return null;
    let p = 0, x = n;
    while (x) { p += x & 1; x = x >>> 1; }
    return p;
  }
  function v4_to_binary(n, group = true) {
    n = n >>> 0;
    const s = n.toString(2).padStart(32, '0');
    if (!group) return s;
    return s.match(/.{8}/g).join('.');
  }
  function v4_class(ip) {
    const a = (ip >>> 24) & 255;
    if (a < 128) return 'A';
    if (a < 192) return 'B';
    if (a < 224) return 'C';
    if (a < 240) return 'D (multicast)';
    return 'E (reserved)';
  }
  function v4_is_private(ip) {
    const a = (ip >>> 24) & 255;
    const b = (ip >>> 16) & 255;
    if (a === 10) return '10.0.0.0/8';
    if (a === 172 && b >= 16 && b <= 31) return '172.16.0.0/12';
    if (a === 192 && b === 168) return '192.168.0.0/16';
    return null;
  }
  function v4_is_special(ip) {
    const a = (ip >>> 24) & 255;
    const b = (ip >>> 16) & 255;
    if (a === 127) return 'Loopback (127.0.0.0/8)';
    if (a === 169 && b === 254) return 'Link-local (169.254.0.0/16)';
    if (a === 100 && (b & 0xC0) === 64) return 'CGNAT (100.64.0.0/10)';
    if (a >= 224 && a < 240) return 'Multicast (224.0.0.0/4)';
    if (a >= 240) return 'Reserved (240.0.0.0/4)';
    if (a === 0) return 'This network (0.0.0.0/8)';
    return null;
  }

  // Subnet contains / overlaps / adjacency
  function v4_contains(outer, inner) {
    if (inner.prefix < outer.prefix) return false;
    return v4_network(inner.ip, outer.prefix) === v4_network(outer.ip, outer.prefix);
  }
  function v4_overlaps(a, b) {
    const aStart = v4_network(a.ip, a.prefix);
    const aEnd = v4_broadcast(a.ip, a.prefix);
    const bStart = v4_network(b.ip, b.prefix);
    const bEnd = v4_broadcast(b.ip, b.prefix);
    return aStart <= bEnd && bStart <= aEnd;
  }

  // Range → list of CIDRs (smallest set covering [start..end] exactly)
  function v4_range_to_cidrs(startStr, endStr) {
    const s = v4_parse(startStr);
    const e = v4_parse(endStr);
    if (s === null || e === null || s > e) return null;
    const out = [];
    let cur = s;
    while (cur <= e) {
      // Largest power-of-two block aligned at cur, not exceeding e
      let maxByAlign = 32;
      if (cur !== 0) {
        // count trailing zeros
        let x = cur, c = 0;
        while ((x & 1) === 0 && c < 32) { x = x >>> 1; c++; }
        maxByAlign = 32 - c;
      } else {
        maxByAlign = 0;
      }
      // also limited by remaining range size
      const remaining = e - cur + 1;
      let maxBySize = 32 - Math.floor(Math.log2(remaining));
      if (Math.pow(2, 32 - maxBySize) > remaining) maxBySize++;
      const prefix = Math.max(maxByAlign, maxBySize);
      out.push({ ip: cur, prefix });
      const blockSize = Math.pow(2, 32 - prefix);
      cur = cur + blockSize;
      if (cur > 0xFFFFFFFF) break;
      cur = cur >>> 0;
    }
    return out;
  }

  // VLSM: given a parent CIDR and array of host requirements, allocate.
  function v4_vlsm(parent, requirements) {
    // requirements: [{name, hosts}], sort largest first
    const sorted = requirements
      .map((r, i) => ({ ...r, _i: i }))
      .filter(r => r.hosts > 0)
      .sort((a, b) => b.hosts - a.hosts);
    const parentSize = v4_size(parent.prefix);
    let cur = v4_network(parent.ip, parent.prefix);
    const end = v4_broadcast(parent.ip, parent.prefix);
    const allocations = [];
    let used = 0;
    for (const req of sorted) {
      // Need hosts + 2 (network + broadcast) unless /31 or /32
      const need = req.hosts + 2;
      let prefix = 32;
      while (Math.pow(2, 32 - prefix) < need && prefix > 0) prefix--;
      if (prefix < parent.prefix) {
        return { error: `"${req.name}" needs ${req.hosts} hosts — too large for parent /${parent.prefix}` };
      }
      const blockSize = Math.pow(2, 32 - prefix);
      // Align cur to blockSize
      const aligned = Math.ceil(cur / blockSize) * blockSize;
      if (aligned + blockSize - 1 > end) {
        return { error: `Out of space — "${req.name}" doesn't fit in /${parent.prefix}` };
      }
      cur = aligned >>> 0;
      allocations.push({ ...req, ip: cur, prefix, size: blockSize });
      used += blockSize;
      cur = (cur + blockSize) >>> 0;
    }
    // restore original order
    allocations.sort((a, b) => a._i - b._i);
    return { allocations, used, total: parentSize, free: parentSize - used };
  }

  // ─────────────────────── Summarization / Aggregation ───────────────────────
  // Single supernet: smallest CIDR that contains every input prefix.
  // Returns { ip, prefix, lo, hi, requested_size, summary_size, waste }.
  function v4_summary(cidrs) {
    if (!cidrs || !cidrs.length) return null;
    let lo = 0xFFFFFFFF >>> 0;
    let hi = 0;
    let requested = 0;
    // Track requested addresses via interval union to avoid double-counting overlaps.
    const ivals = [];
    for (const c of cidrs) {
      const s = v4_network(c.ip, c.prefix) >>> 0;
      const e = v4_broadcast(c.ip, c.prefix) >>> 0;
      if (s < lo) lo = s;
      if (e > hi) hi = e;
      ivals.push([s, e]);
    }
    // Merge intervals to count true union size
    ivals.sort((a, b) => a[0] - b[0]);
    let merged = [ivals[0].slice()];
    for (let i = 1; i < ivals.length; i++) {
      const last = merged[merged.length - 1];
      if (ivals[i][0] <= last[1] + 1) {
        if (ivals[i][1] > last[1]) last[1] = ivals[i][1];
      } else {
        merged.push(ivals[i].slice());
      }
    }
    for (const m of merged) requested += (m[1] - m[0] + 1);
    // Find shortest prefix p such that network(lo, p) === network(hi, p)
    let p = 32;
    let xor = (lo ^ hi) >>> 0;
    while (xor) { xor = xor >>> 1; p--; }
    const ip = (lo & v4_mask(p)) >>> 0;
    const summary_size = Math.pow(2, 32 - p);
    return {
      ip, prefix: p, lo, hi,
      requested_size: requested,
      summary_size,
      waste: summary_size - requested,
      merged_ranges: merged,
      exact: merged.length === 1 && merged[0][0] === ip && merged[0][1] === (ip + summary_size - 1),
    };
  }

  // Optimal aggregation: minimal disjoint CIDR set whose union equals the union of inputs.
  // Returns array of {ip, prefix}, sorted, plus diagnostics.
  function v4_aggregate(cidrs) {
    if (!cidrs || !cidrs.length) return { cidrs: [], merged: [], overlaps: [] };
    // Normalize to network address
    const norm = cidrs.map(c => ({
      ip: v4_network(c.ip, c.prefix) >>> 0,
      prefix: c.prefix,
      start: v4_network(c.ip, c.prefix) >>> 0,
      end: v4_broadcast(c.ip, c.prefix) >>> 0,
    }));
    // Detect overlaps in original inputs (pairs)
    const overlaps = [];
    const sorted = norm.slice().sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start <= sorted[i - 1].end) {
        overlaps.push({
          a: { ip: sorted[i - 1].ip, prefix: sorted[i - 1].prefix },
          b: { ip: sorted[i].ip,     prefix: sorted[i].prefix },
        });
      }
    }
    // Merge to interval list
    const merged = [];
    for (const c of sorted) {
      if (merged.length && c.start <= merged[merged.length - 1].end + 1) {
        if (c.end > merged[merged.length - 1].end) merged[merged.length - 1].end = c.end;
      } else {
        merged.push({ start: c.start, end: c.end });
      }
    }
    // Decompose each merged range into minimal CIDR blocks
    const out = [];
    for (const r of merged) {
      const blocks = _v4_range_to_blocks(r.start, r.end);
      for (const b of blocks) out.push(b);
    }
    return { cidrs: out, merged, overlaps };
  }

  // Internal: range → CIDR blocks (returns {ip, prefix}[]) — handles 0..2^32 edge.
  function _v4_range_to_blocks(start, end) {
    const out = [];
    let cur = start >>> 0;
    // Use plain numbers up to 2^32-1; handle final block specially.
    while (cur <= end) {
      // largest power-of-two aligned at cur
      let maxAlignBits = 32;
      if (cur !== 0) {
        let x = cur, c = 0;
        while ((x & 1) === 0 && c < 32) { x = x >>> 1; c++; }
        maxAlignBits = c;
      }
      // largest by size (don't overshoot end)
      const remaining = end - cur + 1; // 1..2^32 (fits in number)
      let maxSizeBits = Math.floor(Math.log2(remaining));
      if (Math.pow(2, maxSizeBits) > remaining) maxSizeBits--;
      const bits = Math.min(maxAlignBits, maxSizeBits);
      const prefix = 32 - bits;
      const size = Math.pow(2, bits);
      out.push({ ip: cur >>> 0, prefix });
      cur = cur + size;
      if (cur > 0xFFFFFFFF) break;
    }
    return out;
  }

  // Parse a multi-line list of CIDRs. Accepts: 10.0.0.0/24, 10.0.0.0, 10.0.0.0 255.255.255.0,
  // ranges "10.0.0.0-10.0.0.255". Returns { ok: [{ip,prefix,raw}], bad: [{raw, reason}] }.
  function v4_parse_list(text) {
    const ok = [], bad = [];
    const lines = (text || '').split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    for (const raw of lines) {
      // Strip comments after #
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      // Range form: a.b.c.d-e.f.g.h
      const rm = line.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
      if (rm) {
        const blocks = v4_range_to_cidrs(rm[1], rm[2]);
        if (!blocks) { bad.push({ raw, reason: 'invalid range' }); continue; }
        for (const b of blocks) ok.push({ ...b, raw });
        continue;
      }
      // IP + mask form
      const mm = line.match(/^([\d.]+)\s+([\d.]+)$/);
      if (mm) {
        const ip = v4_parse(mm[1]);
        const p = v4_parse_mask(mm[2]);
        if (ip === null || p === null) { bad.push({ raw, reason: 'invalid ip/mask' }); continue; }
        ok.push({ ip, prefix: p, raw });
        continue;
      }
      // CIDR or bare IP (treat bare as /32)
      const c = v4_parse_cidr(line);
      if (c) { ok.push({ ...c, raw }); continue; }
      bad.push({ raw, reason: 'unparseable' });
    }
    return { ok, bad };
  }

  // Common-bits analysis: how many leading bits are identical across all inputs (treating
  // each input as the network address). Useful for explaining "why is the summary /N?".
  function v4_common_bits(cidrs) {
    if (!cidrs.length) return 0;
    let n = v4_network(cidrs[0].ip, cidrs[0].prefix) >>> 0;
    let agree = 32;
    for (let i = 1; i < cidrs.length; i++) {
      const c = v4_network(cidrs[i].ip, cidrs[i].prefix) >>> 0;
      let xor = (n ^ c) >>> 0;
      let common = 32;
      while (xor) { xor = xor >>> 1; common--; }
      if (common < agree) agree = common;
    }
    return agree;
  }

  // ─────────────────────── IPv6 summarization ───────────────────────
  function v6_summary(cidrs) {
    if (!cidrs || !cidrs.length) return null;
    let lo = (1n << 128n) - 1n, hi = 0n;
    let requested = 0n;
    const ivals = [];
    for (const c of cidrs) {
      const s = v6_network(c.ip, c.prefix);
      const e = v6_last(c.ip, c.prefix);
      if (s < lo) lo = s;
      if (e > hi) hi = e;
      ivals.push([s, e]);
    }
    ivals.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const merged = [[ivals[0][0], ivals[0][1]]];
    for (let i = 1; i < ivals.length; i++) {
      const last = merged[merged.length - 1];
      if (ivals[i][0] <= last[1] + 1n) {
        if (ivals[i][1] > last[1]) last[1] = ivals[i][1];
      } else {
        merged.push([ivals[i][0], ivals[i][1]]);
      }
    }
    for (const m of merged) requested += (m[1] - m[0] + 1n);
    // Find shortest prefix p
    let p = 128;
    let xor = lo ^ hi;
    while (xor > 0n) { xor >>= 1n; p--; }
    const ip = lo & v6_mask(p);
    const summary_size = 1n << BigInt(128 - p);
    return {
      ip, prefix: p, lo, hi,
      requested_size: requested,
      summary_size,
      waste: summary_size - requested,
      merged_ranges: merged,
      exact: merged.length === 1 && merged[0][0] === ip && merged[0][1] === (ip + summary_size - 1n),
    };
  }

  // ─────────────────────── IPv6 ───────────────────────
  function v6_parse(str) {
    if (typeof str !== 'string') return null;
    str = str.trim().toLowerCase();
    if (!str) return null;
    // Reject obvious bad chars
    if (!/^[0-9a-f:]+$/.test(str)) return null;
    if ((str.match(/::/g) || []).length > 1) return null;
    let head = '', tail = '';
    if (str.includes('::')) {
      const [h, t] = str.split('::');
      head = h; tail = t;
    } else {
      head = str;
    }
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    if (headGroups.length + tailGroups.length > 8) return null;
    if (!str.includes('::') && headGroups.length !== 8) return null;
    const fillCount = 8 - headGroups.length - tailGroups.length;
    const groups = [...headGroups, ...Array(fillCount).fill('0'), ...tailGroups];
    if (groups.length !== 8) return null;
    let n = 0n;
    for (const g of groups) {
      if (g === '' || g.length > 4 || !/^[0-9a-f]+$/.test(g)) return null;
      n = (n << 16n) | BigInt(parseInt(g, 16));
    }
    return n;
  }
  function v6_format(n, opts) {
    opts = opts || {};
    const groups = [];
    for (let i = 7; i >= 0; i--) {
      groups.push(Number((n >> BigInt(i * 16)) & 0xFFFFn).toString(16));
    }
    if (opts.full) {
      return groups.map(g => g.padStart(4, '0')).join(':');
    }
    // Compress longest run of zero groups (RFC 5952)
    let bestStart = -1, bestLen = 0;
    let curStart = -1, curLen = 0;
    for (let i = 0; i < 8; i++) {
      if (groups[i] === '0') {
        if (curStart < 0) curStart = i;
        curLen++;
        if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
      } else {
        curStart = -1; curLen = 0;
      }
    }
    if (bestLen < 2) return groups.join(':');
    const before = groups.slice(0, bestStart).join(':');
    const after = groups.slice(bestStart + bestLen).join(':');
    return before + '::' + after;
  }
  function v6_mask(prefix) {
    if (prefix <= 0) return 0n;
    if (prefix >= 128) return (1n << 128n) - 1n;
    return ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
  }
  function v6_network(ip, prefix) { return ip & v6_mask(prefix); }
  function v6_last(ip, prefix) {
    return v6_network(ip, prefix) | (~v6_mask(prefix) & ((1n << 128n) - 1n));
  }
  function v6_parse_cidr(str) {
    if (!str) return null;
    const parts = str.trim().split('/');
    const ip = v6_parse(parts[0]);
    if (ip === null) return null;
    const p = parts.length === 2 ? parseInt(parts[1], 10) : 128;
    if (!Number.isFinite(p) || p < 0 || p > 128) return null;
    return { ip, prefix: p };
  }
  function v6_size(prefix) {
    // Returns BigInt
    return 1n << BigInt(128 - prefix);
  }
  function v6_size_human(prefix) {
    const bits = 128 - prefix;
    if (bits === 0) return '1';
    if (bits < 64) {
      const n = 1n << BigInt(bits);
      return n.toLocaleString('en-US');
    }
    // Express as 2^N for huge values
    return '2^' + bits + ' (~' + (Math.pow(2, bits)).toExponential(2) + ')';
  }
  function v6_type(ip) {
    // /128 mask of certain prefixes
    if (ip === 0n) return 'Unspecified (::)';
    if (ip === 1n) return 'Loopback (::1)';
    const top = ip >> 112n;
    const top16 = Number(top);
    if (top16 === 0xfe80) return 'Link-local (fe80::/10)';
    if ((top16 & 0xfe00) === 0xfc00) return 'Unique local (fc00::/7)';
    if ((top16 & 0xff00) === 0xff00) return 'Multicast (ff00::/8)';
    if (top16 === 0x2001 && ((Number(ip >> 96n) & 0xFFFF) === 0xdb8)) return 'Documentation (2001:db8::/32)';
    if ((top16 & 0xe000) === 0x2000) return 'Global unicast (2000::/3)';
    return 'Reserved/other';
  }
  function v6_eui64(macStr) {
    const m = macStr.replace(/[^0-9a-f]/gi, '');
    if (m.length !== 12) return null;
    const bytes = [];
    for (let i = 0; i < 12; i += 2) bytes.push(parseInt(m.substr(i, 2), 16));
    bytes[0] ^= 0x02; // flip universal/local bit
    const ifid = [bytes[0], bytes[1], bytes[2], 0xff, 0xfe, bytes[3], bytes[4], bytes[5]];
    const groups = [];
    for (let i = 0; i < 8; i += 2) {
      groups.push(((ifid[i] << 8) | ifid[i + 1]).toString(16).padStart(4, '0'));
    }
    return groups.join(':');
  }

  // ─────────────────────── Visual subnet tree ───────────────────────
  // A binary tree where each node is either:
  //   { leaf: true, prefix, ip, note?, color? }
  //   { leaf: false, prefix, ip, left, right }
  // Helpers for split/join + walk:
  function vs_make_root(ip, prefix) {
    return { leaf: true, ip: v4_network(ip, prefix) >>> 0, prefix };
  }
  function vs_split(node) {
    if (!node.leaf || node.prefix >= 32) return node;
    const childPrefix = node.prefix + 1;
    const half = Math.pow(2, 32 - childPrefix);
    const left = { leaf: true, ip: node.ip, prefix: childPrefix, note: node.note, color: node.color, divider: node.divider, dividerLabel: node.dividerLabel };
    const right = { leaf: true, ip: (node.ip + half) >>> 0, prefix: childPrefix, note: node.note, color: node.color };
    return { leaf: false, ip: node.ip, prefix: node.prefix, left, right };
  }
  function vs_can_join(node) {
    return !node.leaf && node.left.leaf && node.right.leaf;
  }
  function vs_join(node) {
    if (!vs_can_join(node)) return node;
    return { leaf: true, ip: node.ip, prefix: node.prefix, note: node.left.note || node.right.note, color: node.left.color || node.right.color, divider: node.left.divider, dividerLabel: node.left.dividerLabel };
  }
  function vs_walk_leaves(node, fn, path) {
    path = path || [];
    if (node.leaf) { fn(node, path); return; }
    vs_walk_leaves(node.left, fn, [...path, 'L']);
    vs_walk_leaves(node.right, fn, [...path, 'R']);
  }
  function vs_at_path(root, path) {
    let n = root;
    for (const p of path) {
      if (n.leaf) return null;
      n = (p === 'L') ? n.left : n.right;
    }
    return n;
  }
  function vs_replace(root, path, newNode) {
    if (path.length === 0) return newNode;
    const [head, ...rest] = path;
    const child = head === 'L' ? root.left : root.right;
    const replaced = vs_replace(child, rest, newNode);
    return {
      ...root,
      left: head === 'L' ? replaced : root.left,
      right: head === 'R' ? replaced : root.right,
    };
  }
  function vs_serialize(root) {
    // Compact form: prefix tree as "1" for branch, "0" for leaf, plus notes/colors map.
    let bits = '';
    const meta = {};
    let leafIdx = 0;
    // NOTE: meta is keyed by LEAF index (only leaves increment the counter),
    // because vs_deserialize reads it back the same way. Keying by node index
    // here would shift metadata onto the wrong leaf for any split tree.
    function walk(node) {
      if (node.leaf) {
        bits += '0';
        if (node.note || node.color || node.detached || node.divider || node.dividerLabel) {
          meta[leafIdx] = { n: node.note, c: node.color, x: node.detached ? 1 : 0, d: node.divider ? 1 : 0, dl: node.dividerLabel };
        }
        leafIdx++;
        return;
      }
      bits += '1';
      walk(node.left);
      walk(node.right);
    }
    walk(root);
    return { bits, meta, root: { ip: root.ip, prefix: root.prefix } };
  }
  function vs_deserialize(data) {
    const { bits, meta, root } = data;
    let i = 0, leafIdx = 0;
    function build(ip, prefix) {
      const c = bits[i++];
      if (c === '0') {
        const m = meta[leafIdx++] || {};
        return { leaf: true, ip, prefix, note: m.n, color: m.c, detached: !!m.x, divider: !!m.d, dividerLabel: m.dl };
      }
      const childPrefix = prefix + 1;
      const half = Math.pow(2, 32 - childPrefix);
      const left = build(ip, childPrefix);
      const right = build((ip + half) >>> 0, childPrefix);
      return { leaf: false, ip, prefix, left, right };
    }
    return build(root.ip, root.prefix);
  }

  // ─────────────────────── ACL helpers ───────────────────────
  function acl_lines(action, subnet, opts) {
    // Cisco IOS extended-style. Returns array of line strings.
    opts = opts || {};
    const ip = v4_format(subnet.ip);
    const wc = v4_format(v4_wildcard(subnet.prefix));
    const isHost = subnet.prefix === 32;
    const src = isHost ? `host ${ip}` : `${ip} ${wc}`;
    const dst = opts.destination || 'any';
    const proto = opts.proto || 'ip';
    const port = opts.port ? ` eq ${opts.port}` : '';
    const num = opts.number ? `${opts.number} ` : '';
    return [
      `${num}${action} ${proto} ${src} ${dst}${port}`,
      `! Cisco-style — ${proto.toUpperCase()} from ${ip}/${subnet.prefix} (wildcard ${wc})`,
    ];
  }

  // ─────────────────────── exports ───────────────────────
  global.NetLib = {
    v4_parse, v4_format, v4_mask, v4_wildcard, v4_network, v4_broadcast,
    v4_size, v4_usable, v4_first_host, v4_last_host, v4_parse_cidr, v4_parse_mask,
    v4_to_binary, v4_class, v4_is_private, v4_is_special,
    v4_contains, v4_overlaps, v4_range_to_cidrs, v4_vlsm,
    v4_summary, v4_aggregate, v4_parse_list, v4_common_bits,
    v6_summary,
    v6_parse, v6_format, v6_mask, v6_network, v6_last,
    v6_parse_cidr, v6_size, v6_size_human, v6_type, v6_eui64,
    vs_make_root, vs_split, vs_join, vs_can_join, vs_walk_leaves,
    vs_at_path, vs_replace, vs_serialize, vs_deserialize,
    acl_lines,
  };
})(window);
