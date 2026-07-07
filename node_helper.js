/* MagicMirror²
 * Node Helper: MMM-KVBRad
 *
 * Fetches the nextbike live feed (JSON) server-side, computes the distance
 * from the configured lat/long to every place, filters and sorts them, and
 * returns the nearest N to the front-end module.
 *
 * Requires Node.js 18+ (uses the global fetch API, which also transparently
 * handles the gzip-compressed nextbike response).
 *
 * License: MIT
 */
const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  socketNotificationReceived(notification, payload) {
    if (notification === "MMM-KVBRad-GET") {
      this.fetchFeed(payload.id, payload.config);
    }
  },

  // We use the legacy nextbike-live.json feed on purpose: unlike the more
  // "official" GBFS v2 endpoint (https://gbfs.nextbike.net/maps/gbfs/v2/...),
  // it exposes per-place free-floating bike details incl. bike numbers
  // (bike_list), which this module needs. GBFS is the long-term-stable
  // alternative if live.json is ever retired.
  buildUrl(config) {
    if (config.feedUrl) return config.feedUrl;
    if (config.cityId) {
      return `https://api.nextbike.net/maps/nextbike-live.json?city=${config.cityId}`;
    }
    return `https://api.nextbike.net/maps/nextbike-live.json?domains=${config.domain}`;
  },

  async fetchFeed(id, config) {
    const url = this.buildUrl(config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "MMM-KVBRad (MagicMirror module)" },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }

      const data = await res.json();
      const stations = this.process(data, config);
      this.sendSocketNotification("MMM-KVBRad-DATA", { id, stations });
    } catch (err) {
      clearTimeout(timeout);
      console.error("[MMM-KVBRad] fetch failed:", err.message);
      this.sendSocketNotification("MMM-KVBRad-ERROR", {
        id,
        error: err.message
      });
    }
  },

  process(data, config) {
    const origin = { lat: config.lat, lng: config.lng };
    const out = [];

    const countries = (data && data.countries) || [];
    countries.forEach((country) => {
      (country.cities || []).forEach((city) => {
        (city.places || []).forEach((p) => {
          // determine type: nextbike marks fixed stations with spot=true,
          // single free-floating bikes with bike=true
          const isBike = p.bike === true || p.spot === false;
          const type = isBike ? "bike" : "station";

          // available bikes: prefer "bikes_available_to_rent", fall back to "bikes"
          let bikes = p.bikes_available_to_rent;
          if (bikes == null) bikes = p.bikes;
          if (bikes == null) bikes = Array.isArray(p.bike_list) ? p.bike_list.length : 0;
          bikes = Number(bikes) || 0;

          // filter by type
          if (config.showType === "stations" && type !== "station") return;
          if (config.showType === "bikes" && type !== "bike") return;

          // filter by availability
          if (bikes < (config.minBikes || 0)) return;

          const lat = Number(p.lat);
          const lng = Number(p.lng);
          if (!isFinite(lat) || !isFinite(lng)) return;

          const distance = this.haversine(origin, { lat, lng });
          if (config.maxDistance && distance > config.maxDistance) return;

          let bikeNumbers = [];
          if (Array.isArray(p.bike_list)) {
            bikeNumbers = p.bike_list
              .map((b) => b.number)
              .filter((n) => n != null);
          } else if (typeof p.bike_numbers === "string") {
            bikeNumbers = p.bike_numbers.split(",").map((s) => s.trim()).filter(Boolean);
          }

          out.push({
            uid: p.uid,
            name: p.name,
            bikes,
            type,
            distance: Math.round(distance),
            bearing: Math.round(this.bearing(origin, { lat, lng })),
            bikeNumbers,
            lat,
            lng
          });
        });
      });
    });

    out.sort((a, b) => a.distance - b.distance);
    return out.slice(0, config.maxItems || 5);
  },

  haversine(a, b) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  },

  bearing(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
    const x =
      Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
      Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
});
