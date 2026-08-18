/* NJ toll roads revealed over the 1930s NJ aerial mosaic.
 *
 * The mosaic is a single PMTiles archive read straight over HTTP range requests
 * (see server.py), so nothing on the server side knows what a tile is.
 *
 * Two networks are selectable, each in its own file. The Turnpike carries two
 * alignments north of Newark - the mainline (Eastern Spur) and the Western Spur.
 * Mainline metres are the clock for every alignment and for every sign; see
 * localDist() and clockOf().
 *
 * Visual and interaction decisions live in DESIGN.md rather than in comments
 * here. Where this file makes a choice that looks arbitrary, that is where the
 * reasoning is written down.
 */

import * as maplibregl from './vendor/maplibre-gl.mjs';
import { Protocol } from './vendor/pmtiles.mjs';

const APP_CONFIG = globalThis.APP_CONFIG ?? {};
const PMTILES_URL = APP_CONFIG.aerialUrl || '/aerial.pmtiles';
const AERIAL_TILE_SIZE = APP_CONFIG.aerialTileSize === 512 ? 512 : 256;

// --------------------------------------------------------------------------
// Networks
// --------------------------------------------------------------------------

const NETWORKS = {
  NJTP: {
    key: 'NJTP',
    label: 'New Jersey Turnpike',
    short: 'NJTP',
    file: 'route.geojson',
    color: '#007a33', // Turnpike green
    gold: '#ffd100', // shield gold
    // The same green either side of it: the road as it is going to be, and the
    // road as it has been driven. Both the scrubber and the minimap are drawn
    // in these, so a glance at either reads the same way as a glance at the map.
    light: '#59a87a',
    dark: '#004f21',
  },
  GSP: {
    key: 'GSP',
    label: 'Garden State Parkway',
    short: 'GSP',
    file: 'route-gsp.geojson',
    // The Parkway's true brand green is far darker; it vanishes over the Pine
    // Barrens on a monochrome basemap. DESIGN.md section 1 has the reasoning.
    color: '#2e7d32',
    gold: '#ffc72c',
    light: '#77aa7a',
    dark: '#1e5121',
  },
};
const NETWORK_ORDER = ['NJTP', 'GSP'];

// Width the highlight is painted at, in real-world metres. The Turnpike's
// actual right-of-way through the dual-dual section is around 110 m; this is
// deliberately 3x that. It stopped being a measurement and became a graphic
// device - at the zooms this map is actually read at, true width is a thread.
const HIGHWAY_WIDTH_M = 330;
/* The band is painted at true ground width between two limits, and both exist
 * because the road has to stay legible across nine zoom levels.
 *
 * The floor is what keeps the whole route visible at the state view, where the
 * true width is a third of a pixel. It is deliberately generous - the green is
 * drawn permanently now, and a permanent line you cannot see is worse than no
 * line at all.
 *
 * The cap is the other end of the same problem: at the driving zoom the true
 * 330 m works out to 550 px, and tipped over at 74 degrees that fans out to
 * cover most of the screen - a green wash over the top of the photograph the
 * map exists to show. Frozen at 150 px it reads as roughly 100 m of ground
 * down there, near enough the real right-of-way, so the place where the
 * imagery is sharpest is also where the band is most honest. */
const BAND_CAP_PX = 150;
// The floor as plain anchor points rather than as an expression: MapLibre
// permits exactly one zoom-driven subexpression per paint property, so the
// floor, the true width and the cap cannot be three expressions clamped
// together - they have to be solved here and arrive as one set of stops.
const BAND_FLOOR = [[8, 7], [11, 5], [14, 3.4]];
/* How solid the unrevealed road is. It has to hold its own against a noisy
 * grey photograph at the state view and get out of the way of that same
 * photograph at the driving view, where the same band is 260 px across and
 * would otherwise be a green wash over the only thing worth looking at. */
const GHOST_OPACITY = ['interpolate', ['linear'], ['zoom'], 8, 0.55, 12.5, 0.38, 16, 0.14];
const BAND_OPACITY = ['interpolate', ['linear'], ['zoom'], 8, 0.72, 12.5, 0.56, 16, 0.26];

const MIN_ZOOM = 8; // z8 shows the whole state; the pyramid bottoms out there
const MAX_ZOOM = 19; // native imagery is z16, above that we overzoom

const INTRO_MS = 2600;

/* The three ways of looking at the road.
 *
 * Everything the camera does is a property of the view rather than a set of
 * independent toggles: pitch, which way is up, whether we are chasing the head,
 * how deep, and how hard the relief is pushed. Picking a view is the whole
 * interaction - there is no combination of switches to get wrong.
 *
 *   state - the whole thing, north up, flat. Where the map opens.
 *   top   - straight down and close, following: what a town looks like as the
 *           road goes through it.
 *   drive - the car-navigation view. Tilted right over, turned to face the way
 *           you are going, and as deep as the imagery holds up.
 *
 * `low` is where down the screen the head should sit, 0 at the top and 1 at the
 * bottom, and 0.5 is dead centre. Left null the camera centres on the head AND
 * the view is allowed to pull back to frame both alignments through the split -
 * which is right for a top-down map and wrong for a tilted one, where the two
 * spurs are miles apart and the fit would haul the camera off the road.
 *
 * The driving view is deliberately centred rather than sat low. A navigation
 * app puts the vehicle at the bottom because it only cares about the road
 * ahead; here the road behind you is the half that has just been revealed, and
 * watching it unroll away behind is most of the point.
 */
const VIEWS = {
  state: { pitch: 0, headingUp: false, follow: false, zoom: null, low: null },
  top: { pitch: 0, headingUp: false, follow: true, zoom: 13.4, low: null },
  drive: { pitch: 74, headingUp: true, follow: true, zoom: 13.5, low: 0.5 },
};
const VIEW_ORDER = ['state', 'top', 'drive'];

/* Sky and horizon haze. With the camera tipped to 74 degrees the top of the
 * screen is the edge of the loaded terrain against nothing, which reads as a
 * cliff into a void. These are the greys of the photography rather than a blue
 * sky: the map is one continuous 1930s monochrome image and a blue band across
 * the top of it would be the only colour on the screen that is not signage. */
const SKY = {
  'sky-color': '#242a2f',
  'sky-horizon-blend': 0.75,
  'horizon-color': '#8f9599',
  'horizon-fog-blend': 0.55,
  'fog-color': '#b0b4b7',
  'fog-ground-blend': 0.78,
  'atmosphere-blend': 0.85,
};

/* Speed, as five notches rather than a continuous dial.
 *
 * Set in metres of route per second, not in "seconds for the whole run": the
 * Parkway is 50 miles longer than the Turnpike, and a fixed run time would make
 * the same notch mean two different speeds over the ground. It also makes the
 * numbers mean something against the zoom, which is what the automatic mode
 * below is built on. The mph this works out to was on the dial before and has
 * been taken off - at these speeds it is a number in the thousands, and knowing
 * it tells you nothing about what you are watching.
 *
 * Notch 5 crosses New Jersey in about 37 s, which is the top of the old dial's
 * useful range. Notch 1 is roughly 250 mph over the ground: slow enough that a
 * town takes half a minute to go by, which is the point of the driving view.
 */
const SPEEDS = [110, 290, 750, 2000, 5200];
/* Which notch a given zoom deserves, coarsest first. The pairing is the whole
 * idea: zoomed out you are watching a shape appear and want it quickly, zoomed
 * in you are watching ground go past and want it slowly. Overridable, because
 * sometimes you just want to get somewhere. */
const SPEED_BY_ZOOM = [[14.2, 1], [12.6, 2], [11.2, 3], [9.6, 4]];

// Metres per pixel at zoom 0 for the middle of the route. The band is specified
// in real-world metres, and mpp halves with every zoom level, so an exponential
// base-2 interpolation reproduces a constant ground width exactly - no
// per-zoom recalculation in JS.
//
// 78271.5 is the equator's metres-per-pixel at zoom 0 for MapLibre, whose zoom
// is defined against 512 px tiles (the world is 512 * 2^zoom CSS pixels across).
// The more familiar 156543.03392 is the 256 px tile figure - using it here drew
// the band at half its real width, which is easy to miss because it still
// scaled correctly from zoom to zoom.
const LAT0 = 40.15;
const MPP_Z0 = 78271.51696 * Math.cos((LAT0 * Math.PI) / 180);

const LOOKAHEAD_M = 260; // how far up the road the camera aims when heading-up
const BEARING_TAU = 0.35; // seconds; camera turn smoothing
const ZOOM_TAU = 0.5; // seconds; camera zoom smoothing

// Room left around the pair of heads when both alignments are running.
const SPLIT_PADDING = { top: 90, right: 96, bottom: 150, left: 40 };
// The overview has to clear the road switch above, the speedometer and the
// bottom-right stack below, the scrubber down the whole right-hand edge, and
// the map controls down the left.
const OVERVIEW_PADDING = { top: 62, right: 66, bottom: 130, left: 58 };

// Sign lifecycle, in metres of route either side of the head. Ahead gets more
// runway than behind: the sign you are approaching is the one you want to read.
const SIGN_IN_M = 2400;
const SIGN_FULL_AHEAD_M = 400;
const SIGN_FULL_BEHIND_M = 250;
const SIGN_OUT_M = 1600;
// A sign holds this long in wall-clock terms however fast the road is moving.
// Without it the whole exit list strobes past unreadably at high speed.
const SIGN_DWELL_MS = 900;
const SIGN_DWELL_FADE_MS = 380;
// Anything further than this off the line is a bad geocode, not an interchange.
const SIGN_SNAP_TOLERANCE_M = 1500;

// Municipal labels. `near` is metres from the label point to the road being
// drawn: inside MUNI_NEAR_M a town counts as on the route and is styled up.
const MUNI_SIGN_GREEN = '#006747';
const MUNI_NEAR_M = 4000;
// Opacity per label tier. Place names are not gated on anything - they show
// whatever the camera is doing.
const MUNI_LABEL_OPACITY = { 'muni-label-near': 0.97, 'muni-label-far': 0.62 };
// Off-screen indicators: how close to the road a town must be to earn one, how
// far up and down the route we look, and how many may show at once.
const EDGE_NEAR_M = 6000;
const EDGE_WINDOW_M = 11000;
const MAX_EDGE = 4;
// How far outside the viewport a label anchor can sit and still be readable.
const EDGE_LABEL_REACH = 60;

/* Elevation. This is the only thing in the project that reaches the network -
 * everything else, imagery included, is local. Terrain off, the map still works
 * with no connection at all; terrain on, it needs one. README says so too.
 *
 * Declared up here rather than beside the terrain code because a control's
 * state() reads it during addControl, and a `const` further down the file is
 * still in its temporal dead zone at that point.
 *
 * Two of these values are not optional:
 *   encoding  - MapLibre defaults raster-dem to 'mapbox'. Mapterhorn is
 *               terrarium (elev = R*256 + G + B/256 - 32768). Left on the
 *               default, a pixel that should read 550 m reads 842,930 m.
 *   maxzoom   - their TileJSON omits it, so MapLibre keeps its default of 22
 *               and hammers the CDN for tiles that 404 above 16.
 */
const TERRAIN = {
  // A local New Jersey extract if one has been built, otherwise Mapterhorn's
  // CDN. The local archive is what makes terrain work offline, and what stops
  // the phone pulling elevation over the internet while the imagery is already
  // coming down a Tailscale link.
  local: '/terrain.pmtiles',
  remote: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',
  remoteMaxzoom: 16,
  encoding: 'terrarium',
  tileSize: 512, // raster-dem's native tile size; aerial size is runtime-configured
  attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
};
/* How hard the relief is pushed, against zoom.
 *
 * New Jersey's high point is 550 m and the Turnpike corridor is mostly under
 * 60 m, so at true scale this state is a table and some exaggeration is the
 * only way to see anything at all.
 *
 * The numbers go DOWN as you zoom in, which is the opposite of the guess. The
 * elevation archive stops at z14 - about 5 m per sample - while the driving
 * view reads the photograph at 0.6 m per pixel. Down there one sample spans
 * seven screen pixels, so a 1 m step between neighbouring samples drawn at 4x
 * becomes a 25-degree slope, and flat Burlington County farmland grows a range
 * of mountains made entirely out of quantisation. At 6x it was unusable.
 *
 * So the exaggeration lives where there is real relief to find and enough data
 * under it to find it with: hard at the middle zooms, where the DEM out-
 * resolves the screen, and close to honest at the bottom. */
const TERRAIN_EXAGGERATION = [[8, 5], [12.5, 4], [14.5, 2.2], [16.5, 1.3]];
let terrainLocal = false; // resolved at boot by asking the server for the archive
let terrainApplied = null; // the exaggeration currently handed to setTerrain

const MI = 1609.344;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const warn = (msg) => {
  const w = $('warn');
  w.textContent = msg;
  w.style.display = 'block';
};
// Banner gets the message, console gets the stack.
const reportFailure = (e) => {
  console.error(e);
  warn(e.message);
};

// --------------------------------------------------------------------------
// Icons
//
// Established navigation-app conventions rather than invented glyphs: an arrow
// means orientation, a reticle means position. See DESIGN.md section 6.
// --------------------------------------------------------------------------

