/* global d3: false, topojson: false */
/* eslint-env browser */
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
let buffer;
let arr32;
let arr16;
let clicks16;

const min = 1514764800000;
const max = 1525132800000;
const positionSteps = 1000;
const countyFeatures = {};

const types = [
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
  const classes = previous[selectedCounty] || [];

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
    const alertString = types[alertId - 1];
    if (alertId === 0) {
      break;
    }
    const length = arr16[index16 + 1];
    index16 += 2;
    for (let i = index16; i < index16 + length; i += 1) {
      const county = arr16[i];
      if (!newClasses[county]) {
        // xxx: convert.
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
  context.beginPath();
  context.fillStyle = '#cccccc';
  canvasPath(topojson.feature(us, us.objects.nation));
  context.fill();

  context.beginPath();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 0.5;
  canvasPath(topojson.mesh(us));
  context.stroke();
}

function loadClickMap() {
  const req = new XMLHttpRequest();
  req.open('GET', 'data/clicks.dat', true);
  req.responseType = 'arraybuffer';

  req.onload = () => {
    buffer = req.response;
    if (buffer) {
      clicks16 = new Uint16Array(buffer);
    }
  };

  req.send();
}

function loadWeatherData() {
  const req = new XMLHttpRequest();
  req.open('GET', 'data/weather.dat', true);
  req.responseType = 'arraybuffer';

  req.onload = () => {
    buffer = req.response;
    if (buffer) {
      arr32 = new Uint32Array(buffer, 0, (buffer.byteLength - (buffer.byteLength % 4)) / 4);
      arr16 = new Uint16Array(buffer);
      handleChange();
    }
  };

  req.send();
  loadClickMap();
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

// TODO(jdhollen): move everything below here to an onload event.
function loadMapData() {
  d3.json(
    'data/10m.json',
    (error, usData) => {
      if (error) {
        throw error;
      }
      us = usData;
      const counties = topojson.feature(us, us.objects.counties).features;

      for (let i = 0; i < counties.length; i += 1) {
        countyFeatures[counties[i].id] = counties[i];
      }

      drawBaseMap();
      loadWeatherData();
    },
  );
}

function loadCountyNames() {
  d3.json(
    'data/county-names.json',
    (error, names) => {
      if (error) {
        throw error;
      }
      countyNames = names;
      loadMapData();
    },
  );
}

d3.json(
  'data/alert-names.json',
  (error, names) => {
    if (error) {
      throw error;
    }
    alertNames = names;
    loadCountyNames();
  },
);

document.getElementById('slider').addEventListener('change', handleSliderChangeEvent);
document.getElementById('slider').addEventListener('input', handleSliderInputEvent);
document.getElementById('playPause').addEventListener('click', handlePlayPauseClick);

window.addEventListener('resize', sizeCanvas);
window.addEventListener('orientationchange', sizeCanvas);
canvas.addEventListener('mouseover', handleMouseOver);
canvas.addEventListener('mousemove', handleMouseOver);
canvas.addEventListener('mouseout', handleMouseOut);
sizeCanvas();
