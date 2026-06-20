import { useState, useRef, useEffect, useCallback } from "react";

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── TopoJSON → rings [[lon,lat], …] ─────────────────────────────────────────
function decodeTopo(topo) {
  const { arcs: rawArcs, transform } = topo;
  const [kx, ky] = transform.scale;
  const [dx, dy] = transform.translate;

  // delta-decode + apply transform → [lon, lat]
  const arcs = rawArcs.map((arc) => {
    let x = 0,
      y = 0;
    return arc.map((p) => {
      x += p[0];
      y += p[1];
      return [x * kx + dx, y * ky + dy];
    });
  });

  const getArc = (i) => {
    const a = arcs[i < 0 ? ~i : i];
    return i < 0 ? [...a].reverse() : a;
  };

  const makeRing = (ids) => {
    const pts = [];
    for (const id of ids) {
      const a = getArc(id);
      pts.push(...(pts.length ? a.slice(1) : a));
    }
    return pts;
  };

  const extract = (geom) => {
    if (!geom) return [];
    if (geom.type === "Polygon") return geom.arcs.map(makeRing);
    if (geom.type === "MultiPolygon")
      return geom.arcs.flatMap((p) => p.map(makeRing));
    if (geom.type === "GeometryCollection")
      return geom.geometries.flatMap(extract);
    return [];
  };

  return extract(topo.objects.land);
}

// ─── City DB ──────────────────────────────────────────────────────────────────
const CITIES = {
  Paris: { lat: 48.8566, lon: 2.3522, country: "France", iata: "CDG" },
  London: { lat: 51.5074, lon: -0.1278, country: "UK", iata: "LHR" },
  "New York": { lat: 40.7128, lon: -74.006, country: "USA", iata: "JFK" },
  Tokyo: { lat: 35.6762, lon: 139.6503, country: "Japan", iata: "NRT" },
  Dubai: { lat: 25.2048, lon: 55.2708, country: "UAE", iata: "DXB" },
  Sydney: { lat: -33.8688, lon: 151.2093, country: "Australia", iata: "SYD" },
  Madrid: { lat: 40.4168, lon: -3.7038, country: "Spain", iata: "MAD" },
  Barcelona: { lat: 41.3851, lon: 2.1734, country: "Spain", iata: "BCN" },
  Berlin: { lat: 52.52, lon: 13.405, country: "Germany", iata: "BER" },
  Rome: { lat: 41.9028, lon: 12.4964, country: "Italy", iata: "FCO" },
  Tunis: { lat: 36.8065, lon: 10.1815, country: "Tunisia", iata: "TUN" },
  Djerba: { lat: 33.8075, lon: 10.8451, country: "Tunisia", iata: "DJE" },
  Monastir: { lat: 35.7643, lon: 10.8113, country: "Tunisia", iata: "MIR" },
  Casablanca: {
    lat: 33.5731,
    lon: -7.5898,
    country: "Morocco",
    iata: "CMN",
  },
  Cairo: { lat: 30.0444, lon: 31.2357, country: "Egypt", iata: "CAI" },
  Istanbul: { lat: 41.0082, lon: 28.9784, country: "Turkey", iata: "IST" },
  Amsterdam: {
    lat: 52.3676,
    lon: 4.9041,
    country: "Netherlands",
    iata: "AMS",
  },
  Brussels: { lat: 50.8503, lon: 4.3517, country: "Belgium", iata: "BRU" },
  Vienna: { lat: 48.2082, lon: 16.3738, country: "Austria", iata: "VIE" },
  Zurich: {
    lat: 47.3769,
    lon: 8.5417,
    country: "Switzerland",
    iata: "ZRH",
  },
  Geneva: {
    lat: 46.2044,
    lon: 6.1432,
    country: "Switzerland",
    iata: "GVA",
  },
  Lisbon: { lat: 38.7223, lon: -9.1393, country: "Portugal", iata: "LIS" },
  Milan: { lat: 45.4654, lon: 9.1859, country: "Italy", iata: "MXP" },
  Munich: { lat: 48.1351, lon: 11.582, country: "Germany", iata: "MUC" },
  Frankfurt: { lat: 50.1109, lon: 8.6821, country: "Germany", iata: "FRA" },
  "Los Angeles": {
    lat: 34.0522,
    lon: -118.2437,
    country: "USA",
    iata: "LAX",
  },
  "San Francisco": {
    lat: 37.7749,
    lon: -122.4194,
    country: "USA",
    iata: "SFO",
  },
  Chicago: { lat: 41.8781, lon: -87.6298, country: "USA", iata: "ORD" },
  Miami: { lat: 25.7617, lon: -80.1918, country: "USA", iata: "MIA" },
  Montreal: { lat: 45.5017, lon: -73.5673, country: "Canada", iata: "YUL" },
  Toronto: { lat: 43.6532, lon: -79.3832, country: "Canada", iata: "YYZ" },
  Singapore: {
    lat: 1.3521,
    lon: 103.8198,
    country: "Singapore",
    iata: "SIN",
  },
  Bangkok: { lat: 13.7563, lon: 100.5018, country: "Thailand", iata: "BKK" },
  Seoul: { lat: 37.5665, lon: 126.978, country: "South Korea", iata: "ICN" },
  "Hong Kong": {
    lat: 22.3193,
    lon: 114.1694,
    country: "China",
    iata: "HKG",
  },
  Mumbai: { lat: 19.076, lon: 72.8777, country: "India", iata: "BOM" },
  Delhi: { lat: 28.6139, lon: 77.209, country: "India", iata: "DEL" },
  Doha: { lat: 25.2854, lon: 51.531, country: "Qatar", iata: "DOH" },
  "Abu Dhabi": { lat: 24.4539, lon: 54.3773, country: "UAE", iata: "AUH" },
  Nice: { lat: 43.7102, lon: 7.262, country: "France", iata: "NCE" },
  Lyon: { lat: 45.764, lon: 4.8357, country: "France", iata: "LYS" },
  Marseille: { lat: 43.2965, lon: 5.3698, country: "France", iata: "MRS" },
  Bordeaux: { lat: 44.8378, lon: -0.5792, country: "France", iata: "BOD" },
  Toulouse: { lat: 43.6047, lon: 1.4442, country: "France", iata: "TLS" },
  Athens: { lat: 37.9838, lon: 23.7275, country: "Greece", iata: "ATH" },
  Prague: {
    lat: 50.0755,
    lon: 14.4378,
    country: "Czech Republic",
    iata: "PRG",
  },
  Warsaw: { lat: 52.2297, lon: 21.0122, country: "Poland", iata: "WAW" },
  Stockholm: { lat: 59.3293, lon: 18.0686, country: "Sweden", iata: "ARN" },
  Copenhagen: {
    lat: 55.6761,
    lon: 12.5683,
    country: "Denmark",
    iata: "CPH",
  },
  Dublin: { lat: 53.3498, lon: -6.2603, country: "Ireland", iata: "DUB" },
  Moscow: { lat: 55.7558, lon: 37.6173, country: "Russia", iata: "SVO" },
  "São Paulo": {
    lat: -23.5505,
    lon: -46.6333,
    country: "Brazil",
    iata: "GRU",
  },
  "Buenos Aires": {
    lat: -34.6037,
    lon: -58.3816,
    country: "Argentina",
    iata: "EZE",
  },
  "Mexico City": {
    lat: 19.4326,
    lon: -99.1332,
    country: "Mexico",
    iata: "MEX",
  },
  Jakarta: {
    lat: -6.2088,
    lon: 106.8456,
    country: "Indonesia",
    iata: "CGK",
  },
  "Kuala Lumpur": {
    lat: 3.139,
    lon: 101.6869,
    country: "Malaysia",
    iata: "KUL",
  },
  "Tel Aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", iata: "TLV" },
  Johannesburg: {
    lat: -26.2041,
    lon: 28.0473,
    country: "South Africa",
    iata: "JNB",
  },
  Nairobi: { lat: -1.2921, lon: 36.8219, country: "Kenya", iata: "NBO" },
  Vancouver: { lat: 49.2827, lon: -123.1207, country: "Canada", iata: "YVR" },
  Bali: { lat: -8.3405, lon: 115.092, country: "Indonesia", iata: "DPS" },
  Nantes: { lat: 47.2184, lon: -1.5536, country: "France", iata: "NTE" },
  Lille: { lat: 50.6292, lon: 3.0573, country: "France", iata: "LIL" },
};