const ICON = {
  // Filled navigation arrow - "which way am I pointed".
  heading:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6 19.4 21a.6.6 0 0 1-.85.72L12 18.3l-6.55 3.42A.6.6 0 0 1 4.6 21z"/></svg>',
  // Recentre reticle - "keep me in the middle", looking straight down.
  follow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"/></svg>',
  // Fit-to-extent brackets.
  whole:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  // A road running away to a horizon: the windscreen view, which is what every
  // navigation app puts behind its 3D button. The horizon line is not
  // decoration - without it the trapezoid alone reads as a warning triangle.
  drive:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 7.6h18.4"/><path d="M9.9 7.6 3.6 20.4M14.1 7.6l6.3 12.8"/><path d="M12 10.4v1.7M12 14.3v1.9M12 18.4v1.8"/></svg>',
  north:
    '<svg viewBox="0 0 24 24"><path d="M6.4 3.2l3.6 5H7.7v12.6h-2.6V8.2H2.8z" fill="currentColor"/><text x="12.6" y="17.4" font-family="ui-sans-serif,sans-serif" font-size="13" font-weight="700" fill="currentColor">N</text></svg>',
  south:
    '<svg viewBox="0 0 24 24"><path d="M6.4 20.8l3.6-5H7.7V3.2h-2.6v12.6H2.8z" fill="currentColor"/><text x="12.6" y="17.4" font-family="ui-sans-serif,sans-serif" font-size="13" font-weight="700" fill="currentColor">S</text></svg>',
  // Every icon states its own paint. A stylesheet fill on the <svg> overrides a
  // fill="none" presentation attribute, which is what filled the old reset
  // arc in and left a blob in the corner of the screen.
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.6 19.5 12 7 19.4z"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
  // Skip-to-start rather than a circular arrow: this button goes back to the
  // beginning of the run, and the bar-and-triangle says that in one glance
  // where a rotating arrow says "reload" to half the people who see it.
  reset:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.6 5h2.7v14H5.6z"/><path d="M19.8 5.3v13.4L9.6 12z"/></svg>',
  // The head of the reveal. Same arrow every navigation app draws itself with -
  // a swept chevron rather than an isoceles triangle, because the notch in the
  // tail is what makes the point read as the front at 26 px. Painted from CSS
  // so it follows the network's gold.
  head:
    '<svg viewBox="0 0 24 24"><path d="M12 1.9 21.1 21.6a.62.62 0 0 1-.85.8L12 18.1l-8.25 4.3a.62.62 0 0 1-.85-.8z"/></svg>',
};

// --------------------------------------------------------------------------
// Style
// --------------------------------------------------------------------------

const bandPx = (z) => (HIGHWAY_WIDTH_M * 2 ** z) / MPP_Z0;

/* Piecewise-linear pixel floor, evaluated here rather than by the GPU. */
function floorPx(z) {
  const pts = BAND_FLOOR;
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (z > pts[i][0]) continue;
    const [z0, w0] = pts[i - 1];
    const [z1, w1] = pts[i];
    return w0 + ((w1 - w0) * (z - z0)) / (z1 - z0);
  }
  return pts[pts.length - 1][1];
}

/* True ground width, floored so the road survives the state view and capped so
 * it does not bury the photograph at the driving view - as a single expression,
 * because that is all MapLibre will take.
 *
 * The trick is that base-2 exponential interpolation between two stops IS
 * constant ground width, exactly. So the stops are just the three corners:
 * where the floor gives way to the true width, and where the true width hits
 * the cap. Everything between them comes out ground-true for free. */
function bandWidth() {
  const zCap = Math.min(Math.log2((BAND_CAP_PX * MPP_Z0) / HIGHWAY_WIDTH_M), MAX_ZOOM);
  let zFloor = MIN_ZOOM;
  while (zFloor < zCap && bandPx(zFloor) < floorPx(zFloor)) zFloor += 0.01;

  const stops = [MIN_ZOOM, floorPx(MIN_ZOOM)];
  if (zFloor > MIN_ZOOM + 0.02) stops.push(zFloor, bandPx(zFloor));
  stops.push(zCap, Math.min(BAND_CAP_PX, bandPx(zCap)));
  if (zCap < MAX_ZOOM) stops.push(MAX_ZOOM, BAND_CAP_PX);
  return ['interpolate', ['exponential', 2], ['zoom'], ...stops];
}

// The gold line inside the band. It carries the whole road at the state view,
// where the band is a hairline, and has to stay a legible thread inside a
// 260 px band at the driving view - so it grows, but nothing like as fast.
const coreWidth = () => ['interpolate', ['linear'], ['zoom'], 8, 2.4, 13, 3.4, 17, 4.2];

const CLEAR = 'rgba(0,0,0,0)';

// The reveal is a hard step in a line gradient rather than a re-sliced polyline:
// one paint property per frame instead of re-tiling geometry 60 times a second.
// Driving south, the road behind you is the far end of the line, so the two
// colours swap sides of the step.
const revealTo = (f, color) => {
  const at = clamp(f, 1e-4, 0.9999);
  return northbound
    ? ['step', ['line-progress'], color, at, CLEAR]
    : ['step', ['line-progress'], CLEAR, at, color];
};

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const map = new maplibregl.Map({
  container: 'map',
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  // MapLibre's default ceiling is 60 degrees, which is not enough for a
  // windscreen view - the driving view asks for 74.
  maxPitch: 85,
  zoom: 11,
  center: [-75.13, 39.68], // replaced by the overview framing on load
  // Added by hand below so it can sit bottom-left: the default bottom-right
  // puts it straight under the scrubber column.
  attributionControl: false,
  style: {
    version: 8,
    sources: {
      aerial: {
        type: 'raster',
        url: `pmtiles://${PMTILES_URL}`,
        tileSize: AERIAL_TILE_SIZE,
        attribution:
          '1930s orthophotography &mdash; NJ DEP / NJGIS &middot; routes from OpenStreetMap',
      },
    },
    layers: [
      { id: 'void', type: 'background', paint: { 'background-color': '#111' } },
      {
        id: 'aerial',
        type: 'raster',
        source: 'aerial',
        paint: { 'raster-fade-duration': 150 },
      },
    ],
  },
});

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------

/* One entry per alignment of the *current* network. Each carries its own
 * geometry and distance tables, plus the window of mainline distance it
 * occupies: the mainline spans the whole route, a spur only the stretch
 * between its two junctions. */
let routes = [];
let main = null;
let bounds = null;
let net = NETWORKS.NJTP;

let travelled = 0; // metres along the MAINLINE from its SW end; the clock for
                   // every alignment and every sign, whichever way we drive
let total = 0;
let northbound = true;
let playing = false;
let intro = false; // a view change is flying the camera; nothing else may steer
let following = false; // the map opens on the overview, so nothing is chasing yet
let headingUp = false; // set by the view; the state view opens north up
let scrubbing = false; // a finger is on the scrubber; leave its value alone
let selfDriving = false; // true only inside our own camera writes
let externalZoom = false; // the map is running a zoom the user asked for
let bearing = null; // smoothed camera bearing, null until first frame
let zoomTarget = null; // non-null while the camera is easing to a zoom
let cruiseZoom = VIEWS.top.zoom;
let lastFrame = null;
let viewMode = 'state'; // which of VIEWS the camera is set up for
let viewToken = 0; // bumped whenever a view change is started or abandoned
let speedNotch = 5; // 1 (slowest) to 5 (fastest)
let speedAuto = true; // the notch follows the zoom until you set one by hand
let signs = [];
let cardKey = null; // which interchange the pinned card is naming
let cardSwap = 0; // generation, so a fade cannot be finished by a stale timer
let cardBox = null; // where the card landed, so signs and markers can keep clear
let allExits = null; // raw exit points, fetched once and re-snapped per network
let terrainOn = false;
let muniLabelData = null; // the label points as fetched; `near` is added per network
let muniNear = []; // towns close to the current road, for the edge indicators
let muniPointsByName = new Map(); // every label point per displayed name
let edgePool = []; // reused DOM elements for those indicators
let signBoxes = []; // where the exit signs landed this frame, so markers can dodge them

// --------------------------------------------------------------------------
// Route geometry
// --------------------------------------------------------------------------

