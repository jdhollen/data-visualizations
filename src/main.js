/* global d3: false, topojson: false */
/* eslint-env browser */
/* eslint no-use-before-define: ['error', 'nofunc'] */
/* eslint no-bitwise: ['error', { 'allow': ['&', '|'] }] */

/*
 * A canvas is used to render the actual alert map and county colors because
 * canvas rendering performs better than SVGs (way less memory used than
 * creating 3000 paths).  We only use an SVG for rendering the user's selection.
 */
const canvas = document.getElementById('map');
const context = canvas.getContext('2d');
const canvasPath = d3.geoPath().context(context);

/*
 * An SVG is used to render the red selection outline for counties.  On the
 * canvas, when we draw outlines / shade in counties, we just "re-stamp" the
 * county shape over the map.  Drawing a red border in the canvas leads to
 * anti-aliasing, which leaves behind a weird red feathering effect when a
 * county is deselected.  Using an SVG just for selection makes the selection
 * look sharp without paying the price of rendering the whole map in SVG land.
 */
const svg = d3.select('#svg');
const path = d3.geoPath();

// Grab a bunch of DOM elements, yada yada.
const rewindButton = document.getElementById('rewind');
const backButton = document.getElementById('oneBackward');
const playPauseButton = document.getElementById('playPause');
const forwardButton = document.getElementById('oneForward');
const speedButton = document.getElementById('speed');
const legend = document.getElementById('legend');

const min = 1514764800000;
const max = 1526947200000;
const dataStep = 15 * 60 * 1000;
const positionSteps = 1000;

const alertTypeNames = {
  0x8000: 'Warning',
  0x4000: 'Advisory',
  0x2000: 'Watch',
  0x1000: 'Statement',
};

const alertTypeShortNames = {
  0x8000: 'Wrn',
  0x4000: 'Adv',
  0x2000: 'Wtch',
  0x1000: 'Stmt',
};

const alertTypeCodes = {
  0x8000: 'W',
  0x4000: 'Y',
  0x2000: 'A',
  0x1000: 'S',
};

const types = [
  'NONE',
  'RH', 'VO', 'AF', 'TS', 'TO', 'HU', 'TY', 'EW', 'HF', 'HI', 'TR', 'SV', 'BZ',
  'SQ', 'WS', 'DS', 'WW', 'IS', 'LB', 'LE', 'HS', 'HP', 'SS', 'FF', 'SB', 'SN',
  'BS', 'IP', 'ZR', 'SR', 'GL', 'TI', 'SM', 'AV', 'DU', 'CF', 'LS', 'FA', 'FL',
  'HY', 'ZF', 'FG', 'FW', 'HW', 'WI', 'EC', 'EH', 'HZ', 'HT', 'FZ', 'LW', 'WC',
  'UP', 'SE', 'SU', 'BH', 'LO', 'MA', 'SC', 'SI', 'RB', 'FR', 'AS', 'RP'];

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
  SSS: '#8B0000',
  SSW: '#8B0000',
  SSA: '#2E8B57',
  SSY: '#2E8B57',
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

class WeatherMap {
  constructor(weather, clicks, alerts, counties, map) {
    this.arr32 = new Uint32Array(weather, 0, (weather.byteLength - (weather.byteLength % 4)) / 4);
    this.arr16 = new Uint16Array(weather);

    this.countyNames = counties;
    this.alertNames = alerts;
    this.clicks16 = new Uint16Array(clicks);
    this.us = map;
    const countyFeatures = [];
    const countyTopojson = topojson.feature(this.us, this.us.objects.counties).features;

    for (let i = 0; i < countyTopojson.length; i += 1) {
      countyFeatures[Number(countyTopojson[i].id)] = countyTopojson[i];
    }
    this.meshed = topojson.mesh(this.us);
    this.nation = topojson.feature(this.us, this.us.objects.nation);

    this.countyFeatures = countyFeatures;
    this.selectedCounty = 0;
    this.clickedCounty = 0;
    this.previous = {};
    this.paused = false;
    this.scaleFactor = 1;
    this.speed = 3;
    this.speedBeforeRewind = 3;
    this.stepDelay = 24; // or 48, or 96.
    this.stepMultiplier = 2;
    this.rewind = false;

    this.currentTime = min;
  }

