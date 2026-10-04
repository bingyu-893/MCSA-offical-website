/* Shared coordinate validation, straight-line distance and navigation links. */
(() => {
  'use strict';
  const EARTH_RADIUS_METRES = 6371000;
  const validCoordinates = value => Boolean(value
    && typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180);

  function straightLineMetres(origin, destination) {
    if (!validCoordinates(origin) || !validCoordinates(destination)) return null;
    const radians = degrees => degrees * Math.PI / 180;
    const latitude = radians(destination.latitude - origin.latitude);
    const longitude = radians(destination.longitude - origin.longitude);
    const arc = Math.sin(latitude / 2) ** 2
      + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude))
      * Math.sin(longitude / 2) ** 2;
    return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(arc)));
  }

  function navigationUrl(destination) {
    if (!validCoordinates(destination)) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}`;
  }

  window.MCSAMerchantGeo = Object.freeze({validCoordinates, straightLineMetres, navigationUrl});
})();