// ─── Labels géographiques ─────────────────────────────────────────────────────
const CONTINENT_LABELS = [
  { lat: 5,   lon: 20,   label: "AFRIQUE",          size: 13 },
  { lat: 52,  lon: 12,   label: "EUROPE",            size: 11 },
  { lat: 45,  lon: 88,   label: "ASIE",              size: 15 },
  { lat: 50,  lon: -98,  label: "AMÉRIQUE DU NORD",  size: 11 },
  { lat: -15, lon: -56,  label: "AMÉRIQUE DU SUD",   size: 11 },
  { lat: -25, lon: 133,  label: "AUSTRALIE",         size: 11 },
  { lat: -82, lon: 0,    label: "ANTARCTIQUE",        size: 10 },
];

const OCEAN_LABELS = [
  { lat: 5,   lon: -170, label: "OCÉAN PACIFIQUE",   size: 13 },
  { lat: -30, lon: -130, label: "Pacifique Sud",      size: 9  },
  { lat: 5,   lon: -28,  label: "OCÉAN ATLANTIQUE",  size: 11 },
  { lat: -30, lon: -15,  label: "Atlantique Sud",     size: 9  },
  { lat: -25, lon: 76,   label: "OCÉAN INDIEN",      size: 11 },
  { lat: 83,  lon: 0,    label: "OCÉAN ARCTIQUE",    size: 9  },
  { lat: -58, lon: 30,   label: "OCÉAN AUSTRAL",     size: 9  },
];

