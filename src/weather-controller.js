/* eslint-env browser */

export default class WeatherController {
  constructor(
    weather,
    legend,
    usMap,
    playPauseButton,
    speedButton,
    alertTypeHelper,
  ) {
    this.arr32 = new Uint32Array(weather, 0, (weather.byteLength - (weather.byteLength % 4)) / 4);
    this.arr16 = new Uint16Array(weather);
    this.min = this.arr32[0] * 1000;
    this.max = this.arr32[1] * 1000;
    this.dataStep = this.arr32[2] * 1000;
    this.legend = legend;
    this.usMap = usMap;
    this.playPauseButton = playPauseButton;
    this.speedButton = speedButton;
    this.alertTypeHelper = alertTypeHelper;

    // TODO(jdhollen): this should programatically be slider's max.
    this.positionSteps = 1000;

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

    this.currentTime = this.min;

    usMap.setClickCallback((id) => { this.handleCanvasClick(id); });
    usMap.setMouseoverCallback((id) => { this.handleMouseOver(id); });
    usMap.setMouseoutCallback(() => { this.handleMouseOut(); });
  }

  static datePad(v) {
    return v < 10 ? `0${v}` : v;
  }

  timeToPosition() {
    if (this.currentTime <= this.min) {
      return 1;
    }
    if (this.currentTime >= this.max - this.dataStep) {
      return this.positionSteps;
    }

    return (1 + this.positionSteps) -
      Math.ceil(((this.max - this.dataStep - this.currentTime)
        / (this.max - this.dataStep - this.min)) * this.positionSteps);
  }

  refreshHoverText() {
    const classes = this.previous[this.selectedCounty] || [];
    this.legend.setLegendContents(this.selectedCounty, classes);
  }

  redraw() {
    const newValue = (this.currentTime - this.min) / this.dataStep;
    const newClasses = {};

    let index16 = this.arr32[3 + newValue];

    while (this.arr16[index16] !== 0) {
      const av = this.arr16[index16];

      const length = this.arr16[index16 + 1];
      index16 += 2;
      for (let i = index16; i < index16 + length; i += 1) {
        const county = this.arr16[i];
        if (!newClasses[county]) {
          newClasses[county] = [av];
        } else {
          newClasses[county].push(av);
        }
      }
      index16 += length;
    }

    this.usMap.redraw(newClasses);
    this.usMap.updateSelectionSvg(this.clickedCounty);

    this.previous = newClasses;
    document.getElementById('time').textContent = this.getDateText();
    document.getElementById('slider').value = this.timeToPosition();
    this.refreshHoverText();
  }

  getDateText() {
    const d = new Date(this.currentTime);

    return `${d.getUTCFullYear()}-${WeatherController.datePad(d.getUTCMonth() + 1)}-${WeatherController.datePad(d.getUTCDate())} ${WeatherController.datePad(d.getUTCHours())}:${WeatherController.datePad(d.getUTCMinutes())} UTC`;
  }

  processSliderEvent() {
    const newValue = Number(document.getElementById('slider').value);
    if (newValue === 1) {
      this.currentTime = this.min;
    } else if (newValue === 1000) {
      this.currentTime = this.max - this.dataStep;
    } else {
      const stepSize = Math.floor((this.max - this.dataStep - this.min) / this.positionSteps);
      const offset =
        (stepSize * newValue) - ((stepSize * newValue) % (this.stepMultiplier * this.dataStep));
      this.currentTime = this.min + offset;
    }
    this.redraw();
  }

  refreshButtonState() {
    let newPlayPause;
    if (this.currentTime >= this.max - this.dataStep) {
      newPlayPause = 'reset';
    } else if (this.paused) {
      newPlayPause = 'play';
    } else {
      newPlayPause = 'pause';
    }

    if (this.playPauseButton.className !== newPlayPause) {
      this.playPauseButton.className = newPlayPause;
    }

    const newSpeed = `speed${this.speed + 1}`;
    if (this.speedButton.className !== newSpeed) {
      this.speedButton.className = newSpeed;
    }
  }

  maybeRunStep() {
    this.refreshButtonState();
    if (this.paused || (!this.rewind && this.currentTime >= this.max - this.dataStep)) {
      window.setTimeout(() => { this.maybeRunStep(); }, this.stepDelay);
      return;
    } else if (this.rewind && this.currentTime <= this.min) {
      this.paused = true;
      window.setTimeout(() => { this.maybeRunStep(); }, this.stepDelay);
      return;
    }
    this.currentTime += (this.stepMultiplier * this.dataStep) * (this.rewind ? -1 : 1);
    this.currentTime = Math.max(this.min, Math.min(this.currentTime, this.max - this.dataStep));
    this.redraw();
    window.setTimeout(() => { this.maybeRunStep(); }, this.stepDelay);
  }

  handleMouseOver(id) {
    if (this.clickedCounty) {
      return;
    }

    this.selectedCounty = id;
    this.refreshHoverText();
  }

  handleCanvasClick(id) {
    if (id > 0) {
      this.selectedCounty = id;
    } else {
      this.selectedCounty = 0;
    }

    if (this.clickedCounty === this.selectedCounty) {
      this.clickedCounty = 0;
    } else {
      this.clickedCounty = this.selectedCounty;
    }

    this.usMap.updateSelectionSvg(this.clickedCounty);
    this.refreshHoverText();
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

  handlePlayPauseResetClick() {
    if (this.rewind) {
      this.speed = this.speedBeforeRewind;
      this.resetStepForSpeed();
    }

    if (this.currentTime >= this.max - this.dataStep) {
      this.currentTime = this.min;
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
    if (this.currentTime === this.min) {
      return;
    }
    this.rewind = false;
    this.paused = true;
    this.currentTime -= this.dataStep;
    this.redraw();
  }

  handleForwardClick() {
    if (this.rewind) {
      this.speed = this.speedBeforeRewind;
      this.resetStepForSpeed();
    }
    if (this.currentTime === this.max - this.dataStep) {
      return;
    }
    this.rewind = false;
    this.paused = true;
    this.currentTime += this.dataStep;
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
    const numSteps = (this.max - this.min) / this.dataStep;
    let currentSteps = (this.currentTime - this.min) / this.dataStep;
    currentSteps += (currentSteps % this.stepMultiplier);
    currentSteps = Math.min(numSteps - 1, currentSteps);
    this.currentTime = this.min + (currentSteps * this.dataStep);
  }

  handleRewindClick() {
    if (this.currentTime <= this.min) {
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
