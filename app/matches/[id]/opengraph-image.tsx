import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchMatchDetail } from "@/lib/match-data";
import { englishDateLabel, HOME_TEAM_EN, isMatchId, type MatchDetail } from "@/lib/matches";

export const runtime = "nodejs";
export const alt = "Al Ansar match";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Teams, date and stadium only: never prices or availability, which chat apps would cache for days.
export const revalidate = 3600;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const MAX_LOGO_BYTES = 1_000_000;

/** The opponent logo as a data URI, or null when it is missing, too big or in a format satori cannot draw (e.g. webp). */
async function remoteLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!IMAGE_TYPES.has(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_LOGO_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

async function crestDataUri(): Promise<string> {
  const svg = await readFile(path.join(process.cwd(), "public", "images", "crest.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

function TeamBlock({ name, logo }: { name: string; logo: string | null }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 380 }}>
    {logo
      ? <img src={logo} width={200} height={200} style={{ objectFit: "contain" }} />
      : <div style={{ display: "flex", width: 200, height: 200, borderRadius: 100, background: "#ffffff22" }} />}
    <div style={{ display: "flex", marginTop: 28, fontSize: 44, fontWeight: 700, color: "#ffffff", textAlign: "center" }}>{name}</div>
  </div>;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let match: MatchDetail | null = null;
  if (isMatchId(id)) {
    try { match = await fetchMatchDetail(id); } catch { match = null; }
  }
  const crest = await crestDataUri();

  if (!match) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#17533d" }}>
        <TeamBlock name={HOME_TEAM_EN} logo={crest} />
      </div>,
      size,
    );
  }

  const home = { name: HOME_TEAM_EN, logo: crest };
  const away = { name: match.opponent.nameEn.toUpperCase(), logo: await remoteLogo(match.opponent.logo) };
  const [left, right] = match.isHome ? [home, away] : [away, home];

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#17533d" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <TeamBlock name={left.name} logo={left.logo} />
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#e7d5ae", margin: "0 24px" }}>VS</div>
        <TeamBlock name={right.name} logo={right.logo} />
      </div>
      <div style={{ display: "flex", marginTop: 36, fontSize: 34, color: "#e7d5ae" }}>{englishDateLabel(match.date)}</div>
      <div style={{ display: "flex", marginTop: 10, fontSize: 28, color: "#d6e3da" }}>{match.stadiumEn}</div>
    </div>,
    size,
  );
}
