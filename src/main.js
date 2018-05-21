/* global d3: false, topojson: false */
/* eslint-env browser */
/* eslint no-use-before-define: ["error", "nofunc"] */
const dataStep = 15 * 60 * 1000;
// TODO(jdhollen): make this configurable.
const step = 15 * 60 * 1000;

const context = d3.select('canvas').node().getContext('2d');
const canvas = document.getElementById('map');
const canvasPath = d3.geoPath().context(context);
let countyNames = {};
let alertNames = {};
let selectedCounty = '';
let previous = {};
let paused = false;
let pausedBeforeInputStarted = false;
let slideInProgress = false;
let scaleFactor = 1;
let us = {};
let arr32;
let arr16;
let clicks16;
let meshed;
let nation;

const min = 1514764800000;
const max = 1525132800000;
const positionSteps = 1000;
const countyFeatures = {};

const types = [
  'NONE',
  'RH', 'VO', 'AF', 'TS', 'TO', 'HU', 'TY', 'EW', 'HF', 'HI', 'TR', 'SV', 'BZ',
  'SQ', 'WS', 'DS', 'WW', 'IS', 'LB', 'LE', 'HS', 'HP', 'FF', 'SB', 'SN', 'BS',
  'IP', 'ZR', 'SR', 'GL', 'TI', 'SM', 'AV', 'DU', 'CF', 'LS', 'FA', 'FL', 'HY',
  'ZF', 'FG', 'FW', 'HW', 'WI', 'EC', 'EH', 'HZ', 'HT', 'FZ', 'LW', 'WC', 'UP',
  'SE', 'SU', 'BH', 'LO', 'MA', 'SC', 'SI', 'RB', 'FR', 'AS'];

const alertColors = {
  SV: 'orange',
  TO: 'red',
  MA: 'palevioletred',
  AF: 'red',
  AS: 'gray',
  AV: 'blue',
  BH: 'thistle',
  BS: 'cyan',
  BZ: 'orangered',
  CF: 'forestgreen',
  DU: 'darkkhaki',
  DS: 'bisque',
  EC: 'blue',
  EH: 'mediumvioletred',
  EW: 'deeppink',
  FA: 'seagreen',
  FF: 'limegreen',
  FL: 'green',
  FR: 'green',
  FZ: 'cyan',
  FG: 'slategray',
  FW: 'deeppink',
  GL: '#dda0dd',
  HF: '#cd5c5c',
  HI: '#cd5c5c',
  HS: 'blue',
  HP: 'lightsteelblue',
  HT: 'coral',
  HU: '#dc143c',
  HW: 'goldenrod',
  HY: 'springgreen',
  HZ: 'blue',
  IS: 'darkmagenta',
  IP: 'cyan',
  LB: 'blue',
  LE: 'blue',
  LO: 'khaki',
  LS: 'green',
  LW: 'thistle',
  RB: 'thistle',
  RH: 'red',
  SB: 'blue',
  SC: 'thistle',
  SE: 'thistle',
  SI: 'thistle',
  SM: 'khaki',
  SN: 'blue',
  SQ: 'blue',
  SR: '#9400d3',
  SU: 'forestgreen',
  TI: '#b22222',
  TR: '#b22222',
  TS: 'red',
  TY: '#dc143c',
  UP: 'blue',
  VO: 'red',
  WC: 'lightsteelblue',
  WI: 'tan',
  WS: 'hotpink',
  WW: '#7b68ee',
  ZF: 'cyan',
  ZR: 'cyan',
};

let currentTime = min;

function timeToPosition() {
  if (currentTime <= min) {
    return 1;
  }
  if (currentTime >= max - dataStep) {
    return positionSteps;
  }

  return (1 + positionSteps) -
    Math.ceil(((max - dataStep - currentTime) / (max - dataStep - min)) * positionSteps);
}

