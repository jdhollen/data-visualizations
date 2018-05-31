/* eslint-env browser */

export default class Legend {
  constructor(legend, countyNames, alertRenderer) {
    this.legend = legend;
    this.countyNames = countyNames;
    this.alertRenderer = alertRenderer;
  }

  setLegendContents(countyId, classes) {
    if (!countyId) {
      this.legend.innerHTML = '<span class="legendTitle">Select a county to see alerts.</span>';
      return;
    }

    const stateName = this.countyNames[countyId - (countyId % 1000)];
    const fullName = `${this.countyNames[countyId]}, ${stateName}`;

    let alertHtml = '';
    for (let i = 0; i < classes.length; i += 1) {
      const av = classes[i];

      const alertColor = this.alertRenderer.getColor(av);
      const alert = (window.innerWidth >= 375)
        ? this.alertRenderer.getFullName(av) : this.alertRenderer.getShortName(av);
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
