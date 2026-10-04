# MCSA-offical-website
蒙纳士中国学生会官网

## Local preview

This is a static site. Serve it over HTTP instead of opening `index.html` directly:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

To read local CMS data, run the backend at `http://127.0.0.1:8000` and set `apiBase` in `assets/config.js` to `"http://127.0.0.1:8000/api"`. Do not commit a local-only API address for deployment.

## Discount partners

`discounts.html` reads the published `merchants`, `regions`, and `categories` from `GET /api/site`. Each merchant uses `name`, `text`, `image`, `url`, `region`, `category`, `address`, `latitude`, `longitude`, and `published`. Staff enter the address and both coordinates in the backend CMS; coordinates are validated there. A merchant without coordinates stays in the list but has no marker or navigation button. Unpublished merchants are omitted by the public API.

The page uses Leaflet 1.9.4 and OpenStreetMap tiles. Filters and search update both cards and map markers. The visitor's location is requested only after clicking **查看附近商家**. When granted, the page sorts matching merchants by Haversine straight-line distance, labels it clearly, and keeps the location only in page memory. The **打开地图导航** button opens a Google Maps directions URL with the merchant coordinates as destination; the map provider calculates its own route distance.

Leaflet is loaded from its version-pinned CDN with integrity hashes. If it or the tiles cannot load, the merchant list remains usable. The map displays OpenStreetMap attribution. Before a high-traffic production launch, review the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and consider a hosted tile provider with a service agreement. The map does not preload or bulk-download tiles.

Run the coordinate tests with `node --test tests/merchant-geo.test.cjs`. The repository does not include real merchant records; add verified shops through the backend CMS to populate the map.