/* Segment of `r` containing distance d, plus how far into it we are. */
function locate(r, d) {
  const last = r.coords.length - 1;
  if (d <= 0) return { lo: 0, hi: Math.min(1, last), t: 0 };
  if (d >= r.total) return { lo: Math.max(0, last - 1), hi: last, t: 1 };

  let lo = 0;
  let hi = last;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (r.dists[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = r.dists[hi] - r.dists[lo];
  return { lo, hi, t: span > 0 ? (d - r.dists[lo]) / span : 0 };
}

function pointAt(r, d) {
  const { lo, hi, t } = locate(r, d);
  return [
    r.coords[lo][0] + (r.coords[hi][0] - r.coords[lo][0]) * t,
    r.coords[lo][1] + (r.coords[hi][1] - r.coords[lo][1]) * t,
  ];
}

/* MapLibre's line-progress runs on Mercator length, which stretches with
 * latitude. Over 122 miles of northing that is a ~0.5 mile disagreement with
 * geodesic distance, enough for the head marker to visibly lead or trail the
 * edge of the reveal, so map through the Mercator arc length instead. */
function progressAt(r, d) {
  const { lo, hi, t } = locate(r, d);
  return (r.mercCum[lo] + (r.mercCum[hi] - r.mercCum[lo]) * t) / r.mercTotal;
}

function bearingBetween(a, b) {
  const p1 = a[1] * RAD;
  const p2 = b[1] * RAD;
  const dl = (b[0] - a[0]) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * DEG + 360) % 360;
}

/* Which way the camera faces at distance d. The line is always measured in the
 * route's own order, so driving the other way is the same heading turned
 * around - simpler, and it avoids the lookahead running off either end. */
function bearingAt(r, d) {
  const a = pointAt(r, Math.max(0, Math.min(d, r.total - LOOKAHEAD_M)));
  const b = pointAt(r, Math.max(LOOKAHEAD_M, Math.min(d + LOOKAHEAD_M, r.total)));
  const along = bearingBetween(a, b);
  return northbound ? along : (along + 180) % 360;
}

/* Nearest point on an alignment to a lon/lat, as {dist, offset} in metres.
 * Runs once per exit at load, so a linear scan is fine. */
function snapToRoute(r, lon, lat) {
  const k = Math.cos(lat * RAD);
  let best = { dist: 0, offset: Infinity };
  for (let i = 0; i < r.coords.length - 1; i++) {
    const [x1, y1] = r.coords[i];
    const [x2, y2] = r.coords[i + 1];
    const ax = (x2 - x1) * k;
    const ay = y2 - y1;
    const px = (lon - x1) * k;
    const py = lat - y1;
    const l2 = ax * ax + ay * ay;
    const t = l2 === 0 ? 0 : clamp((px * ax + py * ay) / l2, 0, 1);
    const offset = Math.hypot(px - t * ax, py - t * ay) * 111320;
    if (offset < best.offset) {
      best = { offset, dist: r.dists[i] + t * (r.dists[i + 1] - r.dists[i]) };
    }
  }
  return best;
}

const dirSign = () => (northbound ? 1 : -1);
const runStart = () => (northbound ? 0 : total);
const runEnd = () => (northbound ? total : 0);
/* How far into the run we are - what the readout and the scrubber both show,
 * so they read 0 -> full length whichever way round we are driving. */
const covered = () => (northbound ? travelled : total - travelled);
const atRunEnd = () => (northbound ? travelled >= total : travelled <= 0);

const metresPerSecond = () => SPEEDS[clamp(speedNotch, 1, 5) - 1];
const runSeconds = () => (total ? total / metresPerSecond() : 0);

/* The notch a zoom level asks for. Deliberately a lookup rather than a formula:
 * the breaks are chosen against what the three views actually land on, and a
 * curve fitted through them would only obscure that. */
function autoNotch(z) {
  for (const [from, notch] of SPEED_BY_ZOOM) if (z >= from) return notch;
  return 5;
}

/* Ease toward the target heading the short way round the compass. */
function smoothBearing(target, dt) {
  if (bearing === null || dt === null) {
    bearing = target;
    return bearing;
  }
  const delta = ((target - bearing + 540) % 360) - 180;
  bearing = (bearing + delta * (1 - Math.exp(-dt / BEARING_TAU)) + 360) % 360;
  return bearing;
}

const easeToward = (from, to, dt, tau) =>
  dt === null ? to : from + (to - from) * (1 - Math.exp(-dt / tau));

/* Is this alignment currently being revealed? The mainline always is. */
const isRunning = (r) => travelled >= r.from && travelled <= r.to;

/* Where the head of `r` sits, in its own metres.
 *
 * A spur that is shorter than the mainline stretch it bridges would arrive
 * early and sit waiting at the junction, so it is driven by the fraction of its
 * window that has elapsed rather than by raw distance. Both heads therefore
 * leave the split together and meet again at the rejoin, which is the only way
 * the two reveals read as one road. */
function localDist(r) {
  const span = r.to - r.from;
  if (span <= 0) return 0;
  const u = clamp((travelled - r.from) / span, 0, 1);
  return u * r.total;
}

/* The inverse: a distance measured along `r` expressed on the mainline clock,
 * so a sign on the Western Spur lights at the moment you actually pass it. */
function clockOf(r, d) {
  if (r.total <= 0) return r.from;
  return r.from + (d / r.total) * (r.to - r.from);
}

// --------------------------------------------------------------------------
// Signs
//
// The rule that makes scrubbing work: a sign's appearance is a pure function of
// route position. Nothing here may key off a playback event, or dragging the
// scrubber backwards would leave signs lit that you have not reached.
// --------------------------------------------------------------------------

/* One at a time. Now that a sign is a bare exit number, three of them stacked
 * up the screen were three numbers with nothing to tell you which was which -
 * and the pinned card already names the one you are coming to. The nearest
 * interchange to the head wins; the rest are dropped rather than queued, which
 * is the only correct answer when the thing they are tied to is the road. */
const maxSigns = () => 1;

/* Opacity purely from how far past the head the sign is: negative is ahead. */
function signOpacity(delta) {
  if (delta < -SIGN_IN_M || delta > SIGN_OUT_M) return 0;
  if (delta < -SIGN_FULL_AHEAD_M) {
    return (delta + SIGN_IN_M) / (SIGN_IN_M - SIGN_FULL_AHEAD_M);
  }
  if (delta <= SIGN_FULL_BEHIND_M) return 1;
  return 1 - (delta - SIGN_FULL_BEHIND_M) / (SIGN_OUT_M - SIGN_FULL_BEHIND_M);
}

/* Split one exit record into what actually goes on the sign.
 *
 * Three things in the data would otherwise read badly on a green sign:
 *   - the last four miles are signed as I-95, and the source spells that out in
 *     the destination text ("I-95 exit 68 -- US 46, ..."), which repeats the
 *     number already in the badge;
 *   - toll barriers are keyed by name, so their "ref" is a word like
 *     "Toms River" and will not fit a slot sized for exit numbers;
 *   - and those same rows then say "Toms River Tolls" next to a TOLL flash.
 */
function signText(ex) {
  let name = ex.name || '';
  let tag = ex.kind === 'toll' ? 'Toll' : '';

  const i95 = name.match(/^I-95 exit \S+\s*--\s*(.*)$/);
  if (i95) {
    name = i95[1];
    tag = 'I-95';
  }
  if (ex.kind === 'toll') name = name.replace(/\s+Tolls?$/i, '');

  // A badge holds an exit number, so test for one rather than for length:
  // "70A-B" is five characters and belongs in the badge, while "Essex" is five
  // characters and is a toll barrier whose name is already the destination.
  const ref = ex.ref && /^\d/.test(ex.ref) ? ex.ref : '';
  return { ref, name, tag };
}

function buildSigns() {
  const host = $('signs');
  for (const s of signs) s.el.remove();
  signs = [];
  if (!allExits || !main) return;

  let dropped = 0;
  for (const ex of allExits) {
    if (ex.network !== net.key) continue;
    if (ex.lat == null || ex.lon == null) continue;
    // The Newark Bay Extension is a road this map does not draw.
    if (ex.alignment === 'extension') continue;

    // Snap to whichever alignment is genuinely nearest rather than trusting the
    // label: it costs one extra scan and it is self-correcting.
    let bestR = null;
    let best = { offset: Infinity, dist: 0 };
    for (const r of routes) {
      const hit = snapToRoute(r, ex.lon, ex.lat);
      if (hit.offset < best.offset) {
        best = hit;
        bestR = r;
      }
    }
    if (!bestR || best.offset > SIGN_SNAP_TOLERANCE_M) {
      dropped++;
      continue;
    }

    const { ref, name, tag } = signText(ex);

    // What the scrubber and the map both call this one in shorthand: the exit
    // number, or for a toll barrier - which has no number - its name cut short.
    const short = ref || String(ex.ref || name).split(/[,/]/)[0].trim().slice(0, 14);

    /* Out on the map a sign carries its number and nothing else.
     *
     * The destinations moved to the pinned card, and having them in both places
     * was the problem: two green rectangles side by side saying the same words,
     * one of them drifting about the screen. What is left is a tab over the
     * interchange - which is all the map needs it for, because the question a
     * floating sign answers is "which one is that", not "where does it go". */
    const el = document.createElement('div');
    el.className = 'sign';
    el.dataset.kind = ex.kind === 'toll' ? 'toll' : 'exit';
    el.style.display = 'none';
    const badge = document.createElement('div');
    badge.className = 'sign-badge';
    badge.textContent = short;
    el.appendChild(badge);
    host.appendChild(el);

    signs.push({
      ref: ex.ref,
      // Kept for the pinned card, which draws the same three fields as the
      // gantry sign but in a fixed frame.
      dest: name,
      tag,
      short,
      kind: ex.kind,
      lngLat: [ex.lon, ex.lat],
      clock: clockOf(bestR, best.dist),
      offset: best.offset,
      el,
      w: 0,
      h: 0,
      shown: false,
      litUntil: 0,
    });
  }
  signs.sort((a, b) => a.clock - b.clock);
  if (dropped) {
    console.warn(`${dropped} exit(s) further than ${SIGN_SNAP_TOLERANCE_M} m off the line; not shown`);
  }
}

function clearDwell() {
  for (const s of signs) s.litUntil = 0;
}

function renderSigns(now) {
  signBoxes = [];
  if (!signs.length) return;
  const live = [];
  for (const s of signs) {
    const delta = (travelled - s.clock) * dirSign();
    let op = signOpacity(delta);

    // The dwell floor is the one wall-clock element, and it only applies while
    // the road is actually moving. Scrubbing stays purely positional so that
    // dragging backwards cannot leave a stale sign lit.
    if (playing && !scrubbing) {
      if (op >= 1) s.litUntil = now + SIGN_DWELL_MS;
      else if (s.litUntil) {
        if (now < s.litUntil) op = 1;
        else {
          const fade = 1 - (now - s.litUntil) / SIGN_DWELL_FADE_MS;
          if (fade > 0) op = Math.max(op, fade);
          else s.litUntil = 0;
        }
      }
    }

    if (op <= 0.001) {
      if (s.shown) {
        s.el.style.display = 'none';
        s.shown = false;
      }
      continue;
    }
    live.push({ s, op, rank: Math.abs(delta) });
  }

  // Crowding: nearest to the head wins. Dropping the rest outright is correct -
  // queueing them would desynchronise the sign from the road it names.
  live.sort((a, b) => a.rank - b.rank);
  const keep = live.slice(0, maxSigns());
  for (const extra of live.slice(keep.length)) {
    if (extra.s.shown) {
      extra.s.el.style.display = 'none';
      extra.s.shown = false;
    }
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Clear of the road switch at the top. Everything else fixed on the screen -
  // the title, the minimap, the pinned card, the map's controls - is dodged
  // sideways further down rather than reserved against here: reserving four
  // rectangles' worth of vertical space would leave the signs a letterbox.
  const top = 58;
  const bottom = (h) => Math.max(top, vh - h - 104);

  const placed = [];
  for (const { s, op } of keep) {
    if (!s.shown) {
      s.el.style.display = '';
      s.shown = true;
      s.w = 0;
    }
    // One layout read per appearance rather than per frame.
    if (!s.w) {
      s.w = s.el.offsetWidth;
      s.h = s.el.offsetHeight;
    }
    const pt = map.project(s.lngLat);
    // Sit the sign above the interchange, the way a gantry stands over the road.
    // y is left unclamped for now - the declutter below needs the true order,
    // and clamping first collapses everything that projects off-screen onto the
    // same line, which is precisely when decluttering matters most.
    placed.push({
      s,
      op,
      x: clamp(pt.x - s.w / 2, 8, Math.max(8, vw - s.w - 62)),
      y: pt.y - s.h - 18,
    });
  }

  /* Declutter. At the north end of the Turnpike four interchanges sit inside a
   * mile, and at the south end of the Parkway exits 4 to 9 are closer still, so
   * their anchors project to nearly the same point and the signs draw straight
   * through each other. Nearest the top keeps its place and the rest are pushed
   * down, which preserves the ordering the perspective already implies: the
   * further away a sign is, the higher up the screen it sits. */
  const GAP = 6;
  placed.sort((a, b) => a.y - b.y);
  for (let i = 1; i < placed.length; i++) {
    const a = placed[i];
    for (let j = 0; j < i; j++) {
      const b = placed[j];
      const overlapsX = a.x < b.x + b.s.w && b.x < a.x + a.s.w;
      const overlapsY = a.y < b.y + b.s.h + GAP && b.y < a.y + a.s.h + GAP;
      if (overlapsX && overlapsY) a.y = b.y + b.s.h + GAP;
    }
  }
  // Pushing apart only works while there is room to push into. Against either
  // limit the clamp below would collapse the whole group back onto one line, so
  // the stack moves as a block first: down when the signs are ahead of you and
  // project above the viewport, up when you have passed them and they project
  // off the bottom. Both cases happen on every run.
  if (placed.length) {
    const under = top - placed[0].y;
    if (under > 0) for (const q of placed) q.y += under;
    const last = placed[placed.length - 1];
    const over = last.y - bottom(last.s.h);
    if (over > 0) for (const q of placed) q.y -= over;
  }
  for (const q of placed) q.y = clamp(q.y, top, bottom(q.s.h));

  // #signs paints above everything the map draws and above the page's own
  // furniture, so a sign that drifts over the title, the minimap, the pinned
  // card or the map controls hides them completely.
  avoidChrome(placed, vw, top, bottom);
  for (const q of placed) q.y = clamp(q.y, top, bottom(q.s.h));

  for (const { s, op, x, y } of placed) {
    const scale = 0.93 + 0.07 * op;
    s.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) scale(${scale.toFixed(3)})`;
    s.el.style.opacity = op.toFixed(3);
  }
  // Published so the edge markers can keep out of the signs' way. Signs win:
  // they name the road you are on, the markers only point at scenery.
  signBoxes = placed.map(({ s, x, y }) => ({ x, y, w: s.w, h: s.h }));
}

/* The fixed furniture a floating label has to keep out of: the title, the
 * minimap under it, and the map's own control column. Cached, because this
 * only changes when the viewport or the view does, and a getBoundingClientRect
 * per candidate per frame is a forced layout sixty times a second.
 *
 * The next-exit card is deliberately NOT in here. It is measured when its
 * content changes, in renderNextExit, because it is the one piece that changes
 * size on its own - and reading it here would read zero mid-fade. */
let chromeBoxes = null; // null = not measured yet
function chrome() {
  if (chromeBoxes) return chromeBoxes;
  const out = [];
  const add = (el, p = 8) => {
    if (!el || !el.offsetParent) return; // display:none, or not in the document
    const r = el.getBoundingClientRect();
    if (r.width) out.push({ x: r.x - p, y: r.y - p, w: r.width + 2 * p, h: r.height + 2 * p });
  };
  add($('title-card'));
  add($('minimap'));
  add(document.querySelector('.maplibregl-ctrl-bottom-left'));
  // The bottom stack and the road switch are fixed too, and once the view
  // buttons grew labels the stack reaches high enough up the right-hand side
  // for a sign or an arrow to land on it. Cheaper to list them than to keep a
  // set of hand-tuned margins in step with the CSS.
  add($('views'), 6);
  add($('transport'), 6);
  add($('speedo'), 4);
  add($('road-switch'), 6);
  chromeBoxes = out;
  return out;
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* Move a placed sign off the furniture, and off the other signs.
 *
 * Written as a search over candidate positions rather than as a nudge, because
 * the nudge does not converge. Step a sign off the minimap and it lands on the
 * card; step it off the card and it lands back on the minimap. On a 390 px
 * phone the gap between those two is 101 px and a sign is 153 px, so there is
 * no horizontal answer at that height at all - and no amount of iterating on
 * one axis discovers that.
 *
 * The candidates are the natural position and every edge of every obstacle,
 * crossed. That is a few hundred rectangles to test, which is nothing, and it
 * either finds a genuinely clear spot or leaves the sign where it was. Sideways
 * is cheap in the cost function and downwards is not: the vertical position is
 * what ties a sign to its interchange, the horizontal position is only ever an
 * approximation of it. */
function avoidChrome(placed, vw, top, bottomOf) {
  const boxes = chrome();
  const all = cardBox
    ? [...boxes, { x: cardBox.x - 8, y: cardBox.y - 8, w: cardBox.w + 16, h: cardBox.h + 16 }]
    : boxes;
  if (!all.length) return;
  // The other signs count as obstacles too, and are updated as we go: two signs
  // dodging the same card must not both dodge into the same hole.
  const others = placed.map((q) => ({ x: q.x, y: q.y, w: q.s.w, h: q.s.h }));

  placed.forEach((q, i) => {
    const w = q.s.w;
    const h = q.s.h;
    const obstacles = [...all, ...others.filter((_, j) => j !== i)];
    const fits = (x, y) => !obstacles.some((b) => overlaps({ x, y, w, h }, b));
    if (fits(q.x, q.y)) return;

    // 62 px of the right-hand edge is the scrubber's, the same reserve the
    // natural placement uses.
    const xLo = 8;
    const xHi = Math.max(8, vw - w - 62);
    const yHi = bottomOf(h);
    const xs = [q.x];
    const ys = [q.y];
    for (const b of obstacles) {
      for (const x of [b.x - w, b.x + b.w]) if (x >= xLo && x <= xHi) xs.push(x);
      for (const y of [b.y - h, b.y + b.h]) if (y >= top && y <= yHi) ys.push(y);
    }

    let best = null;
    for (const x of xs) {
      for (const y of ys) {
        if (!fits(x, y)) continue;
        const cost = Math.abs(x - q.x) + 2.2 * Math.abs(y - q.y);
        if (!best || cost < best.cost) best = { x, y, cost };
      }
    }
    if (!best) return; // nowhere clear; leave it where the road put it
    q.x = best.x;
    q.y = best.y;
    others[i] = { x: q.x, y: q.y, w, h };
  });
}

/* A town you are passing that has fallen off the screen gets a marker at the
 * edge pointing the way to it.
 *
 * The direction comes from the geographic bearing between the map centre and
 * the town, turned into screen space by subtracting the map's own bearing -
 * not from the projected pixel. A point behind a pitched camera projects to
 * nonsense, and can land back inside the viewport pointing the wrong way
 * entirely, so anything more than 100 degrees off the direction of travel is
 * treated as behind us regardless of where it says it projects to. */
function renderEdgeLabels() {
  const host = $('edge');
  if (!host) return;
  // An arrow pointing off-screen means "the town you are passing is that way",
  // which is only true while the camera is on the road. Take the camera off it
  // and the arrows are pointing from nowhere in particular. The place names
  // themselves are not gated - they are just labels and always apply.
  if (!following) {
    for (const el of edgePool) {
      if (el.style.display !== 'none') el.style.display = 'none';
    }
    return;
  }

  while (edgePool.length < MAX_EDGE) {
    const el = document.createElement('div');
    el.className = 'edge-label';
    el.innerHTML =
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0.6 11.2 11.4 6 8.6 0.8 11.4z"/></svg><span></span>';
    el.style.display = 'none';
    host.appendChild(el);
    edgePool.push(el);
  }

  const picks = !muniNear.length || !main
    ? []
    : muniNear
        .map((m) => ({ m, d: Math.abs(travelled - m.clock) }))
        .filter((c) => c.d < EDGE_WINDOW_M)
        .sort((a, b) => a.d - b.d)
        .slice(0, MAX_EDGE * 4);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = vw / 2;
  const cy = vh / 2;
  const centre = map.getCenter();
  const mapBearing = map.getBearing();
  // Four markers plus a sign do not fit across a phone, and a crowded edge is
  // worse than a bare one.
  const cap = vw < 560 || window.matchMedia('(pointer: coarse)').matches ? 2 : MAX_EDGE;
  const hits = overlaps;

  // The pinned card, the title and the minimap are furniture rather than signs,
  // but they occupy screen just the same and an arrow parked under one points
  // at nothing anyone can read.
  const boxes = [...signBoxes, ...chrome()];
  if (cardBox) boxes.push(cardBox);
  let slot = 0;

  for (const { m, d } of picks) {
    if (slot >= cap) break;
    const rel = (((bearingBetween([centre.lng, centre.lat], m.lngLat) - mapBearing) % 360) + 360) % 360;
    /* On screen at all means no arrow, whatever direction it lies in. An
     * earlier version let a "this is behind the camera" bearing test override
     * this, on the theory that a point behind a pitched camera projects to
     * nonsense - and it does, but the override fired for towns that were
     * plainly visible off to one side, giving them a label and an arrow at
     * once. A point that really is behind and really does misproject into the
     * viewport now simply gets no arrow, which costs nothing.
     *
     * This deliberately does not ask MapLibre what it drew. That is the exact
     * answer, but it is only available through queryRenderedFeatures, which is
     * too slow to run per frame and so has to be cached - and symbol placement
     * is asynchronous, so just after a camera move the cached answer is a frame
     * behind and a town gets its label and an arrow at the same time. While
     * following, the camera moves every frame and that window is always open.
     * Projecting the point is deterministic and needs no cache.
     *
     * The margin is small on purpose: a generous one was what gave a town at
     * the edge both a label and an arrow, because a label draws offset from the
     * anchor this is testing. */
    /* The margin is negative - it counts anchors a little OUTSIDE the viewport
     * as on screen. MapLibre draws a label whenever its collision box touches
     * the viewport, so a town anchored just past the edge still has its name
     * visible, and giving it an arrow as well is the duplicate this is here to
     * avoid. Half of a wide label is about 55 px. */
    const pts = muniPointsByName.get(m.name) || [m.lngLat];
    const onScreen = pts.some((c) => {
      const pt = map.project(c);
      return pt.x > -EDGE_LABEL_REACH && pt.x < vw + EDGE_LABEL_REACH
        && pt.y > -EDGE_LABEL_REACH && pt.y < vh + EDGE_LABEL_REACH;
    });
    if (onScreen) continue;

    const el = edgePool[slot];
    if (el.style.display === 'none') el.style.display = '';
    const span = el.querySelector('span');
    if (span.textContent !== m.name) span.textContent = m.name;
    // Measuring forces layout, so only remeasure when the text or the viewport
    // actually changed rather than once per candidate per frame.
    if (el._name !== m.name || el._vw !== vw) {
      el._name = m.name;
      el._vw = vw;
      el._w = el.offsetWidth;
      el._h = el.offsetHeight;
    }

    const a = rel * RAD;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const halfW = Math.max(40, vw / 2 - 76);
    const halfH = Math.max(40, vh / 2 - 92);
    const t = Math.min(
      Math.abs(dx) < 1e-6 ? Infinity : halfW / Math.abs(dx),
      Math.abs(dy) < 1e-6 ? Infinity : halfH / Math.abs(dy),
    );
    const box = {
      // The margins are the scrubber down the right and the view + transport
      // stack across the bottom. Missing them is not fatal - the chrome test
      // below would drop the marker rather than draw it over a control - but a
      // marker that fits is better than one that is skipped.
      x: clamp(cx + dx * t - el._w / 2, 6, Math.max(6, vw - el._w - 58)),
      y: clamp(cy + dy * t - el._h / 2, 62, Math.max(62, vh - el._h - 132)),
      w: el._w,
      h: el._h,
    };
    // Anything already placed wins the space. Skipping is the right failure -
    // nudging a marker away from its edge would point it somewhere it is not.
    if (boxes.some((b) => hits(box, b))) continue;

    el.style.transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0)`;
    el.style.opacity = clamp(1 - d / EDGE_WINDOW_M, 0.25, 1).toFixed(2);
    el.querySelector('svg').style.transform = `rotate(${rel.toFixed(1)}deg)`;
    boxes.push(box);
    slot++;
  }

  for (let i = slot; i < edgePool.length; i++) {
    if (edgePool[i].style.display !== 'none') edgePool[i].style.display = 'none';
  }
}

// --------------------------------------------------------------------------
// Camera
// --------------------------------------------------------------------------

/* Frame every alignment that is running: both of them through a split, just the
 * mainline everywhere else. */
/* How far up the road to put the camera centre so the head lands `low` of the
 * way down the screen.
 *
 * Straight perspective geometry, solved against the live camera rather than
 * against the view's nominal numbers, so it keeps holding if you tilt or zoom
 * by hand mid-drive. Screen y is linear in the tangent of the angle off the
 * optical axis, not in the angle itself, which is the one part of this that is
 * easy to get wrong. */
function aheadMetres(low, zoom = map.getZoom(), pitchDeg = map.getPitch()) {
  if (low == null) return 0;
  const halfFov = 0.6435 / 2; // MapLibre's vertical field of view, in radians
  const pitch = pitchDeg * RAD; // angle of the centre ray off straight down
  const vh = map.getCanvas().clientHeight || window.innerHeight;
  const slant = ((vh / 2 / Math.tan(halfFov)) * MPP_Z0) / 2 ** zoom;
  const height = slant * Math.cos(pitch); // camera above the ground
  const toCentre = slant * Math.sin(pitch); // along the ground, nadir to centre
  const alpha = Math.atan((2 * low - 1) * Math.tan(halfFov));
  return toCentre - height * Math.tan(pitch - alpha);
}

function aimCamera(dt) {
  const v = VIEWS[viewMode];
  const running = routes.filter(isRunning);
  const cam = {};
  cam.bearing = smoothBearing(headingUp ? bearingAt(main, localDist(main)) : 0, dt);

  // Framing both heads is only possible from far enough back to hold them both.
  // In the driving view the two alignments are miles apart on a screen a
  // kilometre wide, and the fit would haul the camera off the road to try; down
  // there the mainline is the road.
  if (running.length > 1 && v.low == null) {
    const box = new maplibregl.LngLatBounds(running[0].tip, running[0].tip);
    for (const r of running) box.extend(r.tip);
    // maxZoom keeps the fit from diving in when the two heads are nearly on top
    // of each other at the split and the rejoin, and makes it settle back to
    // the zoom we were driving at once they converge.
    const fit = map.cameraForBounds(box, {
      padding: SPLIT_PADDING,
      bearing: cam.bearing,
      maxZoom: cruiseZoom,
    });
    if (fit) {
      cam.center = fit.center;
      cam.zoom = easeToward(map.getZoom(), fit.zoom, dt, ZOOM_TAU);
      applyCamera(cam);
      return;
    }
  }

  // Sit the head low on the screen by aiming up the road rather than at it.
  const ahead = aheadMetres(v.low);
  cam.center = ahead ? pointAt(main, localDist(main) + dirSign() * ahead) : main.tip;
  if (zoomTarget !== null) {
    const next = easeToward(map.getZoom(), zoomTarget, dt, ZOOM_TAU);
    if (Math.abs(zoomTarget - next) < 0.01) {
      cam.zoom = zoomTarget;
      zoomTarget = null;
    } else {
      cam.zoom = next;
    }
  } else if (running.length === 1) {
    cruiseZoom = map.getZoom();
  }
  applyCamera(cam);
}

/* Our own camera writes, flagged so the zoom listeners below can tell them
 * apart from the user's. jumpTo fires its events synchronously, so the flag is
 * only ever set for the duration of the call. */
function applyCamera(cam) {
  selfDriving = true;
  map.jumpTo(cam);
  selfDriving = false;
}

// --------------------------------------------------------------------------
// Render loop
// --------------------------------------------------------------------------

function render(dt = null, now = performance.now()) {
  if (!main) return;
  let split = false;

  for (const r of routes) {
    const d = localDist(r);
    const f = progressAt(r, d);
    map.setPaintProperty(`${r.id}-band`, 'line-gradient', revealTo(f, net.color));
    map.setPaintProperty(`${r.id}-core`, 'line-gradient', revealTo(f, net.gold));

    r.tip = pointAt(r, d);
    r.head.setLngLat(r.tip);
    // Which way the arrow points. bearingAt already turns itself around when
    // we are running southbound, so this is the direction of travel rather
    // than the direction the line was drawn in.
    r.head.setRotation(bearingAt(r, d));
    // A spur head parked at its junction would just be a second dot sitting on
    // the mainline, so only show a head while its alignment is running.
    const show = r.isMain || isRunning(r);
    r.head.getElement().style.display = show ? '' : 'none';
    if (!r.isMain && isRunning(r)) split = true;
  }

  // Every camera change while following goes through one jumpTo inside
  // aimCamera. An easeTo anywhere here would be cancelled by the next frame -
  // which is exactly why we stand off while the map is running one of its own:
  // that is what lets the zoom buttons and double-tap work mid-drive.
  if (following && !intro && !externalZoom) aimCamera(dt);

  renderSigns(now);
  renderEdgeLabels();
  renderNextExit();
  drawMinimap();

  // The middle of a phone's bottom row is about 110 px wide once the map
  // controls and the pills have taken their share, so the long form does not
  // go there.
  $('note').textContent = split
    ? (window.innerWidth < 560 ? 'Both spurs' : 'Eastern & Western spurs')
    : '';
  if (!scrubbing) setScrubUI(total ? travelled / total : 0);
}

function tick(ts) {
  if (!playing) return;
  if (lastFrame === null) lastFrame = ts;
  const dt = Math.min((ts - lastFrame) / 1000, 0.1); // clamp after tab switches
  lastFrame = ts;

  travelled += dirSign() * (total / runSeconds()) * dt;
  if (atRunEnd()) {
    travelled = runEnd();
    setPlaying(false);
    render(dt, ts);
    return;
  }
  render(dt, ts);
  requestAnimationFrame(tick);
}

/* The camera that frames every vertex of the route at a given bearing.
 *
 * fitBounds cannot do this job. It fits the bounding *box*, and rotating a box
 * only ever makes its axis-aligned extent larger - fit a 130 x 130 km box at 45
 * degrees and you have asked for 184 x 184 km. So asking fitBounds for a
 * bearing makes the frame worse, never better. What fits a long diagonal road
 * into a portrait screen is fitting the road rather than its box: the Turnpike
 * is 184 km corner to corner but only about 25 km wide across its own axis.
 *
 * Returns null if the route has no geometry yet. */
function frameRoute(bearingDeg, pad) {
  if (!routes.length) return null;
  /* Screen axes against world (Mercator) axes at bearing b. Mercator x runs
   * east and y runs SOUTH, which is the same way screen y runs, so at bearing 0
   * the two frames already agree and the rotation below is the whole story:
   *
   *   u =  x cos b + y sin b        (screen right)
   *   v = -x sin b + y cos b        (screen down)
   *
   * The inverse - used to turn the framed centre back into a coordinate - is
   * x = u cos b - v sin b, y = u sin b + v cos b. Getting these two the wrong
   * way round produces a frame computed for bearing -b and applied at +b, which
   * looks almost right at small angles and throws half the Parkway off the
   * screen at large ones. */
  const b = bearingDeg * RAD;
  const cos = Math.cos(b);
  const sin = Math.sin(b);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const r of routes) {
    for (const m of r.merc) {
      const u = m[0] * cos + m[1] * sin;
      const v = -m[0] * sin + m[1] * cos;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  const canvas = map.getCanvas();
  const w = Math.max(32, canvas.clientWidth - pad.left - pad.right);
  const h = Math.max(32, canvas.clientHeight - pad.top - pad.bottom);
  // Mercator units run 0..1 across the world, and the world is 512 * 2^zoom px.
  const worldPx = Math.min(w / Math.max(maxU - minU, 1e-12), h / Math.max(maxV - minV, 1e-12));
  // Asymmetric padding means the framed box is not centred in the viewport: the
  // camera sits off it by half the difference between each pair of pads.
  const cu = (minU + maxU) / 2 - (pad.left - pad.right) / 2 / worldPx;
  const cv = (minV + maxV) / 2 - (pad.top - pad.bottom) / 2 / worldPx;
  const centre = new maplibregl.MercatorCoordinate(cu * cos - cv * sin, cu * sin + cv * cos, 0);
  return { center: centre.toLngLat(), zoom: Math.log2(worldPx / 512), bearing: bearingDeg };
}

/* The whole state, north up and flat - what the map opens on, and what the
 * first of the three view buttons goes back to. It used to be tilted and turned
 * to look up the corridor, which is a handsome frame and a poor map: with two
 * roads running the length of the state, an oblique makes the far half
 * unreadable and hides which end you are at.
 *
 * North up is what this view is for, and it is what it uses whenever it can.
 * But the imagery archive bottoms out at z8, and there is no camera that both
 * faces north and holds the whole road at that zoom in every case: the Parkway
 * is 245 km tall and a desktop screen has room for about 135 km of northing,
 * while a portrait phone cannot hold the Turnpike's diagonal at all.
 *
 * So: north up if it fits. If it does not, turn by the smallest angle that
 * does - which for the Parkway on a wide screen means laying it across the
 * screen rather than up it. If nothing fits, stay north up and let it clip,
 * because rotating to an odd angle for a few per cent more road is a worse
 * trade than an honest crop. */
function showOverview(duration = 0) {
  const pad = OVERVIEW_PADDING;
  const north = frameRoute(0, pad);
  if (!north) {
    if (bounds) map.fitBounds(bounds, { padding: pad, bearing: 0, pitch: 0, duration });
    return;
  }

  let best = north;
  if (north.zoom < MIN_ZOOM) {
    // Ordered by how far from north it is, so the first fit found is the least
    // disorienting one rather than merely the widest.
    for (let d = 5; d <= 180 && best === north; d += 5) {
      for (const cand of [frameRoute(d, pad), frameRoute(360 - d, pad)]) {
        if (cand.zoom >= MIN_ZOOM && (best === north || cand.zoom > best.zoom)) best = cand;
      }
    }
  }
  map.easeTo({ ...best, zoom: Math.max(best.zoom, MIN_ZOOM), pitch: 0, duration, essential: true });
}

/* Move to one of the three views.
 *
 * This is the only thing in the file that flies the camera. Play used to do it
 * too - the first press dropped you out of the overview and onto the road
 * whether you wanted that or not, which made "watch the whole state fill in"
 * impossible to ask for. Now the view is a decision you make with the
 * three-way control and playback leaves it alone. */
function setView(mode, duration = 1100) {
  const v = VIEWS[mode];
  if (!v) return;
  viewMode = mode;
  headingUp = v.headingUp;
  /* Relief belongs to the driving view and to nothing else, so the view owns
   * it outright rather than leaving a switch to get out of step with what is
   * on screen. Looking straight down at a 1930s photograph, a displaced pixel
   * is just a displaced pixel - there is no shading to read it by and no
   * horizon to see it against, so all the terrain mesh buys in the flat views
   * is a wobble in the imagery and a stream of elevation tiles. */
  terrainOn = !!TERRAIN && mode === 'drive';
  applyTerrain();
  // The haze is only ever visible when there is a horizon on screen, and it
  // costs a draw call when there is not.
  map.setSky(v.pitch > 25 ? SKY : undefined);
  syncViews();
  syncMinimap();
  syncControls();
  if (!main) return;

  if (!v.follow) {
    intro = false;
    setFollowing(false);
    showOverview(duration);
    armAutoSpeed();
    return;
  }

  // Follow stays off for the descent: a per-frame jumpTo would cancel the ease
  // the moment it began.
  intro = true;
  setFollowing(false);
  render();
  const d = localDist(main);
  const token = ++viewToken;
  map.easeTo({
    // Framed for where the camera is going, not for where it is.
    center: pointAt(main, d + dirSign() * aheadMetres(v.low, v.zoom, v.pitch)),
    zoom: v.zoom,
    pitch: v.pitch,
    bearing: v.headingUp ? bearingAt(main, d) : 0,
    duration,
    essential: true,
  });

  /* Completion is timed and then confirmed against the camera, not keyed off a
   * single 'moveend'.
   *
   * This used to be map.once('moveend'), and it worked until terrain came on
   * during the descent. Enabling terrain makes the map fire move events of its
   * own as elevation tiles arrive and it re-derives the zoom for the ground
   * height under the centre - and one of those stole the once(). The handler
   * then ran a second into a two-second flight, turned following on, and the
   * next frame's jumpTo cancelled the ease outright: camera stranded at z16.4
   * and 71.5 degrees, speed still set for the view we had left. */
  let waits = 0;
  const settle = () => {
    if (viewToken !== token || viewMode !== mode) return; // superseded
    // MapLibre 6's Map composes a Camera rather than extending one, so
    // isEasing() is not on the map - isMoving() is. Bounded, because with
    // terrain on the map can keep reporting movement while elevation tiles
    // land, and a view change that never completes is worse than one that
    // completes a beat early.
    if (map.isMoving() && waits++ < 12) {
      setTimeout(settle, 120);
      return;
    }
    intro = false;
    bearing = null;
    lastFrame = null;
    zoomTarget = null;
    cruiseZoom = v.zoom;
    setFollowing(true);
    armAutoSpeed();
    applyTerrain();
    if (playing) requestAnimationFrame(tick);
    else render();
  };
  setTimeout(settle, duration + 60);
}

function setPlaying(on) {
  playing = on;
  $('play').innerHTML = on ? ICON.pause : ICON.play;
  $('play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  document.body.classList.toggle('driving', on);
  lastFrame = null;
  if (!on) {
    clearDwell();
    return;
  }
  if (atRunEnd()) travelled = runStart();
  if (VIEWS[viewMode].follow && !intro) setFollowing(true);
  requestAnimationFrame(tick);
}

function setFollowing(on) {
  following = on;
  if (!on) zoomTarget = null; // do not resume a stale zoom next time round
  // The arrows are gated on following, so the moment it changes they have to be
  // re-evaluated. Nothing else would: turning follow off from the control moves
  // no camera and advances no frame, and the arrows would sit there pointing at
  // towns until something unrelated happened to trigger a redraw.
  renderEdgeLabels();
  syncControls();
}

// --------------------------------------------------------------------------
// Map controls
// --------------------------------------------------------------------------

/* A MapLibre control that is just a column of buttons, so our controls sit in
 * the same rhythm as the native compass rather than floating beside it. */
class ButtonGroup {
  constructor(items) {
    this.items = items;
  }
  onAdd() {
    this._el = document.createElement('div');
    this._el.className = 'maplibregl-ctrl maplibregl-ctrl-group ctl-group';
    for (const item of this.items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.addEventListener('click', item.onClick);
      item.el = b;
      this._el.appendChild(b);
    }
    this.sync();
    return this._el;
  }
  onRemove() {
    this._el.remove();
  }
  sync() {
    for (const item of this.items) {
      if (!item.el) continue;
      const s = item.state();
      item.el.innerHTML = s.icon;
      item.el.title = s.title;
      item.el.setAttribute('aria-label', s.title);
      item.el.classList.toggle('on', !!s.on);
      item.el.disabled = !!s.disabled;
      if (s.on !== undefined) item.el.setAttribute('aria-pressed', String(!!s.on));
    }
  }
}

/* What is left for the map controls once the three-way view switch owns pitch,
 * zoom, following and relief, the transport pill owns which way we are running,
 * and the road switch owns which road: which way is up. That is the one thing
 * none of them decides for you, because it is worth overriding inside any of
 * them - a tilted view that does not turn with the road, or a flat one that
 * does, are both things you might want to look at. */
const ctlGroup = new ButtonGroup([
  {
    onClick: () => toggleHeadingUp(),
    state: () => ({
      icon: ICON.heading,
      on: headingUp,
      title: headingUp
        ? 'Heading up — the map turns with the road (tap for north up)'
        : 'North up (tap to turn with the road)',
    }),
  },
]);

const syncControls = () => {
  ctlGroup.sync();
  syncDirection();
};

// All of them top-left. The right-hand edge is the scrubber's, top to bottom.
/* All of them bottom-left, stacked in the order added. The top-left corner
 * belongs to the pinned next-exit card, the right edge to the scrubber, and
 * bottom-right to the transport and view pills - which leaves this corner, and
 * on a phone it is the one your thumb can actually reach anyway. */
// Added bottom-up: MapLibre's bottom corners stack in reverse, so the first
// control added sits lowest. Credits at the floor, controls above them.
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
// maxWidth rather than a CSS clamp: the control picks a round distance that
// fits the width it is given, so capping it here keeps the bar honest. Left at
// its default of 100 px the scale bar is the widest thing in this column, and
// the column's width is what the speedometer is offset past on a phone.
map.addControl(new maplibregl.ScaleControl({ unit: 'imperial', maxWidth: 76 }), 'bottom-left');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');
map.addControl(ctlGroup, 'bottom-left');

// --------------------------------------------------------------------------
// The three-way view switch, and the road switch
// --------------------------------------------------------------------------

/* `label` goes under the icon and `long` into the tooltip. They differ because
 * the button is 54 px wide and "Whole state" is not - and because "State" under
 * a fit-to-extent icon is unambiguous in a way it would not be on its own. */
const VIEW_BUTTONS = {
  state: { icon: ICON.whole, label: 'State', long: 'Whole state', hint: 'the whole road, north up' },
  top: { icon: ICON.follow, label: 'Follow', long: 'Follow', hint: 'straight down, close, keeping up with the head' },
  drive: { icon: ICON.drive, label: 'Drive', long: 'Drive', hint: 'the windscreen view, tilted and in 3D' },
};

function buildViewSwitch() {
  const host = $('views');
  for (const mode of VIEW_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.view = mode;
    b.innerHTML = `${VIEW_BUTTONS[mode].icon}<span class="lbl">${VIEW_BUTTONS[mode].label}</span>`;
    b.title = `${VIEW_BUTTONS[mode].long} — ${VIEW_BUTTONS[mode].hint}`;
    b.setAttribute('aria-label', b.title);
    // Tapping the view you are already in re-centres it, which is the way back
    // after you have dragged the map somewhere and stopped following.
    b.addEventListener('click', () => setView(mode));
    host.appendChild(b);
  }
}

function syncViews() {
  for (const b of $('views').children) {
    const on = b.dataset.view === viewMode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }
}

function buildRoadSwitch() {
  const host = $('road-switch');
  for (const key of NETWORK_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.net = key;
    b.setAttribute('role', 'tab');
    b.textContent = NETWORKS[key].short;
    b.title = NETWORKS[key].label;
    b.addEventListener('click', () => {
      if (net.key !== key) loadNetwork(key).catch(reportFailure);
    });
    host.appendChild(b);
  }
}

/* The sliding pill is positioned from the selected button's own box rather than
 * from a percentage: the two labels are different widths, and a switch whose
 * indicator does not fit what it is under reads as broken. */
function syncRoadSwitch() {
  const host = $('road-switch');
  const slider = $('road-slider');
  // Measured off bounding rects rather than offsetLeft: offsetLeft is quoted
  // against the offsetParent's padding edge in some engines and its border edge
  // in others, and the pill would sit a border-width out in one of them.
  const hr = host.getBoundingClientRect();
  const inset = parseFloat(getComputedStyle(host).borderLeftWidth) || 0;
  for (const b of host.querySelectorAll('button')) {
    const on = b.dataset.net === net.key;
    b.setAttribute('aria-selected', String(on));
    if (!on) continue;
    const br = b.getBoundingClientRect();
    slider.style.width = `${br.width}px`;
    slider.style.transform = `translateX(${(br.left - hr.left - inset).toFixed(2)}px)`;
  }
}

/* MapLibre opens a compact attribution expanded, which on a phone is two lines
 * of text straight across the speedometer. Collapse it to its (i) and let it be
 * opened deliberately - the credit is still one tap away, which is what compact
 * is for. */
map.on('load', () => {
  for (const el of document.querySelectorAll('.maplibregl-ctrl-attrib')) {
    el.classList.remove('maplibregl-compact-show');
  }
});

// Safari zooms the whole page on a pinch unless these are swallowed. MapLibre's
// own pinch-to-zoom is touch-based and keeps working.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

function toggleHeadingUp() {
  headingUp = !headingUp;
  syncControls();
  // While playing, the follow loop owns the bearing and will ease into the new
  // target on its own; an easeTo here would just be cancelled by the next
  // frame. Paused, nothing is driving the camera, so hand the turn to the map.
  if (!playing) {
    map.easeTo({
      bearing: headingUp && main ? bearingAt(main, localDist(main)) : 0,
      duration: 500,
    });
    bearing = null;
  }
}

// --------------------------------------------------------------------------
// Terrain (source constant is up with the other configuration)
// --------------------------------------------------------------------------

function setupTerrain() {
  if (!TERRAIN || map.getSource('dem')) return;
  const src = {
    type: 'raster-dem',
    // Not optional. MapLibre's raster-dem default is 'mapbox', and pmtiles.js
    // synthesises a TileJSON with no encoding field at all, so nothing else
    // supplies it - a pixel that should read 550 m reads 842,930 m instead.
    encoding: TERRAIN.encoding,
    tileSize: TERRAIN.tileSize,
    attribution: TERRAIN.attribution,
  };
  if (terrainLocal) {
    // The archive header carries its own zoom range, so leave maxzoom unset
    // and let the TileJSON supply it.
    src.url = `pmtiles://${TERRAIN.local}`;
  } else {
    src.tiles = [TERRAIN.remote];
    // Their hosted TileJSON omits maxzoom, so MapLibre would keep its default
    // of 22 and hammer the CDN for tiles that do not exist above 16.
    src.maxzoom = TERRAIN.remoteMaxzoom;
  }
  map.addSource('dem', src);
}

/* Is there a local extract? A HEAD costs nothing and decides between an
 * offline-capable archive and the CDN without either being hardcoded. */
async function probeTerrain() {
  try {
    const res = await fetch(TERRAIN.local, { method: 'HEAD' });
    terrainLocal = res.ok;
  } catch {
    terrainLocal = false;
  }
  console.info(
    terrainLocal
      ? 'terrain: local extract at /terrain.pmtiles'
      : 'terrain: no local extract, using the Mapterhorn CDN',
  );
}

/* Interpolate TERRAIN_EXAGGERATION, flat outside its ends. */
function exaggerationFor(z) {
  const pts = TERRAIN_EXAGGERATION;
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (z > pts[i][0]) continue;
    const [z0, e0] = pts[i - 1];
    const [z1, e1] = pts[i];
    return e0 + ((e1 - e0) * (z - z0)) / (z1 - z0);
  }
  return pts[pts.length - 1][1];
}

/* Push the relief to whatever the current zoom deserves. MapLibre takes a
 * number here rather than an expression, so this cannot be handed to the GPU
 * and left alone - it is re-applied whenever the zoom settles. */
function applyTerrain() {
  if (!TERRAIN) return;
  setupTerrain();
  // Quantised, because this runs on every zoomend and setTerrain rebuilds the
  // mesh; a change of a hundredth is not worth a rebuild.
  const want = terrainOn ? Math.round(exaggerationFor(map.getZoom()) * 10) / 10 : null;
  if (want === terrainApplied) return;
  terrainApplied = want;
  map.setTerrain(want === null ? null : { source: 'dem', exaggeration: want });
}


// --------------------------------------------------------------------------
// Municipal boundaries
// --------------------------------------------------------------------------

/* Drawn above the imagery and below every route layer, so a boundary never
 * crosses the road. No fill: any fill flattens the aerial texture, which is the
 * whole reason the map exists.
 *
 * Labels come from a separate point source rather than from the polygons.
 * MapLibre always anchors a symbol using its own polygon placement and will not
 * read a coordinate out of a property, so a pole-of-inaccessibility computed at
 * build time is only usable if it arrives as an actual point. */
function addMunicipalities(polys, labels) {
  // Kept rather than handed off and forgotten: these outlines are also the only
  // silhouette of New Jersey in the project, and the minimap draws its
  // background from them.
  muniPolyData = polys;
  map.addSource('munis', { type: 'geojson', data: polys, tolerance: 0.5 });
  // A single pale hairline disappears completely into this basemap - the
  // imagery is mid-grey and noisy at every zoom, so a light line has nothing to
  // separate from. A dark line underneath gives it its own edge, which is the
  // same trick the labels use with their halo.
  map.addLayer({
    id: 'muni-line-halo',
    type: 'line',
    source: 'munis',
    minzoom: 9,
    paint: {
      'line-color': '#000',
      'line-opacity': 0.35,
      'line-width': 2.6,
      'line-dasharray': [1.2, 1.7],
    },
  });
  map.addLayer({
    id: 'muni-line',
    type: 'line',
    source: 'munis',
    minzoom: 9,
    paint: {
      'line-color': '#f2efe6',
      'line-opacity': 0.5,
      'line-width': 1.1,
      'line-dasharray': [2.8, 4],
    },
  });
  if (!labels) return;
  muniLabelData = labels;
  map.addSource('muni-labels', { type: 'geojson', data: labels });

  // `short` drops the trailing "Township"/"Borough", which is noise when 564 of
  // them are competing for the same screen.
  const field = ['coalesce', ['get', 'short'], ['get', 'name']];
  // White on guide-sign green, the same pairing the exit signs use, so the
  // place names read as part of the same signage rather than as map furniture.
  // The halo is doing the work of the sign's field: unhaloed text over aerial
  // photography is unreadable wherever the ground is pale, and half of 1930s
  // New Jersey is bare field.
  const signPaint = (opacity, halo) => ({
    'text-color': '#ffffff',
    'text-opacity': opacity,
    'text-halo-color': MUNI_SIGN_GREEN,
    'text-halo-width': halo,
    'text-halo-blur': 0.2,
  });

  // Two layers rather than one, split on `near` - the metres from the label to
  // the road, computed in rankMunicipalities(). Towns on the route earn a lower
  // minzoom, a larger size, and a lower sort key, which is what wins them the
  // collision against a neighbour that happens to be nowhere near the road.
  map.addLayer({
    id: 'muni-label-far',
    type: 'symbol',
    source: 'muni-labels',
    minzoom: 11.5,
    filter: ['>=', ['coalesce', ['get', 'near'], 1e9], MUNI_NEAR_M],
    layout: {
      'text-field': field,
      'text-size': 10,
      'text-letter-spacing': 0.06,
      'text-max-width': 8,
      'text-padding': 6,
      'symbol-sort-key': ['coalesce', ['get', 'near'], 1e9],
    },
    paint: signPaint(MUNI_LABEL_OPACITY['muni-label-far'], 1.1),
  });
  map.addLayer({
    id: 'muni-label-near',
    type: 'symbol',
    source: 'muni-labels',
    minzoom: 9.5,
    filter: ['<', ['coalesce', ['get', 'near'], 1e9], MUNI_NEAR_M],
    layout: {
      'text-field': field,
      'text-size': ['interpolate', ['linear'], ['get', 'near'], 0, 13.5, MUNI_NEAR_M, 11],
      'text-letter-spacing': 0.06,
      'text-max-width': 8,
      'text-padding': 6,
      'symbol-sort-key': ['coalesce', ['get', 'near'], 1e9],
    },
    paint: signPaint(MUNI_LABEL_OPACITY['muni-label-near'], 1.7),
  });
}

/* How far each municipality's label sits from the road being drawn, and where
 * along it you pass them. Derived at runtime from the label points already on
 * disk - no rebuild - and redone whenever the network changes, because "near
 * the route" means a different set of towns for the Parkway than the Turnpike.
 *
 * 564 points against a few thousand segments is a couple of million operations,
 * which is fine once per network switch and would not be fine per frame. */
function rankMunicipalities() {
  muniNear = [];
  if (!muniLabelData || !main) return;

  for (const f of muniLabelData.features) {
    const [lon, lat] = f.geometry.coordinates;
    let best = { offset: Infinity, dist: 0 };
    let bestR = null;
    for (const r of routes) {
      const hit = snapToRoute(r, lon, lat);
      if (hit.offset < best.offset) {
        best = hit;
        bestR = r;
      }
    }
    f.properties.near = Math.round(best.offset);
    if (bestR && best.offset < EDGE_NEAR_M) {
      muniNear.push({
        name: f.properties.short || f.properties.name || '',
        lngLat: [lon, lat],
        near: best.offset,
        clock: clockOf(bestR, best.dist),
      });
    }
  }
  /* Collapse same-name towns. `short` is not unique - Bordentown City and
   * Bordentown Township are two municipalities that both render as
   * "Bordentown", and left alone they produce two identical arrows pointing
   * slightly different ways. For a marker naming a place they are the same
   * place, so keep whichever sits closer to the road. */
  const byName = new Map();
  for (const m of muniNear) {
    const prev = byName.get(m.name);
    if (!prev || m.near < prev.near) byName.set(m.name, m);
  }
  muniNear = [...byName.values()].sort((a, b) => a.clock - b.clock);

  /* Every label point that carries each name, so an arrow can tell whether any
   * town of that name is on screen - including the twin it was just collapsed
   * with, whose label the map may well be drawing. */
  muniPointsByName = new Map();
  for (const f of muniLabelData.features) {
    const n = f.properties.short || f.properties.name;
    if (!n) continue;
    if (!muniPointsByName.has(n)) muniPointsByName.set(n, []);
    muniPointsByName.get(n).push(f.geometry.coordinates);
  }

  if (map.getSource('muni-labels')) map.getSource('muni-labels').setData(muniLabelData);
}

// --------------------------------------------------------------------------
// Route layers
// --------------------------------------------------------------------------

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));

