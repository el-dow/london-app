import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import L from "leaflet";
import {
  AREA_COLORS, AREA_ORDER, STATE_LABEL, PLACES, TAG_OPTIONS,
  HOOD_CELLS, GREEN_SHAPES, THAMES_PATH, BASE_WATER, ROAD_PATHS, W, H, Postcard,
} from "./data/core.jsx";
import { loadLocal, saveLocal, photoDB, fileToDataUrl } from "./lib/local.js";
import { RoundelMark } from "./components/RoundelMark.jsx";
import {
  cloudEnabled, getSession, onAuthChange, signInWithEmail, signInWithGoogle, signOut,
  ensureProfile, updateProfile, fetchLeaderboard, fetchMyScore,
  pullAll, pushPlaces, fetchShared, publicPhotoUrl,
  uploadPhoto, removeCloudPhoto,
} from "./lib/cloud.js";

const ONBOARD_KEY = "lof-onboarded";

export default function App() {
  const shareId = useMemo(() => new URLSearchParams(window.location.search).get("share"), []);
  const readOnly = Boolean(shareId);

  const [view, setView] = useState("map");
  const [tab, setTab] = useState("hoods");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [states, setStates] = useState({});
  const [tags, setTags] = useState({});
  const [customTags, setCustomTags] = useState([]);
  const [tagFilter, setTagFilter] = useState("");
  const [newTag, setNewTag] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 });
  const [selected, setSelected] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [tilesOk, setTilesOk] = useState(null);
  const [mapStyle, setMapStyle] = useState("street");
  const [session, setSession] = useState(null);
  const [shareLink, setShareLink] = useState("");
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [myScore, setMyScore] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return localStorage.getItem("lof-nudge-x") === "1"; } catch (e) { return false; }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [shareOwner, setShareOwner] = useState(null);
  const [shareError, setShareError] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const useTiles = view === "map" && mapStyle === "street" && tilesOk !== false;

  const saveTimer = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const mapDivRef = useRef(null);
  const leafletRef = useRef(null);
  const fileRef = useRef(null);
  const metaRef = useRef({});
  const stateRef = useRef({});
  stateRef.current = { states, tags, selected, tab, customTags };

  // ——— Initial load: local (normal mode) or shared map (read-only mode) ———
  useEffect(() => {
    if (readOnly) {
      if (!cloudEnabled) { setShareError(true); setLoaded(true); return; }
      fetchShared(shareId)
        .then((rows) => {
          const st = {}, tg = {};
          rows.forEach((r) => {
            if (r.state) st[r.place_id] = r.state;
            if (r.tags && r.tags.length) tg[r.place_id] = r.tags;
            if (r.user_id) setShareOwner(r.user_id);
          });
          setStates(st); setTags(tg); setLoaded(true);
        })
        .catch(() => { setShareError(true); setLoaded(true); });
      return;
    }
    const d = loadLocal();
    setStates(d.states); setTags(d.tags); setCustomTags(d.customTags);
    metaRef.current = d.meta;
    setLoaded(true);
    if (!localStorage.getItem(ONBOARD_KEY)) setShowOnboard(true);
  }, []);

  // ——— Cloud session + first sync ———
  useEffect(() => {
    if (!cloudEnabled || readOnly) return;
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  useEffect(() => {
    if (!session || readOnly) { setShareLink(""); return; }
    ensureProfile().then((prof) => {
      if (prof) {
        setProfile(prof);
        setNameDraft(prof.display_name || "");
        if (prof.share_id) setShareLink(`${window.location.origin}${window.location.pathname}?share=${prof.share_id}`);
      }
    }).catch(() => {});
    // Merge: newer side wins per place
    (async () => {
      try {
        const rows = await pullAll();
        const { states: ls, tags: lt } = stateRef.current;
        const meta = metaRef.current;
        const nextStates = { ...ls }, nextTags = { ...lt };
        const toPush = [];
        const cloudIds = new Set();
        for (const r of rows) {
          cloudIds.add(r.place_id);
          const cu = new Date(r.updated_at).getTime();
          const lu = meta[r.place_id] || 0;
          if (cu >= lu) {
            if (r.state) nextStates[r.place_id] = r.state; else delete nextStates[r.place_id];
            if (r.tags && r.tags.length) nextTags[r.place_id] = r.tags; else delete nextTags[r.place_id];
            meta[r.place_id] = cu;
          } else {
            toPush.push({ place_id: r.place_id, state: ls[r.place_id] || 0, tags: lt[r.place_id] || [], updated_at: new Date(lu).toISOString() });
          }
        }
        for (const id of new Set([...Object.keys(ls), ...Object.keys(lt)])) {
          if (!cloudIds.has(id)) {
            toPush.push({ place_id: id, state: ls[id] || 0, tags: lt[id] || [], updated_at: new Date(meta[id] || Date.now()).toISOString() });
          }
        }
        setStates(nextStates); setTags(nextTags);
        persistLocalSoon(nextStates, nextTags);
        if (toPush.length) await pushPlaces(toPush);
        setSaveNote("Synced"); setTimeout(() => setSaveNote(""), 1500);
      } catch (e) {
        setSaveNote("Sync hiccup — changes kept locally");
        setTimeout(() => setSaveNote(""), 2500);
      }
    })();
  }, [session && session.user.id]);

  // ——— Persistence ———
  const persistLocalSoon = (st, tg, ct) => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveLocal({
        states: st ?? stateRef.current.states,
        tags: tg ?? stateRef.current.tags,
        customTags: ct ?? stateRef.current.customTags,
        meta: metaRef.current,
      });
      setSaveNote("Saved");
      setTimeout(() => setSaveNote(""), 1200);
    }, 400);
  };

  const persistPlace = (id, nextState, nextTags) => {
    metaRef.current[id] = Date.now();
    persistLocalSoon();
    if (cloudEnabled && session) {
      pushPlaces([{ place_id: id, state: nextState, tags: nextTags, updated_at: new Date().toISOString() }])
        .catch(() => { setSaveNote("Offline — will sync next time"); setTimeout(() => setSaveNote(""), 2000); });
    }
  };

  const setStateTo = (id, s) => {
    if (readOnly) return;
    setStates((prev) => {
      const next = { ...prev };
      if (s === 0) delete next[id]; else next[id] = s;
      persistPlace(id, s, stateRef.current.tags[id] || []);
      return next;
    });
  };
  const cycleState = (id) => setStateTo(id, ((states[id] || 0) + 1) % 3);

  const toggleTag = (id, t) => {
    if (readOnly) return;
    setTags((prev) => {
      const cur = prev[id] || [];
      const list = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
      const next = { ...prev };
      if (list.length) next[id] = list; else delete next[id];
      persistPlace(id, stateRef.current.states[id] || 0, list);
      return next;
    });
  };

  const addCustomTag = () => {
    const t = newTag.trim().toLowerCase();
    if (!t) return;
    setNewTag("");
    if (!TAG_OPTIONS.includes(t) && !customTags.includes(t)) {
      const nc = [...customTags, t];
      setCustomTags(nc);
      persistLocalSoon(undefined, undefined, nc);
    }
    if (selected) toggleTag(selected.id, t);
  };
  const allTags = useMemo(
    () => [...TAG_OPTIONS, ...customTags.filter((t) => !TAG_OPTIONS.includes(t))],
    [customTags]
  );

  // ——— Photos ———
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setPhoto(null);
    (async () => {
      const titles = [`${selected.name}, London`, selected.name];
      for (const t of titles) {
        try {
          const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`);
          if (!r.ok) continue;
          const j = await r.json();
          if (j.type === "disambiguation") continue;
          const thumb = j.thumbnail && j.thumbnail.source;
          const src = thumb
            ? thumb.replace(/\/(\d+)px-([^/]+)$/, "/640px-$2")
            : (j.originalimage && j.originalimage.source) || null;
          if (src && !cancelled) { setPhoto(src); return; }
        } catch (e) { /* offline — postcard fallback */ }
      }
    })();
    return () => { cancelled = true; };
  }, [selected && selected.id]);

  useEffect(() => {
    if (!selected) { setUserPhoto(null); return; }
    let gone = false;
    (async () => {
      const local = await photoDB.get(selected.id);
      if (gone) return;
      if (local) { setUserPhoto(local); return; }
      const owner = shareOwner || (session && session.user.id);
      if (cloudEnabled && owner) {
        try {
          const url = publicPhotoUrl(owner, selected.id);
          const head = await fetch(url, { method: "HEAD" });
          if (head.ok && !gone) setUserPhoto(url);
        } catch (e) {}
      }
    })();
    return () => { gone = true; };
  }, [selected && selected.id, shareOwner, session && session.user.id]);

  const onPickFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f || !selected) return;
    try {
      const data = await fileToDataUrl(f);
      await photoDB.set(selected.id, data);
      setUserPhoto(data);
      if (cloudEnabled && session) {
        uploadPhoto(selected.id, data).catch(() => {
          setSaveNote("Photo saved locally; cloud upload failed");
          setTimeout(() => setSaveNote(""), 2500);
        });
      }
    } catch (err) {
      alert("Couldn't read that image, sorry — try a JPG or PNG.");
    }
  };
  const removeUserPhoto = async () => {
    if (!selected) return;
    await photoDB.del(selected.id);
    if (cloudEnabled && session) removeCloudPhoto(selected.id).catch(() => {});
    setUserPhoto(null);
  };

  // ——— Leaflet street map ———
  const syncLeaflet = () => {
    const lr = leafletRef.current;
    if (!lr) return;
    const { states, selected, tab } = stateRef.current;
    const { map, hoodGroup, greenGroup, layers } = lr;
    const active = tab === "hoods" ? hoodGroup : greenGroup;
    const inactive = tab === "hoods" ? greenGroup : hoodGroup;
    if (map.hasLayer(inactive)) map.removeLayer(inactive);
    if (!map.hasLayer(active)) active.addTo(map);
    const list = tab === "hoods" ? HOOD_CELLS : GREEN_SHAPES;
    list.forEach((p) => {
      const state = states[p.id] || 0;
      const color = AREA_COLORS[p.area] || "#16161A";
      const isSel = selected && selected.id === p.id;
      const park = p.kind === "park";
      layers[p.id].setStyle({
        color: isSel ? "#16161A" : state ? color : park ? "#3E7A4F" : "#9A978B",
        weight: isSel ? 3 : state ? 2 : 1,
        opacity: isSel ? 1 : state ? 0.95 : 0.55,
        dashArray: !isSel && state === 1 ? "6 4" : null,
        fillColor: state ? color : park ? "#3E7A4F" : "#777777",
        fillOpacity: state === 2 ? 0.42 : state === 1 ? 0.15 : park ? 0.12 : 0.03,
      });
    });
    const z = map.getZoom();
    const mode = tab + (z >= (tab === "hoods" ? 13 : 12) ? ":perm" : ":hover");
    if (mode !== lr.labelMode) {
      lr.labelMode = mode;
      list.forEach((p) => {
        const lay = layers[p.id];
        lay.unbindTooltip();
        if (mode.endsWith(":perm")) lay.bindTooltip(p.name, { permanent: true, direction: "center", className: "zonelabel" });
        else lay.bindTooltip(p.name, { sticky: true, direction: "top", className: "zonetip" });
      });
    }
  };

  useEffect(() => {
    if (!useTiles || !mapDivRef.current) return;
    const map = L.map(mapDivRef.current).setView([51.5074, -0.1278], 11);
    let gotTile = false, errs = 0, dead = false;
    const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd", maxZoom: 19,
    });
    tiles.on("tileload", () => { gotTile = true; if (!dead) setTilesOk(true); });
    tiles.on("tileerror", () => { errs++; if (!gotTile && errs >= 4 && !dead) setTilesOk(false); });
    const failTimer = setTimeout(() => { if (!gotTile && !dead) setTilesOk(false); }, 7000);
    tiles.addTo(map);
    map.on("click", () => setSelected(null));

    const layers = {};
    const mk = (p, group) => {
      const poly = L.polygon(p.latlngs, { color: "#888", weight: 1 });
      poly.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelected((cur) => (cur && cur.id === p.id ? null : p));
      });
      poly.bindTooltip(p.name, { sticky: true, direction: "top", className: "zonetip" });
      layers[p.id] = poly;
      poly.addTo(group);
    };
    const hoodGroup = L.layerGroup();
    HOOD_CELLS.forEach((p) => mk(p, hoodGroup));
    const greenGroup = L.layerGroup();
    GREEN_SHAPES.forEach((p) => mk(p, greenGroup));
    leafletRef.current = { map, hoodGroup, greenGroup, layers, labelMode: "" };
    map.on("zoomend", syncLeaflet);
    syncLeaflet();
    return () => { dead = true; clearTimeout(failTimer); map.remove(); leafletRef.current = null; };
  }, [useTiles]);

  useEffect(() => { syncLeaflet(); }, [states, selected, tab, useTiles, view]);

  // ——— Drawn-map pan/zoom (fallback mode) ———
  useEffect(() => {
    if (view !== "map" || useTiles || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([1, 12]).on("zoom", (e) => setTf(e.transform));
    svg.call(zoom).on("dblclick.zoom", null);
    zoomRef.current = zoom;
    return () => svg.on(".zoom", null);
  }, [view, useTiles]);

  const zoomBy = (f) => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(220).call(zoomRef.current.scaleBy, f);
  };
  const zoomReset = () => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(280).call(zoomRef.current.transform, d3.zoomIdentity);
  };

  const places = PLACES[tab];
  const total = places.length;
  const visited = places.filter((p) => states[p.id] === 2).length;
  const wanted = places.filter((p) => states[p.id] === 1).length;
  const pct = total ? Math.round((visited / total) * 100) : 0;

  const byArea = useMemo(() => {
    const groups = {};
    for (const p of places) (groups[p.area] = groups[p.area] || []).push(p);
    return AREA_ORDER.filter((a) => groups[a]).map((a) => [a, groups[a]]);
  }, [tab]);

  const matches = (p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "todo" && p.state !== 0) return false;
    if (filter === "want" && p.state !== 1) return false;
    if (filter === "visited" && p.state !== 2) return false;
    if (tagFilter && !(tags[p.id] || []).includes(tagFilter)) return false;
    return true;
  };

  const resetAll = () => {
    if (!confirm("Clear all progress for both lists? This can't be undone.")) return;
    setStates({}); setTags({});
    metaRef.current = {};
    persistLocalSoon({}, {});
    if (cloudEnabled && session) {
      const wipe = [...new Set([...Object.keys(states), ...Object.keys(tags)])].map((id) => ({
        place_id: id, state: 0, tags: [], updated_at: new Date().toISOString(),
      }));
      pushPlaces(wipe).catch(() => {});
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setSaveNote("Share link copied!");
    } catch (e) {
      prompt("Copy your share link:", shareLink);
    }
    setTimeout(() => setSaveNote(""), 2000);
  };

  const loadRankings = async () => {
    if (!cloudEnabled) return;
    setLbLoading(true);
    try {
      const [lb, sc] = await Promise.all([
        fetchLeaderboard(),
        session ? fetchMyScore() : Promise.resolve(null),
      ]);
      setLeaderboard(lb);
      setMyScore(sc);
    } catch (e) {
      setLeaderboard([]);
    }
    setLbLoading(false);
  };

  useEffect(() => {
    if (view === "rank") loadRankings();
  }, [view, session && session.user.id]);

  const saveName = async () => {
    const name = nameDraft.trim().slice(0, 24);
    try {
      await updateProfile({ display_name: name });
      setProfile((p) => ({ ...(p || {}), display_name: name }));
      setSaveNote("Name saved");
      setTimeout(() => setSaveNote(""), 1500);
      loadRankings();
    } catch (e) {
      alert("Couldn't save your name — try again.");
    }
  };

  const toggleLeaderboard = async () => {
    const next = !(profile && profile.on_leaderboard);
    try {
      await updateProfile({ on_leaderboard: next });
      setProfile((p) => ({ ...(p || {}), on_leaderboard: next }));
      loadRankings();
    } catch (e) {
      alert("Couldn't update that — try again.");
    }
  };

  const sendMagicLink = async () => {
    const email = authEmail.trim();
    if (!email) return;
    try {
      const { error } = await signInWithEmail(email);
      if (error) throw error;
      setAuthSent(true);
    } catch (e) {
      alert("Couldn't send the sign-in link: " + (e.message || "unknown error"));
    }
  };

  const pill = (active) => ({
    padding: "7px 14px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
    border: "1.5px solid " + (active ? "#16161A" : "#D6D6D1"),
    background: active ? "#16161A" : "#FFF", color: active ? "#FFF" : "#3C3C42",
    fontFamily: "inherit",
  });

  const showLabels = tf.k >= (tab === "hoods" ? 2.4 : 1.6);
  const labelSize = Math.max(7, 12.5 / tf.k);
  const shapes = tab === "hoods" ? HOOD_CELLS : GREEN_SHAPES;
  const selState = selected ? states[selected.id] || 0 : 0;
  const selColor = selected ? AREA_COLORS[selected.area] || "#16161A" : "#16161A";
  const selTags = selected ? tags[selected.id] || [] : [];

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif", background: "#FFF", minHeight: "100vh", color: "#16161A" }}>

      {/* Header */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <RoundelMark size={46} />
            <h1 style={{ fontWeight: 800, fontSize: 25, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.05 }}>
              Patch Map<br />London{readOnly && <span style={{ fontWeight: 600, fontSize: 14, color: "#6B6B70" }}> · a shared map</span>}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "#6B6B70" }}>
              {saveNote || (readOnly ? "read-only view" : session ? "synced to your account" : "progress saves in this browser")}
            </span>
            {cloudEnabled && !readOnly && (
              session ? (
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="chip" onClick={copyShareLink} title={shareLink}
                    style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1.5px solid #16161A", background: "#16161A", color: "#FFF" }}>
                    Share my map
                  </button>
                  <button className="chip" onClick={() => signOut()}
                    style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1.5px solid #D6D6D1", background: "#FFF", color: "#3C3C42" }}>
                    Sign out
                  </button>
                </span>
              ) : (
                <button className="chip" onClick={() => { setAuthOpen(true); setAuthSent(false); }}
                  style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1.5px solid #16161A", background: "#FFF", color: "#16161A" }}>
                  Sign in to sync
                </button>
              )
            )}
          </div>
        </div>

        {cloudEnabled && !readOnly && !session && !nudgeDismissed && (visited + wanted) >= 3 && (
          <div style={{ margin: "10px 0 0", padding: "11px 14px", borderRadius: 10, background: "#16161A", color: "#FFF", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, flex: 1, minWidth: 180 }}>
              You're building a great map — sign in to save it across devices, add photos and join the leaderboard.
            </span>
            <button className="chip" onClick={() => { setAuthOpen(true); setAuthSent(false); }}
              style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, border: "none", background: "#FFF", color: "#16161A" }}>
              Sign in
            </button>
            <button onClick={() => { setNudgeDismissed(true); try { localStorage.setItem("lof-nudge-x", "1"); } catch (e) {} }}
              aria-label="Dismiss" className="chip"
              style={{ padding: "7px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#FFF" }}>
              Not now
            </button>
          </div>
        )}

        {readOnly && (
          <div style={{ margin: "10px 0 0", padding: "9px 13px", borderRadius: 10, background: "#F4F1E8", border: "1px solid #E3DFD2", fontSize: 13.5, color: "#55555B" }}>
            {shareError
              ? "Couldn't load this shared map — the link may be wrong, or sharing isn't set up on this site."
              : <>You're viewing a friend's exploration map. <a href={window.location.pathname} style={{ color: "#16161A", fontWeight: 700 }}>Start your own →</a></>}
          </div>
        )}

        <div style={{ margin: "12px 0 4px" }}>
          <div style={{ position: "relative", height: 24 }}>
            <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 4, borderRadius: 2, background: "#E8E8E4" }} />
            <div className="marker" style={{ position: "absolute", top: 10, left: 0, width: `${pct}%`, height: 4, borderRadius: 2, background: "#16161A", transition: "width 300ms ease" }} />
            {[0, 25, 50, 75, 100].map((t) => (
              <div key={t} style={{ position: "absolute", top: 6, left: `calc(${t}% - 1px)`, width: 2, height: 12, background: t <= pct ? "#16161A" : "#C9C9C4" }} />
            ))}
            <div className="marker" style={{ position: "absolute", top: 3, left: `calc(${pct}% - 9px)`, width: 18, height: 18, borderRadius: "50%", background: "#FFF", border: "4px solid #16161A", transition: "left 300ms ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "#55555B" }}>
            <span>{visited}/{total} visited · {wanted} on the list</span>
            <span style={{ fontWeight: 500, color: "#16161A" }}>{pct}%</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="chip" style={pill(tab === "hoods")} onClick={() => { setTab("hoods"); setSelected(null); }}>Neighbourhoods</button>
            <button className="chip" style={pill(tab === "green")} onClick={() => { setTab("green"); setSelected(null); }}>Green spaces</button>
          </div>
          <div style={{ flex: 1 }} />
          {view === "map" && (
            <div style={{ display: "flex", border: "1.5px solid #D6D6D1", borderRadius: 999, overflow: "hidden" }}>
              <button className="chip" onClick={() => { setMapStyle("street"); setTilesOk(null); }}
                style={{ padding: "7px 13px", fontSize: 13, fontWeight: 600, border: "none", background: mapStyle === "street" ? "#3C3C42" : "#FFF", color: mapStyle === "street" ? "#FFF" : "#3C3C42", borderRadius: 0 }}>
                Street
              </button>
              <button className="chip" onClick={() => setMapStyle("drawn")}
                style={{ padding: "7px 13px", fontSize: 13, fontWeight: 600, border: "none", background: mapStyle === "drawn" ? "#3C3C42" : "#FFF", color: mapStyle === "drawn" ? "#FFF" : "#3C3C42", borderRadius: 0 }}>
                Drawn
              </button>
            </div>
          )}
          <div style={{ display: "flex", border: "1.5px solid #16161A", borderRadius: 999, overflow: "hidden" }}>
            {[["map", "Map"], ["list", "List"], ...(cloudEnabled && !readOnly ? [["rank", "Rankings"]] : [])].map(([key, label]) => (
              <button key={key} className="chip" onClick={() => setView(key)}
                style={{ padding: "7px 16px", fontSize: 14, fontWeight: 600, border: "none", background: view === key ? "#16161A" : "#FFF", color: view === key ? "#FFF" : "#16161A", borderRadius: 0 }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ——— MAP VIEW ——— */}
      {view === "map" && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 40px" }}>
          <div style={{ position: "relative" }}>
            {useTiles ? (
              <div ref={mapDivRef} style={{ width: "100%", height: "min(72vh, 640px)", borderRadius: 12, border: "1.5px solid #D6D6D1", overflow: "hidden", background: "#EAF2F7" }} />
            ) : (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`}
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, border: "1.5px solid #D6D6D1", background: "#F6F4EC", touchAction: "none", cursor: "grab" }}
                role="img" aria-label="Map of Greater London neighbourhoods and green spaces"
              >
                <g transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`}>
                  <g>
                    {GREEN_SHAPES.map((g) => (
                      <path key={"base" + g.id} d={g.path} fill="#C5DBBA" opacity={0.7} />
                    ))}
                    {ROAD_PATHS.map((d, i) => (
                      <path key={"rd" + i} d={d} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                    ))}
                    {ROAD_PATHS.map((d, i) => (
                      <path key={"rd2" + i} d={d} fill="none" stroke="#D9D5C6" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {BASE_WATER.map((d, i) => (
                      <path key={"wt" + i} d={d} fill="none" stroke="#9FC2DA" strokeWidth={i === 0 ? 5 : 3.5} strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    <path d={THAMES_PATH} fill="none" stroke="#8FB8D4" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
                  </g>

                  {tab === "green" && HOOD_CELLS.map((c) => (
                    <path key={"ghost" + c.id} d={c.path} fill="none" stroke="#B9B6A8" strokeWidth={0.8 / Math.sqrt(tf.k)} opacity={0.6} />
                  ))}

                  {shapes.map((p) => {
                    const state = states[p.id] || 0;
                    const color = AREA_COLORS[p.area] || "#16161A";
                    const isGreenTab = tab === "green";
                    const isSel = selected && selected.id === p.id;
                    const fill = state === 0 ? (isGreenTab ? "#7FA86F" : "#6B6960") : color;
                    const fop = state === 2 ? 0.5 : state === 1 ? 0.18 : isGreenTab ? 0.25 : 0.06;
                    return (
                      <path
                        key={p.id}
                        className="cell"
                        d={p.path}
                        fill={fill}
                        fillOpacity={fop}
                        stroke={isSel ? "#16161A" : state === 0 ? "#A9A698" : color}
                        strokeOpacity={isSel ? 1 : state === 0 ? 0.7 : 0.95}
                        strokeWidth={(isSel ? 2.6 : state === 0 ? 0.9 : 2) / Math.sqrt(tf.k)}
                        strokeDasharray={!isSel && state === 1 ? `${6 / tf.k} ${4 / tf.k}` : undefined}
                        onClick={() => setSelected(isSel ? null : p)}
                      >
                        <title>{p.name} — {STATE_LABEL[state]}</title>
                      </path>
                    );
                  })}

                  {showLabels && shapes.map((p) => {
                    const state = states[p.id] || 0;
                    const color = AREA_COLORS[p.area] || "#16161A";
                    return (
                      <text key={"t" + p.id} className="maplabel" x={p.x} y={p.y}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={labelSize} fontWeight={state === 2 ? 800 : 600}
                        fill={state === 2 ? color : "#3A3A40"}
                        stroke="#F6F4EC" strokeWidth={2.6 / tf.k} paintOrder="stroke">
                        {p.name}
                      </text>
                    );
                  })}
                </g>
              </svg>
            )}

            {mapStyle === "street" && tilesOk === null && (
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1200, background: "rgba(22,22,26,0.8)", color: "#FFF", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}>
                loading street map…
              </div>
            )}

            {/* ——— Place card ——— */}
            {selected && (
              <div className="placecard" style={{
                position: "absolute", top: 10, right: 10, width: "min(252px, 58%)", zIndex: 1200,
                background: "#FFF", border: "1.5px solid #D6D6D1", borderRadius: 12,
                overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,0.16)",
              }}>
                <div style={{ position: "relative" }}>
                  {(userPhoto || photo) ? (
                    <img src={userPhoto || photo} alt={selected.name}
                      style={{ display: "block", width: "100%", height: 118, objectFit: "cover" }}
                      onError={() => { if (!userPhoto) setPhoto(null); else setUserPhoto(null); }} />
                  ) : (
                    <Postcard name={selected.name} area={selected.area} kind={selected.kind} />
                  )}
                  {userPhoto && (
                    <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(22,22,26,0.7)", color: "#FFF", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 600 }}>
                      {readOnly ? "their photo" : "your photo"}
                    </span>
                  )}
                  <button onClick={() => setSelected(null)} aria-label="Close"
                    style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(22,22,26,0.75)", color: "#FFF", fontSize: 13, lineHeight: 1, cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
                <div style={{ padding: "10px 12px 12px", maxHeight: "min(46vh, 300px)", overflowY: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: selColor, flexShrink: 0 }} />
                    <strong style={{ fontSize: 15.5, letterSpacing: "-0.01em" }}>{selected.name}</strong>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#6B6B70", margin: "3px 0 9px" }}>{selected.blurb}</div>

                  {readOnly ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: selColor }}>
                        {STATE_LABEL[selState] === "unexplored" ? "Not visited yet" : STATE_LABEL[selState] === "want to go" ? "On their list" : "Visited ✓"}
                      </div>
                      {selTags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                          {selTags.map((t) => (
                            <span key={t} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: selColor, color: "#FFF" }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 5 }}>
                        {[[1, "Want to go"], [2, "Visited"]].map(([s, label]) => (
                          <button key={s} className="chip"
                            onClick={() => setStateTo(selected.id, selState === s ? 0 : s)}
                            style={{
                              flex: 1, padding: "6px 4px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                              border: `1.5px ${s === 1 ? "dashed" : "solid"} ${selState === s ? selColor : "#D6D6D1"}`,
                              background: selState === s ? (s === 2 ? selColor : "#FFF") : "#FFF",
                              color: selState === s ? (s === 2 ? "#FFF" : selColor) : "#3C3C42",
                            }}>
                            {selState === s ? "✓ " : ""}{label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                        <button className="chip" onClick={() => fileRef.current && fileRef.current.click()}
                          style={{ flex: 1, padding: "5px 4px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1px solid #D6D6D1", background: "#FFF", color: "#3C3C42" }}>
                          📷 {userPhoto ? "Replace my photo" : "Add my photo"}
                        </button>
                        {userPhoto && (
                          <button className="chip" onClick={removeUserPhoto}
                            style={{ padding: "5px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1px solid #D6D6D1", background: "#FFF", color: "#8A4040" }}>
                            Remove
                          </button>
                        )}
                      </div>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickFile} />
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A8A90", marginBottom: 5 }}>My impressions</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {allTags.map((t) => {
                            const on = selTags.includes(t);
                            return (
                              <button key={t} className="chip" onClick={() => toggleTag(selected.id, t)}
                                style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, border: "1px solid " + (on ? selColor : "#D6D6D1"), background: on ? selColor : "#FFF", color: on ? "#FFF" : "#55555B" }}>
                                {t}
                              </button>
                            );
                          })}
                        </div>
                        <input value={newTag} onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addCustomTag(); }}
                          placeholder="add your own, press enter…"
                          style={{ marginTop: 6, width: "100%", boxSizing: "border-box", padding: "5px 8px", borderRadius: 7, fontSize: 11.5, border: "1px solid #D6D6D1", fontFamily: "inherit", outlineColor: "#16161A" }} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {!useTiles && (
              <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 1200 }}>
                {[["+", () => zoomBy(1.5)], ["−", () => zoomBy(1 / 1.5)], ["⌂", zoomReset]].map(([label, fn]) => (
                  <button key={label} className="chip" onClick={fn} aria-label={label === "⌂" ? "Reset view" : label === "+" ? "Zoom in" : "Zoom out"}
                    style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #D6D6D1", background: "rgba(255,255,255,0.95)", fontSize: 17, fontWeight: 600, lineHeight: 1 }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ position: "absolute", bottom: useTiles ? 26 : 10, left: 10, zIndex: 1200, background: "rgba(255,255,255,0.94)", border: "1px solid #D6D6D1", borderRadius: 10, padding: "7px 11px", fontSize: 12, lineHeight: 1.85, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
              <div><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: "rgba(107,105,96,0.08)", border: "1px solid #B9B6A8", marginRight: 7, verticalAlign: -1 }} />Unexplored</div>
              <div><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: "rgba(214,64,44,0.18)", border: "1.5px dashed #D6402C", marginRight: 7, verticalAlign: -1 }} />Want to go</div>
              <div><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: "rgba(214,64,44,0.5)", border: "1.5px solid #D6402C", marginRight: 7, verticalAlign: -1 }} />Visited</div>
            </div>
          </div>
          <p style={{ fontSize: 13.5, color: "#6B6B70", margin: "10px 2px 0" }}>
            {tilesOk === false && mapStyle === "street"
              ? "Couldn't load street tiles (offline?) — showing the drawn map instead. Tap Street to retry."
              : readOnly
              ? "Tap any area to see what they thought of it."
              : "Tap any area to open its card — mark it, tag it, add a photo. Zone names appear as you zoom in."}
          </p>
        </div>
      )}

      {/* ——— LIST VIEW ——— */}
      {view === "list" && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 60px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 6px", alignItems: "center" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a place…"
              style={{ flex: "1 1 170px", padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1.5px solid #D6D6D1", fontFamily: "inherit", outlineColor: "#16161A" }} />
            {[["all", "All"], ["todo", "Unexplored"], ["want", "Want to go"], ["visited", "Visited"]].map(([key, label]) => (
              <button key={key} className="chip" onClick={() => setFilter(key)}
                style={{ ...pill(filter === key), fontSize: 13, padding: "6px 11px" }}>{label}</button>
            ))}
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
              style={{ padding: "7px 9px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "1.5px solid " + (tagFilter ? "#16161A" : "#D6D6D1"), background: "#FFF", color: tagFilter ? "#16161A" : "#3C3C42", fontFamily: "inherit", cursor: "pointer" }}>
              <option value="">any impression</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {!loaded ? (
            <p style={{ color: "#6B6B70", fontFamily: "'DM Mono', monospace", fontSize: 14, padding: "30px 0" }}>Loading your map…</p>
          ) : (
            byArea.map(([area, items]) => {
              const color = AREA_COLORS[area] || "#16161A";
              const withState = items.map((p) => ({ ...p, state: states[p.id] || 0 }));
              const shown = withState.filter((p) => matches(p));
              const done = withState.filter((p) => p.state === 2).length;
              if (shown.length === 0) return null;
              return (
                <section key={area} style={{ display: "flex", gap: 14, margin: "22px 0" }}>
                  <div aria-hidden style={{ width: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 9 }}>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{area}</h2>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6B6B70" }}>{done}/{items.length}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {shown.map(({ name, id, state }) => {
                        const base = { padding: "6px 12px", borderRadius: 999, fontSize: 13.5, fontWeight: 500, cursor: readOnly ? "default" : "pointer" };
                        const s = state === 2
                          ? { ...base, background: color, color: "#FFF", border: `1.5px solid ${color}` }
                          : state === 1
                          ? { ...base, background: "#FFF", color, border: `1.5px dashed ${color}`, fontWeight: 600 }
                          : { ...base, background: "#FFF", color: "#3C3C42", border: "1.5px solid #D6D6D1" };
                        return (
                          <button key={id} className="chip" style={s} onClick={() => !readOnly && cycleState(id)}
                            aria-label={`${name} — ${STATE_LABEL[state]}${readOnly ? "" : ". Tap to change"}`} title={`${name} — ${STATE_LABEL[state]}`}>
                            {state === 1 && <span aria-hidden style={{ marginRight: 5 }}>◌</span>}
                            {state === 2 && <span aria-hidden style={{ marginRight: 5 }}>●</span>}
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })
          )}

          <div style={{ marginTop: 36, paddingTop: 14, borderTop: "1px solid #ECECE8", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#8A8A90" }}>
              Perceived neighbourhoods, not boroughs.{cloudEnabled && !readOnly && !session ? " Sign in to sync across devices." : ""}
            </span>
            {!readOnly && (
              <button onClick={resetAll} className="chip" style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, border: "1.5px solid #D6D6D1", background: "#FFF", color: "#8A4040" }}>
                Reset everything
              </button>
            )}
          </div>
        </div>
      )}

      {/* ——— RANKINGS VIEW ——— */}
      {view === "rank" && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 60px" }}>
          {!session ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#55555B" }}>
              <p style={{ fontSize: 15, marginBottom: 14 }}>Sign in to earn points and join the leaderboard.</p>
              <button className="chip" onClick={() => { setAuthOpen(true); setAuthSent(false); }}
                style={{ padding: "9px 18px", borderRadius: 999, fontSize: 14, fontWeight: 700, border: "none", background: "#16161A", color: "#FFF" }}>
                Sign in to sync
              </button>
            </div>
          ) : (
            <>
              {/* My score */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, margin: "6px 0 8px" }}>
                {[
                  ["Your score", myScore ? myScore.total : "—", "#16161A"],
                  ["Visited · 10 each", myScore ? myScore.visited_pts : "—", "#1B8A4C"],
                  ["Tagged · 5 each", myScore ? myScore.tag_pts : "—", "#E08712"],
                  ["Photos · 5 each", myScore ? myScore.photo_pts : "—", "#A23073"],
                ].map(([label, val, col]) => (
                  <div key={label} style={{ background: "#F6F4EC", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, color: "#6B6B70", fontFamily: "'DM Mono', monospace" }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: col, letterSpacing: "-0.02em" }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Display name + opt-in */}
              <div style={{ background: "#FFF", border: "1.5px solid #E3DFD2", borderRadius: 12, padding: "14px 16px", margin: "8px 0 20px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 9 }}>How you appear on the leaderboard</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={24}
                    placeholder="Your display name"
                    style={{ flex: "1 1 160px", padding: "8px 12px", borderRadius: 8, fontSize: 14, border: "1.5px solid #D6D6D1", fontFamily: "inherit", outlineColor: "#16161A" }} />
                  <button className="chip" onClick={saveName}
                    style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, border: "1.5px solid #16161A", background: "#FFF", color: "#16161A" }}>
                    Save name
                  </button>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, cursor: "pointer", fontSize: 13.5 }}>
                  <span onClick={toggleLeaderboard} style={{ position: "relative", width: 40, height: 23, borderRadius: 999, background: profile && profile.on_leaderboard ? "#1B8A4C" : "#D6D6D1", transition: "background 150ms", flexShrink: 0 }}>
                    <span style={{ position: "absolute", top: 2.5, left: profile && profile.on_leaderboard ? 19.5 : 2.5, width: 18, height: 18, borderRadius: "50%", background: "#FFF", transition: "left 150ms" }} />
                  </span>
                  <span>Show my name on the leaderboard{profile && profile.on_leaderboard === false ? " — you currently appear as \u201cAnonymous explorer\u201d" : ""}</span>
                </label>
                <div style={{ fontSize: 12, color: "#8A8A90", marginTop: 7 }}>
                  Everyone's on the leaderboard. With this off, others see you as "Anonymous explorer" — your email and which places you've been are never shown either way.
                </div>
              </div>

              {/* Leaderboard */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Leaderboard</h2>
                <button className="chip" onClick={loadRankings} style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1.5px solid #D6D6D1", background: "#FFF", color: "#3C3C42" }}>
                  Refresh
                </button>
              </div>
              {lbLoading ? (
                <p style={{ color: "#6B6B70", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>Loading…</p>
              ) : leaderboard && leaderboard.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {leaderboard.map((r, i) => {
                    const medal = r.rank === 1 ? "#E0A012" : r.rank === 2 ? "#9AA0A6" : r.rank === 3 ? "#B5763A" : null;
                    const mine = profile && (r.display_name === (profile.display_name || "")) && profile.on_leaderboard;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: mine ? "#F1F5EE" : "#FFF", border: "1.5px solid " + (mine ? "#1B8A4C" : "#ECECE8") }}>
                        <div style={{ width: 28, textAlign: "center", fontWeight: 800, fontSize: 15, color: medal || "#9A978B" }}>{r.rank}</div>
                        <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.display_name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#8A8A90" }}>{r.hoods} hoods · {r.greens} parks · {r.photos} photos</div>
                        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", minWidth: 48, textAlign: "right" }}>{r.score}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "#6B6B70", fontSize: 14 }}>
                  No one's on the leaderboard yet. Flip the toggle above to be the first!
                </p>
              )}
              <p style={{ fontSize: 12.5, color: "#8A8A90", marginTop: 16 }}>
                Scoring: 10 points per place visited, 5 for tagging a place (once each), 5 for adding a photo.
              </p>
            </>
          )}
        </div>
      )}

      {/* ——— Sign-in modal ——— */}
      {authOpen && (
        <div onClick={() => setAuthOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(22,22,26,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 14, padding: "22px 22px 18px", width: "min(340px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800 }}>Sync your map</h3>
            {authSent ? (
              <p style={{ fontSize: 14, color: "#55555B", margin: 0 }}>
                Magic link sent to <strong>{authEmail}</strong> — open it on this device and you'll be signed in. You can close this.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 13.5, color: "#55555B", margin: "0 0 14px" }}>
                  Sign in so your progress, tags and photos follow you across devices — and you'll get a shareable link to your map.
                </p>
                <button className="chip" onClick={() => signInWithGoogle().catch(() => alert("Couldn't start Google sign-in."))}
                  style={{ width: "100%", padding: "10px", borderRadius: 9, fontSize: 14, fontWeight: 700, border: "1.5px solid #D6D6D1", background: "#FFF", color: "#16161A", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                  <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
                  Continue with Google
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "#ECECE8" }} />
                  <span style={{ fontSize: 12, color: "#9A978B" }}>or by email</span>
                  <div style={{ flex: 1, height: 1, background: "#ECECE8" }} />
                </div>
                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMagicLink(); }}
                  placeholder="you@example.com"
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, fontSize: 14, border: "1.5px solid #D6D6D1", fontFamily: "inherit", outlineColor: "#16161A" }} />
                <button className="chip" onClick={sendMagicLink}
                  style={{ marginTop: 10, width: "100%", padding: "9px", borderRadius: 9, fontSize: 14, fontWeight: 700, border: "none", background: "#16161A", color: "#FFF" }}>
                  Send magic link
                </button>
              </>
            )}
            <button onClick={() => setAuthOpen(false)} className="chip"
              style={{ marginTop: 8, width: "100%", padding: "7px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "1.5px solid #D6D6D1", background: "#FFF", color: "#55555B" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ——— First-visit onboarding ——— */}
      {showOnboard && !readOnly && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(22,22,26,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#FFF", borderRadius: 14, padding: "24px 24px 18px", width: "min(380px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "0 0 12px" }}>
              <RoundelMark size={46} />
              <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800, lineHeight: 1.05 }}>Patch Map<br />London</h3>
            </div>
            <p style={{ fontSize: 14, color: "#3C3C42", margin: "0 0 10px", lineHeight: 1.55 }}>
              Your personal map of every London neighbourhood and green space. Tap an area on the map to open its card — mark it <strong>want to go</strong> or <strong>visited</strong>, tag your impressions, and add your own photo.
            </p>
            <p style={{ fontSize: 14, color: "#3C3C42", margin: "0 0 14px", lineHeight: 1.55 }}>
              Watch the city fill with colour as you explore. The list view lets you search and filter — including by your own tags.
            </p>
            <button className="chip" onClick={() => { setShowOnboard(false); try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (e) {} }}
              style={{ width: "100%", padding: "10px", borderRadius: 9, fontSize: 14.5, fontWeight: 700, border: "none", background: "#16161A", color: "#FFF" }}>
              Start exploring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
