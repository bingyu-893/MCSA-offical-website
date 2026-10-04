/* Discount partners: one filtered list, matching map markers and optional nearby order. */
(() => {
  'use strict';
  const MELBOURNE = [-37.8136, 144.9631];
  const {validCoordinates, straightLineMetres, navigationUrl} = window.MCSAMerchantGeo;
  let map, markerLayer, userMarker, markers = new Map();
  let userPosition = null;
  const filters = {region: '', category: '', query: ''};
  let lastDetailButton = null;

  const site = () => window.MCSA;
  const esc = value => site().esc(value);
  const word = (zh, en, hant) => ({zh, en, hant}[site().lang] || zh);
  const localized = value => site().t(value);
  const partners = () => (Array.isArray(site().data?.merchants) ? site().data.merchants : [])
    .filter(merchant => merchant.published !== false);
  function distanceTo(merchant) {
    return userPosition ? straightLineMetres(userPosition, merchant) : null;
  }

  function distanceLabel(metres) {
    if (metres === null) return '';
    const amount = metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
    return `${word('直线距离', 'Straight-line distance', '直線距離')} ${amount}`;
  }

  function visiblePartners() {
    const query = filters.query.trim().toLocaleLowerCase();
    return partners().filter(merchant =>
      (!filters.region || merchant.region === filters.region)
      && (!filters.category || merchant.category === filters.category)
      && (!query || [localized(merchant.name), localized(merchant.text), merchant.address || '']
        .some(value => String(value).toLocaleLowerCase().includes(query))))
      .sort((first, second) => userPosition
        ? (distanceTo(first) ?? Infinity) - (distanceTo(second) ?? Infinity) : 0);
  }

  function optionList(entries, current, allLabel) {
    return `<option value="">${esc(allLabel)}</option>${entries.map(entry =>
      `<option value="${esc(entry.id)}" ${current === entry.id ? 'selected' : ''}>${esc(localized(entry.name))}</option>`).join('')}`;
  }

  function labelFor(entries, id) {
    return localized(entries.find(entry => entry.id === id)?.name) || '';
  }

  function card(merchant, index) {
    const name = localized(merchant.name);
    const category = labelFor(site().data.categories, merchant.category);
    const region = labelFor(site().data.regions, merchant.region);
    const photo = site().image(merchant.image, name, null, 'merchant-photo')
      || `<div class="merchant-photo merchant-photo-empty" aria-hidden="true">MCSA</div>`;
    const distance = distanceLabel(distanceTo(merchant));
    return `<article class="merchant-card" id="merchant-${esc(merchant.id)}">
      <button class="merchant-card-main" type="button" data-detail="${esc(merchant.id)}" aria-label="${esc(word('查看商家详情：', 'View partner details: ', '查看商家詳情：') + name)}">
        <div class="merchant-photo-wrap">${photo}${category ? `<span class="merchant-category">${esc(category)}</span>` : ''}</div>
        <div class="merchant-card-copy"><strong>${esc(name)}</strong><span>${esc(region || merchant.address || '')}</span>
          <span class="merchant-offer">${esc(localized(merchant.text))}</span>
          ${distance ? `<span class="merchant-distance">${esc(distance)}</span>` : ''}</div>
      </button>
      <div class="merchant-card-actions">${validCoordinates(merchant)
        ? `<button type="button" data-on-map="${esc(merchant.id)}">${word('在地图查看', 'Show on map', '在地圖查看')}</button>`
        : `<span>${word('位置待补充', 'Location pending', '位置待補充')}</span>`}
        <span aria-hidden="true">${index === 0 && userPosition && distance ? '⌖' : '→'}</span></div>
    </article>`;
  }

  function notice(message) {
    const element = document.querySelector('#merchant-notice');
    if (element) element.textContent = message;
  }

  function updateMap(items) {
    if (!map) return;
    markerLayer.clearLayers();
    markers = new Map();
    const coordinates = [];
    items.filter(validCoordinates).forEach(merchant => {
      const point = [merchant.latitude, merchant.longitude];
      coordinates.push(point);
      const name = localized(merchant.name);
      const popup = `<div class="merchant-popup"><strong>${esc(name)}</strong>
        <span>${esc(merchant.address || '')}</span>
        ${distanceTo(merchant) === null ? '' : `<span>${esc(distanceLabel(distanceTo(merchant)))}</span>`}
        <button type="button">${word('查看详情', 'View details', '查看詳情')}</button></div>`;
      const icon = L.divIcon({className: 'merchant-pin', html: '<span aria-hidden="true">●</span>', iconSize: [32, 40], iconAnchor: [16, 39]});
      const marker = L.marker(point, {icon, title: name}).bindPopup(popup).addTo(markerLayer);
      marker.on('popupopen', event => {
        const button = event.popup.getElement()?.querySelector('button');
        button?.addEventListener('click', () => showDetail(merchant.id, button));
      });
      markers.set(merchant.id, marker);
    });
    if (userPosition) {
      const point = [userPosition.latitude, userPosition.longitude];
      if (userMarker) userMarker.remove();
      userMarker = L.circleMarker(point, {radius: 9, color: '#fff', weight: 3, fillColor: '#2176d2', fillOpacity: 1})
        .bindPopup(word('你的位置', 'Your location', '你的位置')).addTo(map);
      if (!coordinates.length) coordinates.push(point);
    }
    const message = document.querySelector('#merchant-map-message');
    message.hidden = coordinates.length > 0;
    if (!coordinates.length) {
      map.setView(MELBOURNE, 11);
    } else if (coordinates.length === 1) {
      map.setView(coordinates[0], 13);
    } else {
      map.fitBounds(coordinates, {padding: [38, 38], maxZoom: 14});
    }
  }

  function refresh() {
    const items = visiblePartners();
    const grid = document.querySelector('#merchant-cards');
    if (!grid) return;
    grid.innerHTML = items.map(card).join('');
    document.querySelector('#merchant-empty').hidden = items.length > 0;
    const nearest = userPosition && items.find(validCoordinates);
    document.querySelector('#merchant-nearest').textContent = nearest
      ? `${word('最近商家', 'Nearest partner', '最近商家')}：${localized(nearest.name)} · ${distanceLabel(distanceTo(nearest))}`
      : userPosition ? word('当前筛选中没有已录入坐标的商家。', 'No located partners match these filters.', '目前篩選中沒有已錄入座標的商家。') : '';
    updateMap(items);
  }

  function focusOnMap(id) {
    const marker = markers.get(id);
    if (!map || !marker) return;
    const mapElement = document.querySelector('#merchant-map');
    mapElement.scrollIntoView({behavior: 'smooth', block: 'center'});
    map.invalidateSize();
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
    marker.openPopup();
  }

  function showDetail(id, trigger = null) {
    const merchant = partners().find(item => item.id === id);
    if (!merchant) return;
    lastDetailButton = trigger;
    const dialog = document.querySelector('#merchant-dialog');
    const name = localized(merchant.name);
    const category = labelFor(site().data.categories, merchant.category);
    const region = labelFor(site().data.regions, merchant.region);
    const photo = site().image(merchant.image, name, null, 'merchant-detail-photo')
      || '<div class="merchant-detail-photo merchant-photo-empty" aria-hidden="true">MCSA</div>';
    const website = site().safe(merchant.url);
    dialog.innerHTML = `<div class="merchant-dialog-layout">${photo}<div class="merchant-dialog-copy">
      <button class="merchant-close" type="button" aria-label="${word('关闭详情', 'Close details', '關閉詳情')}">×</button>
      ${category ? `<span class="merchant-dialog-category">${esc(category)}</span>` : ''}
      <h2>${esc(name)}</h2><p class="merchant-dialog-region">${esc(region)}</p>
      <p class="merchant-dialog-offer">${esc(localized(merchant.text))}</p>
      ${merchant.address ? `<p><strong>${word('地址', 'Address', '地址')}：</strong>${esc(merchant.address)}</p>` : ''}
      ${distanceTo(merchant) === null ? '' : `<p class="merchant-distance">${esc(distanceLabel(distanceTo(merchant)))}</p>`}
      <div class="merchant-dialog-actions">
        ${validCoordinates(merchant) ? `<button type="button" data-show-on-map="${esc(merchant.id)}">${word('地图定位', 'Show on map', '地圖定位')}</button>
          <a class="merchant-navigate" href="${esc(navigationUrl(merchant))}" target="_blank" rel="noopener noreferrer">${word('打开地图导航', 'Open directions', '開啟地圖導航')} ↗</a>` : ''}
        ${website ? `<a href="${esc(website)}" target="_blank" rel="noopener noreferrer">${word('商家链接', 'Partner website', '商家連結')} ↗</a>` : ''}
      </div>
      <small>${word('距离为直线距离；导航软件显示的步行或驾车路程可能不同。',
        'Distance is straight-line; walking or driving routes may differ.',
        '距離為直線距離；導航軟體顯示的步行或駕車路程可能不同。')}</small>
    </div></div>`;
    dialog.querySelector('.merchant-close').onclick = () => dialog.close();
    dialog.querySelector('[data-show-on-map]')?.addEventListener('click', () => {
      dialog.close();
      focusOnMap(merchant.id);
    });
    dialog.showModal();
  }

  function requestLocation() {
    if (!window.isSecureContext || !navigator.geolocation) {
      notice(word('定位需要 HTTPS 或本机地址；仍可使用商家列表和筛选。',
        'Location needs HTTPS or localhost. The list and filters still work.',
        '定位需要 HTTPS 或本機位址；仍可使用商家列表和篩選。'));
      return;
    }
    const button = document.querySelector('#merchant-nearby');
    button.disabled = true;
    notice(word('正在请求你的位置…', 'Requesting your location…', '正在請求你的位置…'));
    navigator.geolocation.getCurrentPosition(position => {
      button.disabled = false;
      userPosition = {latitude: position.coords.latitude, longitude: position.coords.longitude};
      notice(word('已按直线距离从近到远排序；位置仅用于本页计算。',
        'Sorted by straight-line distance. Your location is used only on this page.',
        '已按直線距離由近到遠排序；位置僅用於本頁計算。'));
      refresh();
    }, error => {
      button.disabled = false;
      notice(error.code === 1
        ? word('你没有授权定位，仍可使用列表和筛选。', 'Location was denied; the list and filters still work.', '你沒有授權定位，仍可使用列表和篩選。')
        : word('暂时无法取得位置，请稍后再试；列表和筛选仍可使用。', 'Location is unavailable. Please try again later.', '暫時無法取得位置，請稍後再試；列表和篩選仍可使用。'));
    }, {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
  }

  function initialize() {
    const root = document.querySelector('#merchant-experience');
    if (map) {
      map.remove();
      map = null;
      userMarker = null;
    }
    if (!root) return;
    const regions = site().data.regions || [];
    const categories = site().data.categories || [];
    root.innerHTML = `<div class="merchant-map-shell">
      <div id="merchant-map" role="region" aria-label="${word('商家地图', 'Partner map', '商家地圖')}"></div>
      <p id="merchant-map-message" class="merchant-map-message">${word('目前没有可显示的商家坐标；仍可查看下方列表。', 'No partner coordinates to show yet. Browse the list below.', '目前沒有可顯示的商家座標；仍可查看下方列表。')}</p>
      <button id="merchant-nearby" type="button" class="merchant-nearby">⌖ ${word('查看附近商家', 'Find nearby partners', '查看附近商家')}</button>
    </div>
    <p id="merchant-notice" class="merchant-notice" role="status">${word('点击“查看附近商家”后才会请求定位。地图距离均为直线距离。',
      'Location is requested only when you select “Find nearby partners”. Map distances are straight-line.',
      '點擊「查看附近商家」後才會請求定位。地圖距離均為直線距離。')}</p>
    <form id="merchant-filters" class="merchant-filters" role="search">
      <label>${word('地区', 'Area', '地區')}<select id="merchant-region">${optionList(regions, filters.region, word('全部地区', 'All areas', '全部地區'))}</select></label>
      <label>${word('类别', 'Category', '類別')}<select id="merchant-category">${optionList(categories, filters.category, word('全部类别', 'All categories', '全部類別'))}</select></label>
      <label class="merchant-search-label"><span class="visually-hidden">${word('搜索商家', 'Search partners', '搜尋商家')}</span>
        <input id="merchant-search" type="search" value="${esc(filters.query)}" placeholder="${word('搜索商家名称、优惠或地址', 'Search name, offer or address', '搜尋商家名稱、優惠或地址')}"></label>
      <button class="merchant-search-button" type="submit">${word('搜索', 'Search', '搜尋')}</button>
    </form>
    <p id="merchant-nearest" class="merchant-nearest" aria-live="polite"></p>
    <div id="merchant-cards" class="merchant-cards"></div>
    <p id="merchant-empty" class="empty-state" hidden>${word('暂无符合条件的商家。可调整筛选或在后台录入商家。',
      'No partners match. Adjust the filters or add partners in the CMS.',
      '暫無符合條件的商家。可調整篩選或在後台錄入商家。')}</p>
    <dialog id="merchant-dialog" class="merchant-dialog" aria-label="${word('商家详情', 'Partner details', '商家詳情')}"></dialog>`;

    if (window.L) {
      map = L.map('merchant-map', {scrollWheelZoom: false, zoomControl: true}).setView(MELBOURNE, 11);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      tiles.on('tileerror', () => notice(word('地图暂时无法加载；商家列表和导航链接仍可使用。',
        'The map is unavailable; the list and directions still work.',
        '地圖暫時無法載入；商家列表和導航連結仍可使用。')));
      markerLayer = L.layerGroup().addTo(map);
      requestAnimationFrame(() => map?.invalidateSize());
    } else {
      root.querySelector('#merchant-map-message').textContent = word('地图暂时无法加载；仍可使用商家列表。',
        'The map is unavailable; the partner list still works.',
        '地圖暫時無法載入；仍可使用商家列表。');
      notice(word('地图组件暂时无法加载；商家列表和筛选仍可使用。',
        'The map component is unavailable; the list and filters still work.',
        '地圖元件暫時無法載入；商家列表和篩選仍可使用。'));
    }
    root.querySelector('#merchant-nearby').onclick = requestLocation;
    root.querySelector('#merchant-region').onchange = event => { filters.region = event.target.value; refresh(); };
    root.querySelector('#merchant-category').onchange = event => { filters.category = event.target.value; refresh(); };
    root.querySelector('#merchant-search').oninput = event => { filters.query = event.target.value; refresh(); };
    root.querySelector('#merchant-filters').onsubmit = event => { event.preventDefault(); refresh(); };
    root.onclick = event => {
      const detail = event.target.closest('[data-detail]');
      const onMap = event.target.closest('[data-on-map]');
      if (detail) showDetail(detail.dataset.detail, detail);
      if (onMap) focusOnMap(onMap.dataset.onMap);
    };
    root.querySelector('#merchant-dialog').addEventListener('close', () => lastDetailButton?.focus());
    refresh();
  }

  window.addEventListener('mcsa-render', initialize);
  if (site()?.data) initialize();
})();
