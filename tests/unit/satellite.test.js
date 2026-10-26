import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availabilityXmlUrl,
  buildImageUrl,
  frameCandidates,
  isPlausibleImageSize,
  markerPosition,
  parseLatestFrameTime,
} from "../../src/lib/satellite.js";

const XML = `<Domains xmlns:ows='http://www.opengis.net/ows/1.1'><SpaceDomain><BoundingBox miny='-90' maxx='180' maxy='90' minx='-180' crs='urn:ogc:def:crs:OGC:2:84'/></SpaceDomain><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain>2026-10-25/2026-10-25T02:30:00Z/PT10M,2026-10-25T02:50:00Z/2026-10-25T14:30:00Z/PT10M,2026-10-26T02:50:00Z/2026-10-26T12:30:00Z/PT10M</Domain><Size>3</Size></DimensionDomain></Domains>`;

test("the availability request spans yesterday through tomorrow in UTC", () => {
  const now = new Date("2026-10-26T23:55:00Z");
  assert.equal(
    availabilityXmlUrl("Himawari_AHI_Band13_Clean_Infrared", now),
    "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/Himawari_AHI_Band13_Clean_Infrared/default/2km/all/2026-10-25--2026-10-27.xml",
  );
});

test("the latest advertised frame is parsed from the last time range", () => {
  assert.equal(parseLatestFrameTime(XML), "2026-10-26T12:30:00Z");
  assert.equal(parseLatestFrameTime("<Domains />"), null);
  assert.equal(parseLatestFrameTime(""), null);
  assert.equal(parseLatestFrameTime(null), null);
});

test("frame candidates start one step before the newest frame and walk backwards", () => {
  assert.deepEqual(frameCandidates("2026-10-26T12:30:00Z", 3), [
    "2026-10-26T12:20:00Z",
    "2026-10-26T12:10:00Z",
    "2026-10-26T12:00:00Z",
  ]);
  assert.deepEqual(frameCandidates("not-a-time"), []);
});

test("the image URL uses lon/lat order and only adds TIME when requested", () => {
  const url = new URL(
    buildImageUrl("Himawari_AHI_Band13_Clean_Infrared", {
      time: "2026-10-26T12:20:00Z",
    }),
  );
  assert.equal(url.searchParams.get("VERSION"), "1.1.1");
  assert.equal(url.searchParams.get("FORMAT"), "image/png");
  assert.equal(url.searchParams.get("SRS"), "EPSG:4326");
  assert.equal(url.searchParams.get("BBOX"), "76.5,3.5,85.5,11.5");
  assert.equal(url.searchParams.get("TIME"), "2026-10-26T12:20:00Z");

  const latest = new URL(buildImageUrl("VIIRS_SNPP_CorrectedReflectance_TrueColor"));
  assert.equal(latest.searchParams.has("TIME"), false);
});

test("tiny transparent frames fail the size probe while real frames pass", () => {
  assert.equal(isPlausibleImageSize(2_696), false);
  assert.equal(isPlausibleImageSize(4_999), false);
  assert.equal(isPlausibleImageSize(5_000), true);
  assert.equal(isPlausibleImageSize(122_833), true);
  assert.equal(isPlausibleImageSize(null), false);
});

test("the location marker is positioned from the map bounds and stays inside them", () => {
  const colombo = markerPosition({ latitude: 6.9271, longitude: 79.8612 });
  assert.ok(colombo);
  assert.match(colombo.left, /%$/);
  assert.match(colombo.top, /%$/);

  assert.equal(markerPosition({ latitude: 51.5, longitude: -0.12 }), null);
  assert.equal(markerPosition({ latitude: "oops", longitude: 80 }), null);
  assert.equal(markerPosition(null), null);
});
