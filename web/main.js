/* global d3: false, topojson: false, moment: false */
/* eslint-env browser */

const svg = d3.select('#map');
const data = {};
let countyNames = {};
let alertNames = {};
let loadedIndex = 0;
let selectedCounty = '';
let previous = [];
let paused = false;
let pausedBeforeInputStarted = false;
let slideInProgress = false;
const min = moment.utc('20180101', 'YYYYMMDD').valueOf();
const max = moment.utc('20180501', 'YYYYMMDD').valueOf();
const positionSteps = 1000;

const types = [
  'SV', 'TO', 'MA', 'AF', 'AS', 'AV', 'BH', 'BS', 'BZ', 'CF', 'DU', 'DS', 'EC',
  'EH', 'EW', 'FA', 'FF', 'FL', 'FR', 'FZ', 'FG', 'FW', 'GL', 'HF', 'HI', 'HS',
  'HP', 'HT', 'HU', 'HW', 'HY', 'HZ', 'IS', 'IP', 'LB', 'LE', 'LO', 'LS', 'LW',
  'RB', 'RH', 'SB', 'SC', 'SE', 'SI', 'SM', 'SN', 'SQ', 'SR', 'SU', 'TI', 'TR',
  'TS', 'TY', 'UP', 'VO', 'WC', 'WI', 'WS', 'WW', 'ZF', 'ZR'];

let currentTime = moment.utc('20180101', 'YYYYMMDD');

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

  let countyId = selectedCounty;
  if (selectedCounty[0] === '0') {
    countyId = countyId.substring(1);
  }

  const stateName = countyNames[`${(countyId - (countyId % 1000))}`];
  const fullName = `${countyNames[countyId]}, ${stateName}`;

  const classString =
    document.getElementById(`county${selectedCounty}`).getAttribute('class');

  let classes = [];
  if (classString) {
    classes = classString.split(' ');
  }

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

function redraw() {
  const newValue = currentTime.format('YYYYMMDDHHmm');

  for (let i = 0; i < previous.length; i += 1) {
    previous[i].setAttribute('class', '');
  }
  previous = [];

  for (let i = 0; i < types.length; i += 1) {
    const type = types[i];
    const counties =
      (data[type] && data[type][newValue]) ? data[type][newValue] : [];

    for (let j = 0; j < counties.length; j += 1) {
      const el = document.getElementById(`county${counties[j]}`);
      if (el) {
        previous.push(el);
        el.classList.add(type);
      }
    }
  }

  document.getElementById('time').textContent =
    currentTime.format('YYYY-MM-DD HH:mm');
  document.getElementById('slider').value = timeToPosition();
  refreshHoverText();
}

function processSliderEvent() {
  const newValue = document.getElementById('slider').value;
  const newTime =
    moment(min + (Math.floor((max - min) / positionSteps) * newValue));
  currentTime = newTime.subtract(newTime.minutes() % 15, 'm');
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
  if (paused || currentTime.valueOf() >= max) {
    window.setTimeout(handleChange, 25);
    return;
  }
  currentTime = currentTime.add(60, 'm');
  redraw();
  window.setTimeout(handleChange, 25);
}

function handleMouseOver(d) {
  selectedCounty = d.id;
  refreshHoverText();
}

function handleMouseOut(d) {
  if (d.id === selectedCounty) {
    selectedCounty = '';
  }
  refreshHoverText();
}

function drawBaseMap(us) {
  const path = d3.geoPath();
  svg.append('g')
    .attr('class', 'counties')
    .selectAll('path')
    .data(topojson.feature(us, us.objects.counties).features)
    .enter()
    .append('path')
    .attr('id', d => `county${d.id}`)
    .on('mouseover', handleMouseOver)
    .on('mouseout', handleMouseOut)
    .attr('d', path);

  svg.append('path')
    .attr('class', 'county-borders')
    .attr('d', path(topojson.mesh(us, us.objects.counties, (a, b) => a !== b)));
}

function loadWeatherData() {
  loadedIndex += 1;
  d3.json(
    `data/outfile-${types[loadedIndex - 1]}.json`,
    (error, days) => {
      if (error && loadedIndex < types.length) {
        loadWeatherData();
        return;
      } else if (error) {
        handleChange();
        return;
      }

      data[types[loadedIndex - 1]] = days;

      if (loadedIndex < types.length) {
        loadWeatherData();
      } else {
        handleChange();
      }
    },
  );
}

function sizeSvg() {
  const w = Math.min(860, window.innerWidth);
  const h = Math.max(300, Math.min(600, window.innerHeight - 100));
  const width = w * 0.625 < h ? w : h / 0.625;

  svg.attr('width', `${width - 2}px`);
}

function handlePlayPauseClick() {
  paused = !paused;
}

// TODO(jdhollen): move everything below here to an onload event.
function loadMapData() {
  d3.json(
    'data/10m.json',
    (error, us) => {
      if (error) {
        throw error;
      }

      drawBaseMap(us);
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

window.addEventListener('resize', sizeSvg);
sizeSvg();
