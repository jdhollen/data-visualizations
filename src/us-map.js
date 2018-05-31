/* global d3: false, topojson: false */
/* eslint-env browser */

export default class UsMap {
  constructor(data, canvas, svg, clicks, alertTypeHelper) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.canvasPath = d3.geoPath().context(this.context);
    this.svg = d3.select(svg);
    this.path = d3.geoPath();
    this.us = data;
    this.alertTypeHelper = alertTypeHelper;
    this.clicks16 = new Uint16Array(clicks);

    this.renderedCounties = {};

    const countyFeatures = [];
    const countyTopojson = topojson.feature(this.us, this.us.objects.counties).features;

    for (let i = 0; i < countyTopojson.length; i += 1) {
      countyFeatures[Number(countyTopojson[i].id)] = countyTopojson[i];
    }
    this.countyFeatures = countyFeatures;

    this.meshed = topojson.mesh(this.us);
    this.nation = topojson.feature(this.us, this.us.objects.nation);

    canvas.addEventListener('mouseover', (e) => { this.handleMouseover(e); });
    canvas.addEventListener('mousemove', (e) => { this.handleMouseover(e); });
    canvas.addEventListener('mouseout', (e) => { this.handleMouseout(e); });
    canvas.addEventListener('click', (e) => { this.handleClick(e); });
    window.addEventListener('resize', () => this.sizeCanvas());
    window.addEventListener('orientationchange', () => this.sizeCanvas());
  }

  handleMouseover(e) {
    if (this.mouseoverCallback) {
      this.mouseoverCallback(this.getCountyIdForMouseCoords(e));
    }
  }

  handleMouseout() {
    if (this.mouseoutCallback) {
      this.mouseoutCallback();
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
    return this.clicks16[(x * 600) + y];
  }

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

  static setMapDimensions(canvas, svg) {
    const w = Math.min(860, window.innerWidth);
    const h = Math.max(300, Math.min(600, window.innerHeight - 100));
    const width = w * 0.625 < h ? w : h / 0.625;
    const height = width * 0.625;

    canvas.setAttribute('style', `width: ${width}px; height: ${height}px;`);
    canvas.setAttribute('width', devicePixelRatio * width);
    canvas.setAttribute('height', devicePixelRatio * height);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    return width;
  }

  sizeCanvas() {
    const width = UsMap.setMapDimensions(this.canvas, this.svg.node());
    this.scaleFactor = width / 960;
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.strokeStyle = '#ffffff';
    this.context.lineWidth = 0.5;
    this.context.scale(devicePixelRatio * this.scaleFactor, devicePixelRatio * this.scaleFactor);
    this.drawBaseMap();
    this.redraw(this.renderedCounties, true);
  }

  updateSelectionSvg(clickedCounty) {
    this.svg.selectAll('*').remove();
    if (clickedCounty) {
      this.svg.append('path')
        .attr('class', 'selectedCounty')
        .attr('d', this.path(this.countyFeatures[clickedCounty]));
    }
  }

  drawCounty(countyId, fillStyle) {
    this.context.fillStyle = fillStyle;
    this.context.beginPath();
    this.canvasPath(this.countyFeatures[countyId]);
    this.context.fill();
    this.context.stroke();
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

  redraw(newValues, ignorePreviousState) {
    const changes = {};

    const previousKeys = Object.keys(this.renderedCounties);
    for (let i = 0; i < previousKeys.length; i += 1) {
      changes[previousKeys[i]] = [];
    }
    const newKeys = Object.keys(newValues);
    for (let i = 0; i < newKeys.length; i += 1) {
      changes[newKeys[i]] = newValues[newKeys[i]];
    }

    const changeKeys = Object.keys(changes);
    for (let i = 0; i < changeKeys.length; i += 1) {
      const countyId = changeKeys[i];
      const alertForMap = changes[countyId] ? changes[countyId][0] : 0;
      const previousAlertForMap =
        this.renderedCounties[countyId] ? this.renderedCounties[countyId][0] : 0;
      if (ignorePreviousState || alertForMap !== previousAlertForMap) {
        const color = this.alertTypeHelper.getColor(alertForMap);
        this.drawCounty(countyId, color);
      }
    }

    this.renderedCounties = newValues;
  }
}
