/* eslint no-bitwise: ['error', { 'allow': ['&', '|'] }] */

const alertTypeNames = {
  0x8000: 'Warning',
  0x4000: 'Advisory',
  0x2000: 'Watch',
  0x1000: 'Statement',
};

const alertTypeShortNames = {
  0x8000: 'Wrn',
  0x4000: 'Adv',
  0x2000: 'Wtch',
  0x1000: 'Stmt',
};

const alertTypeCodes = {
  0x8000: 'W',
  0x4000: 'Y',
  0x2000: 'A',
  0x1000: 'S',
};

const types = [
  'NONE',
  'RH', 'VO', 'AF', 'TS', 'TO', 'HU', 'TY', 'EW', 'HF', 'HI', 'TR', 'SV', 'BZ',
  'SQ', 'WS', 'DS', 'WW', 'IS', 'LB', 'LE', 'HS', 'HP', 'SS', 'FF', 'SB', 'SN',
  'BS', 'IP', 'ZR', 'SR', 'GL', 'TI', 'SM', 'AV', 'DU', 'CF', 'LS', 'FA', 'FL',
  'HY', 'ZF', 'FG', 'FW', 'HW', 'WI', 'EC', 'EH', 'HZ', 'HT', 'FZ', 'LW', 'WC',
  'UP', 'SE', 'SU', 'BH', 'LO', 'MA', 'SC', 'SI', 'RB', 'FR', 'AS', 'RP'];

const alertColors = {
  ASY: '#808080',
  AFY: '#696969',
  AFW: '#A9A9A9',
  AVY: '#CD853F',
  AVW: '#1E90FF',
  AVA: '#F4A460',
  BHS: '#40E0D0',
  BZW: '#FF4500',
  BZA: '#ADFF2F',
  DUY: '#BDB76B',
  CFY: '#7CFC00',
  CFS: '#6B8E23',
  CFW: '#228B22',
  CFA: '#66CDAA',
  FGY: '#708090',
  SMY: '#F0E68C',
  DSW: '#FFE4C4',
  EHW: '#C71585',
  EHA: '#800000',
  ECW: '#0000FF',
  ECA: '#0000FF',
  EWW: '#FF8C00',
  FFS: '#8B0000',
  FFW: '#8B0000',
  FFA: '#2E8B57',
  FLY: '#00FF7F',
  FLS: '#00FF00',
  FLW: '#00FF00',
  FLA: '#2E8B57',
  FZW: '#483D8B',
  FZA: '#00FFFF',
  ZFY: '#008080',
  ZRY: '#DA70D6',
  FRY: '#6495ED',
  GLW: '#DDA0DD',
  GLA: '#FFC0CB',
  HZW: '#9400D3',
  HZA: '#4169E1',
  SEW: '#D8BFD8',
  SEA: '#483D8B',
  HTY: '#FF7F50',
  SUY: '#BA55D3',
  SUW: '#228B22',
  HWW: '#DAA520',
  HWA: '#B8860B',
  HFW: '#CD5C5C',
  HIW: '#CD5C5C',
  HFA: '#9932CC',
  HUW: '#DC143C',
  HUA: '#FF00FF',
  HYY: '#00FF7F',
  ISW: '#8B008B',
  LEY: '#48D1CC',
  LEW: '#008B8B',
  LEA: '#87CEFA',
  LWY: '#D2B48C',
  LSY: '#7CFC00',
  LSS: '#6B8E23',
  LSW: '#228B22',
  LSA: '#66CDAA',
  LOY: '#A52A2A',
  MAS: '#FFDAB9',
  RHW: '#4B0082',
  FWW: '#FF1493',
  RPS: '#40E0D0',
  SSS: '#8B0000',
  SSW: '#8B0000',
  SSA: '#2E8B57',
  SSY: '#2E8B57',
  SVW: '#FFA500',
  SVA: '#DB7093',
  SVS: '#00FFFF',
  SCY: '#D8BFD8',
  RBY: '#D8BFD8',
  SIY: '#D8BFD8',
  SRW: '#9400D3',
  SRA: '#FFE4B5',
  TOW: '#FF0000',
  TOA: '#FFFF00',
  TRW: '#B22222',
  TRA: '#F08080',
  TSY: '#D2691E',
  TSW: '#FD6347',
  TSA: '#FF00FF',
  TYW: '#DC143C',
  TYA: '#FF00FF',
  VOW: '#2F4F4F',
  WIY: '#D2B48C',
  WCY: '#AFEEEE',
  WCW: '#B0C4DE',
  WCA: '#5F9EA0',
  WSW: '#FF69B4',
  WSA: '#4682B4',
  WWY: '#7B68EE',
  FAY: '#00FF7F',
  FAS: '#00FF00',
  FAW: '#00FF00',
  FAA: '#2E8B57',
};

