/* global d3: false, topojson: false */
/* eslint-env browser */

/*
 * A view that renders the standard topojson Albers projection of the US into a
 * supplied canvas and svg.  The canvas and svg are assumed to be positioned
 * with the svg directly on top of the canvas.  The canvas is used to render
 * data for all counties, because svg rendering doesn't perform well on lots of
 * devices.  The SVG is still used, though, to give a crisp rendering of a
 * single selected county's outline--this allows selection to come and go
 * without worrying about aliasing in the canvas.
 *
 * This view exposes callback events for mouseover, mouseout, and click events.
 *
 * @param data the generated topojson file for this map.
 * @param canvas a canvas DOM element. This will be dynamically resized to fit
 *     the user's window, with a maximum width of 860px.
 * @param svg an svg DOM element. This should be absolutely positioned over the
 *     canvas and will by dynamically resized to match.
 * @param clickMap a 960*600-element Uint16Array where each value
 *     corresponds to an individual pixel in the Albers projection and holds the
 *     county that appears at that pixel.  It is used to quickly translate hover
 *     and click events on the canvas into a county without tracking 3000
 *     elements. I am basically trading the cost of the data transfer for speed
 *     in the browser.
 * @param alertRenderer a renderer that can generate colors
 */
export default class UsMap {
  constructor(data, canvas, svg, clickMap, alertRenderer) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.canvasPath = d3.geoPath().context(this.context);
    this.svg = d3.select(svg);
    this.path = d3.geoPath();
    this.us = data;
    this.alertRenderer = alertRenderer;
    this.clickMap = clickMap;

    // The currently rendered set of counties, stored as an object mapping the
    // county FIPS ID to the current set of alerts for that county.  If a county
    // has no alerts, it is not present.
    this.renderedCounties = {};

    const countyFeatures = [];
    const countyTopojson = topojson.feature(this.us, this.us.objects.counties).features;

    for (let i = 0; i < countyTopojson.length; i += 1) {
      countyFeatures[Number(countyTopojson[i].id)] = countyTopojson[i];
    }
    // A lookup table for getting the GeoJSON feature corresponding to a county.
    this.countyFeatures = countyFeatures;

    // A pre-computed outline of all of the counties in the US and a
    // pre-computed background fill for the entire country.  This speeds things
    // up when redrawing for browser resizes.
    this.meshed = topojson.mesh(this.us);
    this.nation = topojson.feature(this.us, this.us.objects.nation);

