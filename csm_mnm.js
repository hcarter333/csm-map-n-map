    function getParam(name) {
      const source = window.location.search.length > 1
        ? window.location.search.substring(1)
        : window.location.hash.slice(1);
      const p = new URLSearchParams(source);
      return p.get(name);
    }

    const mapurl2 = getParam("mapurl");
    console.log("CZML URL:", mapurl2);

    // Main viewer setup
    const viewer = new Cesium.Viewer("cesiumContainer", {
      terrain: Cesium.Terrain.fromWorldTerrain(),
    });

    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org' })
    );

    viewer.scene.globe.enableLighting = true;

    try {
      const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
      viewer.scene.primitives.add(tileset);
    } catch (error) {
      console.log(`Error loading tileset: ${error}`);
    }

    const mainDataSource = await Cesium.CzmlDataSource.load(mapurl2);
    viewer.dataSources.add(mainDataSource);

    // Small viewer setup
    const smallViewer = new Cesium.Viewer("smallViewer", {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      terrain: Cesium.Terrain.fromWorldTerrain(),
    });

    smallViewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org' })
    );
    smallViewer.scene.globe.enableLighting = true;

    try {
      const smallTileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
      smallViewer.scene.primitives.add(smallTileset);
    } catch (error) {
      console.log(`Error loading small viewer tileset: ${error}`);
    }

    const smallDataSource = await Cesium.CzmlDataSource.load(mapurl2);
    smallViewer.dataSources.add(smallDataSource);

    // Clock sync
    viewer.clock.onTick.addEventListener(() => {
      Cesium.JulianDate.clone(viewer.clock.currentTime, smallViewer.clock.currentTime);
      smallViewer.clock.shouldAnimate = viewer.clock.shouldAnimate;
      smallViewer.clock.multiplier = viewer.clock.multiplier;
    });


function getViewportSize() {
  const vv = window.visualViewport;
  return {
    w: (vv && vv.width)  || window.innerWidth,
    h: (vv && vv.height) || window.innerHeight,
  };
}


function encodeCamera(viewer) {
  const cam = viewer.camera;
  const toArray = (cart) => [cart.x, cart.y, cart.z];
  return {
    pos: toArray(cam.positionWC),
    dir: toArray(cam.directionWC),
    up: toArray(cam.upWC),
    right: toArray(cam.rightWC),
  };
}

function decodeCamera(viewer, data) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromArray(data.pos),
    orientation: {
      direction: Cesium.Cartesian3.fromArray(data.dir),
      up: Cesium.Cartesian3.fromArray(data.up),
      right: Cesium.Cartesian3.fromArray(data.right),
    },
    duration: 1.5,
  });
}

  function b64Encode(obj) {
    return btoa(JSON.stringify(obj));
  }

  function b64Decode(str) {
    return JSON.parse(atob(str));
  }

