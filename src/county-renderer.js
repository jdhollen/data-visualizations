/* eslint class-methods-use-this: ["error", { "exceptMethods": ["getColor"] }] */

/*
 * A renderer for displaying US Counties as "CountyName, State"--for example,
 * "Santa Cruz, California" or "Union, New Jersey".  The input map should hold
 * FIPS->name mappings for both counties and states.  The state names should
 * be stored in the slot for county code 000.  For example, "1000" should be
 * Alabama.  FIPS codes are NOT zero-padded in this map (they look like actual
 * numbers).  That means Alabama is "1000", not "01000".
 */
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