const SEA_LABELS = [
  { lat: 36,  lon: 17,   label: "Mer Méditerranée",  size: 7.5 },
  { lat: 20,  lon: 38,   label: "Mer Rouge",          size: 7  },
  { lat: 56,  lon: 4,    label: "Mer du Nord",        size: 7  },
  { lat: 43,  lon: 33,   label: "Mer Noire",          size: 7  },
  { lat: 59,  lon: 21,   label: "Mer Baltique",       size: 6.5 },
  { lat: 26,  lon: 52,   label: "Golfe Persique",     size: 6.5 },
  { lat: 25,  lon: -90,  label: "Golfe du Mexique",   size: 7  },
  { lat: 15,  lon: -74,  label: "Mer des Caraïbes",   size: 7  },
  { lat: 13,  lon: 115,  label: "Mer de Chine",       size: 7  },
  { lat: 15,  lon: 85,   label: "Golfe du Bengale",   size: 7  },
  { lat: 64,  lon: -20,  label: "Mer du Groenland",   size: 6.5 },
  { lat: 70,  lon: 42,   label: "Mer de Barents",     size: 6.5 },
  { lat: 37,  lon: 25,   label: "Mer Égée",           size: 6  },
  { lat: 42,  lon: 15,   label: "Mer Adriatique",     size: 6  },
  { lat: 40,  lon: 22,   label: "",                    size: 6  }, // placeholder
  { lat: 30,  lon: 32,   label: "Canal de Suez",      size: 6  },
  { lat: 12,  lon: 50,   label: "Golfe d'Aden",       size: 6.5 },
  { lat: 8,   lon: -5,   label: "Golfe de Guinée",    size: 6.5 },
];

// Decode country borders from topojson
function decodeCountries(topo) {
  const { arcs: rawArcs, transform } = topo;
  const [kx, ky] = transform.scale;
  const [dx, dy] = transform.translate;
  const arcs = rawArcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(p => { x += p[0]; y += p[1]; return [x * kx + dx, y * ky + dy]; });
  });
  const getArc = i => { const a = arcs[i < 0 ? ~i : i]; return i < 0 ? [...a].reverse() : a; };
  const makeRing = ids => { const pts = []; for (const id of ids) { const a = getArc(id); pts.push(...(pts.length ? a.slice(1) : a)); } return pts; };
  const extract = geom => {
    if (!geom) return [];
    if (geom.type === 'Polygon') return geom.arcs.map(makeRing);
    if (geom.type === 'MultiPolygon') return geom.arcs.flatMap(p => p.map(makeRing));
    if (geom.type === 'GeometryCollection') return geom.geometries.flatMap(extract);
    return [];
  };
  return extract(topo.objects.countries);
}

