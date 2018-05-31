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

// Given the loaded
function createControllerAndSetUpListeners(weather, alertRenderer, countyRenderer, usMap) {
  // Grab a bunch of DOM elements, yada yada.
  const rewindButton = document.getElementById('rewind');
  const backButton = document.getElementById('oneBackward');
  const playPauseButton = document.getElementById('playPause');
  const forwardButton = document.getElementById('oneForward');
  const speedButton = document.getElementById('speed');
  const legendElement = document.getElementById('legend');

  // Initialize the map, start it running, and then hook up event listeners.
  // Bluntly, it's more straightforward to not handle user input for a bit than
  // it is to receive the events but do nothing.
  const legend = new Legend(legendElement, countyRenderer, alertRenderer);
  const weatherMap = new WeatherController(weather, legend, usMap, playPauseButton, speedButton);
  weatherMap.maybeRunStep();

  document.getElementById('slider').addEventListener('change', (e) => { weatherMap.handleSliderChangeEvent(e); });
  document.getElementById('slider').addEventListener('input', (e) => { weatherMap.handleSliderInputEvent(e); });
  playPauseButton.addEventListener('click', () => weatherMap.handlePlayPauseResetClick());
  forwardButton.addEventListener('click', () => weatherMap.handleForwardClick());
  backButton.addEventListener('click', () => weatherMap.handleBackwardClick());
  speedButton.addEventListener('click', () => weatherMap.handleSpeedClick());
  rewindButton.addEventListener('click', () => weatherMap.handleRewindClick());
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
  const alertRenderer = new AlertRenderer();

  const canvas = document.getElementById('map');
  const svg = document.getElementById('svg');
  UsMap.setMapDimensions(canvas, svg);

  let weatherResult;
  let clicksResult;
  let countyRenderer;
  let mapDataResult;
  let usMap;

  const weather = fetch('data/weather-type-2018.dat')
    .then(getBuf).then((r) => { weatherResult = r; });
  const clicks = fetch('data/click-map.dat')
    .then(getBuf).then((r) => { clicksResult = r; });
  const counties = fetch('data/county-names.json')
    .then(getJson).then((r) => { countyRenderer = new CountyRenderer(r); });
  const mapData = fetch('data/us-10m.json').then(getJson).then((r) => { mapDataResult = r; });
  const map = Promise.all([clicks, mapData]).then(() => {
    usMap = new UsMap(mapDataResult, canvas, svg, clicksResult, alertRenderer);
    usMap.sizeCanvas();
  });

  Promise.all([weather, counties, map]).then(() =>
    createControllerAndSetUpListeners(weatherResult, alertRenderer, countyRenderer, usMap));
}

// Okay! Time to actually do something.  Check if the browser supports fetch()
// and Promises--if it doesn't, load a polyfill.  Once that's done, we actually
// spin up the visualization (hooray!).
if (checkFetchAndPromiseSupport()) {
  main();
} else {
  loadPolyfills(main);
}