function refreshHoverText() {
  const el = document.getElementById('hoverText');
  if (!el) {
    return;
  }
  if (!selectedCounty) {
    el.textContent = '';
    return;
  }

  // TODO(jdhollen): flush out all missing names + fix.
  const stateName = countyNames[`${selectedCounty.substring(0, 2)}000`];
  const fullName = `${countyNames[selectedCounty]}, ${stateName}`;
  const classes = previous[Number(selectedCounty)] || [];

  let alerts = '';
  for (let i = 0; i < classes.length; i += 1) {
    const alert = alertNames[classes[i]];
    if (alert) {
      alerts = alerts.concat(` ${alert}`);
    }
  }
  if (!alerts) {
    alerts = 'No alerts';
  }

  el.textContent = `${fullName}: ${alerts}`;
}

function drawCounty(county, fillStyle) {
  context.fillStyle = fillStyle;
  context.beginPath();
  canvasPath(county);
  context.fill();
  context.stroke();
}

function redraw(ignorePreviousState) {
  if (!arr32) {
    return;
  }

  const newValue = (currentTime - min) / dataStep;
  const newClasses = {};
  const changes = {};

  const previousKeys = Object.keys(previous);
  for (let i = 0; i < previousKeys.length; i += 1) {
    changes[previousKeys[i]] = [];
  }

  let index16 = arr32[3 + newValue];

  while (true) {
    const alertId = arr16[index16];
    const alertString = types[alertId];
    if (alertId === 0) {
      break;
    }
    const length = arr16[index16 + 1];
    index16 += 2;
    for (let i = index16; i < index16 + length; i += 1) {
      const county = arr16[i];
      if (!newClasses[county]) {
        newClasses[county] = [alertString];
        changes[county] = [alertString];
      } else {
        newClasses[county].push(alertString);
        changes[county].push(alertString);
      }
    }
    index16 += length;
  }

  const changeKeys = Object.keys(changes);
  for (let i = 0; i < changeKeys.length; i += 1) {
    const countyId = changeKeys[i];
    const countyString = countyId < 10000 ? `0${countyId}` : countyId;
    const alertForMap = changes[countyId] ? changes[countyId][0] : '';
    const previousAlertForMap = previous[countyId] ? previous[countyId][0] : '';
    if (ignorePreviousState || alertForMap !== previousAlertForMap) {
      const color = alertColors[alertForMap] || '#cccccc';
      drawCounty(countyFeatures[countyString], color);
    }
  }

  previous = newClasses;
  document.getElementById('time').textContent = new Date(currentTime);
  document.getElementById('slider').value = timeToPosition();
  refreshHoverText();
}

function processSliderEvent() {
  const newValue = document.getElementById('slider').value;
  const stepSize = Math.floor((max - dataStep - min) / positionSteps);
  // TODO(jdhollen): round instead of floor here.
  const offset = (stepSize * newValue) - ((stepSize * newValue) % step);
  currentTime = min + offset;
  redraw();
}

function handleSliderInputEvent() {
  if (!slideInProgress) {
    pausedBeforeInputStarted = paused;
  }
  slideInProgress = true;
  paused = true;
  processSliderEvent();
}

function handleSliderChangeEvent() {
  slideInProgress = false;
  paused = pausedBeforeInputStarted;
  processSliderEvent();
}

function handleChange() {
  if (paused || currentTime >= max - dataStep) {
    window.setTimeout(handleChange, 25);
    return;
  }
  currentTime += step;
  redraw();
  window.setTimeout(handleChange, 25);
}

function handleMouseOver(e) {
  const rect = canvas.getBoundingClientRect();
  const offsetTop = rect.top + document.body.scrollTop;
  const offsetLeft = rect.left + document.body.scrollLeft;

  const ratio = 1 / (canvas.width / (960 * devicePixelRatio));
  const x = Math.floor(ratio * (e.clientX - offsetLeft));
  const y = Math.floor(ratio * (e.clientY - offsetTop));

  if (clicks16) {
    const id = clicks16[(x * 600) + y];
    if (id > 0) {
      selectedCounty = id < 10000 ? `0${id}` : `${id}`;
    } else {
      selectedCounty = '';
    }
  }
  refreshHoverText();
}

