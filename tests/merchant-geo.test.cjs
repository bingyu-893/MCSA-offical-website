const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/merchant-geo.js'), 'utf8'), context);
const geo = context.window.MCSAMerchantGeo;

test('validates both coordinates and handles old merchants without them', () => {
  assert.equal(geo.validCoordinates({latitude: -37.8, longitude: 144.9}), true);
  assert.equal(geo.validCoordinates({latitude: null, longitude: null}), false);
  assert.equal(geo.validCoordinates({latitude: 91, longitude: 144.9}), false);
  assert.equal(geo.validCoordinates({latitude: -37.8, longitude: NaN}), false);
  assert.equal(geo.straightLineMetres({latitude: -37.8, longitude: 144.9}, {}), null);
});

test('calculates straight-line metres, including zero and a known latitude step', () => {
  const start = {latitude: -37.8, longitude: 145};
  assert.equal(geo.straightLineMetres(start, start), 0);
  const next = {latitude: -37.79, longitude: 145};
  assert.ok(Math.abs(geo.straightLineMetres(start, next) - 1112) < 4);
  assert.ok(Math.abs(geo.straightLineMetres(start, next) - geo.straightLineMetres(next, start)) < 0.001);
});

test('uses coordinates as the destination for external directions', () => {
  const url = geo.navigationUrl({latitude: -37.8105, longitude: 144.9627});
  assert.equal(url, 'https://www.google.com/maps/dir/?api=1&destination=-37.8105%2C144.9627');
  assert.equal(geo.navigationUrl({latitude: null, longitude: null}), '');
});