// ─── Flat Map ─────────────────────────────────────────────────────────────────
function FlatMap({ trips }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const arcProgressRef = useRef({});
  const timeRef = useRef(0);
  const [landRings, setLandRings] = useState([]);
  const [countryRings, setCountryRings] = useState([]);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
      .then(r => r.json()).then(topo => setLandRings(decodeTopo(topo))).catch(() => {});
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json()).then(topo => setCountryRings(decodeCountries(topo))).catch(() => {});
  }, []);

  // Equirectangular projection: lon/lat → canvas x/y
  const project = useCallback((lat, lon, W, H) => {
    const x = ((lon + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    return { x, y };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = canvas._dpr || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    timeRef.current += 0.016;

    ctx.clearRect(0, 0, W, H);

    // Ocean background
    ctx.fillStyle = "#c8dce8";
    ctx.fillRect(0, 0, W, H);

    // Land fill
    landRings.forEach((ring) => {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const { x, y } = project(lat, lon, W, H);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "#d8e4c8";
      ctx.fill();
    });

    // Country borders
    countryRings.forEach((ring) => {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const { x, y } = project(lat, lon, W, H);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(160,170,140,0.7)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // Grid lines
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = ((lon + 180) / 360) * W;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H);
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.5; ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const y = ((90 - lat) / 180) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
      ctx.strokeStyle = lat === 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)";
      ctx.lineWidth = lat === 0 ? 1 : 0.5; ctx.stroke();
    }

    // Tropic lines (Cancer & Capricorne)
    [23.5, -23.5].forEach(lat => {
      const y = ((90 - lat) / 180) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
      ctx.strokeStyle = "rgba(200,180,100,0.25)"; ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
    });

    // Border
    ctx.strokeStyle = "rgba(60,60,70,0.25)"; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);

    // ── Océans & mers labels ──
    const scale = Math.min(W, H) / 400;
    OCEAN_LABELS.forEach(({ lat, lon, label, size }) => {
      const { x, y } = project(lat, lon, W, H);
      ctx.save();
      ctx.font = `italic ${Math.round(size * scale + 7)}px Georgia, serif`;
      ctx.fillStyle = "rgba(80,110,140,0.65)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
      ctx.restore();
    });

    SEA_LABELS.forEach(({ lat, lon, label, size }) => {
      if (!label) return;
      const { x, y } = project(lat, lon, W, H);
      ctx.save();
      ctx.font = `italic ${Math.round(size * scale + 5)}px Georgia, serif`;
      ctx.fillStyle = "rgba(80,110,140,0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
      ctx.restore();
    });

    // ── Continents labels ──
    CONTINENT_LABELS.forEach(({ lat, lon, label, size }) => {
      const { x, y } = project(lat, lon, W, H);
      ctx.save();
      ctx.font = `bold ${Math.round(size * scale + 6)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = "rgba(60,70,50,0.45)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.letterSpacing = "2px";
      ctx.fillText(label, x, y);
      ctx.restore();
    });

    // ── Flight arcs ──
    trips.forEach((trip, i) => {
      const from = CITIES[trip.from];
      const to = CITIES[trip.to];
      if (!from || !to) return;
      if (arcProgressRef.current[i] === undefined) arcProgressRef.current[i] = 0;
      if (arcProgressRef.current[i] < 1)
        arcProgressRef.current[i] = Math.min(1, arcProgressRef.current[i] + 0.008);
      const progress = arcProgressRef.current[i];
      const isPlane = trip.type !== "train";

      const p1 = project(from.lat, from.lon, W, H);
      const p2 = project(to.lat, to.lon, W, H);

      // Control point: arc goes upward (toward north = lower y)
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const cpx = mx;
      const cpy = my - dist * 0.35;

      // Draw partial arc up to progress
      ctx.beginPath();
      const steps = 60;
      const maxStep = Math.floor(steps * progress);
      for (let s = 0; s <= maxStep; s++) {
        const t = s / steps;
        // Quadratic bezier point
        const bx = (1 - t) ** 2 * p1.x + 2 * (1 - t) * t * cpx + t ** 2 * p2.x;
        const by = (1 - t) ** 2 * p1.y + 2 * (1 - t) * t * cpy + t ** 2 * p2.y;
        if (s === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.strokeStyle = isPlane ? "rgba(24,24,27,0.15)" : "rgba(100,100,120,0.15)";
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      for (let s = 0; s <= maxStep; s++) {
        const t = s / steps;
        const bx = (1 - t) ** 2 * p1.x + 2 * (1 - t) * t * cpx + t ** 2 * p2.x;
        const by = (1 - t) ** 2 * p1.y + 2 * (1 - t) * t * cpy + t ** 2 * p2.y;
        if (s === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.strokeStyle = isPlane ? "#18181b" : "#71717a";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Traveling dot
      if (progress < 1) {
        const t = progress;
        const bx = (1 - t) ** 2 * p1.x + 2 * (1 - t) * t * cpx + t ** 2 * p2.x;
        const by = (1 - t) ** 2 * p1.y + 2 * (1 - t) * t * cpy + t ** 2 * p2.y;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#18181b";
        ctx.fill();
      }
    });

    // ── City dots ──
    const citySet = new Set();
    trips.forEach((t) => { citySet.add(t.from); citySet.add(t.to); });
    citySet.forEach((name) => {
      const city = CITIES[name];
      if (!city) return;
      const { x, y } = project(city.lat, city.lon, W, H);
      const pulse = 0.5 + 0.5 * Math.sin(timeRef.current * 2 + city.lat);

      ctx.beginPath();
      ctx.arc(x, y, 3 + pulse * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(24,24,27,${0.2 * pulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#18181b";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(city.iata, x + 5, y - 4);
      ctx.fillStyle = "#18181b";
      ctx.fillText(city.iata, x + 5, y - 4);
    });
  }, [trips, project, landRings, countryRings]);

  useEffect(() => { arcProgressRef.current = {}; }, [trips.length]);

  useEffect(() => {
    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = c.parentElement.clientWidth;
      const cssH = c.parentElement.clientHeight;
      c._dpr = dpr;
      c.width = cssW * dpr;
      c.height = cssH * dpr;
      c.style.width = cssW + "px";
      c.style.height = cssH + "px";
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const t = setTimeout(resize, 200);
    return () => { window.removeEventListener("resize", resize); clearTimeout(t); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

// ─── Boarding Pass Card ───────────────────────────────────────────────────────
function BoardingPassCard({ bp, onDelete, onSetActive }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #e4e4e7 0%, #ececee 100%)",
      border: "1px solid rgba(60,60,70,0.25)",
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{ background: "linear-gradient(90deg, #e0e0e3, #d8d8dc)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed rgba(60,60,70,0.25)" }}>
        <div>
          <div style={{ fontSize: 9, color: "#71717a", letterSpacing: 2, marginBottom: 2 }}>BOARDING PASS</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: "#18181b", letterSpacing: 1 }}>
            {bp.from?.iata || "???"} <span style={{ color: "#18181b" }}>→</span> {bp.to?.iata || "???"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "#71717a", letterSpacing: 1 }}>FLIGHT</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#18181b" }}>{bp.flight || "—"}</div>
        </div>
      </div>
      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "PASSENGER", value: bp.passenger || "—" },
          { label: "DATE", value: bp.date || "—" },
          { label: "DEPARTURE", value: bp.departure || "—" },
          { label: "GATE", value: bp.gate || "—" },
          { label: "SEAT", value: bp.seat || "—" },
          { label: "CLASS", value: bp.class || "ECO" },
        ].map(({ label, value }) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 8, color: "#a1a1aa", letterSpacing: 1.5, marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#a1a1aa", fontWeight: 700, wordBreak: "break-word" }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: "0 18px 14px", height: 32, background: "repeating-linear-gradient(90deg, #c4c4c9 0px, #c4c4c9 2px, #e8e8ea 2px, #e8e8ea 4px)", borderRadius: 3, opacity: 0.7 }} />
      <div style={{ display: "flex", gap: 8, padding: "0 18px 14px" }}>
        <button onClick={onSetActive} style={{ flex: 1, background: "rgba(24,24,27,0.12)", border: "1px solid rgba(24,24,27,0.25)", color: "#3f3f46", borderRadius: 6, padding: "7px 0", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", letterSpacing: 1 }}>
          ▶ ACTIVER WIDGET
        </button>
        <button onClick={onDelete} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#dc2626", borderRadius: 6, padding: "7px 10px", fontSize: 10, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ position: "absolute", top: "50%", left: -5, transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: "#f4f4f5", border: "1px solid rgba(60,60,70,0.2)" }} />
      <div style={{ position: "absolute", top: "50%", right: -5, transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: "#f4f4f5", border: "1px solid rgba(60,60,70,0.2)" }} />
    </div>
  );
}

// ─── In-flight Widget ─────────────────────────────────────────────────────────
function InFlightWidget({ bp, onClose }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(244,244,245,0.99) 100%)", borderTop: "1px solid rgba(24,24,27,0.3)", backdropFilter: "blur(20px)", padding: "10px 14px", zIndex: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#a1a1aa", animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 8, color: "#a1a1aa", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>EN VOL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" }}>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700, color: "#18181b", lineHeight: 1 }}>{bp.from?.iata || "—"}</span>
          <span style={{ fontSize: 12, color: "#18181b" }}>✈</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700, color: "#18181b", lineHeight: 1 }}>{bp.to?.iata || "—"}</span>
          {bp.flight && <span style={{ fontSize: 9, color: "#71717a", marginLeft: 4 }}>{bp.flight}</span>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(24,24,27,0.2)", color: "#a1a1aa", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(24,24,27,0.1)" }}>
        {[
          { label: "SIÈGE", value: bp.seat || "—" },
          { label: "PORTE", value: bp.gate || "—" },
          { label: "DÉPART", value: bp.departure || "—" },
          { label: "HEURE", value: timeStr },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 7, color: "#a1a1aa", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#a1a1aa", fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [trips, setTrips] = useState(() => {
    try {
      const saved = localStorage.getItem("flightlog_trips");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { from: "Paris", to: "Tunis", date: "2024-07-15", type: "plane" },
      { from: "Tunis", to: "Paris", date: "2024-08-02", type: "plane" },
      { from: "Paris", to: "Tokyo", date: "2025-03-10", type: "plane" },
    ];
  });
  const [boardingPasses, setBoardingPasses] = useState(() => {
    try {
      const saved = localStorage.getItem("flightlog_passes");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [activeBP, setActiveBP] = useState(null);
  const [tab, setTab] = useState("globe");
  const [form, setForm] = useState({ from: "", to: "", date: "", type: "plane" });
  const [fromQ, setFromQ] = useState("");
  const [toQ, setToQ] = useState("");
  const [showFromS, setShowFromS] = useState(false);
  const [showToS, setShowToS] = useState(false);
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [bpLoading, setBpLoading] = useState(false);
  const [bpErr, setBpErr] = useState("");
  const [importMode, setImportMode] = useState("email");

  useEffect(() => {
    localStorage.setItem("flightlog_trips", JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    localStorage.setItem("flightlog_passes", JSON.stringify(boardingPasses));
  }, [boardingPasses]);

  const cityNames = Object.keys(CITIES).sort();
  const filtered = (q) =>
    cityNames.filter((c) => c.toLowerCase().includes(q.toLowerCase())).slice(0, 7);

  const totalKm = trips.reduce((acc, t) => {
    const f = CITIES[t.from], to = CITIES[t.to];
    return f && to ? acc + haversine(f.lat, f.lon, to.lat, to.lon) : acc;
  }, 0);

  const addTrip = () => {
    if (!CITIES[form.from] || !CITIES[form.to]) return;
    setTrips((p) => [...p, { ...form }]);
    setForm({ from: "", to: "", date: "", type: "plane" });
    setFromQ("");
    setToQ("");
    setTab("globe");
  };

  const parseEmail = async () => {
    if (!importText.trim()) return;
    setImportLoading(true);
    setImportErr("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: `Analyse ce texte et extrais les trajets. Pour chaque trajet:\n- from: ville départ EN (doit être dans: ${cityNames.join(", ")})\n- to: ville arrivée EN (idem)\n- date: YYYY-MM-DD\n- type: "plane" ou "train"\nRéponds UNIQUEMENT en JSON: [{"from":"Paris","to":"Tunis","date":"2024-07-15","type":"plane"}]\nSi rien trouvé: []\n\nTexte: ${importText}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map((b) => b.text || "").join("") || "[]";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const valid = parsed.filter((t) => CITIES[t.from] && CITIES[t.to]);
      if (valid.length > 0) {
        setTrips((p) => [...p, ...valid]);
        setImportText("");
        setTab("globe");
      } else setImportErr("Aucun trajet détecté dans ce texte.");
    } catch {
      setImportErr("Erreur d'analyse. Réessaie.");
    }
    setImportLoading(false);
  };

  const parseBoardingPass = async (fileData, fileType) => {
    setBpLoading(true);
    setBpErr("");
    try {
      const isImage = fileType.startsWith("image/");
      const contentPart = isImage
        ? { type: "image", source: { type: "base64", media_type: fileType, data: fileData } }
        : { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData } };
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: [contentPart, { type: "text", text: `Analyse cette carte d'embarquement et extrais les infos. Réponds UNIQUEMENT en JSON:\n{\n  "passenger": "NOM PRENOM",\n  "from": {"iata":"CDG","city":"Paris"},\n  "to": {"iata":"TUN","city":"Tunis"},\n  "flight": "AF1234",\n  "date": "15 JUL",\n  "departure": "14:30",\n  "arrival": "17:05",\n  "gate": "K23",\n  "seat": "14A",\n  "class": "ECO"\n}\nSi tu ne trouves pas une info, mets null.` }] }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map((b) => b.text || "").join("") || "{}";
      const bp = JSON.parse(text.replace(/```json|```/g, "").trim());
      setBoardingPasses((p) => [...p, bp]);
      const fromCity = cityNames.find((c) => CITIES[c].iata === bp.from?.iata);
      const toCity = cityNames.find((c) => CITIES[c].iata === bp.to?.iata);
      if (fromCity && toCity) {
        setTrips((p) => [...p, { from: fromCity, to: toCity, date: bp.date || "", type: "plane" }]);
      }
      setTab("passes");
    } catch {
      setBpErr("Erreur lors de la lecture. Réessaie avec une image plus nette.");
    }
    setBpLoading(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result.split(",")[1];
      parseBoardingPass(b64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const countryCounts = [
    ...new Set(trips.map((t) => CITIES[t.to]?.country).filter(Boolean)),
  ].length;

  return (
    <div style={{ minHeight: "100vh", maxWidth: "100vw", overflowX: "hidden", background: "#f4f4f5", color: "#a1a1aa", fontFamily: "'JetBrains Mono', monospace", display: "flex", flexDirection: "column", paddingBottom: activeBP ? 150 : 72 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #f4f4f5; }
        ::-webkit-scrollbar-thumb { background: #c4c4c9; border-radius: 2px; }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px rgba(161,161,170,0.2), 0 0 12px rgba(161,161,170,0.4); } 50% { box-shadow: 0 0 0 6px rgba(161,161,170,0.1), 0 0 20px rgba(161,161,170,0.7); } }
        @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .inp { background: rgba(24,24,27,0.02); border: 1px solid rgba(24,24,27,0.18); color: #18181b; padding: 12px 13px; border-radius: 7px; font-family: 'JetBrains Mono', monospace; font-size: 13px; width: 100%; outline: none; transition: all 0.2s; }
        .inp:focus { border-color: rgba(24,24,27,0.4); background: rgba(24,24,27,0.07); }
        .inp::placeholder { color: #b4b4ba; }
        .sug { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #e8e8ea; border: 1px solid rgba(24,24,27,0.2); border-radius: 7px; z-index: 200; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.6); }
        .sug-i { padding: 11px 13px; font-size: 12px; cursor: pointer; transition: background 0.12s; display: flex; justify-content: space-between; align-items: center; }
        .sug-i:hover { background: rgba(24,24,27,0.1); color: #3f3f46; }
        .btn-p { background: linear-gradient(135deg, rgba(24,24,27,0.15), rgba(24,24,27,0.08)); border: 1px solid rgba(24,24,27,0.3); color: #3f3f46; padding: 14px 20px; border-radius: 7px; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 1px; transition: all 0.2s; width: 100%; }
        .btn-p:active { background: rgba(24,24,27,0.25); }
        .btn-p:disabled { opacity: 0.3; cursor: not-allowed; }
        .stat { background: rgba(24,24,27,0.02); border: 1px solid rgba(24,24,27,0.12); border-radius: 8px; padding: 10px 12px; }
        .card-in { animation: fadeIn 0.3s ease; }
        .upload-zone { border: 2px dashed rgba(24,24,27,0.25); border-radius: 10px; padding: 28px 16px; text-align: center; cursor: pointer; transition: all 0.2s; position: relative; }
        .upload-zone:active { border-color: rgba(24,24,27,0.4); background: rgba(24,24,27,0.03); }
        .upload-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .bot-nav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,0.97); border-top: 1px solid rgba(60,60,70,0.15); backdrop-filter: blur(20px); display: flex; z-index: 500; }
        .nav-btn { flex: 1; background: none; border: none; cursor: pointer; padding: 10px 4px 14px; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.15s; }
        .nav-btn .nav-icon { font-size: 18px; line-height: 1; }
        .nav-btn .nav-label { font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 1px; color: #b4b4ba; transition: color 0.15s; }
        .nav-btn.active .nav-label { color: #3f3f46; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(24,24,27,0.08)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 22, color: "#18181b", letterSpacing: 2 }}>FLIGHTLOG</span>
          <span style={{ fontSize: 8, color: "#a8a8b0", letterSpacing: 3 }}>v2</span>
        </div>
        <div style={{ fontSize: 9, color: "#a8a8b0", letterSpacing: 2 }}>{Math.round(totalKm).toLocaleString("fr-FR")} KM</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "12px 16px", borderBottom: "1px solid rgba(24,24,27,0.06)" }}>
        <div className="stat" style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 8, color: "#b4b4ba", letterSpacing: 2, marginBottom: 2 }}>DISTANCE TOTALE</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 32, fontWeight: 700, color: "#18181b", lineHeight: 1 }}>
            {Math.round(totalKm).toLocaleString("fr-FR")}<span style={{ fontSize: 13, color: "#71717a", marginLeft: 4 }}>km</span>
          </div>
          <div style={{ fontSize: 8, color: "#b4b4ba", marginTop: 2 }}>{(totalKm / 40075 * 100).toFixed(2)}× le tour de la Terre</div>
        </div>
        <div className="stat">
          <div style={{ fontSize: 8, color: "#b4b4ba", letterSpacing: 2, marginBottom: 2 }}>TRAJETS</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 26, fontWeight: 700, color: "#3f3f46", lineHeight: 1 }}>{trips.length}</div>
          <div style={{ fontSize: 8, color: "#b4b4ba", marginTop: 1 }}>✈{trips.filter((t) => t.type === "plane").length} 🚆{trips.filter((t) => t.type === "train").length}</div>
        </div>
        <div className="stat">
          <div style={{ fontSize: 8, color: "#b4b4ba", letterSpacing: 2, marginBottom: 2 }}>PAYS / PASS</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 26, fontWeight: 700, color: "#a1a1aa", lineHeight: 1 }}>
            {countryCounts}<span style={{ color: "#b4b4ba", fontSize: 14 }}> / </span><span style={{ color: "#71717a" }}>{boardingPasses.length}</span>
          </div>
          <div style={{ fontSize: 8, color: "#b4b4ba", marginTop: 1 }}>pays · cartes</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Globe */}
        {tab === "globe" && (
          <div className="card-in" style={{ flex: 1, minHeight: 340, height: "60vw", maxHeight: 500, background: "rgba(24,24,27,0.02)", borderRadius: 12, border: "1px solid rgba(24,24,27,0.1)", overflow: "hidden", position: "relative" }}>
            <FlatMap trips={trips} />
            <div style={{ position: "absolute", bottom: 10, left: 12, display: "flex", gap: 12, fontSize: 8, color: "#a8a8b0", letterSpacing: 1 }}>
              <span>GLISSE</span>
              <span style={{ color: "#18181b" }}>▬ VOL</span>
              <span style={{ color: "#71717a" }}>▬ TRAIN</span>
            </div>
          </div>
        )}

        {/* Add trip */}
        {tab === "add" && (
          <div className="card-in" style={{ width: "100%", background: "rgba(24,24,27,0.02)", borderRadius: 12, border: "1px solid rgba(24,24,27,0.1)", padding: 16 }}>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: "#18181b", letterSpacing: 1, marginBottom: 22 }}>NOUVEAU TRAJET</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "DEPUIS", q: fromQ, setQ: setFromQ, field: "from", show: showFromS, setShow: setShowFromS },
                { label: "VERS", q: toQ, setQ: setToQ, field: "to", show: showToS, setShow: setShowToS },
              ].map(({ label, q, setQ, field, show, setShow }) => (
                <div key={field}>
                  <div style={{ fontSize: 9, color: "#b4b4ba", letterSpacing: 2, marginBottom: 6 }}>{label}</div>
                  <div style={{ position: "relative" }}>
                    <input className="inp" value={q}
                      onChange={(e) => { setQ(e.target.value); setForm((f) => ({ ...f, [field]: "" })); setShow(true); }}
                      onFocus={() => setShow(true)}
                      onBlur={() => setTimeout(() => setShow(false), 150)}
                      placeholder="Ville ou aéroport..." />
                    {show && q && (
                      <div className="sug">
                        {filtered(q).map((c) => (
                          <div key={c} className="sug-i" onMouseDown={() => { setForm((f) => ({ ...f, [field]: c })); setQ(c); setShow(false); }}>
                            <span>{c}</span>
                            <span style={{ color: "#b4b4ba", fontSize: 9 }}>{CITIES[c].iata} · {CITIES[c].country}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#b4b4ba", letterSpacing: 2, marginBottom: 6 }}>DATE</div>
                  <input type="date" className="inp" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#b4b4ba", letterSpacing: 2, marginBottom: 6 }}>TYPE</div>
                  <select className="inp" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="plane">✈ Vol avion</option>
                    <option value="train">🚆 Train</option>
                  </select>
                </div>
              </div>
              {form.from && form.to && CITIES[form.from] && CITIES[form.to] && (
                <div style={{ background: "rgba(24,24,27,0.05)", border: "1px solid rgba(24,24,27,0.15)", borderRadius: 7, padding: "10px 14px", fontSize: 11, color: "#18181b", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
                  {CITIES[form.from].iata} → {CITIES[form.to].iata} &nbsp;·&nbsp; {Math.round(haversine(CITIES[form.from].lat, CITIES[form.from].lon, CITIES[form.to].lat, CITIES[form.to].lon)).toLocaleString("fr-FR")} km
                </div>
              )}
              <button className="btn-p" onClick={addTrip} disabled={!CITIES[form.from] || !CITIES[form.to]}>+ AJOUTER CE TRAJET</button>
            </div>
          </div>
        )}

        {/* Import */}
        {tab === "import" && (
          <div className="card-in" style={{ width: "100%", background: "rgba(24,24,27,0.02)", borderRadius: 12, border: "1px solid rgba(24,24,27,0.1)", padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[{ id: "email", label: "📧 EMAIL" }, { id: "boarding", label: "🎫 BILLET" }].map((m) => (
                <button key={m.id} onClick={() => setImportMode(m.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 6, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", letterSpacing: 1, background: importMode === m.id ? "rgba(24,24,27,0.12)" : "none", border: importMode === m.id ? "1px solid rgba(24,24,27,0.3)" : "1px solid rgba(24,24,27,0.1)", color: importMode === m.id ? "#3f3f46" : "#b4b4ba", transition: "all 0.2s" }}>{m.label}</button>
              ))}
            </div>
            {importMode === "email" ? (
              <>
                <div style={{ fontSize: 9, color: "#b4b4ba", letterSpacing: 1.5, marginBottom: 6 }}>COLLER TON EMAIL DE CONFIRMATION</div>
                <div style={{ fontSize: 11, color: "#b4b4ba", marginBottom: 12, lineHeight: 1.6 }}>Air France, Transavia, SNCF, Trainline...</div>
                <textarea className="inp" rows={7} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={"Votre réservation AF1234\nDépart: Paris CDG, 15 juillet 2024 à 14:30\nArrivée: Tunis Carthage 17:05..."} style={{ resize: "vertical" }} />
                {importErr && <div style={{ color: "#dc2626", fontSize: 10, marginTop: 8 }}>{importErr}</div>}
                <button className="btn-p" onClick={parseEmail} disabled={importLoading || !importText.trim()} style={{ marginTop: 12 }}>
                  {importLoading ? "⏳ ANALYSE..." : "◉ ANALYSER ET IMPORTER"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 9, color: "#b4b4ba", letterSpacing: 1.5, marginBottom: 6 }}>PHOTO OU PDF DU BILLET</div>
                <div style={{ fontSize: 11, color: "#b4b4ba", marginBottom: 14, lineHeight: 1.6 }}>Claude lit siège, porte, vol, heure automatiquement.</div>
                <label className="upload-zone">
                  <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} />
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
                  <div style={{ fontSize: 12, color: "#3f3f46", marginBottom: 4 }}>Appuie pour choisir</div>
                  <div style={{ fontSize: 9, color: "#b4b4ba", letterSpacing: 1 }}>JPG · PNG · PDF</div>
                </label>
                {bpLoading && <div style={{ textAlign: "center", color: "#3f3f46", fontSize: 11, marginTop: 14 }}>⏳ LECTURE EN COURS...</div>}
                {bpErr && <div style={{ color: "#dc2626", fontSize: 10, marginTop: 10 }}>{bpErr}</div>}
              </>
            )}
          </div>
        )}

        {/* Boarding passes */}
        {tab === "passes" && (
          <div className="card-in">
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 15, fontWeight: 700, color: "#18181b", letterSpacing: 1, marginBottom: 14 }}>CARTES — {boardingPasses.length}</div>
            {boardingPasses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#a8a8b0", fontSize: 11, letterSpacing: 2 }}>
                AUCUNE CARTE<br /><span style={{ fontSize: 9, marginTop: 8, display: "block" }}>→ IMPORT</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {boardingPasses.map((bp, i) => (
                  <BoardingPassCard key={i} bp={bp}
                    onDelete={() => setBoardingPasses((p) => p.filter((_, j) => j !== i))}
                    onSetActive={() => setActiveBP(bp)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* List */}
        {tab === "list" && (
          <div className="card-in" style={{ background: "rgba(24,24,27,0.02)", borderRadius: 12, border: "1px solid rgba(24,24,27,0.1)", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(24,24,27,0.08)", fontFamily: "'Rajdhani', sans-serif", fontSize: 13, fontWeight: 700, color: "#18181b", letterSpacing: 1 }}>TRAJETS — {trips.length}</div>
            {trips.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#a8a8b0", fontSize: 10, letterSpacing: 2 }}>AUCUN TRAJET</div>}
            {trips.map((t, i) => {
              const f = CITIES[t.from], to = CITIES[t.to];
              const km = f && to ? Math.round(haversine(f.lat, f.lon, to.lat, to.lon)) : 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid rgba(24,24,27,0.05)", gap: 10 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{t.type === "plane" ? "✈" : "🚆"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#18181b", fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.from} <span style={{ color: t.type === "plane" ? "#18181b" : "#a1a1aa" }}>→</span> {t.to}
                    </div>
                    <div style={{ fontSize: 9, color: "#b4b4ba", marginTop: 2 }}>{t.date || "—"} · {CITIES[t.to]?.country || ""}</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.type === "plane" ? "#18181b" : "#a1a1aa", fontWeight: 700, flexShrink: 0 }}>{km.toLocaleString("fr-FR")} km</div>
                  <button onClick={() => setTrips((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a8b0", fontSize: 20, padding: "0 2px", flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeBP && <InFlightWidget bp={activeBP} onClose={() => setActiveBP(null)} />}

      <nav className="bot-nav" style={{ bottom: activeBP ? 80 : 0 }}>
        {[
          { id: "globe", icon: "🌍", label: "GLOBE" },
          { id: "add", icon: "＋", label: "TRAJET" },
          { id: "import", icon: "📥", label: "IMPORT" },
          { id: "passes", icon: "🎫", label: "PASS" },
          { id: "list", icon: "☰", label: "LISTE" },
        ].map((t) => (
          <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <span className="nav-icon" style={{ color: tab === t.id ? "#3f3f46" : "#b4b4ba" }}>{t.icon}</span>
            <span className="nav-label" style={{ color: tab === t.id ? "#3f3f46" : "#b4b4ba" }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
