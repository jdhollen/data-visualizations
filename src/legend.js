/* eslint-env browser */

/* A simple legend that spits out formatted HTML into the specified DOM element. */
export default class Legend {
  constructor(legend, countyRenderer, alertRenderer) {
    this.legend = legend;
    this.countyRenderer = countyRenderer;
    this.alertRenderer = alertRenderer;
  }

  setLegendContents(countyId, alertIds) {
    if (!countyId) {
      this.legend.innerHTML = '<span class="legendTitle">Select a county to see alerts.</span>';
      return;
    }

    const fullName = this.countyRenderer.getFullName(countyId);

    let alertHtml = '';
    for (let i = 0; i < alertIds.length; i += 1) {
      const alertId = alertIds[i];

      const alertColor = this.alertRenderer.getColor(alertId);

      // Some tiny phones (iPhone SE, Moto E, yada yada) don't have the screen
      // real estate to render "Winter Weather Advisory", so we shorten it up.
      const alert = (window.innerWidth >= 375)
        ? this.alertRenderer.getFullName(alertId) : this.alertRenderer.getShortName(alertId);
      if (alert) {
        alertHtml = alertHtml.concat(`<div class="legendItem"><div class="legendSquare" style="background-color:${alertColor};"></div>${alert}</div>`);
      }
    }
    if (!alertHtml) {
      alertHtml = '<div class="legendItem">No alerts</div>';
    }

    this.legend.innerHTML = `<span class="legendTitle">${fullName}</span>${alertHtml}`;
  }
}
