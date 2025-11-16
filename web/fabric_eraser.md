# Fabric.js 4.6 — True Eraser Using Canvas Primitives

This document explains how to implement a real transparent eraser inside Fabric.js 4.6 using pure HTML Canvas primitives, bypassing Fabric’s brush system. Fabric renders vector objects, so to erase pixels you must write directly onto the underlying canvas using:

globalCompositeOperation = "destination-out"

This operation removes pixels rather than coloring them.

## Fabric Canvas Architecture

Fabric uses multiple layered canvases:
- lowerCanvasEl / contextContainer — the actual pixel layer. Erasing happens here.
- contextTop — temporary overlay used for drawing previews.

## Basic Eraser Using Canvas Primitives

Disable Fabric free drawing:
```
canvas.isDrawingMode = false;
```

Use the raw context:
```
const ctx = canvas.contextContainer;
```

Implement erasing:
```
let isErasing = false;
let isDown = false;

canvas.on("mouse:down", (opt) => {
  isDown = true;
  const p = canvas.getPointer(opt.e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});

canvas.on("mouse:move", (opt) => {
  if (!isDown || !isErasing) return;
  const p = canvas.getPointer(opt.e);

  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = 30;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  canvas.renderAll();
});

canvas.on("mouse:up", () => {
  isDown = false;
  ctx.globalCompositeOperation = "source-over";
});
```

## Flattening Fabric Objects Into Pixels

Fabric objects are vectors on top of the pixel layer. To erase them destructively:
```
function flattenFabric() {
  const dataUrl = canvas.toDataURL();
  fabric.Image.fromURL(dataUrl, (img) => {
    canvas.clear();
    canvas.add(img);
    canvas.renderAll();
  });
}
```

## Eraser With Stroke Preview

Draw preview on contextTop:
```
const previewCtx = canvas.contextTop;

canvas.on("mouse:move", (opt) => {
  if (!isDown || !isErasing) return;
  const p = canvas.getPointer(opt.e);

  previewCtx.globalCompositeOperation = "source-over";
  previewCtx.lineWidth = 30;
  previewCtx.strokeStyle = "rgba(0,0,0,0.3)";
  previewCtx.lineCap = "round";
  previewCtx.lineJoin = "round";
  previewCtx.lineTo(p.x, p.y);
  previewCtx.stroke();
});
```

Apply final erase on mouseup:
```
canvas.on("mouse:up", () => {
  if (!isErasing) return;

  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(canvas.contextTop.canvas, 0, 0);

  canvas.clearContext(canvas.contextTop);
  canvas.renderAll();
});
```

## Summary

- Erase pixels via Canvas primitives on contextContainer with destination-out.
- Optional: flatten Fabric objects before erasing.
- Optional: use preview layer for smooth UX.
- Provides true transparency erasing, compatible with any rendered content.
