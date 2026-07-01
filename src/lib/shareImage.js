// Build a shareable PNG of the user's London map and share (or download) it.
import { PLACES, HOOD_CELLS, GREEN_SHAPES, THAMES_PATH, AREA_COLORS, W, H } from "../data/core.jsx";

// Escape text for safe inclusion in SVG.
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The patch-P logo as inline SVG markup (matches RoundelMark).
function logoMarkup(x, y, scale) {
  const g = `translate(${x},${y}) scale(${scale})`;
  return `<g transform="${g}">
    <clipPath id="shareP"><path d="M40 24 H104 a56 56 0 0 1 0 112 H76 V216 H40 Z"/></clipPath>
    <g clip-path="url(#shareP)">
      <rect x="40" y="24" width="124" height="192" fill="#F6F4EC"/>
      <path d="M40 24 L104 24 L80 100 L40 92 Z" fill="#D6402C"/>
      <path d="M104 24 L164 44 L160 100 L80 100 Z" fill="#2747B8"/>
      <path d="M40 92 L80 100 L160 100 L162 140 L76 150 L40 140 Z" fill="#E08712"/>
      <path d="M40 140 L76 150 L72 216 L40 216 Z" fill="#1B8A4C"/>
      <path d="M76 150 L132 150 L122 216 L72 216 Z" fill="#A23073"/>
    </g>
    <path d="M40 24 H104 a56 56 0 0 1 0 112 H76 V216 H40 Z" fill="none" stroke="#16161A" stroke-width="7" stroke-linejoin="round"/>
  </g>`;
}

// Compose the full share SVG. kind = 'hoods' | 'green'.
function buildSvg({ kind, states, pct, visited, total }) {
  const shapes = kind === "green" ? GREEN_SHAPES : HOOD_CELLS;
  const visitedSet = new Set(PLACES[kind].filter((p) => states[p.id] === 2).map((p) => p.id));

  // Card dimensions — portrait, social-friendly (1080x1350-ish ratio).
  const PAD = 60;
  const cardW = W + PAD * 2;
  const headerH = 250;
  const footerH = 150;
  const cardH = headerH + H + footerH;

  const areaColor = (p) => {
    const place = PLACES[kind].find((x) => x.id === p.id);
    return place ? (AREA_COLORS[place.area] || "#16161A") : "#16161A";
  };

  const mapShapes = shapes.map((p) => {
    const on = visitedSet.has(p.id);
    return `<path d="${p.path}" fill="${on ? areaColor(p) : "#E4E1D6"}" fill-opacity="${on ? 0.85 : 0.5}" stroke="${on ? "#FFFFFF" : "#D2CEC0"}" stroke-width="${on ? 1.2 : 0.5}"/>`;
  }).join("");

  const greensUnder = kind === "hoods"
    ? GREEN_SHAPES.map((g) => `<path d="${g.path}" fill="#C5DBBA" opacity="0.4"/>`).join("")
    : "";

  const label = kind === "green" ? "of London's green spaces" : "of London's neighbourhoods";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}">
    <rect width="${cardW}" height="${cardH}" fill="#F6F4EC"/>
    <!-- header -->
    ${logoMarkup(PAD, 46, 0.62)}
    <text x="${PAD + 110}" y="108" font-family="Hanken Grotesk, Arial, sans-serif" font-size="46" font-weight="800" fill="#16161A" letter-spacing="-1">Patch Map London</text>
    <text x="${PAD + 110}" y="150" font-family="Hanken Grotesk, Arial, sans-serif" font-size="24" fill="#6B6B70">patch-map-london.netlify.app</text>
    <text x="${PAD}" y="228" font-family="Hanken Grotesk, Arial, sans-serif" font-size="120" font-weight="800" fill="#16161A" letter-spacing="-3">${pct}%</text>
    <text x="${PAD + (pct >= 100 ? 340 : pct >= 10 ? 250 : 150)}" y="228" font-family="Hanken Grotesk, Arial, sans-serif" font-size="30" fill="#3C3C42">${label}</text>
    <!-- map -->
    <g transform="translate(${PAD}, ${headerH})">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#EEEBE0" rx="16"/>
      ${greensUnder}
      <path d="${THAMES_PATH}" fill="none" stroke="#8FB8D4" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
      ${mapShapes}
    </g>
    <!-- footer -->
    <text x="${PAD}" y="${headerH + H + 70}" font-family="Hanken Grotesk, Arial, sans-serif" font-size="30" font-weight="700" fill="#16161A">${visited} of ${total} ${kind === "green" ? "green spaces" : "neighbourhoods"} explored</text>
    <text x="${PAD}" y="${headerH + H + 112}" font-family="Hanken Grotesk, Arial, sans-serif" font-size="24" fill="#6B6B70">How much of London have you explored?</text>
  </svg>`;
}

// Render SVG string to a PNG blob via canvas.
async function svgToPngBlob(svg, scale = 2) {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("render failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise((res) => canvas.toBlob(res, "image/png", 0.95));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Public: build + share (or download) the image.
// Returns 'shared' | 'downloaded' | 'error'.
export async function shareMapImage({ kind, states, pct, visited, total }) {
  try {
    const svg = buildSvg({ kind, states, pct, visited, total });
    const blob = await svgToPngBlob(svg, 2);
    if (!blob) return "error";
    const file = new File([blob], "patch-map-london.png", { type: "image/png" });

    // Prefer the native share sheet (mobile), with the image as a file.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Patch Map London",
        text: `I've explored ${pct}% of London's ${kind === "green" ? "green spaces" : "neighbourhoods"}! patch-map-london.netlify.app`,
      });
      return "shared";
    }

    // Fallback: trigger a download.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patch-map-london.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "downloaded";
  } catch (e) {
    if (e && e.name === "AbortError") return "shared"; // user cancelled the share sheet
    return "error";
  }
}
