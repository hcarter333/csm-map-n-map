# Cesium Dual-Viewer URL-Param Flow

This document describes how the provided script behaves **when a web page is loaded with URL parameters** that the code recognizes, and 
how it **generates a “saved view” URL** that encodes camera state, panel size, and time.  

It's important to note the camera views are saved from existing viewer settings.

---

## Overview

On page load, the script:

1. Reads a **CZML URL** from the page URL (`mapurl`).
2. Creates **two Cesium viewers**:
   - a **main** viewer (`cesiumContainer`)
   - a **small** viewer (`smallViewer`) in a subpanel
3. Loads the same CZML into both viewers.
4. Keeps the small viewer’s clock **synchronized** to the main viewer.
5. After both CZMLs are loaded, optionally restores:
   - main camera (`panelview`)
   - small camera (`subpanelview`)
   - small panel size (`subpanelsize`)
   - timeline time (`viewtime`)
   - hides the save panel (`hideSave=1`)
6. When the user clicks **Save View**, it builds a new URL containing these parameters so the view can be reopened later.

---

## URL Parameter Input

The script recognizes these parameters:

- `mapurl`  
  The URL to a CZML file. Required for data loading.

- `panelview`  
  Base64 JSON containing the main viewer camera state (position + orientation vectors).

- `subpanelview`  
  Base64 JSON containing the small viewer camera state.

- `subpanelsize`  
  Base64 JSON describing the small viewer container size.
  - New format: `{ "vw": number, "vh": number }`
  - Back-compat format: `{ "width": "...", "height": "..." }`

- `viewtime`  
  ISO-8601 time string for the Cesium clock (e.g. `"2026-02-15T13:45:00Z"`)

- `hideSave`  
  If `hideSave=1`, hides the `#saveViewPanel` element.

---

## How Parameters Are Read: `getParam(name)`

```js
function getParam(name) {
  const source = window.location.search.length > 1
    ? window.location.search.substring(1)
    : window.location.hash.slice(1);
  const p = new URLSearchParams(source);
  return p.get(name);
}
