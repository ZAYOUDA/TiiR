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
  // ── France ──
  Paris: { lat: 48.8566, lon: 2.3522, country: "France", iata: "CDG" },
  Nice: { lat: 43.7102, lon: 7.262, country: "France", iata: "NCE" },
  Lyon: { lat: 45.764, lon: 4.8357, country: "France", iata: "LYS" },
  Marseille: { lat: 43.2965, lon: 5.3698, country: "France", iata: "MRS" },
  Bordeaux: { lat: 44.8378, lon: -0.5792, country: "France", iata: "BOD" },
  Toulouse: { lat: 43.6047, lon: 1.4442, country: "France", iata: "TLS" },
  Nantes: { lat: 47.2184, lon: -1.5536, country: "France", iata: "NTE" },
  Lille: { lat: 50.6292, lon: 3.0573, country: "France", iata: "LIL" },
  Strasbourg: { lat: 48.5383, lon: 7.6283, country: "France", iata: "SXB" },
  Montpellier: { lat: 43.5762, lon: 3.963, country: "France", iata: "MPL" },
  Rennes: { lat: 48.0698, lon: -1.7347, country: "France", iata: "RNS" },
  Biarritz: { lat: 43.4683, lon: -1.5231, country: "France", iata: "BIQ" },
  Clermont: { lat: 45.7866, lon: 3.1692, country: "France", iata: "CFE" },
  Brest: { lat: 48.4478, lon: -4.4186, country: "France", iata: "BES" },
  // ── UK ──
  London: { lat: 51.5074, lon: -0.1278, country: "UK", iata: "LHR" },
  "London Gatwick": { lat: 51.1537, lon: -0.1821, country: "UK", iata: "LGW" },
  Manchester: { lat: 53.3537, lon: -2.275, country: "UK", iata: "MAN" },
  Edinburgh: { lat: 55.9508, lon: -3.3615, country: "UK", iata: "EDI" },
  Birmingham: { lat: 52.4539, lon: -1.7481, country: "UK", iata: "BHX" },
  Glasgow: { lat: 55.8642, lon: -4.4331, country: "UK", iata: "GLA" },
  Bristol: { lat: 51.3827, lon: -2.7191, country: "UK", iata: "BRS" },
  // ── Germany ──
  Berlin: { lat: 52.52, lon: 13.405, country: "Germany", iata: "BER" },
  Munich: { lat: 48.1351, lon: 11.582, country: "Germany", iata: "MUC" },
  Frankfurt: { lat: 50.1109, lon: 8.6821, country: "Germany", iata: "FRA" },
  Hamburg: { lat: 53.5753, lon: 10.0153, country: "Germany", iata: "HAM" },
  Dusseldorf: { lat: 51.2217, lon: 6.7762, country: "Germany", iata: "DUS" },
  Cologne: { lat: 50.9333, lon: 6.9597, country: "Germany", iata: "CGN" },
  Stuttgart: { lat: 48.6899, lon: 9.2219, country: "Germany", iata: "STR" },
  Nuremberg: { lat: 49.4987, lon: 11.0669, country: "Germany", iata: "NUE" },
  // ── Spain ──
  Madrid: { lat: 40.4168, lon: -3.7038, country: "Spain", iata: "MAD" },
  Barcelona: { lat: 41.3851, lon: 2.1734, country: "Spain", iata: "BCN" },
  Valencia: { lat: 39.4699, lon: -0.3763, country: "Spain", iata: "VLC" },
  Seville: { lat: 37.3826, lon: -5.9961, country: "Spain", iata: "SVQ" },
  Malaga: { lat: 36.7213, lon: -4.4214, country: "Spain", iata: "AGP" },
  Bilbao: { lat: 43.2627, lon: -2.9253, country: "Spain", iata: "BIO" },
  Palma: { lat: 39.5517, lon: 2.7388, country: "Spain", iata: "PMI" },
  Ibiza: { lat: 38.8729, lon: 1.3731, country: "Spain", iata: "IBZ" },
  "Tenerife Sur": { lat: 28.0445, lon: -16.5725, country: "Spain", iata: "TFS" },
  "Las Palmas": { lat: 27.9319, lon: -15.3866, country: "Spain", iata: "LPA" },
  Alicante: { lat: 38.2822, lon: -0.5582, country: "Spain", iata: "ALC" },
  // ── Italy ──
  Rome: { lat: 41.9028, lon: 12.4964, country: "Italy", iata: "FCO" },
  Milan: { lat: 45.4654, lon: 9.1859, country: "Italy", iata: "MXP" },
  Venice: { lat: 45.5051, lon: 12.3519, country: "Italy", iata: "VCE" },
  Naples: { lat: 40.8518, lon: 14.2681, country: "Italy", iata: "NAP" },
  Catania: { lat: 37.4997, lon: 15.0664, country: "Italy", iata: "CTA" },
  Bologna: { lat: 44.5351, lon: 11.2887, country: "Italy", iata: "BLQ" },
  Turin: { lat: 45.0703, lon: 7.6869, country: "Italy", iata: "TRN" },
  Florence: { lat: 43.8100, lon: 11.2051, country: "Italy", iata: "FLR" },
  Palermo: { lat: 38.1157, lon: 13.3522, country: "Italy", iata: "PMO" },
  Bari: { lat: 41.1395, lon: 16.7603, country: "Italy", iata: "BRI" },
  // ── Portugal ──
  Lisbon: { lat: 38.7223, lon: -9.1393, country: "Portugal", iata: "LIS" },
  Porto: { lat: 41.2487, lon: -8.6814, country: "Portugal", iata: "OPO" },
  Faro: { lat: 37.0144, lon: -7.9659, country: "Portugal", iata: "FAO" },
  Funchal: { lat: 32.6941, lon: -16.7745, country: "Portugal", iata: "FNC" },
  // ── Netherlands / Belgium / Luxembourg ──
  Amsterdam: { lat: 52.3676, lon: 4.9041, country: "Netherlands", iata: "AMS" },
  Brussels: { lat: 50.8503, lon: 4.3517, country: "Belgium", iata: "BRU" },
  Luxembourg: { lat: 49.6233, lon: 6.2044, country: "Luxembourg", iata: "LUX" },
  // ── Switzerland / Austria ──
  Zurich: { lat: 47.3769, lon: 8.5417, country: "Switzerland", iata: "ZRH" },
  Geneva: { lat: 46.2044, lon: 6.1432, country: "Switzerland", iata: "GVA" },
  Basel: { lat: 47.5996, lon: 7.5290, country: "Switzerland", iata: "BSL" },
  Vienna: { lat: 48.2082, lon: 16.3738, country: "Austria", iata: "VIE" },
  Salzburg: { lat: 47.7948, lon: 13.0043, country: "Austria", iata: "SZG" },
  Innsbruck: { lat: 47.2602, lon: 11.3439, country: "Austria", iata: "INN" },
  // ── Scandinavia ──
  Stockholm: { lat: 59.3293, lon: 18.0686, country: "Sweden", iata: "ARN" },
  Gothenburg: { lat: 57.6628, lon: 12.2798, country: "Sweden", iata: "GOT" },
  Copenhagen: { lat: 55.6761, lon: 12.5683, country: "Denmark", iata: "CPH" },
  Oslo: { lat: 60.1976, lon: 11.1004, country: "Norway", iata: "OSL" },
  Bergen: { lat: 60.2934, lon: 5.2181, country: "Norway", iata: "BGO" },
  Helsinki: { lat: 60.3172, lon: 24.9633, country: "Finland", iata: "HEL" },
  Reykjavik: { lat: 63.985, lon: -22.6056, country: "Iceland", iata: "KEF" },
  // ── Eastern Europe ──
  Prague: { lat: 50.0755, lon: 14.4378, country: "Czech Republic", iata: "PRG" },
  Warsaw: { lat: 52.2297, lon: 21.0122, country: "Poland", iata: "WAW" },
  Krakow: { lat: 50.0777, lon: 19.7848, country: "Poland", iata: "KRK" },
  Budapest: { lat: 47.4369, lon: 19.2556, country: "Hungary", iata: "BUD" },
  Bucharest: { lat: 44.5711, lon: 26.085, country: "Romania", iata: "OTP" },
  Sofia: { lat: 42.6957, lon: 23.4083, country: "Bulgaria", iata: "SOF" },
  Belgrade: { lat: 44.8184, lon: 20.3091, country: "Serbia", iata: "BEG" },
  Zagreb: { lat: 45.7429, lon: 16.0688, country: "Croatia", iata: "ZAG" },
  Dubrovnik: { lat: 42.5614, lon: 18.2682, country: "Croatia", iata: "DBV" },
  Ljubljana: { lat: 46.2237, lon: 14.4576, country: "Slovenia", iata: "LJU" },
  Bratislava: { lat: 48.1702, lon: 17.2127, country: "Slovakia", iata: "BTS" },
  Kiev: { lat: 50.345, lon: 30.8947, country: "Ukraine", iata: "KBP" },
  Minsk: { lat: 53.8825, lon: 28.0325, country: "Belarus", iata: "MSQ" },
  // ── Ireland ──
  Dublin: { lat: 53.3498, lon: -6.2603, country: "Ireland", iata: "DUB" },
  // ── Greece / Cyprus / Malta ──
  Athens: { lat: 37.9838, lon: 23.7275, country: "Greece", iata: "ATH" },
  Thessaloniki: { lat: 40.5197, lon: 22.9709, country: "Greece", iata: "SKG" },
  Heraklion: { lat: 35.3397, lon: 25.1803, country: "Greece", iata: "HER" },
  Rhodes: { lat: 36.4054, lon: 28.0862, country: "Greece", iata: "RHO" },
  Santorini: { lat: 36.3992, lon: 25.4793, country: "Greece", iata: "JTR" },
  Mykonos: { lat: 37.4356, lon: 25.3481, country: "Greece", iata: "JMK" },
  Larnaca: { lat: 34.8751, lon: 33.6249, country: "Cyprus", iata: "LCA" },
  Paphos: { lat: 34.7181, lon: 32.4857, country: "Cyprus", iata: "PFO" },
  Valletta: { lat: 35.8575, lon: 14.4775, country: "Malta", iata: "MLA" },
  // ── Russia ──
  Moscow: { lat: 55.7558, lon: 37.6173, country: "Russia", iata: "SVO" },
  "St Petersburg": { lat: 59.8003, lon: 30.2625, country: "Russia", iata: "LED" },
  Novosibirsk: { lat: 54.9633, lon: 82.9007, country: "Russia", iata: "OVB" },
  // ── Turkey ──
  Istanbul: { lat: 41.0082, lon: 28.9784, country: "Turkey", iata: "IST" },
  Ankara: { lat: 40.1281, lon: 32.9951, country: "Turkey", iata: "ESB" },
  Antalya: { lat: 36.8987, lon: 30.8005, country: "Turkey", iata: "AYT" },
  Izmir: { lat: 38.2924, lon: 27.157, country: "Turkey", iata: "ADB" },
  Bodrum: { lat: 37.2506, lon: 27.6643, country: "Turkey", iata: "BJV" },
  // ── Middle East ──
  Dubai: { lat: 25.2048, lon: 55.2708, country: "UAE", iata: "DXB" },
  "Abu Dhabi": { lat: 24.4539, lon: 54.3773, country: "UAE", iata: "AUH" },
  Doha: { lat: 25.2854, lon: 51.531, country: "Qatar", iata: "DOH" },
  Riyadh: { lat: 24.9576, lon: 46.6988, country: "Saudi Arabia", iata: "RUH" },
  Jeddah: { lat: 21.6796, lon: 39.1565, country: "Saudi Arabia", iata: "JED" },
  Dammam: { lat: 26.4712, lon: 49.7979, country: "Saudi Arabia", iata: "DMM" },
  Kuwait: { lat: 29.2267, lon: 47.9689, country: "Kuwait", iata: "KWI" },
  Muscat: { lat: 23.5933, lon: 58.2844, country: "Oman", iata: "MCT" },
  Bahrain: { lat: 26.2708, lon: 50.6336, country: "Bahrain", iata: "BAH" },
  "Tel Aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", iata: "TLV" },
  Amman: { lat: 31.7226, lon: 35.9931, country: "Jordan", iata: "AMM" },
  Beirut: { lat: 33.8208, lon: 35.4882, country: "Lebanon", iata: "BEY" },
  Baghdad: { lat: 33.2625, lon: 44.2346, country: "Iraq", iata: "BGW" },
  Tehran: { lat: 35.6892, lon: 51.3890, country: "Iran", iata: "IKA" },
  // ── Africa ──
  Cairo: { lat: 30.0444, lon: 31.2357, country: "Egypt", iata: "CAI" },
  "Sharm El Sheikh": { lat: 27.9773, lon: 34.3951, country: "Egypt", iata: "SSH" },
  Hurghada: { lat: 27.1783, lon: 33.7994, country: "Egypt", iata: "HRG" },
  Luxor: { lat: 25.6711, lon: 32.7063, country: "Egypt", iata: "LXR" },
  Tunis: { lat: 36.8065, lon: 10.1815, country: "Tunisia", iata: "TUN" },
  Djerba: { lat: 33.8075, lon: 10.8451, country: "Tunisia", iata: "DJE" },
  Monastir: { lat: 35.7643, lon: 10.8113, country: "Tunisia", iata: "MIR" },
  Sfax: { lat: 34.7182, lon: 10.6905, country: "Tunisia", iata: "SFA" },
  Tozeur: { lat: 33.9397, lon: 8.1106, country: "Tunisia", iata: "TOE" },
  Casablanca: { lat: 33.5731, lon: -7.5898, country: "Morocco", iata: "CMN" },
  Marrakech: { lat: 31.6069, lon: -8.0363, country: "Morocco", iata: "RAK" },
  Agadir: { lat: 30.3250, lon: -9.4131, country: "Morocco", iata: "AGA" },
  Fes: { lat: 34.0008, lon: -5.0117, country: "Morocco", iata: "FEZ" },
  Tangier: { lat: 35.7268, lon: -5.9169, country: "Morocco", iata: "TNG" },
  Algiers: { lat: 36.6910, lon: 3.2154, country: "Algeria", iata: "ALG" },
  Oran: { lat: 35.6239, lon: -0.6212, country: "Algeria", iata: "ORN" },
  Constantine: { lat: 36.2760, lon: 6.6204, country: "Algeria", iata: "CZL" },
  Tripoli: { lat: 32.6635, lon: 13.1590, country: "Libya", iata: "TIP" },
  Johannesburg: { lat: -26.2041, lon: 28.0473, country: "South Africa", iata: "JNB" },
  "Cape Town": { lat: -33.9648, lon: 18.6017, country: "South Africa", iata: "CPT" },
  Durban: { lat: -29.6144, lon: 31.1197, country: "South Africa", iata: "DUR" },
  Nairobi: { lat: -1.2921, lon: 36.8219, country: "Kenya", iata: "NBO" },
  "Addis Ababa": { lat: 8.9779, lon: 38.7993, country: "Ethiopia", iata: "ADD" },
  Lagos: { lat: 6.5774, lon: 3.3212, country: "Nigeria", iata: "LOS" },
  Abuja: { lat: 9.0064, lon: 7.2631, country: "Nigeria", iata: "ABV" },
  Accra: { lat: 5.5913, lon: -0.1668, country: "Ghana", iata: "ACC" },
  Dakar: { lat: 14.7397, lon: -17.4902, country: "Senegal", iata: "DSS" },
  Abidjan: { lat: 5.2613, lon: -3.9263, country: "Ivory Coast", iata: "ABJ" },
  "Dar es Salaam": { lat: -6.8781, lon: 39.2026, country: "Tanzania", iata: "DAR" },
  Zanzibar: { lat: -6.2221, lon: 39.2249, country: "Tanzania", iata: "ZNZ" },
  Kigali: { lat: -1.9686, lon: 30.1395, country: "Rwanda", iata: "KGL" },
  Mauritius: { lat: -20.4302, lon: 57.6836, country: "Mauritius", iata: "MRU" },
  // ── India ──
  Mumbai: { lat: 19.076, lon: 72.8777, country: "India", iata: "BOM" },
  Delhi: { lat: 28.6139, lon: 77.209, country: "India", iata: "DEL" },
  Bangalore: { lat: 13.1986, lon: 77.7066, country: "India", iata: "BLR" },
  Chennai: { lat: 12.9941, lon: 80.1709, country: "India", iata: "MAA" },
  Kolkata: { lat: 22.6520, lon: 88.4463, country: "India", iata: "CCU" },
  Hyderabad: { lat: 17.2403, lon: 78.4294, country: "India", iata: "HYD" },
  Goa: { lat: 15.3808, lon: 73.8314, country: "India", iata: "GOI" },
  Jaipur: { lat: 26.8242, lon: 75.8122, country: "India", iata: "JAI" },
  Cochin: { lat: 10.1520, lon: 76.4019, country: "India", iata: "COK" },
  Ahmedabad: { lat: 23.0771, lon: 72.6346, country: "India", iata: "AMD" },
  // ── South / Central Asia ──
  Colombo: { lat: 7.1804, lon: 79.8844, country: "Sri Lanka", iata: "CMB" },
  Dhaka: { lat: 23.8433, lon: 90.3978, country: "Bangladesh", iata: "DAC" },
  Kathmandu: { lat: 27.6966, lon: 85.3591, country: "Nepal", iata: "KTM" },
  Islamabad: { lat: 33.6169, lon: 73.0992, country: "Pakistan", iata: "ISB" },
  Karachi: { lat: 24.9065, lon: 67.1609, country: "Pakistan", iata: "KHI" },
  Lahore: { lat: 31.5216, lon: 74.4036, country: "Pakistan", iata: "LHE" },
  Tashkent: { lat: 41.2580, lon: 69.2813, country: "Uzbekistan", iata: "TAS" },
  Almaty: { lat: 43.3521, lon: 77.0405, country: "Kazakhstan", iata: "ALA" },
  Tbilisi: { lat: 41.6693, lon: 44.9547, country: "Georgia", iata: "TBS" },
  Baku: { lat: 40.4675, lon: 50.0467, country: "Azerbaijan", iata: "GYD" },
  Yerevan: { lat: 40.1473, lon: 44.3959, country: "Armenia", iata: "EVN" },
  // ── China ──
  "Hong Kong": { lat: 22.3193, lon: 114.1694, country: "Hong Kong", iata: "HKG" },
  Beijing: { lat: 40.0799, lon: 116.6031, country: "China", iata: "PEK" },
  Shanghai: { lat: 31.1443, lon: 121.8083, country: "China", iata: "PVG" },
  Guangzhou: { lat: 23.3924, lon: 113.2988, country: "China", iata: "CAN" },
  Chengdu: { lat: 30.5785, lon: 103.9471, country: "China", iata: "CTU" },
  Shenzhen: { lat: 22.6393, lon: 113.8107, country: "China", iata: "SZX" },
  Kunming: { lat: 24.9920, lon: 102.7440, country: "China", iata: "KMG" },
  Chongqing: { lat: 29.7192, lon: 106.6417, country: "China", iata: "CKG" },
  Xian: { lat: 34.4471, lon: 108.7516, country: "China", iata: "XIY" },
  Taipei: { lat: 25.0777, lon: 121.2328, country: "Taiwan", iata: "TPE" },
  // ── Japan / Korea ──
  Tokyo: { lat: 35.6762, lon: 139.6503, country: "Japan", iata: "NRT" },
  Osaka: { lat: 34.4348, lon: 135.2440, country: "Japan", iata: "KIX" },
  Nagoya: { lat: 34.8583, lon: 136.8050, country: "Japan", iata: "NGO" },
  Fukuoka: { lat: 33.5858, lon: 130.4508, country: "Japan", iata: "FUK" },
  Sapporo: { lat: 42.7752, lon: 141.6922, country: "Japan", iata: "CTS" },
  Okinawa: { lat: 26.1958, lon: 127.6461, country: "Japan", iata: "OKA" },
  Seoul: { lat: 37.5665, lon: 126.978, country: "South Korea", iata: "ICN" },
  Busan: { lat: 35.1796, lon: 129.0756, country: "South Korea", iata: "PUS" },
  // ── Southeast Asia ──
  Singapore: { lat: 1.3521, lon: 103.8198, country: "Singapore", iata: "SIN" },
  Bangkok: { lat: 13.7563, lon: 100.5018, country: "Thailand", iata: "BKK" },
  Phuket: { lat: 8.1132, lon: 98.3169, country: "Thailand", iata: "HKT" },
  "Chiang Mai": { lat: 18.7669, lon: 98.9620, country: "Thailand", iata: "CNX" },
  "Kuala Lumpur": { lat: 3.139, lon: 101.6869, country: "Malaysia", iata: "KUL" },
  Penang: { lat: 5.2976, lon: 100.2765, country: "Malaysia", iata: "PEN" },
  Jakarta: { lat: -6.2088, lon: 106.8456, country: "Indonesia", iata: "CGK" },
  Bali: { lat: -8.3405, lon: 115.092, country: "Indonesia", iata: "DPS" },
  Surabaya: { lat: -7.3798, lon: 112.7870, country: "Indonesia", iata: "SUB" },
  "Ho Chi Minh": { lat: 10.8188, lon: 106.6519, country: "Vietnam", iata: "SGN" },
  Hanoi: { lat: 21.2187, lon: 105.8074, country: "Vietnam", iata: "HAN" },
  "Da Nang": { lat: 16.0439, lon: 108.1992, country: "Vietnam", iata: "DAD" },
  Manila: { lat: 14.5086, lon: 121.0198, country: "Philippines", iata: "MNL" },
  Cebu: { lat: 10.3075, lon: 123.9792, country: "Philippines", iata: "CEB" },
  Yangon: { lat: 16.9073, lon: 96.1331, country: "Myanmar", iata: "RGN" },
  "Phnom Penh": { lat: 11.5466, lon: 104.8440, country: "Cambodia", iata: "PNH" },
  "Siem Reap": { lat: 13.4107, lon: 103.8123, country: "Cambodia", iata: "REP" },
  Vientiane: { lat: 17.9883, lon: 102.5630, country: "Laos", iata: "VTE" },
  // ── Australia / NZ / Pacific ──
  Sydney: { lat: -33.8688, lon: 151.2093, country: "Australia", iata: "SYD" },
  Melbourne: { lat: -37.6690, lon: 144.8410, country: "Australia", iata: "MEL" },
  Brisbane: { lat: -27.3842, lon: 153.1175, country: "Australia", iata: "BNE" },
  Perth: { lat: -31.9403, lon: 115.9669, country: "Australia", iata: "PER" },
  Adelaide: { lat: -34.9457, lon: 138.5308, country: "Australia", iata: "ADL" },
  Cairns: { lat: -16.8858, lon: 145.7553, country: "Australia", iata: "CNS" },
  Auckland: { lat: -37.0082, lon: 174.7917, country: "New Zealand", iata: "AKL" },
  Queenstown: { lat: -45.0211, lon: 168.7392, country: "New Zealand", iata: "ZQN" },
  Papeete: { lat: -17.5534, lon: -149.6068, country: "French Polynesia", iata: "PPT" },
  Nadi: { lat: -17.7553, lon: 177.4431, country: "Fiji", iata: "NAN" },
  // ── USA ──
  "New York": { lat: 40.7128, lon: -74.006, country: "USA", iata: "JFK" },
  "Los Angeles": { lat: 34.0522, lon: -118.2437, country: "USA", iata: "LAX" },
  "San Francisco": { lat: 37.7749, lon: -122.4194, country: "USA", iata: "SFO" },
  Chicago: { lat: 41.8781, lon: -87.6298, country: "USA", iata: "ORD" },
  Miami: { lat: 25.7617, lon: -80.1918, country: "USA", iata: "MIA" },
  Atlanta: { lat: 33.6407, lon: -84.4277, country: "USA", iata: "ATL" },
  Dallas: { lat: 32.8998, lon: -97.0403, country: "USA", iata: "DFW" },
  Denver: { lat: 39.8561, lon: -104.6737, country: "USA", iata: "DEN" },
  Seattle: { lat: 47.4502, lon: -122.3088, country: "USA", iata: "SEA" },
  Boston: { lat: 42.3656, lon: -71.0096, country: "USA", iata: "BOS" },
  Washington: { lat: 38.9531, lon: -77.4565, country: "USA", iata: "IAD" },
  Houston: { lat: 29.9902, lon: -95.3368, country: "USA", iata: "IAH" },
  "Las Vegas": { lat: 36.0840, lon: -115.1537, country: "USA", iata: "LAS" },
  Orlando: { lat: 28.4312, lon: -81.3081, country: "USA", iata: "MCO" },
  Phoenix: { lat: 33.4373, lon: -112.0078, country: "USA", iata: "PHX" },
  Minneapolis: { lat: 44.8848, lon: -93.2223, country: "USA", iata: "MSP" },
  Detroit: { lat: 42.2124, lon: -83.3534, country: "USA", iata: "DTW" },
  Honolulu: { lat: 21.3245, lon: -157.9251, country: "USA", iata: "HNL" },
  Newark: { lat: 40.6925, lon: -74.1687, country: "USA", iata: "EWR" },
  Philadelphia: { lat: 39.8721, lon: -75.2411, country: "USA", iata: "PHL" },
  Charlotte: { lat: 35.2144, lon: -80.9473, country: "USA", iata: "CLT" },
  "Salt Lake City": { lat: 40.7899, lon: -111.9791, country: "USA", iata: "SLC" },
  Portland: { lat: 45.5898, lon: -122.5951, country: "USA", iata: "PDX" },
  Nashville: { lat: 36.1245, lon: -86.6782, country: "USA", iata: "BNA" },
  Austin: { lat: 30.1975, lon: -97.6664, country: "USA", iata: "AUS" },
  // ── Canada ──
  Montreal: { lat: 45.5017, lon: -73.5673, country: "Canada", iata: "YUL" },
  Toronto: { lat: 43.6532, lon: -79.3832, country: "Canada", iata: "YYZ" },
  Vancouver: { lat: 49.2827, lon: -123.1207, country: "Canada", iata: "YVR" },
  Calgary: { lat: 51.1225, lon: -114.0132, country: "Canada", iata: "YYC" },
  Edmonton: { lat: 53.3097, lon: -113.5792, country: "Canada", iata: "YEG" },
  Ottawa: { lat: 45.3225, lon: -75.6692, country: "Canada", iata: "YOW" },
  Halifax: { lat: 44.8808, lon: -63.5086, country: "Canada", iata: "YHZ" },
  // ── Mexico / Caribbean / Central America ──
  "Mexico City": { lat: 19.4326, lon: -99.1332, country: "Mexico", iata: "MEX" },
  Cancun: { lat: 21.0365, lon: -86.8771, country: "Mexico", iata: "CUN" },
  Guadalajara: { lat: 20.5218, lon: -103.3107, country: "Mexico", iata: "GDL" },
  Monterrey: { lat: 25.7785, lon: -100.1069, country: "Mexico", iata: "MTY" },
  Havana: { lat: 22.9892, lon: -82.4091, country: "Cuba", iata: "HAV" },
  "Punta Cana": { lat: 18.5674, lon: -68.3634, country: "Dominican Rep.", iata: "PUJ" },
  "Santo Domingo": { lat: 18.4297, lon: -69.6688, country: "Dominican Rep.", iata: "SDQ" },
  "San Juan": { lat: 18.4394, lon: -66.0018, country: "Puerto Rico", iata: "SJU" },
  Panama: { lat: 9.0714, lon: -79.3833, country: "Panama", iata: "PTY" },
  "San Jose CR": { lat: 9.9939, lon: -84.2088, country: "Costa Rica", iata: "SJO" },
  // ── South America ──
  "São Paulo": { lat: -23.5505, lon: -46.6333, country: "Brazil", iata: "GRU" },
  "Rio de Janeiro": { lat: -22.8099, lon: -43.2506, country: "Brazil", iata: "GIG" },
  Brasilia: { lat: -15.8711, lon: -47.9186, country: "Brazil", iata: "BSB" },
  Fortaleza: { lat: -3.7762, lon: -38.5326, country: "Brazil", iata: "FOR" },
  Salvador: { lat: -12.9086, lon: -38.3225, country: "Brazil", iata: "SSA" },
  Recife: { lat: -8.1265, lon: -34.9231, country: "Brazil", iata: "REC" },
  Manaus: { lat: -3.0386, lon: -60.0497, country: "Brazil", iata: "MAO" },
  "Buenos Aires": { lat: -34.6037, lon: -58.3816, country: "Argentina", iata: "EZE" },
  Cordoba: { lat: -31.3236, lon: -64.2080, country: "Argentina", iata: "COR" },
  Mendoza: { lat: -32.8316, lon: -68.7930, country: "Argentina", iata: "MDZ" },
  Santiago: { lat: -33.3930, lon: -70.7858, country: "Chile", iata: "SCL" },
  Lima: { lat: -12.0219, lon: -77.1143, country: "Peru", iata: "LIM" },
  Cusco: { lat: -13.5357, lon: -71.9388, country: "Peru", iata: "CUZ" },
  Bogota: { lat: 4.7016, lon: -74.1469, country: "Colombia", iata: "BOG" },
  Medellin: { lat: 6.1645, lon: -75.4232, country: "Colombia", iata: "MDE" },
  Cartagena: { lat: 10.4424, lon: -75.5130, country: "Colombia", iata: "CTG" },
  Quito: { lat: -0.1292, lon: -78.3575, country: "Ecuador", iata: "UIO" },
  Guayaquil: { lat: -2.1574, lon: -79.8836, country: "Ecuador", iata: "GYE" },
  Caracas: { lat: 10.6013, lon: -66.9913, country: "Venezuela", iata: "CCS" },
  Montevideo: { lat: -34.8384, lon: -56.0308, country: "Uruguay", iata: "MVD" },
  Asuncion: { lat: -25.2399, lon: -57.5199, country: "Paraguay", iata: "ASU" },
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

  // Zoom / pan state (refs to avoid re-render)
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const dragRef = useRef(null); // { startX, startY, startPanX, startPanY }
  const pinchRef = useRef(null); // { dist, zoom, panX, panY }

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
      .then(r => r.json()).then(topo => setLandRings(decodeTopo(topo))).catch(() => {});
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json()).then(topo => setCountryRings(decodeCountries(topo))).catch(() => {});
  }, []);

  // Base map bounds at zoom=1 (2:1 ratio, fills canvas)
  const getBaseBounds = useCallback((W, H) => {
    const mapW = Math.min(W, H * 2);
    const mapH = mapW / 2;
    const ox = (W - mapW) / 2;
    const oy = (H - mapH) / 2;
    return { mapW, mapH, ox, oy };
  }, []);

  // Zoomed bounds
  const getMapBounds = useCallback((W, H) => {
    const { mapW: bW, mapH: bH, ox: bOx, oy: bOy } = getBaseBounds(W, H);
    const z = zoomRef.current;
    const mapW = bW * z;
    const mapH = bH * z;
    const ox = bOx + (bW - mapW) / 2 + panXRef.current;
    const oy = bOy + (bH - mapH) / 2 + panYRef.current;
    return { mapW, mapH, ox, oy };
  }, [getBaseBounds]);

  const project = useCallback((lat, lon, mapW, mapH, ox, oy) => {
    const x = ox + ((lon + 180) / 360) * mapW;
    const y = oy + ((90 - lat) / 180) * mapH;
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

    const { mapW, mapH, ox, oy } = getMapBounds(W, H);
    const isMobile = W < 500;
    const pr = (lat, lon) => project(lat, lon, mapW, mapH, ox, oy);

    // Background
    ctx.fillStyle = "#e8edf2";
    ctx.fillRect(0, 0, W, H);

    // Ocean (clipped to canvas)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.fillStyle = "#b8d0e0";
    ctx.fillRect(ox, oy, mapW, mapH);

    // Land
    landRings.forEach(ring => {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const { x, y } = pr(lat, lon);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "#dde8cc";
      ctx.fill();
    });

    // Country borders
    countryRings.forEach(ring => {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const { x, y } = pr(lat, lon);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(150,165,130,0.8)";
      ctx.lineWidth = 0.5 / zoomRef.current;
      ctx.stroke();
    });

    // Grid
    for (let lon = -180; lon <= 180; lon += 30) {
      const { x } = pr(0, lon);
      ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + mapH);
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 0.5; ctx.stroke();
    }
    for (let lat = -60; lat <= 90; lat += 30) {
      const { y } = pr(lat, 0);
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + mapW, y);
      ctx.strokeStyle = lat === 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = lat === 0 ? 1 : 0.5; ctx.stroke();
    }
    [23.5, -23.5].forEach(lat => {
      const { y } = pr(lat, 0);
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + mapW, y);
      ctx.strokeStyle = "rgba(200,175,90,0.3)"; ctx.lineWidth = 0.8;
      ctx.setLineDash([5, 7]); ctx.stroke(); ctx.setLineDash([]);
    });

    // ── Labels (taille adaptée au zoom) ──
    const fs = mapW / 900;

    OCEAN_LABELS.forEach(({ lat, lon, label, size }) => {
      if (!label) return;
      const { x, y } = pr(lat, lon);
      if (x < -50 || x > W + 50 || y < -20 || y > H + 20) return;
      const fs2 = Math.max(6, Math.round(size * fs));
      ctx.save();
      ctx.font = `italic ${fs2}px Georgia, serif`;
      ctx.fillStyle = "rgba(60,100,140,0.6)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
      ctx.restore();
    });

    if (!isMobile || zoomRef.current > 1.5) {
      SEA_LABELS.forEach(({ lat, lon, label, size }) => {
        if (!label) return;
        const { x, y } = pr(lat, lon);
        if (x < -50 || x > W + 50 || y < -20 || y > H + 20) return;
        const fs2 = Math.max(5, Math.round(size * fs));
        ctx.save();
        ctx.font = `italic ${fs2}px Georgia, serif`;
        ctx.fillStyle = "rgba(60,100,140,0.5)";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label, x, y);
        ctx.restore();
      });
    }

    CONTINENT_LABELS.forEach(({ lat, lon, label, size }) => {
      const { x, y } = pr(lat, lon);
      if (x < -80 || x > W + 80 || y < -30 || y > H + 30) return;
      const fs2 = Math.max(7, Math.round(size * fs));
      ctx.save();
      ctx.font = `bold ${fs2}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = "rgba(50,65,40,0.4)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
      ctx.restore();
    });

    // ── Arcs de vol ──
    trips.forEach((trip, i) => {
      const from = CITIES[trip.from];
      const to = CITIES[trip.to];
      if (!from || !to) return;
      if (arcProgressRef.current[i] === undefined) arcProgressRef.current[i] = 0;
      if (arcProgressRef.current[i] < 1)
        arcProgressRef.current[i] = Math.min(1, arcProgressRef.current[i] + 0.008);
      const progress = arcProgressRef.current[i];
      const isPlane = trip.type !== "train";

      const p1 = pr(from.lat, from.lon);
      const p2 = pr(to.lat, to.lon);
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const cpx = mx;
      const cpy = my - dist * 0.4;

      const steps = 60;
      const maxStep = Math.floor(steps * progress);
      const drawCurve = (lw, color) => {
        ctx.beginPath();
        for (let s = 0; s <= maxStep; s++) {
          const t = s / steps;
          const bx = (1-t)**2*p1.x + 2*(1-t)*t*cpx + t**2*p2.x;
          const by = (1-t)**2*p1.y + 2*(1-t)*t*cpy + t**2*p2.y;
          if (s === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
      };
      drawCurve(5, isPlane ? "rgba(24,24,27,0.12)" : "rgba(100,100,120,0.12)");
      drawCurve(1.8, isPlane ? "#18181b" : "#71717a");

      if (progress < 1) {
        const t = progress;
        const bx = (1-t)**2*p1.x + 2*(1-t)*t*cpx + t**2*p2.x;
        const by = (1-t)**2*p1.y + 2*(1-t)*t*cpy + t**2*p2.y;
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#18181b"; ctx.fill();
      }
    });

    // ── Villes ──
    const citySet = new Set();
    trips.forEach(t => { citySet.add(t.from); citySet.add(t.to); });
    citySet.forEach(name => {
      const city = CITIES[name];
      if (!city) return;
      const { x, y } = pr(city.lat, city.lon);
      const pulse = 0.5 + 0.5 * Math.sin(timeRef.current * 2 + city.lat);

      ctx.beginPath();
      ctx.arc(x, y, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(24,24,27,${0.18 * pulse})`; ctx.lineWidth = 1; ctx.stroke();

      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#18181b"; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();

      const labelSize = Math.max(7, Math.round(10 * fs));
      ctx.font = `bold ${labelSize}px 'JetBrains Mono', monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeText(city.iata, x + 5, y - 4);
      ctx.fillStyle = "#18181b";
      ctx.fillText(city.iata, x + 5, y - 4);
    });

    ctx.restore();

    // Bordure
    ctx.strokeStyle = "rgba(60,80,100,0.2)"; ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, mapW, mapH);
  }, [trips, project, getMapBounds, landRings, countryRings]);

  useEffect(() => { arcProgressRef.current = {}; }, [trips.length]);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Resize
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

  // Zoom helper (zoom toward a point cx,cy in canvas coords)
  const applyZoom = useCallback((newZoom, cx, cy) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = canvas._dpr || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const { mapW: bW, mapH: bH, ox: bOx, oy: bOy } = (() => {
      const mapW = Math.min(W, H * 2);
      const mapH = mapW / 2;
      return { mapW, mapH, ox: (W - mapW) / 2, oy: (H - mapH) / 2 };
    })();

    const oldZ = zoomRef.current;
    const clampedZ = Math.max(1, Math.min(20, newZoom));
    // Adjust pan so the point under cursor stays fixed
    const scale = clampedZ / oldZ;
    panXRef.current = cx - bOx - bW / 2 - (cx - bOx - bW / 2 - panXRef.current) * scale;
    panYRef.current = cy - bOy - bH / 2 - (cy - bOy - bH / 2 - panYRef.current) * scale;
    zoomRef.current = clampedZ;
    clampPan(W, H, clampedZ, bW, bH);
  }, []);

  const clampPan = (W, H, z, bW, bH) => {
    const maxPanX = (bW * (z - 1)) / 2;
    const maxPanY = (bH * (z - 1)) / 2;
    panXRef.current = Math.max(-maxPanX, Math.min(maxPanX, panXRef.current));
    panYRef.current = Math.max(-maxPanY, Math.min(maxPanY, panYRef.current));
  };

  // Mouse wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      applyZoom(zoomRef.current * delta, cx, cy);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  // Mouse drag
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onDown = (e) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panXRef.current, startPanY: panYRef.current };
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const dpr = canvas._dpr || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const bW = Math.min(W, H * 2);
      const bH = bW / 2;
      panXRef.current = dragRef.current.startPanX + dx;
      panYRef.current = dragRef.current.startPanY + dy;
      clampPan(W, H, zoomRef.current, bW, bH);
    };
    const onUp = () => { dragRef.current = null; canvas.style.cursor = "grab"; };
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.style.cursor = "grab";
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Touch: drag + pinch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startPanX: panXRef.current, startPanY: panYRef.current };
        pinchRef.current = null;
      } else if (e.touches.length === 2) {
        dragRef.current = null;
        pinchRef.current = { dist: dist2(e.touches[0], e.touches[1]), zoom: zoomRef.current, panX: panXRef.current, panY: panYRef.current };
      }
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      const dpr = canvas._dpr || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const bW = Math.min(W, H * 2);
      const bH = bW / 2;
      if (e.touches.length === 1 && dragRef.current) {
        const dx = e.touches[0].clientX - dragRef.current.startX;
        const dy = e.touches[0].clientY - dragRef.current.startY;
        panXRef.current = dragRef.current.startPanX + dx;
        panYRef.current = dragRef.current.startPanY + dy;
        clampPan(W, H, zoomRef.current, bW, bH);
      } else if (e.touches.length === 2 && pinchRef.current) {
        const newDist = dist2(e.touches[0], e.touches[1]);
        const scale = newDist / pinchRef.current.dist;
        const newZoom = Math.max(1, Math.min(20, pinchRef.current.zoom * scale));
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - canvas.getBoundingClientRect().left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - canvas.getBoundingClientRect().top;
        applyZoom(newZoom, cx, cy);
      }
    };
    let lastTap = 0;
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) {
        dragRef.current = null;
        // Double-tap → reset zoom
        const now = Date.now();
        if (now - lastTap < 300) {
          zoomRef.current = 1;
          panXRef.current = 0;
          panYRef.current = 0;
        }
        lastTap = now;
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyZoom]);

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
      <div style={{ flex: 1, minHeight: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Globe */}
        {tab === "globe" && (
          <div className="card-in" style={{ width: "100%", aspectRatio: "2 / 1", minHeight: 160, maxHeight: "calc(100vh - 260px)", position: "relative", background: "#b8d0e0", borderRadius: 12, border: "1px solid rgba(24,24,27,0.1)", overflow: "hidden" }}>
            <FlatMap trips={trips} />
            <div style={{ position: "absolute", bottom: 10, left: 12, display: "flex", gap: 12, fontSize: 8, color: "#a8a8b0", letterSpacing: 1, pointerEvents: "none" }}>
              <span style={{ color: "#18181b" }}>▬ VOL</span>
              <span style={{ color: "#71717a" }}>▬ TRAIN</span>
            </div>
            <div style={{ position: "absolute", top: 8, right: 8, pointerEvents: "none" }}>
              <div style={{ background: "rgba(255,255,255,0.55)", borderRadius: 4, padding: "3px 7px", fontSize: 8, color: "#71717a", letterSpacing: 1 }}>scroll · pinch · double-tap=reset</div>
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
