// 镜头表：start 用台词定位；in = 入场转场
import * as s01 from './s01_night.js';
import * as sheetShot from './sheet.js';
import * as s02 from './s02_kitchen.js';
import * as s03 from './s03_press.js';
import * as s04 from './s04_scroll.js';
import * as s05 from './s05_table.js';
import * as s06 from './s06_pack.js';
import * as s07 from './s07_journey.js';
import * as s08 from './s08_window.js';
import * as s09 from './s09_change.js';
import * as s10 from './s10_pass.js';
import * as s11 from './s11_city.js';
import * as s12 from './s12_apartment.js';
import * as s13 from './s13_note.js';
import * as s14 from './s14_bite.js';
import * as s15 from './s15_gran_open.js';
import * as s16 from './s16_mutual.js';
import * as s17 from './s17_sushi.js';
import * as s18 from './s18_finale.js';
export function SHOTS(C, DUR) {
  const L = id => C[id].at;
  if (location.search.includes('sheet')) return [{ id: 'SHEET', start: 0, build: sheetShot.build }];
  return [
    { id: 'S01', start: 0, build: E => s01.build({ ...E, titleIn: C.L02.end + .35 }) },
    { id: 'S02', start: L('L03') - 1.2, in: { type: 'dissolve', dur: 1.2 }, build: s02.build },
    { id: 'S03', start: L('L04') - .1, build: s03.build },
    { id: 'S04', start: L('L06') - .5, in: { type: 'dissolve', dur: .9 }, build: s04.build },
    { id: 'S05', start: L('L07') - .6, in: { type: 'dissolve', dur: .9 }, build: s05.build },
    { id: 'S06', start: L('L09') - .3, in: { type: 'dissolve', dur: .6 }, build: s06.build },
    { id: 'S07', start: L('L10') + .9, in: { type: 'dissolve', dur: 1.0 }, build: s07.build },
    { id: 'S08', start: L('L12') - .3, in: { type: 'dissolve', dur: .7 }, build: s08.build },
    { id: 'S09', start: L('L13') - .5, in: { type: 'dissolve', dur: 1.0 }, build: s09.build },
    { id: 'S10', start: L('L14') - .4, in: { type: 'dissolve', dur: .7 }, build: s10.build },
    { id: 'S11', start: L('L15') - .4, in: { type: 'dissolve', dur: .8 }, build: s11.build },
    { id: 'S12', start: L('L16') - .3, in: { type: 'dissolve', dur: .7 }, build: s12.build },
    { id: 'S13', start: L('L17') - .35, in: { type: 'dissolve', dur: .5 }, build: E => s13.build(E, 'gran') },
    { id: 'S14', start: L('L18') - .7, in: { type: 'dissolve', dur: .6 }, build: s14.build },
    { id: 'S15', start: L('L19') - .4, in: { type: 'dissolve', dur: .9 }, build: s15.build },
    { id: 'S15b', start: L('L20') - .3, in: { type: 'dissolve', dur: .5 }, build: E => s13.build(E, 'girl') },
    { id: 'S16', start: L('L21') - .5, in: { type: 'dissolve', dur: .9 }, build: s16.build },
    { id: 'S17', start: L('L22') - .6, build: s17.build },
    { id: 'S18', start: L('L24') - .6, in: { type: 'dissolve', dur: 1.0 }, build: s18.build },
  ];
}