function addRoute(feature, id, isMain) {
  const coords = feature.geometry.coordinates;
  const p = feature.properties;
  const length = p.dists[p.dists.length - 1];

  // Window of mainline distance this alignment occupies. A branch that arrives
  // without its junctions would otherwise produce NaN coordinates several
  // frames later, which is a miserable thing to debug.
  const from = isMain ? 0 : Number(p.attach_start_m);
  const to = isMain ? length : Number(p.attach_end_m);
  if (!(Number.isFinite(from) && Number.isFinite(to) && to > from)) {
    throw new Error(`${p.name || id}: bad attach_start_m/attach_end_m (run build_route.py?)`);
  }

  // Every vertex in Mercator, kept because showOverview rotates the whole route
  // through dozens of candidate bearings and re-projecting 8,000 points per
  // bearing is the difference between instant and a visible stall.
  const merc = coords.map((c) => {
    const m = maplibregl.MercatorCoordinate.fromLngLat({ lng: c[0], lat: c[1] });
    return [m.x, m.y];
  });

  const mercCum = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = (coords[i][0] - coords[i - 1][0]) * RAD;
    const dy = mercY(coords[i][1]) - mercY(coords[i - 1][1]);
    mercCum[i] = mercCum[i - 1] + Math.hypot(dx, dy);
    bounds.extend(coords[i]);
  }

  const r = {
    id,
    isMain,
    coords,
    merc,
    dists: p.dists,
    mercCum,
    mercTotal: mercCum[mercCum.length - 1],
    total: length,
    from,
    to,
    tip: coords[0],
  };

  map.addSource(id, {
    type: 'geojson',
    data: feature,
    lineMetrics: true, // required for line-progress
    tolerance: 0, // no simplification, so progress stays true at low zoom
  });

  const el = document.createElement('div');
  el.className = 'head';
  el.innerHTML = ICON.head;
  /* rotationAlignment 'map' turns the arrow with the map, so it points at real
   * ground rather than at a screen direction - drive north-up and it swings,
   * drive heading-up and it holds still pointing up the screen, which is
   * exactly what a navigation app does.
   *
   * pitchAlignment stays on the viewport on purpose. Laying the arrow flat in
   * the ground plane is the other defensible choice, and at the driving view's
   * 74 degrees it foreshortens the arrow to under a third of its height - a
   * gold splinter. Face-on it stays an arrow at every pitch. */
  r.head = new maplibregl.Marker({
    element: el,
    rotationAlignment: 'map',
    pitchAlignment: 'viewport',
  })
    .setLngLat(coords[0])
    .addTo(map);

  routes.push(r);
  return r;
}

