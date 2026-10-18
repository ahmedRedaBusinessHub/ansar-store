import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryLabel, formatDuration, isMediaId, mediaJsonLd, mediaListPath, mediaMeta, mediaPath,
  mediaTitle, parseCategory, parseMediaKind, toMediaItem,
} from "../lib/media";

process.env.ANSAR_API_BASE_URL = "http://api.test";

const P = "11111111-1111-4111-8111-111111111111";
const V = "22222222-2222-4222-8222-222222222222";
const photoRow = {
  id: P, media_type: "PHOTO", image_url: "/uploads/photos/a.webp", thumbnail_url: "/uploads/photos/a-thumb.webp",
  image_blurhash: "x", caption_ar: " تدريب الفريق ", category: "TRAINING", display_order: 0,
  created_at: "2026-10-01T10:00:00.000Z", video_url: null, video_duration_seconds: null, video_size_bytes: null, video_status: null,
};
const videoRow = {
  ...photoRow, id: V, media_type: "VIDEO", image_url: "/uploads/photos/poster.webp", thumbnail_url: "/uploads/photos/poster-thumb.webp",
  video_url: "/uploads/videos/v.mp4", video_duration_seconds: 75.4, video_status: "READY", category: "EVENTS", caption_ar: null,
};

test("toMediaItem maps photos and videos", () => {
  assert.deepEqual(toMediaItem(photoRow), {
    id: P, kind: "photo", image: "http://api.test/uploads/photos/a.webp", thumbnail: "http://api.test/uploads/photos/a-thumb.webp",
    videoUrl: null, durationSeconds: null, caption: "تدريب الفريق", category: "TRAINING", publishedAt: "2026-10-01T10:00:00.000Z",
  });
  const video = toMediaItem(videoRow)!;
  assert.equal(video.kind, "video");
  assert.equal(video.videoUrl, "http://api.test/uploads/videos/v.mp4");
  assert.equal(video.durationSeconds, 75.4);
  assert.equal(video.caption, "");
  assert.equal(video.category, "EVENTS");
});

test("toMediaItem drops unusable rows", () => {
  assert.equal(toMediaItem({ ...photoRow, image_url: "javascript:alert(1)" }), null);
  assert.equal(toMediaItem({ ...videoRow, video_url: null }), null);
  assert.equal(toMediaItem({ ...photoRow, id: "not-a-uuid" }), null);
  assert.equal(toMediaItem({ ...photoRow, media_type: "AUDIO" }), null);
  assert.equal(toMediaItem(undefined), null);
  assert.equal(toMediaItem({ ...photoRow, category: "OTHER" })?.category, null);
  assert.equal(toMediaItem({ ...photoRow, thumbnail_url: null })?.thumbnail, "http://api.test/uploads/photos/a.webp");
  assert.equal(toMediaItem({ ...photoRow, created_at: "nope" })?.publishedAt, null);
});

test("a video without poster or duration is kept", () => {
  const video = toMediaItem({ ...videoRow, image_url: null, thumbnail_url: null, video_duration_seconds: null })!;
  assert.equal(video.image, null);
  assert.equal(video.thumbnail, null);
  assert.equal(video.durationSeconds, null);
  assert.equal(formatDuration(video.durationSeconds), null);
  assert.deepEqual(mediaJsonLd(video).thumbnailUrl, ["https://store.alansar.sa/images/logo.svg"]);
  assert.equal("duration" in mediaJsonLd(video), false);
});

test("formatDuration", () => {
  assert.equal(formatDuration(45), "0:45");
  assert.equal(formatDuration(75), "1:15");
  assert.equal(formatDuration(59.6), "1:00");
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(-1), null);
  assert.equal(formatDuration(Number.NaN), null);
});

test("categories, ids, titles and paths", () => {
  assert.equal(parseCategory("TRAINING"), "TRAINING");
  assert.equal(parseCategory("training"), undefined);
  assert.equal(parseCategory(["EVENTS", "GENERAL"]), "EVENTS");
  assert.equal(parseCategory(undefined), undefined);
  assert.equal(parseMediaKind("video"), "video");
  assert.equal(parseMediaKind(["photo"]), "photo");
  assert.equal(parseMediaKind("x"), undefined);
  assert.equal(parseMediaKind(undefined), undefined);
  assert.equal(categoryLabel("RENOVATIONS"), "ترميمات");
  assert.equal(categoryLabel(null), "");
  assert.equal(isMediaId(P), true);
  assert.equal(isMediaId("../x"), false);
  assert.equal(mediaListPath("photo"), "/gallery?type=photo");
  assert.equal(mediaListPath("video"), "/gallery?type=video");
  assert.equal(mediaPath({ kind: "photo", id: P }), `/gallery/${P}`);
  assert.equal(mediaPath({ kind: "video", id: V }), `/videos/${V}`);
  assert.equal(mediaTitle({ kind: "video", caption: "" }), "فيديو من نادي الأنصار");
  assert.equal(mediaTitle({ kind: "photo", caption: "لقطة" }), "لقطة");
  assert.equal(mediaMeta({ category: "EVENTS", publishedAt: null }, () => ""), "فعاليات");
  assert.equal(mediaMeta({ category: null, publishedAt: "x" }, () => "1 أكتوبر 2026"), "1 أكتوبر 2026");
});

test("JSON-LD", () => {
  const ld = mediaJsonLd(toMediaItem(videoRow)!);
  assert.equal(ld["@type"], "VideoObject");
  assert.equal(ld.duration, "PT75S");
  assert.equal(ld.url, `https://store.alansar.sa/videos/${V}`);
  assert.deepEqual(ld.thumbnailUrl, ["http://api.test/uploads/photos/poster.webp"]);
  assert.equal(mediaJsonLd(toMediaItem(photoRow)!)["@type"], "ImageObject");
});