const alertNames = {
  SV: 'Severe Thunderstorm',
  TO: 'Tornado',
  MA: 'Marine',
  AF: 'Volcanic Ashfall',
  AS: 'Air Stagnation',
  AV: 'Avalanche',
  BH: 'Beach Hazard',
  BS: 'Blowing Snow',
  BZ: 'Blizzard',
  CF: 'Coastal Flood',
  DU: 'Blowing Dust',
  DS: 'Dust Storm',
  EC: 'Extreme Cold',
  EH: 'Excessive Heat',
  EW: 'Extreme Wind',
  FA: 'Areal Flood',
  FF: 'Flash Flood',
  FL: 'Flood',
  FR: 'Frost',
  FZ: 'Freeze',
  FG: 'Dense Fog',
  FW: 'Red Flag',
  GL: 'Gale',
  HF: 'Hurricane Force Wind',
  HI: 'Inland Hurricane Wind',
  HS: 'Heavy Snow',
  HP: 'Heavy Sleet',
  HT: 'Heat',
  HU: 'Hurricane',
  HW: 'High Wind',
  HY: 'Hydrologic',
  HZ: 'Hard Freeze',
  IS: 'Ice Storm',
  IP: 'Sleet',
  LB: 'Lake Effect Snow and Blowing Snow',
  LE: 'Lake Effect Snow',
  LO: 'Low Water',
  LS: 'Lakeshore Flood',
  LW: 'Lake Wind',
  RB: 'Small Craft for Rough Bar',
  RH: 'Radiological Hazard',
  RP: 'Rip Current',
  SB: 'Snow and Blowing Snow',
  SC: 'Small Craft',
  SE: 'Hazardous Seas',
  SI: 'Small Craft for Winds',
  SM: 'Dense Smoke',
  SN: 'Snow',
  SQ: 'Snow Squall',
  SR: 'Storm',
  SS: 'Storm Surge',
  SU: 'High Surf',
  TI: 'Inland Tropical Storm Wind',
  TR: 'Tropical Storm',
  TS: 'Tsunami',
  TY: 'Typhoon',
  UP: 'Ice Accretion',
  VO: 'Volcano',
  WC: 'Wind Chill',
  WI: 'Wind',
  WS: 'Winter Storm',
  WW: 'Winter Weather',
  ZF: 'Freezing Fog',
  ZR: 'Freezing Rain',
};

export default class AlertRenderer {
  constructor() {
    this.types = types;
    this.alertTypeNames = alertTypeNames;
    this.alertTypeShortNames = alertTypeShortNames;
    this.alertTypeCodes = alertTypeCodes;
    this.alertColors = alertColors;
    this.alertNames = alertNames;
  }

  getFullName(alertNumber) {
    const alertId = alertNumber & 0xff;
    const alertType = alertNumber & 0xff00;
    const alert = this.alertNames[this.types[alertId]];
    if (!alert) {
      return '';
    }

    return `${alert} ${this.alertTypeNames[alertType]}`;
  }

  getShortName(alertNumber) {
    const alertId = alertNumber & 0xff;
    const alertType = alertNumber & 0xff00;
    const alert = this.alertNames[this.types[alertId]];
    if (!alert) {
      return '';
    }

    return `${alert} ${this.alertTypeShortNames[alertType]}`;
  }

  getColor(alertNumber) {
    const alertString =
      this.types[alertNumber & 0xff] + this.alertTypeCodes[alertNumber & 0xff00];
    return this.alertColors[alertString] || '#cccccc';
  }
}