    // Aaaand a bunch of event listeners.
    canvas.addEventListener('mouseover', (e) => { this.handleMouseover(e); });
    canvas.addEventListener('mousemove', (e) => { this.handleMouseover(e); });
    canvas.addEventListener('mouseout', (e) => { this.handleMouseout(e); });
    canvas.addEventListener('click', (e) => { this.handleClick(e); });
    window.addEventListener('resize', () => this.redrawMapForResize());
    window.addEventListener('orientationchange', () => this.redrawMapForResize());
  }

  handleMouseover(e) {
    if (this.mouseoverCallback) {
      this.mouseoverCallback(this.getCountyIdForMouseCoords(e));
    }
  }

  handleMouseout(e) {
    if (this.mouseoutCallback) {
      this.mouseoutCallback(e);
    }
  }

  handleClick(e) {
    if (this.clickCallback) {
      this.clickCallback(this.getCountyIdForMouseCoords(e));
    }
  }

  getCountyIdForMouseCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const offsetTop = rect.top;
    const offsetLeft = rect.left;

    const ratio = 1 / (this.canvas.width / (960 * devicePixelRatio));
    const x = Math.floor(ratio * (e.clientX - offsetLeft));
    const y = Math.floor(ratio * (e.clientY - offsetTop));
    return this.clickMap[(x * 600) + y];
  }

  // Re-render the basemap quickly--this is ideal for window resizes.  It just
  // draws a grey country with a white outline for all counties on top of it.
  drawBaseMap() {
    this.context.beginPath();
    this.context.fillStyle = '#cccccc';
    this.canvasPath(this.nation);
    this.context.fill();

    this.context.beginPath();
    this.context.strokeStyle = '#ffffff';
    this.context.lineWidth = 0.5;
    this.canvasPath(this.meshed);
    this.context.stroke();
  }

  // Resizes canvas and svg so that they occupy a certain amount of window real
  // estate--curently a maximum width of 860px and a maximum height of 600px,
  // further clamped down by innerWidth and innerHeight.
  static setMapDimensions(canvas, svg) {
    const w = Math.min(860, window.innerWidth);
    const h = Math.max(300, Math.min(600, window.innerHeight - 100));
    const width = w * 0.625 < h ? w : h / 0.625;
    const height = width * 0.625;

    canvas.setAttribute('style', `width: ${width}px; height: ${height}px;`);

    // Fancy scaling crap for retina and friends.
    canvas.setAttribute('width', devicePixelRatio * width);
    canvas.setAttribute('height', devicePixelRatio * height);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    return width;
  }

  // Redraw all map content in response to a reorientation or resize event.
  redrawMapForResize() {
    const width = UsMap.setMapDimensions(this.canvas, this.svg.node());
    this.scaleFactor = width / 960;
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.strokeStyle = '#ffffff';
    this.context.lineWidth = 0.5;
    this.context.scale(devicePixelRatio * this.scaleFactor, devicePixelRatio * this.scaleFactor);
    this.drawBaseMap();
    this.redraw(this.renderedCounties, true);
  }

  // Sets the currently selected county to be highlighted on the map.
  setSelection(selection) {
    this.svg.selectAll('*').remove();
    if (selection) {
      this.svg.append('path')
        .attr('class', 'selectedCounty')
        .attr('d', this.path(this.countyFeatures[selection]));
    }
  }

  // Draws a single county on the canvas with the specified canvas fillStyle.
  drawCounty(countyId, fillStyle) {
    this.context.fillStyle = fillStyle;
    this.context.beginPath();
    this.canvasPath(this.countyFeatures[countyId]);
    this.context.fill();
    this.context.stroke();
  }

  // Redraws the map with the colors specified in newValues.  If
  // ignorePreviousState is true, all counties in newValues will be drawn--this
  // is useful for resize events.  Otherwise, by default, we track the currently
  // drawn state of the map and only re-draw those counties whose colors have
  // actually changed.
  redraw(newValues, ignorePreviousState) {
    // The set of all counties that either have a color right now or had one
    // before.
    const changes = {};

    const previousKeys = Object.keys(this.renderedCounties);
    for (let i = 0; i < previousKeys.length; i += 1) {
      // Start by assuming that all previously-displayed counties should be
      // rendered as having no data.
      changes[previousKeys[i]] = [];
    }
    const newKeys = Object.keys(newValues);
    for (let i = 0; i < newKeys.length; i += 1) {
      // Record all new data values into changes, and overwrite any of the
      // values already stored in the loop over previousKeys.
      changes[newKeys[i]] = newValues[newKeys[i]];
    }

    const changeKeys = Object.keys(changes);
    for (let i = 0; i < changeKeys.length; i += 1) {
      const countyId = changeKeys[i];
      const alertForMap = changes[countyId] ? changes[countyId][0] : 0;
      const previousAlertForMap =
        this.renderedCounties[countyId] ? this.renderedCounties[countyId][0] : 0;
      // Only redraw the county if its color actually changed (or if we were
      // explicitly told to ignore previous state).
      if (ignorePreviousState || alertForMap !== previousAlertForMap) {
        const color = this.alertRenderer.getColor(alertForMap);
        this.drawCounty(countyId, color);
      }
    }

    this.renderedCounties = newValues;
  }

  setClickCallback(callback) {
    this.clickCallback = callback;
  }

  setMouseoverCallback(callback) {
    this.mouseoverCallback = callback;
  }

  setMouseoutCallback(callback) {
    this.mouseoutCallback = callback;
  }
}
