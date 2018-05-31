/* eslint class-methods-use-this: ["error", { "exceptMethods": ["getColor"] }] */

export default class CountyRenderer {
  constructor(countyNames) {
    this.countyNames = countyNames;
  }

  getFullName(countyId) {
    const stateName = this.countyNames[countyId - (countyId % 1000)];
    return `${this.countyNames[countyId]}, ${stateName}`;
  }

  getShortName(countyId) {
    return this.getFullName(countyId);
  }

  getColor() {
    return '#cccccc';
  }
}