document.getElementById("saveViewBtn").addEventListener("click", () => {
  const panelview    = b64Encode(encodeCamera(viewer));
  const subpanelview = b64Encode(encodeCamera(smallViewer));

  const smallPanel = document.getElementById("smallViewerContainer");
  const rect = smallPanel.getBoundingClientRect();

  // Convert current CSS pixel size -> vw/vh
  const { w: vpW, h: vpH } = getViewportSize();
  const vw = (rect.width  / vpW) * 100;
  const vh = (rect.height / vpH) * 100;

  const subpanelsize = b64Encode({ vw: +vw.toFixed(3), vh: +vh.toFixed(3) });

  const viewtime = Cesium.JulianDate.toIso8601(viewer.clock.currentTime);

  // Preserve ALL existing params + hash exactly (no re-encoding)
  const href = window.location.href;
  const [baseWithParams, anchor] = href.split("#", 2);
  const [baseUrl, queryString]  = baseWithParams.split("?", 2);

  const rawParams = new URLSearchParams(queryString || "");
  rawParams.set("panelview", panelview);
  rawParams.set("subpanelview", subpanelview);
  rawParams.set("subpanelsize", subpanelsize);
  rawParams.set("viewtime", viewtime);
  rawParams.set("hideSave", "1");   // 👈 NEW: add hideSave=1

  const query = Array.from(rawParams.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const newUrl = `${baseUrl}?${query}` + (anchor ? `#${anchor}` : "");

  document.getElementById("viewLink").innerHTML =
    `<a href="${newUrl}" target="_blank">Open Saved View</a>`;
});

function restoreCameraAfterReady(viewerInstance, paramName) {
  const encoded = getParam(paramName);
  if (!encoded) return;
  let decoded;
  try { decoded = b64Decode(encoded); } catch (e) { console.warn(`Could not decode ${paramName}:`, e); return; }

  // Run once on first post-render to ensure scene is ready
  const onceRestore = function () {
    viewerInstance.scene.postRender.removeEventListener(onceRestore);
    decodeCamera(viewerInstance, decoded);
  };
  viewerInstance.scene.postRender.addEventListener(onceRestore);
}

function restorePanelSize() {
  const val = getParam("subpanelsize");
  if (!val) return;

  try {
    const size = b64Decode(val);
    const smallPanel = document.getElementById("smallViewerContainer");

    if (size && typeof size.vw === "number" && typeof size.vh === "number") {
      // New format: numbers in vw/vh
      smallPanel.style.width  = `${size.vw}vw`;
      smallPanel.style.height = `${size.vh}vh`;
      return;
    }

    // Backward compatibility: old format {width: "...", height: "..."}
    if (size && size.width && size.height) {
      const wStr = String(size.width);
      const hStr = String(size.height);

      // If already vw/vh strings, reuse them directly
      if (wStr.endsWith("vw") && hStr.endsWith("vh")) {
        smallPanel.style.width  = wStr;
        smallPanel.style.height = hStr;
        return;
      }

      // If px (or plain numbers), convert to vw/vh
      const pxW = parseFloat(wStr);
      const pxH = parseFloat(hStr);
      if (!Number.isNaN(pxW) && !Number.isNaN(pxH)) {
        const { w: vpW, h: vpH } = getViewportSize();
        const vw = (pxW / vpW) * 100;
        const vh = (pxH / vpH) * 100;
        smallPanel.style.width  = `${vw.toFixed(3)}vw`;
        smallPanel.style.height = `${vh.toFixed(3)}vh`;
        return;
      }

      // Fallback: apply raw strings
      smallPanel.style.width  = wStr;
      smallPanel.style.height = hStr;
    }
  } catch (e) {
    console.warn("Could not decode/restore subpanelsize:", e);
  }
}

function restoreTimeAfterReady() {
  const t = getParam("viewtime");
  if (!t) return;
  let jd;
  try { jd = Cesium.JulianDate.fromIso8601(t); } catch (e) { console.warn("Bad viewtime:", e); return; }

  // Set both clocks; timeline will follow currentTime
  viewer.clock.currentTime = jd.clone();
  viewer.clock.shouldAnimate = false; // pause at saved time (optional)
  smallViewer.clock.currentTime = jd.clone();
  smallViewer.clock.shouldAnimate = viewer.clock.shouldAnimate;

  // Optionally bring timeline into view around the saved time
  if (viewer.timeline && viewer.clock.startTime && viewer.clock.stopTime) {
    const start = viewer.clock.startTime;
    const stop  = viewer.clock.stopTime;
    // zoom to full interval defined by CZML (safe default)
    viewer.timeline.zoomTo(start, stop);
  }
}

function maybeHideSavePanel() {
  const hide = getParam("hideSave");
  if (hide === "1") {
    const panel = document.getElementById("saveViewPanel");
    if (panel) panel.style.display = "none";
  }
}

// Wait for BOTH CZMLs to load before restoring views/time
Promise.all([mainDataSource, smallDataSource]).then(() => {
  restorePanelSize();
  restoreCameraAfterReady(viewer, "panelview");
  restoreCameraAfterReady(smallViewer, "subpanelview");
  restoreTimeAfterReady();
  maybeHideSavePanel();
});