function handleMouseOut() {
  selectedCounty = '';
  refreshHoverText();
}

function drawBaseMap() {
  if (!us.objects) {
    return;
  }
  if (!meshed) {
    meshed = topojson.mesh(us);
  }
  if (!nation) {
    nation = topojson.feature(us, us.objects.nation);
  }
  context.beginPath();
  context.fillStyle = '#cccccc';
  canvasPath(nation);
  context.fill();

  context.beginPath();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 0.5;
  canvasPath(meshed);
  context.stroke();
}

function loadClickMap(buffer) {
  clicks16 = new Uint16Array(buffer);
}

function loadWeatherData(buffer) {
  arr32 = new Uint32Array(buffer, 0, (buffer.byteLength - (buffer.byteLength % 4)) / 4);
  arr16 = new Uint16Array(buffer);
}

function sizeCanvas() {
  const w = Math.min(860, window.innerWidth);
  const h = Math.max(300, Math.min(600, window.innerHeight - 100));
  const width = w * 0.625 < h ? w : h / 0.625;
  const height = width * 0.625;

  canvas.setAttribute('style', `width: ${width}px; height: ${height}px;`);
  canvas.width = devicePixelRatio * width;
  canvas.height = devicePixelRatio * height;
  scaleFactor = width / 960;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 0.5;
  context.scale(devicePixelRatio * scaleFactor, devicePixelRatio * scaleFactor);
  if (us) {
    drawBaseMap();
    redraw(true);
  }
}

function handlePlayPauseClick() {
  paused = !paused;
}

function loadMapData(usData) {
  us = usData;
  const counties = topojson.feature(us, us.objects.counties).features;

  for (let i = 0; i < counties.length; i += 1) {
    countyFeatures[counties[i].id] = counties[i];
  }

  drawBaseMap();
}

if (checkFetchAndPromiseSupport()) {
  main();
} else {
  loadPolyfills(main);
}

function getJson(r) {
  return r.json();
}

function getBuf(r) {
  return r.arrayBuffer();
}

function main() {
  const weather = fetch('data/weather.dat').then(getBuf).then(b => loadWeatherData(b));
  const clicks = fetch('data/clicks.dat').then(getBuf).then(b => loadClickMap(b));
  const alerts = fetch('data/alert-names.json').then(getJson).then((j) => { alertNames = j; });
  const counties = fetch('data/county-names.json').then(getJson).then((j) => { countyNames = j; });
  const map = fetch('data/10m.json').then(getJson).then(j => loadMapData(j));

  document.getElementById('slider').addEventListener('change', handleSliderChangeEvent);
  document.getElementById('slider').addEventListener('input', handleSliderInputEvent);
  document.getElementById('playPause').addEventListener('click', handlePlayPauseClick);

  window.addEventListener('resize', sizeCanvas);
  window.addEventListener('orientationchange', sizeCanvas);
  canvas.addEventListener('mouseover', handleMouseOver);
  canvas.addEventListener('mousemove', handleMouseOver);
  canvas.addEventListener('mouseout', handleMouseOut);
  sizeCanvas();

  Promise.all([weather, clicks, alerts, counties, map]).then(() => handleChange());
}

function loadPolyfills(callback) {
  const script = document.createElement('script');
  script.src = 'https://cdn.polyfill.io/v2/polyfill.min.js?features=fetch';
  script.onload = () => { callback(); };
  script.onerror = () => { callback(new Error('failed to load polyfills')); };
  document.head.appendChild(script);
}

function checkFetchAndPromiseSupport() {
  return window.Promise && window.fetch;
}
