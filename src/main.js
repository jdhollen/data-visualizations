/* global d3: false, topojson: false, moment: false */
/* eslint-env browser */

const svg = d3.select('#svg');
const path = d3.geoPath();
const dataStep = 15 * 60 * 1000;

// TODO(jdhollen): make this configurable.
const step = 15 * 60 * 1000;

const context = d3.select('canvas').node().getContext('2d');
const canvas = document.getElementById('map');
const canvasPath = d3.geoPath().context(context);
const data = {};
let countyNames = {};
let alertNames = {};
let selectedCounty = '';
let previous = {};
let paused = false;
let pausedBeforeInputStarted = false;
let slideInProgress = false;
let scaleFactor = 1;
let us = {};
const min = moment.utc('20180101', 'YYYYMMDD').valueOf();
const max = moment.utc('20180501', 'YYYYMMDD').valueOf();
const positionSteps = 1000;
const countyElementLookup = {};
const countyFeatures = {};

const types = [
  'SV', 'TO', 'MA', 'AF', 'AS', 'AV', 'BH', 'BS', 'BZ', 'CF', 'DU', 'DS', 'EC',
  'EH', 'EW', 'FA', 'FF', 'FL', 'FR', 'FZ', 'FG', 'FW', 'GL', 'HF', 'HI', 'HS',
  'HP', 'HT', 'HU', 'HW', 'HY', 'HZ', 'IS', 'IP', 'LB', 'LE', 'LO', 'LS', 'LW',
  'RB', 'RH', 'SB', 'SC', 'SE', 'SI', 'SM', 'SN', 'SQ', 'SR', 'SU', 'TI', 'TR',
  'TS', 'TY', 'UP', 'VO', 'WC', 'WI', 'WS', 'WW', 'ZF', 'ZR'];

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

let currentTime = moment.utc('20180101', 'YYYYMMDD').valueOf();

function timeToPosition() {
  if (currentTime <= min) {
    return 1;
  }
  if (currentTime >= max) {
    return positionSteps;
  }

  return positionSteps - Math.ceil(((max - currentTime) / (max - min)) * positionSteps);
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
  const newValue = (currentTime - min) / dataStep;
  const newClasses = {};
  const changes = {};

  const previousKeys = Object.keys(previous);
  for (let i = 0; i < previousKeys.length; i += 1) {
    changes[previousKeys[i]] = [];
  }

  for (let i = 0; i < types.length; i += 1) {
    const type = types[i];
    const counties =
      (data[type] && data[type][newValue]) ? data[type][newValue] : [];

    for (let j = 0; j < counties.length; j += 1) {
      if (!newClasses[counties[j]]) {
        newClasses[counties[j]] = [type];
        changes[counties[j]] = [type];
      } else {
        newClasses[counties[j]].push(type);
        changes[counties[j]].push(type);
      }
    }
  }

  const changeKeys = Object.keys(changes);
  for (let i = 0; i < changeKeys.length; i += 1) {
    const county = changeKeys[i];
    const alertForMap = changes[county] ? changes[county][0] : '';
    const previousAlertForMap = previous[county] ? previous[county][0] : '';
    if (ignorePreviousState || alertForMap !== previousAlertForMap) {
      const color = alertColors[alertForMap] || '#cccccc';
      drawCounty(countyFeatures[county], color);
    }
  }

  previous = newClasses;
  document.getElementById('time').textContent = new Date(currentTime);
  document.getElementById('slider').value = timeToPosition();
  refreshHoverText();
}

function processSliderEvent() {
  const newValue = document.getElementById('slider').value;
  let stepSize = Math.floor((max - min) / positionSteps);
  stepSize -= (stepSize % step);
  const newTime = moment(min + (stepSize * newValue));
  currentTime = newTime.subtract(newTime.minutes() % 15, 'm').valueOf();
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
  if (paused || currentTime >= max) {
    window.setTimeout(handleChange, 25);
    return;
  }
  currentTime += step;
  redraw();
  window.setTimeout(handleChange, 25);
}

function handleMouseOver(d) {
  selectedCounty = d.id;
  refreshHoverText();
}

function handleMouseOut() {
  selectedCounty = '';
  refreshHoverText();
}

function drawBaseMap() {
  const counties = topojson.feature(us, us.objects.counties).features;

  context.beginPath();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 0.5;
  canvasPath(topojson.mesh(us));
  context.stroke();

  // TODO(jdhollen): just stamp the whiole country instead.
  for (let i = 0; i < counties.length; i += 1) {
    countyFeatures[counties[i].id] = counties[i];
    drawCounty(counties[i], '#ccc');
  }

  const keys = Object.keys(countyNames);
  for (let i = 0; i < keys.length; i += 1) {
    const element = document.getElementById(`county${keys[i]}`);
    if (element) {
      countyElementLookup[keys[i]] = element;
    }
  }
}

function loadWeatherData() {
  d3.json(
    'data/counties-smol.json',
    (error, counties) => {
      if (error) {
        throw error;
      }

      const countyKeys = Object.keys(counties);
      for (let i = 0; i < countyKeys.length; i += 1) {
        const county = counties[countyKeys[i]];
        const runs = Object.keys(county);
        for (let j = 0; j < runs.length; j += 1) {
          const run = county[j];
          let time = run[0] - 1;
          const length = run[1];
          const values = run[2];

          for (let k = 0; k < length; k += 1) {
            for (let l = 0; l < values.length; l += 1) {
              if (!data[values[l]]) {
                data[values[l]] = [];
              }
              if (!data[values[l]][time]) {
                data[values[l]][time] = [];
              }
              data[values[l]][time].push(countyKeys[i]);
            }
            time += 1;
          }
        }
      }
      handleChange();
    },
  );
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
  // TODO(jdhollen): replace 2 with pixel scaling for display.
  context.strokeStyle = '#ffffff';
  context.lineWidth = 0.5;
  context.scale(devicePixelRatio * scaleFactor, devicePixelRatio * scaleFactor);
  svg.attr('width', width);
  svg.attr('height', height);
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
      us = usData;
      if (error) {
        throw error;
      }
      svg.append('g')
        .attr('class', 'counties')
        .selectAll('path')
        .data(topojson.feature(us, us.objects.counties).features)
        .enter()
        .append('path')
        .attr('id', d => d.id)
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .attr('d', path);

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
sizeCanvas();
