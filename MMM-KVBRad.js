/* MagicMirror²
 * Module: MMM-KVBRad
 *
 * Shows the nearest nextbike stations / free-floating bikes to a given
 * lat/long, based on the live nextbike feed (default domain: kg = KVB-Rad Köln).
 *
 * Distance-based (Haversine) instead of a fixed station ID.
 *
 * License: MIT
 */
Module.register("MMM-KVBRad", {
  defaults: {
    // --- Your position ------------------------------------------------------
    lat: 50.9413,          // your latitude  (decimal degrees, WGS84)
    lng: 6.9583,           // your longitude (decimal degrees, WGS84)

    // --- Feed ---------------------------------------------------------------
    domain: "kg",           // nextbike domain code (kg = KVB-Rad Köln)
    cityId: null,           // optional: use a numeric city id instead of domain (Köln = 14)
    feedUrl: null,          // optional: full override, e.g. "https://api.nextbike.net/maps/nextbike-live.json?domains=kg"

    // --- What to show -------------------------------------------------------
    showType: "all",        // "all" | "stations" | "bikes"  (bikes = free-floating in the flex zone)
    minBikes: 1,            // only show entries with at least this many available bikes
    maxDistance: 1000,      // metres; 0 = no limit
    maxItems: 5,            // how many rows to display

    // --- Display ------------------------------------------------------------
    showDistance: true,
    showBearing: false,     // show a compass arrow pointing towards the station
    bearingCorrection: 0,   // degrees; rotate arrows to match how the mirror is mounted
    showBikeNumbers: false, // list individual bike numbers (only useful for single bikes)
    showType_icons: true,   // small icon distinguishing station vs. free-floating bike

    // --- Timing -------------------------------------------------------------
    updateInterval: 5 * 60 * 1000, // 5 min; the live feed updates roughly once per minute, so don't go much lower
    retryDelay: 30 * 1000,
    animationSpeed: 1000
  },

  getStyles() {
    return ["MMM-KVBRad.css", "font-awesome.css"];
  },

  getTranslations() {
    return { en: "translations/en.json", de: "translations/de.json" };
  },

  start() {
    Log.info("Starting module: " + this.name);
    this.stations = [];
    this.loaded = false;
    this.error = null;
    this.updateTimer = null;
    this.getData();
  },

  getData() {
    this.sendSocketNotification("MMM-KVBRad-GET", {
      id: this.identifier,
      config: this.config
    });
  },

  // Single self-rescheduling timer: the next fetch is scheduled only after a
  // response arrives, so the normal interval and the error retry can never
  // overlap or drift.
  scheduleUpdate(delay) {
    const next = delay != null ? delay : this.config.updateInterval;
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => this.getData(), next);
  },

  socketNotificationReceived(notification, payload) {
    if (!payload || payload.id !== this.identifier) return;

    if (notification === "MMM-KVBRad-DATA") {
      this.stations = payload.stations || [];
      this.loaded = true;
      this.error = null;
      this.updateDom(this.config.animationSpeed);
      this.scheduleUpdate();
    } else if (notification === "MMM-KVBRad-ERROR") {
      this.error = payload.error || "unknown error";
      this.loaded = true;
      this.updateDom(this.config.animationSpeed);
      // retry sooner than the normal interval
      this.scheduleUpdate(this.config.retryDelay);
    }
  },

  getHeader() {
    return this.data.header || "KVB-Rad";
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "kvbrad";

    if (!this.loaded) {
      wrapper.textContent = this.translate("LOADING") || "Loading …";
      wrapper.className = "kvbrad dimmed light small";
      return wrapper;
    }

    if (this.error) {
      wrapper.textContent = "KVB-Rad: " + this.error;
      wrapper.className = "kvbrad dimmed light small";
      return wrapper;
    }

    if (this.stations.length === 0) {
      wrapper.textContent = this.translate("NONE") || "No bikes nearby";
      wrapper.className = "kvbrad dimmed light small";
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "kvbrad-table small";

    this.stations.forEach((s) => {
      const row = document.createElement("tr");

      // icon (station vs. free-floating bike)
      if (this.config.showType_icons) {
        const iconCell = document.createElement("td");
        iconCell.className = "kvbrad-icon dimmed";
        const icon = document.createElement("span");
        icon.className =
          "fa " + (s.type === "bike" ? "fa-bicycle" : "fa-map-marker");
        iconCell.appendChild(icon);
        row.appendChild(iconCell);
      }

      // bikes available
      const bikesCell = document.createElement("td");
      bikesCell.className = "kvbrad-bikes bright";
      bikesCell.textContent = s.bikes;
      row.appendChild(bikesCell);

      // name
      const nameCell = document.createElement("td");
      nameCell.className = "kvbrad-name";
      nameCell.textContent = s.name;
      if (this.config.showBikeNumbers && s.bikeNumbers && s.bikeNumbers.length) {
        const nums = document.createElement("span");
        nums.className = "kvbrad-numbers xsmall dimmed";
        nums.textContent = " (" + s.bikeNumbers.join(", ") + ")";
        nameCell.appendChild(nums);
      }
      row.appendChild(nameCell);

      // distance
      if (this.config.showDistance) {
        const distCell = document.createElement("td");
        distCell.className = "kvbrad-dist dimmed";
        distCell.textContent = this.formatDistance(s.distance);
        row.appendChild(distCell);
      }

      // bearing arrow
      if (this.config.showBearing) {
        const bCell = document.createElement("td");
        bCell.className = "kvbrad-bearing dimmed";
        bCell.textContent = this.bearingArrow(s.bearing);
        row.appendChild(bCell);
      }

      table.appendChild(row);
    });

    wrapper.appendChild(table);
    return wrapper;
  },

  formatDistance(m) {
    if (m == null) return "";
    return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km";
  },

  bearingArrow(bearing) {
    if (bearing == null) return "";
    const a = (bearing + this.config.bearingCorrection + 360) % 360;
    const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
    return arrows[Math.round(a / 45) % 8];
  }
});