  timeToPosition() {
    if (this.currentTime <= min) {
      return 1;
    }
    if (this.currentTime >= max - dataStep) {
      return positionSteps;
    }

    return (1 + positionSteps) -
      Math.ceil(((max - dataStep - this.currentTime) / (max - dataStep - min)) * positionSteps);
  }

  refreshHoverText() {
    if (!this.selectedCounty) {
      legend.innerHTML = '<span class="legendTitle">Select a county to see alerts.</span>';
      return;
    }

    const stateName = this.countyNames[this.selectedCounty - (this.selectedCounty % 1000)];
    const fullName = `${this.countyNames[this.selectedCounty]}, ${stateName}`;
    const classes = this.previous[this.selectedCounty] || [];

    let alerts = '';
    for (let i = 0; i < classes.length; i += 1) {
      const av = classes[i];
      const alertId = av & 0xff;
      const alertType = av & 0xff00;
      const alert = this.alertNames[types[alertId]];
      const alertColor = alertColors[`${types[alertId]}${alertTypeCodes[alertType]}`];
      const alertSuffix = (window.innerWidth >= 375)
        ? alertTypeNames[alertType] : alertTypeShortNames[alertType];
      if (alert) {
        alerts = alerts.concat(`<div class="legendItem"><div class="legendSquare" style="background-color:${alertColor};"></div>${alert} ${alertSuffix}</div>`);
      }
    }
    if (!alerts) {
      alerts = '<div class="legendItem">No alerts</div>';
    }

    legend.innerHTML = `<span class="legendTitle">${fullName}</span>${alerts}`;
  }

  updateSelectionSvg() {
    svg.selectAll('*').remove();
    if (this.clickedCounty) {
      svg.append('path')
        .attr('class', 'selectedCounty')
        .attr('d', path(this.countyFeatures[this.clickedCounty]));
    }
  }

  redraw(ignorePreviousState) {
    const newValue = (this.currentTime - min) / dataStep;
    const newClasses = {};
    const changes = {};

    const previousKeys = Object.keys(this.previous);
    for (let i = 0; i < previousKeys.length; i += 1) {
      changes[previousKeys[i]] = [];
    }

    let index16 = this.arr32[3 + newValue];

    while (true) {
      const av = this.arr16[index16];
      const alertId = av & 0xff;
      if (alertId === 0) {
        break;
      }
      const length = this.arr16[index16 + 1];
      index16 += 2;
      for (let i = index16; i < index16 + length; i += 1) {
        const county = this.arr16[i];
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
      const alertForMap = changes[countyId] ? changes[countyId][0] : '';
      const previousAlertForMap = this.previous[countyId] ? this.previous[countyId][0] : '';
      if (ignorePreviousState || alertForMap !== previousAlertForMap) {
        const alertString = types[alertForMap & 0xff] + alertTypeCodes[alertForMap & 0xff00];
        const color = alertColors[alertString] || '#cccccc';
        drawCounty(this.countyFeatures[countyId], color);
      }
    }

    this.updateSelectionSvg();

    this.previous = newClasses;
    document.getElementById('time').textContent = this.getDateText();
    document.getElementById('slider').value = this.timeToPosition();
    this.refreshHoverText();
  }

  getDateText() {
    const d = new Date(this.currentTime);

    return `${d.getUTCFullYear()}-${datePad(d.getUTCMonth() + 1)}-${datePad(d.getUTCDate())} ${datePad(d.getUTCHours())}:${datePad(d.getUTCMinutes())} UTC`;
  }

  processSliderEvent() {
    const newValue = Number(document.getElementById('slider').value);
    if (newValue === 1) {
      this.currentTime = min;
    } else if (newValue === 1000) {
      this.currentTime = max - dataStep;
    } else {
      const stepSize = Math.floor((max - dataStep - min) / positionSteps);
      const offset =
        (stepSize * newValue) - ((stepSize * newValue) % (this.stepMultiplier * dataStep));
      this.currentTime = min + offset;
    }
    this.redraw();
  }

  refreshButtonState() {
    let newPlayPause;
    if (this.currentTime >= max - dataStep) {
      newPlayPause = 'reset';
    } else if (this.paused) {
      newPlayPause = 'play';
    } else {
      newPlayPause = 'pause';
    }

    if (playPauseButton.className !== newPlayPause) {
      playPauseButton.className = newPlayPause;
    }

    const newSpeed = `speed${this.speed + 1}`;
    if (speedButton.className !== newSpeed) {
      speedButton.className = newSpeed;
    }
  }

  maybeRunStep() {
    this.refreshButtonState();
    if (this.paused || (!this.rewind && this.currentTime >= max - dataStep)) {
      window.setTimeout(() => { this.maybeRunStep(); }, this.stepDelay);
      return;
    } else if (this.rewind && this.currentTime <= min) {
      this.paused = true;
      window.setTimeout(() => { this.maybeRunStep(); }, this.stepDelay);
      return;
    }
    this.currentTime += (this.stepMultiplier * dataStep) * (this.rewind ? -1 : 1);
    this.currentTime = Math.max(min, Math.min(this.currentTime, max - dataStep));
    this.redraw();
    window.setTimeout(() => { this.maybeRunStep(); }, this.stepDelay);
  }

  handleMouseOver(e) {
    if (this.clickedCounty) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const offsetTop = rect.top;
    const offsetLeft = rect.left;

    const ratio = 1 / (canvas.width / (960 * devicePixelRatio));
    const x = Math.floor(ratio * (e.clientX - offsetLeft));
    const y = Math.floor(ratio * (e.clientY - offsetTop));

    if (this.clicks16) {
      const id = this.clicks16[(x * 600) + y];
      this.selectedCounty = id;
    }
    this.refreshHoverText();
  }

  handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const offsetTop = rect.top;
    const offsetLeft = rect.left;

    const ratio = 1 / (canvas.width / (960 * devicePixelRatio));
    const x = Math.floor(ratio * (e.clientX - offsetLeft));
    const y = Math.floor(ratio * (e.clientY - offsetTop));

    if (this.clicks16) {
      const id = this.clicks16[(x * 600) + y];
      if (id > 0) {
        this.selectedCounty = id;
      } else {
        this.selectedCounty = 0;
      }
    }
    if (this.clickedCounty === this.selectedCounty) {
      this.clickedCounty = 0;
    } else {
      this.clickedCounty = this.selectedCounty;
    }

    this.updateSelectionSvg();
    this.refreshHoverText();
  }

