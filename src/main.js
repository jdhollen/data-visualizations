/* global d3: false, topojson: false */
/* eslint-env browser */
/* eslint no-use-before-define: ['error', 'nofunc'] */
/* eslint no-bitwise: ['error', { 'allow': ['&', '|'] }] */
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

const typeBits = {
  0x8000: 'Warning',
  0x4000: 'Advisory',
  0x2000: 'Watch',
  0x1000: 'Statement',
};

const letterBits = {
  0x8000: 'W',
  0x4000: 'Y',
  0x2000: 'A',
  0x1000: 'S',
};

const types = [
  'NONE',
  'RH', 'VO', 'AF', 'TS', 'TO', 'HU', 'TY', 'EW', 'HF', 'HI', 'TR', 'SV', 'BZ',
  'SQ', 'WS', 'DS', 'WW', 'IS', 'LB', 'LE', 'HS', 'HP', 'FF', 'SB', 'SN', 'BS',
  'IP', 'ZR', 'SR', 'GL', 'TI', 'SM', 'AV', 'DU', 'CF', 'LS', 'FA', 'FL', 'HY',
  'ZF', 'FG', 'FW', 'HW', 'WI', 'EC', 'EH', 'HZ', 'HT', 'FZ', 'LW', 'WC', 'UP',
  'SE', 'SU', 'BH', 'LO', 'MA', 'SC', 'SI', 'RB', 'FR', 'AS', 'RP'];

const alertColors = {
  ASY: '#808080',
  AFY: '#696969',
  AFW: '#A9A9A9',
  AVY: '#CD853F',
  AVW: '#1E90FF',
  AVA: '#F4A460',
  BHS: '#40E0D0',
  BZW: '#FF4500',
  BZA: '#ADFF2F',
  DUY: '#BDB76B',
  CFY: '#7CFC00',
  CFS: '#6B8E23',
  CFW: '#228B22',
  CFA: '#66CDAA',
  FGY: '#708090',
  SMY: '#F0E68C',
  DSW: '#FFE4C4',
  EHW: '#C71585',
  EHA: '#800000',
  ECW: '#0000FF',
  ECA: '#0000FF',
  EWW: '#FF8C00',
  FFS: '#8B0000',
  FFW: '#8B0000',
  FFA: '#2E8B57',
  FLY: '#00FF7F',
  FLS: '#00FF00',
  FLW: '#00FF00',
  FLA: '#2E8B57',
  FZW: '#483D8B',
  FZA: '#00FFFF',
  ZFY: '#008080',
  ZRY: '#DA70D6',
  FRY: '#6495ED',
  GLW: '#DDA0DD',
  GLA: '#FFC0CB',
  HZW: '#9400D3',
  HZA: '#4169E1',
  SEW: '#D8BFD8',
  SEA: '#483D8B',
  HTY: '#FF7F50',
  SUY: '#BA55D3',
  SUW: '#228B22',
  HWW: '#DAA520',
  HWA: '#B8860B',
  HFW: '#CD5C5C',
  HIW: '#CD5C5C',
  HFA: '#9932CC',
  HUW: '#DC143C',
  HUA: '#FF00FF',
  HYY: '#00FF7F',
  ISW: '#8B008B',
  LEY: '#48D1CC',
  LEW: '#008B8B',
  LEA: '#87CEFA',
  LWY: '#D2B48C',
  LSY: '#7CFC00',
  LSS: '#6B8E23',
  LSW: '#228B22',
  LSA: '#66CDAA',
  LOY: '#A52A2A',
  MAS: '#FFDAB9',
  RHW: '#4B0082',
  FWW: '#FF1493',
  RPS: '#40E0D0',
  SVW: '#FFA500',
  SVA: '#DB7093',
  SVS: '#00FFFF',
  SCY: '#D8BFD8',
  RBY: '#D8BFD8',
  SIY: '#D8BFD8',
  SRW: '#9400D3',
  SRA: '#FFE4B5',
  TOW: '#FF0000',
  TOA: '#FFFF00',
  TRW: '#B22222',
  TRA: '#F08080',
  TSY: '#D2691E',
  TSW: '#FD6347',
  TSA: '#FF00FF',
  TYW: '#DC143C',
  TYA: '#FF00FF',
  VOW: '#2F4F4F',
  WIY: '#D2B48C',
  WCY: '#AFEEEE',
  WCW: '#B0C4DE',
  WCA: '#5F9EA0',
  WSW: '#FF69B4',
  WSA: '#4682B4',
  WWY: '#7B68EE',
  FAY: '#00FF7F',
  FAS: '#00FF00',
  FAW: '#00FF00',
  FAA: '#2E8B57',
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
    const av = classes[i];
    const alertId = av & 0xff;
    const alertType = av & 0xff00;
    const alert = alertNames[types[alertId]];
    if (alert) {
      alerts = alerts.concat(` ${alert} ${typeBits[alertType]}`);
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
    const av = arr16[index16];
    const alertId = av & 0xff;
    if (alertId === 0) {
      break;
    }
    const length = arr16[index16 + 1];
    index16 += 2;
    for (let i = index16; i < index16 + length; i += 1) {
      const county = arr16[i];
      if (!newClasses[county]) {
        newClasses[county] = [av];
        changes[county] = [av];
      } else {
        newClasses[county].push(av);
        changes[county].push(av);
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
      const alertString = types[alertForMap & 0xff] + letterBits[alertForMap & 0xff00];
      const color = alertColors[alertString] || '#cccccc';
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

function maybeRunStep() {
  if (paused || currentTime >= max - dataStep) {
    window.setTimeout(maybeRunStep, 25);
    return;
  }
  currentTime += step;
  redraw();
  window.setTimeout(maybeRunStep, 25);
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
  const weather = fetch('data/weather-type.dat').then(getBuf).then(b => loadWeatherData(b));
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

  Promise.all([weather, clicks, alerts, counties, map]).then(() => maybeRunStep());
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
