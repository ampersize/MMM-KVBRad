# MMM-KVBRad

A [MagicMirror²](https://magicmirror.builders/) module that shows the **nearest
nextbike stations and free-floating bikes to a given lat/long** — distance-based
(Haversine) instead of a fixed station ID.

Defaults to **KVB-Rad Köln** (nextbike domain `kg`, city `14`), but works for any
nextbike system by changing the `domain` (or `cityId` / `feedUrl`).

Because KVB-Rad is largely **free-floating inside a flex zone** in the inner city,
a fixed "nearest station" is often not what you want — the nearest *rentable bike*
can be closer and only appears in the live feed. This module can show stations,
free-floating bikes, or both.

## How it works

- The `node_helper` fetches the live JSON feed **server-side** (no browser CORS
  issue; gzip is decompressed automatically by Node's `fetch`).
- It computes the distance from your configured `lat`/`lng` to every place,
  filters by type / availability / radius, sorts by distance, and returns the
  nearest N to the front-end.

## Requirements

- Node.js **20+** (uses the global `fetch` API; matches MagicMirror² 2.30+'s
  requirement). No external npm dependencies.

## Install

```bash
cd ~/MagicMirror/modules
git clone <your-repo-or-copy-the-folder-here> MMM-KVBRad
# no `npm install` needed (no dependencies)
```

Or just drop the `MMM-KVBRad` folder into `~/MagicMirror/modules/`.

## Configuration

Add to `~/MagicMirror/config/config.js`:

```js
{
  module: "MMM-KVBRad",
  position: "top_left",
  header: "KVB-Rad",
  config: {
    lat: 50.9413,      // your position
    lng: 6.9583,
    showType: "all",    // "all" | "stations" | "bikes"
    maxDistance: 1000,  // metres (0 = no limit)
    maxItems: 5,
    updateInterval: 3 * 60 * 1000
  }
}
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `lat` / `lng` | `50.9413` / `6.9583` | Your position in decimal degrees (WGS84). |
| `domain` | `"kg"` | nextbike domain code. `kg` = KVB-Rad Köln. |
| `cityId` | `null` | Use a numeric city id instead of the domain (Köln = `14`). |
| `feedUrl` | `null` | Full override of the feed URL. |
| `showType` | `"all"` | `"stations"`, `"bikes"` (free-floating), or `"all"`. |
| `minBikes` | `1` | Only show entries with at least this many available bikes. |
| `maxDistance` | `1000` | Radius in metres. `0` = no limit. |
| `maxItems` | `5` | Number of rows displayed. |
| `showDistance` | `true` | Show the distance column. |
| `showBearing` | `false` | Show a compass arrow towards the entry. |
| `bearingCorrection` | `0` | Degrees; rotate arrows to match how the mirror is mounted. |
| `showBikeNumbers` | `false` | List individual bike numbers (useful for single bikes). |
| `showType_icons` | `true` | Small icon: station (marker) vs. free-floating bike. |
| `updateInterval` | `180000` | Refresh interval in ms. Keep at ≥ ~60 s to be gentle on the API. |
| `retryDelay` | `30000` | Retry delay after an error, in ms. |
| `animationSpeed` | `1000` | DOM update fade duration in ms. |

## Feed endpoints (for reference / other systems)

- Live (bikes + stations), JSON: `https://api.nextbike.net/maps/nextbike-live.json?domains=kg`
- Live by city id: `https://api.nextbike.net/maps/nextbike-live.json?city=14`
- Official stations only, XML: `https://api.nextbike.net/maps/nextbike-official.xml?city=14`

To find another system's domain code, look up its `domain` value in
`https://api.nextbike.net/maps/nextbike-live.json` (or the GBFS systems list).

## Notes

- `showType: "all"` is recommended for the inner city so you also catch
  free-floating bikes in the flex zone.
- The feed reflects near-real-time availability; treat counts as a snapshot.
- Not affiliated with nextbike GmbH or KVB.

## License

MIT