  drawBaseMap() {
    context.beginPath();
    context.fillStyle = '#cccccc';
    canvasPath(this.nation);
    context.fill();

    context.beginPath();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 0.5;
    canvasPath(this.meshed);
    context.stroke();
  }


  handleSliderInputEvent() {
    this.processSliderEvent();
  }

  handleSliderChangeEvent() {
    this.processSliderEvent();
  }

  handleMouseOut() {
    if (this.clickedCounty) {
      return;
    }
    this.selectedCounty = 0;
    this.refreshHoverText();
  }

  sizeCanvas() {
    const w = Math.min(860, window.innerWidth);
    const h = Math.max(300, Math.min(600, window.innerHeight - 100));
    const width = w * 0.625 < h ? w : h / 0.625;
    const height = width * 0.625;

    canvas.setAttribute('style', `width: ${width}px; height: ${height}px;`);
    canvas.width = devicePixelRatio * width;
    canvas.height = devicePixelRatio * height;
    svg.attr('width', width);
    svg.attr('height', height);
    this.scaleFactor = width / 960;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 0.5;
    context.scale(devicePixelRatio * this.scaleFactor, devicePixelRatio * this.scaleFactor);
    if (this.us) {
      this.drawBaseMap();
      this.redraw(true);
    }
  }

  handlePlayPauseResetClick() {
    if (this.rewind) {
      this.speed = this.speedBeforeRewind;
      this.resetStepForSpeed();
    }

    if (this.currentTime >= max - dataStep) {
      this.currentTime = min;
      this.rewind = false;
      this.paused = false;
    } else {
      this.rewind = false;
      this.paused = !this.paused;
    }
  }

  handleBackwardClick() {
    if (this.rewind) {
      this.speed = this.speedBeforeRewind;
      this.resetStepForSpeed();
    }
    if (this.currentTime === min) {
      return;
    }
    this.rewind = false;
    this.paused = true;
    this.currentTime -= dataStep;
    this.redraw();
  }