/* Three passes, so every layer of a kind sits below every layer of the next.
 *
 * What each one is for changed once the green became permanent. It used to be a
 * thin ghost line marking where the road would go, with the reveal painting the
 * green band in behind the head. Now:
 *
 *   ghost - the whole footprint, full width, always. The road is a fact about
 *           the map from the first frame; you can see where it is going at
 *           every zoom without having to play anything.
 *   band  - the same footprint at the same width, brighter, revealed. Passing
 *           over a stretch is what lights it up rather than what draws it.
 *   core  - the gold thread down the middle, revealed. This is the thing that
 *           actually moves, and at the state view - where the band is a few
 *           pixels wide - it is the reveal you can see.
 */
function addLayers() {
  const width = bandWidth();
  // Square ends on the wide layers. A round cap on a 260 px line is a 130 px
  // disc, and it put a green blister on the map at each end of the road.
  const wide = { 'line-cap': 'butt', 'line-join': 'round' };
  for (const r of routes) {
    map.addLayer({
      id: `${r.id}-ghost`,
      type: 'line',
      source: r.id,
      layout: wide,
      paint: { 'line-color': net.color, 'line-opacity': GHOST_OPACITY, 'line-width': width },
    });
  }
  for (const r of routes) {
    map.addLayer({
      id: `${r.id}-band`,
      type: 'line',
      source: r.id,
      layout: wide,
      paint: {
        'line-width': width,
        'line-opacity': BAND_OPACITY,
        'line-gradient': revealTo(0, net.color),
      },
    });
  }
  for (const r of routes) {
    map.addLayer({
      id: `${r.id}-core`,
      type: 'line',
      source: r.id,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': coreWidth(),
        'line-opacity': 0.92,
        'line-gradient': revealTo(0, net.gold),
      },
    });
  }
}

