/* eslint-env browser */

import AlertRenderer from './alert-renderer';
import CountyRenderer from './county-renderer';
import Legend from './legend';
import UsMap from './us-map';
import WeatherController from './weather-controller';

function getJson(r) {
  return r.json();
}

function getBuf(r) {
  return r.arrayBuffer();
}

function createControllerAndStartAnimation(weather, alertRenderer, countyRenderer, usMap) {
  // Grab a bunch of DOM elements, yada yada.
  const rewindButton = document.getElementById('rewind');
  const backButton = document.getElementById('oneBackward');
  const playPauseButton = document.getElementById('playPause');
  const forwardButton = document.getElementById('oneForward');
  const speedButton = document.getElementById('speed');
  const legendElement = document.getElementById('legend');
  const timeDisplay = document.getElementById('time');
  const slider = document.getElementById('slider');

  const legend = new Legend(legendElement, countyRenderer, alertRenderer);

  const weatherController = new WeatherController(
    weather,
    legend,
    usMap,
    slider,
    timeDisplay,
    playPauseButton,
    forwardButton,
    backButton,
    rewindButton,
    speedButton,
  );
  weatherController.run();
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


function main() {
  // Set up the map size early--this minimizes the amount of time that it takes
  // for the screen to take on its final shape, which looks better even though
  // nothing will render for a bit yet.
  const canvas = document.getElementById('map');
  const svg = document.getElementById('svg');
  UsMap.setMapDimensions(canvas, svg);

  const alertRenderer = new AlertRenderer();
  let weatherBuffer;
  let clickMapBuffer;
  let countyRenderer;
  let mapJson;
  let usMap;

  const weather = fetch('data/weather-type-900-1514764800.dat')
    .then(getBuf).then((r) => { weatherBuffer = r; });
  const clicks = fetch('data/click-map.dat')
    .then(getBuf).then((r) => { clickMapBuffer = r; });
  const counties = fetch('data/county-names.json')
    .then(getJson).then((r) => { countyRenderer = new CountyRenderer(r); });
  const mapData = fetch('data/us-10m.json').then(getJson).then((r) => { mapJson = r; });

  // Create the US map early--again, just to get something on the screen ASAP.
  const map = Promise.all([clicks, mapData]).then(() => {
    usMap = new UsMap(mapJson, canvas, svg, new Uint16Array(clickMapBuffer), alertRenderer);
    usMap.redrawMapForResize();
  });

  Promise.all([weather, counties, map]).then(() =>
    createControllerAndStartAnimation(weatherBuffer, alertRenderer, countyRenderer, usMap));
}

// Okay! Time to actually do something.  Check if the browser supports fetch()
// and Promises--if it doesn't, load a polyfill.  Once that's done, we actually
// spin up the visualization (hooray!).
if (checkFetchAndPromiseSupport()) {
  main();
} else {
  loadPolyfills(main);
}