  handleForwardClick() {
    if (this.rewind) {
      this.speed = this.speedBeforeRewind;
      this.resetStepForSpeed();
    }
    if (this.currentTime === max - dataStep) {
      return;
    }
    this.rewind = false;
    this.paused = true;
    this.currentTime += dataStep;
    this.redraw();
  }

  handleSpeedClick() {
    this.speed = (this.speed + 1) % 5;
    this.resetStepForSpeed();
    this.redraw();
  }

  resetStepForSpeed() {
    switch (this.speed) {
      case 0:
        this.stepDelay = 96;
        this.stepMultiplier = 1;
        break;
      case 1:
        this.stepDelay = 48;
        this.stepMultiplier = 1;
        break;
      case 2:
        this.stepDelay = 24;
        this.stepMultiplier = 1;
        break;
      case 3:
        this.stepDelay = 24;
        this.stepMultiplier = 2;
        break;
      case 4:
        this.stepDelay = 24;
        this.stepMultiplier = 4;
        break;
      default:
        this.stepDelay = 24;
        this.stepMultiplier = 1;
        break;
    }
    const numSteps = (max - min) / dataStep;
    let currentSteps = (this.currentTime - min) / dataStep;
    currentSteps += (currentSteps % this.stepMultiplier);
    currentSteps = Math.min(numSteps - 1, currentSteps);
    this.currentTime = min + (currentSteps * dataStep);
  }

  handleRewindClick() {
    if (this.currentTime <= min) {
      this.rewind = false;
      return;
    }
    if (this.rewind) {
      this.speed = Math.min(4, this.speed + 1);
      this.resetStepForSpeed();
    } else {
      this.speedBeforeRewind = this.speed;
    }
    this.rewind = true;
    this.paused = false;
  }
}

function drawCounty(county, fillStyle) {
  context.fillStyle = fillStyle;
  context.beginPath();
  canvasPath(county);
  context.fill();
  context.stroke();
}

function datePad(v) {
  return v < 10 ? `0${v}` : v;
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
  let weatherResult;
  let clicksResult;
  let alertsResult;
  let countiesResult;
  let mapResult;

  const weather = fetch('data/weather-type-2018.dat')
    .then(getBuf).then((r) => { weatherResult = r; });
  const clicks = fetch('data/clicks.dat')
    .then(getBuf).then((r) => { clicksResult = r; });
  const alerts = fetch('data/alert-names.json')
    .then(getJson).then((r) => { alertsResult = r; });
  const counties = fetch('data/county-names.json')
    .then(getJson).then((r) => { countiesResult = r; });
  const map = fetch('data/10m.json').then(getJson).then((r) => { mapResult = r; });

  Promise.all([weather, clicks, alerts, counties, map]).then(() =>
    init(weatherResult, clicksResult, alertsResult, countiesResult, mapResult));
}

function init(weather, clicks, alerts, counties, map) {
  const weatherMap = new WeatherMap(weather, clicks, alerts, counties, map);
  weatherMap.sizeCanvas();
  weatherMap.maybeRunStep();

  document.getElementById('slider').addEventListener('change', (e) => { weatherMap.handleSliderChangeEvent(e); });
  document.getElementById('slider').addEventListener('input', (e) => { weatherMap.handleSliderInputEvent(e); });
  playPauseButton.addEventListener('click', () => weatherMap.handlePlayPauseResetClick());
  forwardButton.addEventListener('click', () => weatherMap.handleForwardClick());
  backButton.addEventListener('click', () => weatherMap.handleBackwardClick());
  speedButton.addEventListener('click', () => weatherMap.handleSpeedClick());
  rewindButton.addEventListener('click', () => weatherMap.handleRewindClick());

  window.addEventListener('resize', () => weatherMap.sizeCanvas());
  window.addEventListener('orientationchange', (e) => { weatherMap.sizeCanvas(e); });
  canvas.addEventListener('mouseover', (e) => { weatherMap.handleMouseOver(e); });
  canvas.addEventListener('mousemove', (e) => { weatherMap.handleMouseOver(e); });
  canvas.addEventListener('mouseout', (e) => { weatherMap.handleMouseOut(e); });
  canvas.addEventListener('click', (e) => { weatherMap.handleCanvasClick(e); });
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
