// Patch Map London — the letter P, filled edge to edge with the app's area-colour patches.
let _uid = 0;

export function RoundelMark({ size = 46 }) {
  const id = "patchp-clip-" + (++_uid);
  // The glyph lives in a ~150-wide x 216-tall artwork box; keep that ratio so the P isn't squashed.
  const w = Math.round(size * 0.78);
  return (
    <svg width={w} height={size} viewBox="28 12 148 216" role="img" aria-label="Patch Map London">
      <defs>
        <clipPath id={id}>
          <path d="M40 24 H104 a56 56 0 0 1 0 112 H76 V216 H40 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="40" y="24" width="124" height="192" fill="#F6F4EC" />
        <path d="M40 24 L104 24 L80 100 L40 92 Z" fill="#D6402C" />
        <path d="M104 24 L164 44 L160 100 L80 100 Z" fill="#2747B8" />
        <path d="M40 92 L80 100 L160 100 L162 140 L76 150 L40 140 Z" fill="#E08712" />
        <path d="M40 140 L76 150 L72 216 L40 216 Z" fill="#1B8A4C" />
        <path d="M76 150 L132 150 L122 216 L72 216 Z" fill="#A23073" />
        <path d="M122 216 L132 150 L162 140 L160 160 a56 40 0 0 1 -38 56 Z" fill="#0E7A52" opacity="0.85" />
      </g>
      <path d="M40 24 H104 a56 56 0 0 1 0 112 H76 V216 H40 Z" fill="none" stroke="#16161A" strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
}