function teardownRoutes() {
  for (const r of routes) {
    for (const suffix of ['ghost', 'band', 'core']) {
      const id = `${r.id}-${suffix}`;
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(r.id)) map.removeSource(r.id);
    r.head.remove();
  }
  routes = [];
  main = null;
}

// --------------------------------------------------------------------------
// Minimap
//
// Where you are on the whole road, for the two views that cannot show you.
//
// It reaches the network exactly zero times. Everything it draws is already in
// memory - the municipal polygons the boundary layer was built from, and the
// route's own Mercator vertices - so a second MapLibre instance, a second tile
// pyramid and a second set of range requests are all avoided. That is what
// makes it affordable to redraw every frame, which is what "in sync with any
// motion" actually requires: the head moves 60 times a second and a minimap
// that lags it is worse than none.
// --------------------------------------------------------------------------

const MINI = {
  h: 152, // desktop panel height; the width comes from the state's own shape
  hSmall: 108,
  maxW: 140,
  pad: 4,
  step: 0.9, // minimum spacing, in minimap pixels, between kept vertices
};
let mini = null; // built geometry + canvas context, or null before first build
let muniPolyData = null; // kept so the minimap can draw the state silhouette

const mercX = (lon) => (lon + 180) / 360;
const mercYn = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / Math.PI) / 2;

/* Every polygon ring in a FeatureCollection, Polygon and MultiPolygon alike. */
function eachRing(fc, fn) {
  for (const f of fc.features || []) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) for (const ring of poly) fn(ring);
  }
}

const miniOn = () => VIEWS[viewMode] && viewMode !== 'state';

/* Rebuild everything that only changes when the road or the viewport does: the
 * projection, the decimated route point sets, and the static layer (state
 * silhouette plus the whole road in green) painted once into its own canvas.
 * Per frame all that is left is a blit and a few hundred line segments. */
