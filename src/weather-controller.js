/* eslint-env browser */

/* The main controller for the WWA animation. */
export default class WeatherController {
  /*
   * This constructor takes a binary flatfile for weather data in the "weather"
   * parameter.  Its format is as follows:
   *
   * [4 bytes]: the start timestamp in seconds since the epoch.
   * [4 bytes]: the end timestamp in seconds since the epoch.
   * [4 bytes]: the size of each time step in the data in seconds.
   * [4 * (end - start) / timeStep]: offsets at which each time step's data is
   *    held, if weather is instead read as a Uint16Array.
   *
   * Each step is then encoded as follows:
   * [2 bytes] : alertId, or 0 for DONE.
   * [2 bytes] : number of counties with this alert.
   * [2 bytes * numCounties] : FIPS code for the county with an active alert for
   *     id alertId.
   *
   * @param weather the weather data, as specified above.
   * @param legend a Legend that will be made to display the selected or hovered
   *     map element.
   * @param usMap a UsMap that will display color-coded counties according to
   *     the "most serious" warning currently out for those counties.
   * @param slider an input range DOM element for quickly changing the displayed
   *     time in the animation.
   * @param timeDisplay a simple DOM element for displaying the current timestep
   *     in the animation.
   */
  constructor(
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
  ) {
    this.arr32 = new Uint32Array(weather, 0, (weather.byteLength - (weather.byteLength % 4)) / 4);
    this.arr16 = new Uint16Array(weather);
    this.minTime = this.arr32[0] * 1000;
    this.maxTime = this.arr32[1] * 1000;
    this.dataStep = this.arr32[2] * 1000;
    this.lastStep = this.maxTime - this.dataStep;
    this.legend = legend;
    this.usMap = usMap;
    this.playPauseButton = playPauseButton;
    this.speedButton = speedButton;
    this.slider = slider;
    this.timeDisplay = timeDisplay;
    this.sliderMax = Number(slider.getAttribute('max'));

    // The current county selected by the user: either the last clicked county,
    // or the currently hovered county if no county is actively clicked.
    this.selectedCounty = 0;

    // The actively clicked county.
    this.clickedCounty = 0;

    // The set of active alerts for the current timestep, stored as a map from
    // FIPS id to an array of alert IDs.
    this.currentAlerts = {};

    // Whether or not playback is currently paused.
    this.paused = false;

    // Whether or not playback is running backwards.
    this.rewind = false;

    // The current speed setting (controls the parameters below).
    this.speed = 3;

    // The speed before the user started rewinding--clicking rewind multiple
    // times will speed up the rewind process, but we don't want that speed to
    // stick around when the user hits play again.
    this.speedBeforeRewind = 3;

    // The time, in millis, that we wait between animation steps.  Possible
    // values are 24, 48, 96.
    this.stepDelay = 24;

    // The number of steps that we take at a time.  Possible values are 1, 2, 4.
    // Increasing this number makes playback run faster at the cost of skipping
    // frames, which can often be nice.
    this.stepMultiplier = 2;

    // The current time in the animation, in millis since the epoch.
    this.currentTime = this.minTime;

    usMap.setClickCallback((id) => { this.handleCanvasClick(id); });
    usMap.setMouseoverCallback((id) => { this.handleMouseOver(id); });
    usMap.setMouseoutCallback(() => { this.handleMouseOut(); });

    slider.addEventListener('change', (e) => { this.handleSliderChangeEvent(e); });
    slider.addEventListener('input', (e) => { this.handleSliderInputEvent(e); });
    playPauseButton.addEventListener('click', () => this.handlePlayPauseResetClick());
    forwardButton.addEventListener('click', () => this.handleForwardClick());
    backButton.addEventListener('click', () => this.handleBackwardClick());
    speedButton.addEventListener('click', () => this.handleSpeedClick());
    rewindButton.addEventListener('click', () => this.handleRewindClick());

    // Whether or not the animation has started--this is only used to prevent
    // multiple calls to run().
    this.started = false;
  }

  static datePad(v) {
    return v < 10 ? `0${v}` : v;
  }

  timeToPosition() {
    if (this.currentTime <= this.minTime) {
      return 1;
    }
    if (this.currentTime >= this.lastStep) {
      return this.sliderMax;
    }

    return (1 + this.sliderMax) -
      Math.ceil(((this.lastStep - this.currentTime)
        / (this.lastStep - this.minTime)) * this.sliderMax);
  }

  refreshHoverText() {
    const classes = this.currentAlerts[this.selectedCounty] || [];
    this.legend.setLegendContents(this.selectedCounty, classes);
  }

  redraw() {
    const newValue = (this.currentTime - this.minTime) / this.dataStep;
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
    this.usMap.setSelection(this.clickedCounty);

    this.currentAlerts = newClasses;
    this.timeDisplay.textContent = this.getDateText();
    this.slider.value = this.timeToPosition();
    this.refreshHoverText();
  }

  getDateText() {
    const d = new Date(this.currentTime);

    return `${d.getUTCFullYear()}-${WeatherController.datePad(d.getUTCMonth() + 1)}-${WeatherController.datePad(d.getUTCDate())} ${WeatherController.datePad(d.getUTCHours())}:${WeatherController.datePad(d.getUTCMinutes())} UTC`;
  }

  processSliderEvent() {
    const newValue = Number(this.slider.value);
    if (newValue === 1) {
      this.currentTime = this.minTime;
    } else if (newValue === 1000) {
      this.currentTime = this.lastStep;
    } else {
      const stepSize = Math.floor((this.lastStep - this.minTime) / this.sliderMax);
      const offset =
        (stepSize * newValue) - ((stepSize * newValue) % (this.stepMultiplier * this.dataStep));
      this.currentTime = this.minTime + offset;
    }
    this.redraw();
  }

  // Redraws play and speed button icons to match the current speed and state of
  // playback.
  refreshButtonState() {
    let newPlayPause;
    if (this.currentTime >= this.lastStep) {
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

  scheduleStep() {
    window.setTimeout(() => { this.maybeRunStep(); }, this.stepDelay);
  }

  // Run a step of the animation if the user hasn't paused / reached the end.
  maybeRunStep() {
    this.refreshButtonState();
    if (this.paused || (!this.rewind && this.currentTime >= this.lastStep)) {
      this.scheduleStep();
      return;
    } else if (this.rewind && this.currentTime <= this.minTime) {
      this.paused = true;
      this.scheduleStep();
      return;
    }
    this.currentTime += (this.stepMultiplier * this.dataStep) * (this.rewind ? -1 : 1);
    this.currentTime = Math.max(this.minTime, Math.min(this.currentTime, this.lastStep));
    this.redraw();
    this.scheduleStep();
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

    this.usMap.setSelection(this.clickedCounty);
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

    if (this.currentTime >= this.lastStep) {
      this.currentTime = this.minTime;
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
    if (this.currentTime === this.minTime) {
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
    if (this.currentTime === this.lastStep) {
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

  handleRewindClick() {
    if (this.currentTime <= this.minTime) {
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

  // Ensures that the current time is set so that steps line up with the current
  // speed.  For example, if the step size is 30 minutes, we don't want to step
  // between :15 and :45, but rather, :00 and :30.
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
    const numSteps = (this.maxTime - this.minTime) / this.dataStep;
    let currentSteps = (this.currentTime - this.minTime) / this.dataStep;
    currentSteps += (currentSteps % this.stepMultiplier);
    currentSteps = Math.min(numSteps - 1, currentSteps);
    this.currentTime = this.minTime + (currentSteps * this.dataStep);
  }

  // Starts the animation.
  run() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.maybeRunStep();
  }
}