function buildMinimap() {
  const cv = $('mini-canvas');
  if (!cv || !routes.length) {
    mini = null;
    return;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const eat = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  // The state if we have its outline, the road if we do not. Framing on the
  // state is what keeps the panel the same shape when you change road - a
  // minimap that reshapes itself under you is a second thing to re-read.
  for (const r of routes) for (const m of r.merc) eat(m[0], m[1]);
  if (muniPolyData) {
    eachRing(muniPolyData, (ring) => {
      for (const c of ring) eat(mercX(c[0]), mercYn(c[1]));
    });
  }

  const pad = MINI.pad;
  const h = window.innerWidth < 560 ? MINI.hSmall : MINI.h;
  const dx = Math.max(maxX - minX, 1e-9);
  const dy = Math.max(maxY - minY, 1e-9);
  let k = (h - 2 * pad) / dy;
  let w = Math.round(dx * k + 2 * pad);
  if (w > MINI.maxW) {
    w = MINI.maxW;
    k = (w - 2 * pad) / dx;
  }
  const ox = pad + ((w - 2 * pad) - dx * k) / 2 - minX * k;
  const oy = pad + ((h - 2 * pad) - dy * k) / 2 - minY * k;
  // Above 2x the extra pixels are invisible at this size and cost real fill.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);

  mini = { cv, ctx: cv.getContext('2d'), w, h, k, ox, oy, dpr, base: null, paths: [] };

  /* Decimated to whatever the panel can actually resolve. 8,000 vertices in a
   * 100 px panel is 80 vertices per pixel; keeping one every 0.9 px is the same
   * picture for one-twentieth of the work, and the work happens every frame. */
  for (const r of routes) {
    const xs = [];
    const ys = [];
    const ds = [];
    let lx = -1e9;
    let ly = -1e9;
    for (let i = 0; i < r.merc.length; i++) {
      const x = ox + r.merc[i][0] * k;
      const y = oy + r.merc[i][1] * k;
      const last = i === r.merc.length - 1;
      // The last vertex is kept whatever happens: it is the end of the road.
      if (!last && xs.length && Math.hypot(x - lx, y - ly) < MINI.step) continue;
      xs.push(x);
      ys.push(y);
      ds.push(r.dists[i]);
      lx = x;
      ly = y;
    }
    mini.paths.push({ r, xs, ys, ds });
  }

  const base = document.createElement('canvas');
  base.width = cv.width;
  base.height = cv.height;
  const b = base.getContext('2d');
  b.scale(dpr, dpr);
  b.lineJoin = 'round';
  b.lineCap = 'round';

  if (muniPolyData) {
    /* 564 municipal outlines at 1.7 km per pixel are not readable as
     * boundaries and are not meant to be - collectively they are the only
     * silhouette of New Jersey this project has, and the texture is what makes
     * the panel read as a map rather than as a squiggle on a card. One path,
     * one fill, one stroke. */
    b.beginPath();
    eachRing(muniPolyData, (ring) => {
      let px = -1e9;
      let py = -1e9;
      let started = false;
      for (const c of ring) {
        const x = ox + mercX(c[0]) * k;
        const y = oy + mercYn(c[1]) * k;
        if (started && Math.hypot(x - px, y - py) < 0.7) continue;
        if (started) b.lineTo(x, y);
        else b.moveTo(x, y);
        started = true;
        px = x;
        py = y;
      }
      if (started) b.closePath();
    });
    b.fillStyle = 'rgba(242, 239, 230, .07)';
    b.fill();
    b.strokeStyle = 'rgba(242, 239, 230, .13)';
    b.lineWidth = 0.5;
    b.stroke();
  }

  // The whole road, always - the same promise the map itself makes with the
  // permanent green. Dark casing under it so it survives the muni texture.
  for (const pass of [
    { color: 'rgba(0, 0, 0, .55)', width: 4.4 },
    { color: net.light, width: 3 },
  ]) {
    b.strokeStyle = pass.color;
    b.lineWidth = pass.width;
    b.beginPath();
    for (const p of mini.paths) {
      for (let i = 0; i < p.xs.length; i++) {
        if (i) b.lineTo(p.xs[i], p.ys[i]);
        else b.moveTo(p.xs[i], p.ys[i]);
      }
    }
    b.stroke();
  }

  mini.base = base;
  drawMinimap();
}

/* The gold, the head, and nothing else - everything here moves. */
function drawMinimap() {
  if (!mini || !main || !miniOn()) return;
  const { ctx, w, h, dpr } = mini;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(mini.base, 0, 0, w, h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /* The driven stretch, painted the way the map paints it: the band in the
   * deeper green, the centre line in gold on top of it. Two passes over the
   * same points rather than one two-tone stroke, because a canvas stroke has
   * one colour - which is also how the map does it, with two line layers. */
  for (const pass of [
    { color: net.dark, width: 3 },
    { color: net.gold, width: 1.3 },
  ]) {
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = pass.width;
    for (const p of mini.paths) {
      if (p.xs.length < 2 || !isRunning(p.r)) continue;
      const d = localDist(p.r);
      // The stretch that is lit: from the start of the road up to the head
      // going north, from the head to the far end going south - the same halves
      // the line-gradient step paints out on the map.
      let i = 0;
      while (i < p.ds.length - 1 && p.ds[i + 1] <= d) i++;
      const from = northbound ? 0 : i;
      const to = northbound ? i : p.xs.length - 1;
      ctx.beginPath();
      ctx.moveTo(p.xs[from], p.ys[from]);
      for (let j = from + 1; j <= to; j++) ctx.lineTo(p.xs[j], p.ys[j]);
      ctx.stroke();
    }
  }

  for (const p of mini.paths) {
    if (!p.r.isMain && !isRunning(p.r)) continue;
    const tip = p.r.tip;
    const x = mini.ox + mercX(tip[0]) * mini.k;
    const y = mini.oy + mercYn(tip[1]) * mini.k;
    // The same arrow as on the map, small. The panel is always north up, so
    // the geographic bearing is the screen bearing.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bearingAt(p.r, localDist(p.r)) * RAD);
    ctx.beginPath();
    ctx.moveTo(0, -5.4);
    ctx.lineTo(4.4, 5.2);
    ctx.lineTo(0, 2.8);
    ctx.lineTo(-4.4, 5.2);
    ctx.closePath();
    ctx.fillStyle = net.gold;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }
}

/* The minimap answers a question the whole-state view is already answering, so
 * it only exists in the other two. */
function syncMinimap() {
  const el = $('minimap');
  if (!el) return;
  const on = miniOn();
  if (el.classList.contains('on') === on) return;
  el.classList.toggle('on', on);
  chromeBoxes = null; // the top-left column just changed height
  if (on) drawMinimap();
}

// --------------------------------------------------------------------------
// Interface widgets
// --------------------------------------------------------------------------

/* Vertical scrubber, built by hand. A rotated <input type=range> is a
 * hit-testing and reflow liability, and this control has to hold exactly still
 * under a dragging finger - a track that resizes mid-drag moves the value and
 * the map with it. */
// How close to an interchange counts as going past it, for the readout that
// rides with the thumb.
const EXIT_READOUT_M = 1600;
// Long enough to read as a transition, short enough that scrubbing hard does
// not turn into a slideshow.
const CARD_FADE_MS = 170;

/* The interchange either side of the head, in travel order. `signs` is sorted
 * by mainline clock ascending, so northbound walks it forwards and southbound
 * backwards - either way `prev` is the one behind you and `next` the one you
 * are coming to. */
function exitContext() {
  let prev = null;
  let next = null;
  for (let i = 0; i < signs.length; i++) {
    const s = northbound ? signs[i] : signs[signs.length - 1 - i];
    if ((s.clock - travelled) * dirSign() <= 0) {
      prev = s;
    } else {
      next = s;
      break;
    }
  }
  return { prev, next };
}

/* Distance the way a highway sign gives it: feet close in, miles beyond half a
 * mile, and nothing in between reading "0.1 mi". Feet round to 50 because the
 * underlying snap is worth about that much and a number ending in 7 claims a
 * precision the geocode does not have. */
function signDistance(m) {
  const ft = m / 0.3048;
  if (ft < 2640) return `${Math.max(50, Math.round(ft / 50) * 50).toLocaleString()} ft`;
  return `${(m / MI).toFixed(1)} mi`;
}

/* The pinned next-interchange card.
 *
 * The gantry signs out on the map answer "what is around me"; this answers
 * "what is next", which is a different question and the one worth a fixed
 * place on the screen. Because it is pinned it needs none of the placement
 * machinery the floating signs need - no projection, no declutter, no
 * crowding cap.
 *
 * The fade is the one piece of state here, and it is deliberately keyed on the
 * interchange changing rather than on anything to do with playback: scrub
 * backwards past three exits and you get three swaps, same as driving forwards
 * past them. The distance underneath keeps updating every frame without any
 * transition at all - it is a readout, not a transition. */
function renderNextExit() {
  const el = $('next-exit');
  if (!el) return;
  const { next } = exitContext();
  const key = next ? `${next.kind}:${next.ref}:${Math.round(next.clock)}` : '';
  if (key === cardKey) {
    if (next && el.classList.contains('on')) {
      $('ne-dist').textContent = signDistance(Math.abs(next.clock - travelled));
    }
    return;
  }

  cardKey = key;
  const token = ++cardSwap;
  const wasShowing = el.classList.contains('on');
  el.classList.remove('on');
  if (!next) cardBox = null;
  const show = () => {
    // A later change already claimed the card; let that one finish instead.
    if (token !== cardSwap || !next) return;
    el.dataset.kind = next.kind === 'toll' ? 'toll' : 'exit';
    $('ne-dist').textContent = signDistance(Math.abs(next.clock - travelled));
    $('ne-badge').textContent = next.ref && /^\d/.test(next.ref) ? next.ref : '';
    $('ne-dest').textContent = next.dest || '';
    $('ne-tag').textContent = next.tag || '';
    el.classList.add('on');
    const r = el.getBoundingClientRect();
    cardBox = { x: r.x, y: r.y, w: r.width, h: r.height };
    /* The card is the one piece of furniture that changes size, and it does it
     * a fade later than the frame that decided to change it - a two-line
     * destination is 20 px taller than a one-line one. Playing, the next frame
     * absorbs that. Paused or scrubbed, no frame is coming, so the things that
     * dodge the card have to be re-placed against the size it actually landed
     * at rather than the size it had before the swap. */
    if (!playing) {
      renderSigns(performance.now());
      renderEdgeLabels();
    }
  };
  if (wasShowing) setTimeout(show, CARD_FADE_MS);
  else show();
}

/* Mileage is a fine number and a poor answer to "where am I". The exits either
 * side of the head are the answer, so they ride on the thumb with it - shown
 * while you are dragging, which is exactly when you are hunting for a place
 * rather than a distance, and otherwise only as you actually pass one. */
function setExitReadout() {
  const host = $('scrub-readout');
  const { prev, next } = exitContext();
  const near = Math.min(
    prev ? Math.abs(travelled - prev.clock) : Infinity,
    next ? Math.abs(travelled - next.clock) : Infinity,
  );
  const show = !!(prev || next) && (scrubbing || near < EXIT_READOUT_M);
  host.classList.toggle('has-exits', show);
  if (!show) return;
  const from = prev ? prev.short : '';
  const to = next ? next.short : '';
  if (host._from === from && host._to === to) return;
  host._from = from;
  host._to = to;
  const box = $('scrub-exits');
  box.querySelector('u').textContent = from;
  box.querySelector('b').textContent = to;
  box.querySelector('i').style.display = from && to ? '' : 'none';
}

/* The scrubber is a map of the road, not a progress bar.
 *
 * Both of these roads run up the state, so the track is laid out south at the
 * bottom and north at the top and it stays that way whichever direction you are
 * driving - the same position on the bar is always the same place on the
 * ground. What the direction changes is which end the gold grows from: the
 * revealed stretch runs up from the south end going north, and down from the
 * north end going south, exactly as it does out on the map.
 *
 * The number is therefore a position rather than a distance travelled: miles up
 * the road from its southern end. Driving north those are the same number,
 * which is why it took switching direction to notice they are different
 * questions. */
function setScrubUI(u) {
  const pct = (clamp(u, 0, 1) * 100).toFixed(3);
  const fill = $('scrub-fill');
  fill.style.height = `${(northbound ? clamp(u, 0, 1) : 1 - clamp(u, 0, 1)) * 100}%`;
  $('scrub-track').classList.toggle('south', !northbound);
  $('scrub-thumb').style.bottom = `${pct}%`;
  $('scrub-mi').textContent = `${(travelled / MI).toFixed(1)} mi`;
  setExitReadout();
  $('scrubber').setAttribute('aria-valuenow', String(Math.round(u * 1000)));
  $('scrubber').setAttribute(
    'aria-valuetext',
    `${(travelled / MI).toFixed(1)} of ${(total / MI).toFixed(1)} miles from the southern end`,
  );
}

function scrubTo(u) {
  travelled = clamp(u, 0, 1) * total; // u is a place on the road, not a fraction of the run
  bearing = null; // snap rather than sweep when jumping down the road
  clearDwell();
  setScrubUI(u);
  render();
}

function initScrubber() {
  const el = $('scrubber');
  const track = $('scrub-track');
  const at = (e) => {
    const r = track.getBoundingClientRect();
    return clamp(1 - (e.clientY - r.top) / r.height, 0, 1); // bottom = start
  };
  el.addEventListener('pointerdown', (e) => {
    if (!total) return;
    scrubbing = true;
    el.setPointerCapture(e.pointerId);
    setPlaying(false);
    scrubTo(at(e));
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (scrubbing) scrubTo(at(e));
  });
  for (const ev of ['pointerup', 'pointercancel']) {
    el.addEventListener(ev, () => {
      scrubbing = false;
      setExitReadout(); // the exits are shown for the drag; retire them with it
    });
  }
  el.addEventListener('keydown', (e) => {
    // Up is north, whichever way we happen to be driving - the same convention
    // as the track itself.
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    const page = { PageUp: 50, PageDown: -50 }[e.key];
    const d = step ?? page;
    if (d === undefined) return;
    e.preventDefault();
    setPlaying(false);
    scrubTo(clamp(travelled / total + d / 1000, 0, 1));
  });
}

/* Semicircular speedometer. The arc runs left (slowest) to right (fastest)
 * around a centre at (66, 64) with radius 52 in the SVG's own coordinates. It
 * used to be continuous and to read out in mph; it is now five detents, because
 * five is how many genuinely different speeds this map has and mph was a
 * four-digit number that told you nothing. */
const SPEEDO = { cx: 66, cy: 64, r: 52, w: 132, h: 74, tickR: 61.5 };
const NOTCHES = SPEEDS.length;

function speedoPoint(u, radius = SPEEDO.r) {
  const a = Math.PI - clamp(u, 0, 1) * Math.PI;
  return [SPEEDO.cx + radius * Math.cos(a), SPEEDO.cy - radius * Math.sin(a)];
}

// Notch 1 is placed a little way round the arc rather than at the dead left
// end: at u = 0 the lit arc has zero length and the dial reads as switched off
// rather than as set to its slowest.
const notchU = (n) => 0.06 + (0.94 * (clamp(n, 1, NOTCHES) - 1)) / (NOTCHES - 1);

function buildSpeedoTicks() {
  const g = $('speedo-ticks');
  for (let n = 1; n <= NOTCHES; n++) {
    const [x, y] = speedoPoint(notchU(n), SPEEDO.tickR);
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', 'tick');
    c.setAttribute('cx', x.toFixed(2));
    c.setAttribute('cy', y.toFixed(2));
    c.setAttribute('r', '1.7');
    g.appendChild(c);
  }
}

function setSpeedUI() {
  const u = notchU(speedNotch);
  const [x, y] = speedoPoint(u);
  $('speedo-lit').setAttribute(
    'd',
    `M ${SPEEDO.cx - SPEEDO.r} ${SPEEDO.cy} A ${SPEEDO.r} ${SPEEDO.r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`,
  );
  $('speedo-knob').setAttribute('cx', x.toFixed(2));
  $('speedo-knob').setAttribute('cy', y.toFixed(2));
  $('speed-notch').textContent = String(speedNotch);

  const ticks = $('speedo-ticks').children;
  for (let i = 0; i < ticks.length; i++) ticks[i].classList.toggle('on', i < speedNotch);

  const mode = $('speed-mode');
  mode.textContent = speedAuto ? 'AUTO' : 'MANUAL';
  mode.classList.toggle('manual', !speedAuto);
  mode.title = speedAuto
    ? 'Speed follows the zoom — drag the dial to set it by hand'
    : 'Speed set by hand — tap to go back to following the zoom';

  const el = $('speedo');
  el.setAttribute('aria-valuenow', String(speedNotch));
  el.setAttribute(
    'aria-valuetext',
    `Speed ${speedNotch} of ${NOTCHES}${speedAuto ? ', following the zoom' : ''}` +
      (total ? `, whole route in ${Math.round(runSeconds())} seconds` : ''),
  );
}

/* Setting a notch by hand takes the dial off automatic - there is no way to
 * express "I meant that one" other than to stop overruling it. The AUTO chip is
 * the way back. */
function setSpeedNotch(n, fromAuto = false) {
  const next = clamp(Math.round(n), 1, NOTCHES);
  const auto = fromAuto ? speedAuto : false;
  if (next === speedNotch && auto === speedAuto) return;
  speedNotch = next;
  speedAuto = auto;
  setSpeedUI();
}

const armAutoSpeed = () => {
  if (speedAuto) setSpeedNotch(autoNotch(map.getZoom()), true);
};

function initSpeedo() {
  const el = $('speedo');
  const svg = el.querySelector('svg');
  let dragging = false;
  const at = (e) => {
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * SPEEDO.w;
    const sy = ((e.clientY - r.top) / r.height) * SPEEDO.h;
    const ang = Math.atan2(SPEEDO.cy - sy, sx - SPEEDO.cx);
    // Below the centre line there is no arc; snap to whichever end is nearer
    // rather than letting atan2's wrap fling the value to the far end.
    const u = ang < 0 ? (sx < SPEEDO.cx ? 0 : 1) : clamp(1 - ang / Math.PI, 0, 1);
    // Inverse of notchU, so the detent you land on is the one under your finger.
    return Math.round(((u - 0.06) / 0.94) * (NOTCHES - 1)) + 1;
  };
  const apply = (e) => setSpeedNotch(at(e));
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    apply(e);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (dragging) apply(e);
  });
  for (const ev of ['pointerup', 'pointercancel']) {
    el.addEventListener(ev, () => {
      dragging = false;
    });
  }
  el.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    setSpeedNotch(speedNotch + d);
  });

  // The AUTO chip sits inside the dial's own drag surface, so its events have
  // to be stopped or pressing it would also set a manual notch under the finger.
  const mode = $('speed-mode');
  const rearm = (e) => {
    e.stopPropagation();
    e.preventDefault();
    speedAuto = true;
    setSpeedUI();
    armAutoSpeed();
  };
  mode.addEventListener('pointerdown', (e) => e.stopPropagation());
  mode.addEventListener('click', rearm);
  mode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') rearm(e);
  });
}

/* Back to the start of the run, in whatever view you are in. It used to throw
 * you back to the overview as well, which was the only way to get there; there
 * is a button for that now, so this does the one thing its icon promises. */
function backToStart(duration = 800) {
  setPlaying(false);
  intro = false;
  travelled = runStart();
  bearing = null;
  zoomTarget = null;
  clearDwell();
  render();
  setView(viewMode, duration);
}

$('play').onclick = () => setPlaying(!playing);
$('reset').onclick = () => backToStart();
$('reset').innerHTML = ICON.reset;
$('play').innerHTML = ICON.play;

/* Which way we are driving, next to play and reset rather than off in the map
 * controls. It belongs with them: it is a property of the run, like where the
 * run starts and whether it is moving, and none of those are things about the
 * map. Pressing it re-runs the road from the other end. */
function syncDirection() {
  const b = $('direction');
  if (!b) return;
  b.innerHTML = northbound ? ICON.north : ICON.south;
  b.title = northbound
    ? 'Running northbound — tap to run southbound'
    : 'Running southbound — tap to run northbound';
  b.setAttribute('aria-label', b.title);
}
$('direction').onclick = () => {
  northbound = !northbound;
  syncDirection();
  backToStart();
};
syncDirection();

/* The long explanation, behind the title card.
 *
 * Focus goes to the close button on the way in and back to the card on the way
 * out, because the card is the only way back in and a dialog that leaves your
 * focus behind it strands a keyboard on the map. */
function setAbout(on) {
  const el = $('about');
  if (!el) return;
  el.classList.toggle('on', on);
  if (on) $('about-close').focus();
  else $('title-card').focus();
}
$('title-card').addEventListener('click', () => setAbout(true));
$('title-card').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    setAbout(true);
  }
});
$('about-close').addEventListener('click', () => setAbout(false));
// The backdrop only, not the panel: a drag that starts on the text and ends on
// the backdrop is a selection, not a dismissal.
$('about').addEventListener('click', (e) => {
  if (e.target === $('about')) setAbout(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('about').classList.contains('on')) setAbout(false);
});

/* A backgrounded tab stops getting animation frames, so playback stalls where
 * it stood and resumes mid-stride when you come back - which looks like a
 * glitch even though the distance is right. Stopping deliberately says what
 * happened, and leaves the road where you left it. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) setPlaying(false);
});

// Panning or rotating the map by hand is an implicit "stop following me".
// Rotation needs the originalEvent check: the follow loop's own jumpTo fires
// rotate events too, and those must not switch following off.
// The token bump abandons any view change still in flight: taking hold of the
// map yourself has to win against a descent that is about to force follow on.
map.on('dragstart', () => {
  viewToken++;
  if (following) setFollowing(false);
});
map.on('rotatestart', (e) => {
  if (!e.originalEvent) return;
  viewToken++;
  if (following) setFollowing(false);
});

// Zooming stays available while following. The per-frame jumpTo would cancel
// the map's own zoom animation (buttons, wheel, double-tap) the instant it
// started, so stand off the camera until that zoom has finished and then carry
// on following at whatever zoom it landed on. 'idle' is a backstop in case a
// zoomend goes missing - following must never stall for good.
map.on('zoomstart', () => {
  if (!selfDriving) externalZoom = true;
});
map.on('zoomend', () => {
  externalZoom = false;
  // The zoom is what the automatic speed and the terrain exaggeration are both
  // keyed off, so this is where they get re-read. selfDriving keeps the follow
  // loop's own per-frame jumpTo out of it - jumpTo fires its events
  // synchronously, so the flag is still set here.
  if (selfDriving) return;
  armAutoSpeed();
  applyTerrain();
});
map.on('idle', () => {
  externalZoom = false;
  // Symbol placement is asynchronous, so a label can appear a beat after the
  // frame that decided there was none - leaving an arrow pointing at a town
  // whose name is now on screen. While playing the next frame fixes it; paused
  // or scrubbed, nothing would. 'idle' is the point where placement has settled.
  renderEdgeLabels();

  /* And now that it has settled, correct the one thing projecting the anchor
   * cannot know: MapLibre draws a label whenever its collision box touches the
   * viewport, so a town anchored just outside still shows its name. Asking what
   * was drawn is exact but far too slow to run per frame - here it runs once,
   * when the map has stopped moving, which is also the only time a stale arrow
   * would survive long enough to be seen. */
  const labelLayers = ['muni-label-near', 'muni-label-far'].filter((id) => map.getLayer(id));
  if (!labelLayers.length) return;
  const drawn = new Set(
    map
      .queryRenderedFeatures({ layers: labelLayers })
      .map((f) => f.properties.short || f.properties.name),
  );
  for (const el of edgePool) {
    if (el.style.display === 'none') continue;
    if (drawn.has(el.querySelector('span').textContent)) el.style.display = 'none';
  }
});

// Signs are positioned in screen space, so they have to be replaced after a
// rotate or a resize even when nothing about the route has changed.
map.on('move', () => {
  if (playing) return;
  renderSigns(performance.now());
  renderEdgeLabels();
});
// The map's own controls appear as it loads, and the attribution changes width
// when terrain adds its credit - both move the column the signs dodge.
map.on('load', () => {
  chromeBoxes = null;
});
window.addEventListener('resize', () => {
  for (const s of signs) s.w = 0; // remeasure: max-width is in vw
  chromeBoxes = null;
  cardBox = null;
  cardKey = null; // forces the card to re-measure itself on the next frame
  buildMinimap(); // the panel is a different height below 560 px
  render();
});

// --------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------

const routeCache = new Map();

async function loadNetwork(key) {
  const target = NETWORKS[key];
  if (!routeCache.has(key)) {
    const res = await fetch(target.file);
    if (!res.ok) throw new Error(`${target.file}: ${res.status} (run build_route.py?)`);
    routeCache.set(key, await res.json());
  }
  net = target;
  document.documentElement.style.setProperty('--net', net.color);
  document.documentElement.style.setProperty('--net-gold', net.gold);
  document.documentElement.style.setProperty('--net-light', net.light);
  document.documentElement.style.setProperty('--net-dark', net.dark);
  syncRoadSwitch();

  teardownRoutes();
  const collection = routeCache.get(key);
  const feats = collection.features || [collection];
  const mainFeature = feats.find((f) => f.properties.role === 'mainline') || feats[0];
  const spurs = feats.filter((f) => f !== mainFeature);

  bounds = new maplibregl.LngLatBounds(
    mainFeature.geometry.coordinates[0],
    mainFeature.geometry.coordinates[0],
  );

  main = addRoute(mainFeature, 'main', true);
  spurs.forEach((f, i) => addRoute(f, spurs.length > 1 ? `spur${i}` : 'spur', false));
  total = main.total;

  addLayers();
  buildSigns();
  rankMunicipalities();
  buildMinimap(); // the road it draws, and the colour it draws it in, both changed

  northbound = true;
  travelled = runStart();
  cruiseZoom = VIEWS.top.zoom;
  bearing = null;

  setPlaying(false);
  setFollowing(false);
  render();
  // Switching road puts you back at the whole-state view. The other two are
  // framed on a head that has just moved to the other end of a different road,
  // and landing in a windscreen view of somewhere you did not ask for is worse
  // than a beat of orientation.
  setView('state', 0);
  setSpeedUI();
}

/* Optional data. A missing file is a smaller map, not a broken one, so these
 * resolve to null rather than rejecting. */
async function optional(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

initScrubber();
buildSpeedoTicks();
initSpeedo();
setSpeedUI();
buildViewSwitch();
buildRoadSwitch();
syncViews();
syncRoadSwitch();
// The switch is sized off its own labels, and until Overpass has arrived those
// labels are a different width. Re-measuring on both is cheap and covers the
// case where the font never loads at all.
document.fonts?.ready.then(() => {
  syncRoadSwitch();
  chromeBoxes = null; // the title and the readout may have just changed width
});
window.addEventListener('resize', syncRoadSwitch);

const loaded = new Promise((resolve) => map.on('load', resolve));

Promise.all([
  loaded,
  optional('municipalities.geojson'),
  optional('municipality-labels.geojson'),
  optional('exits-points.json'),
  probeTerrain(),
])
  .then(([, munis, muniLabels, exits]) => {
    if (munis) addMunicipalities(munis, muniLabels);
    else console.info('municipalities.geojson not found — boundary layer off');
    allExits = exits;
    if (!exits) console.info('exits-points.json not found — signs off');
    setupTerrain();
    return loadNetwork('NJTP');
  })
  .catch(reportFailure);

/* Verification handle. Everything in this file is module-scoped, and
 * `window.map` is the container <div> rather than the map (elements with an id
 * become named properties of window), so a harness driving this page has no
 * other way in. Read-only by intent. */
window.__map = map;
window.__chrome = () => ({ boxes: chrome(), card: cardBox });
/* Drop the head at an exact distance and redraw. The scrubber quantises to
 * 1/1000 of the route, which is 200 m on the Turnpike - too coarse to check
 * that the two heads meet at a junction. */
window.__seek = (metres) => {
  travelled = clamp(metres, 0, total);
  bearing = null;
  clearDwell();
  render();
  return routes.map((r) => ({ id: r.id, tip: r.tip, running: isRunning(r), local: localDist(r) }));
};
window.__state = () => ({
  net: net.key,
  travelled,
  total,
  northbound,
  playing,
  following,
  headingUp,
  intro,
  viewMode,
  speedNotch,
  speedAuto,
  terrainOn,
  minimap: !!mini && miniOn(),
  zoom: map.getZoom(),
  pitch: map.getPitch(),
  runSeconds: runSeconds(),
  routes: routes.map((r) => r.id),
  signs: signs.length,
  munisNearRoute: muniNear.length,
  signsShown: signs.filter((s) => s.shown).map((s) => s.ref),
});

// Surface real failures (a missing or unreadable pmtiles) rather than leaving a
// silently blank map. Absent tiles are not errors: PMTiles resolves them to
// nothing, so gaps in the mosaic just render empty.
let told = false;
map.on('error', (e) => {
  if (told) return;
  told = true;
  warn(`map: ${e.error?.message || e.error || 'unknown error'}`);
});
