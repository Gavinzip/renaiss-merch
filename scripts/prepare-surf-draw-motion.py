"""Derive a transparent, frame-controlled draw animation from the approved film.

Requires numpy, OpenCV and Pillow. No generated/replaced artwork is used.
Usage: python scripts/prepare-surf-draw-motion.py --ffmpeg /path/to/ffmpeg
The film and intermediate RGB remain in work/, never in public/ or dist/.
"""
import argparse
import hashlib
import json
import subprocess
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'work/generated-videos/2026-10-07-surf-box-open-4s-v1/surf-box-forward-1080p-source-v2.mp4'
OUT = ROOT / 'work/derived-media/surf-draw-box-alpha-v2'
WIDTH, HEIGHT, TILE, COLUMNS, ROWS = 1920, 1080, 768, 5, 3


def isolate(rgb):
    # Seed the dark connected box, then classify only its narrow contour band.
    seed = (rgb.min(axis=2) < 110).astype(np.uint8)
    seed[:100] = 0
    seed[1000:] = 0
    seed[:, :160] = 0
    seed[:, 1780:] = 0
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(seed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    silhouette = np.zeros((HEIGHT, WIDTH), np.uint8)
    cv2.drawContours(silhouette, [max(contours, key=cv2.contourArea)], -1, 1, -1)
    kernel = np.ones((13, 13), np.uint8)
    inner = cv2.erode(silhouette, kernel)
    outer = cv2.dilate(silhouette, kernel)
    labels = np.zeros_like(silhouette)
    labels[outer == 1] = cv2.GC_PR_BGD
    labels[silhouette == 1] = cv2.GC_PR_FGD
    labels[inner == 1] = cv2.GC_FGD
    cv2.grabCut(rgb, labels, None, np.zeros((1, 65)), np.zeros((1, 65)), 2, cv2.GC_INIT_WITH_MASK)
    solid = np.isin(labels, [cv2.GC_FGD, cv2.GC_PR_FGD]).astype(np.uint8)
    contours, _ = cv2.findContours(solid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    solid[:] = 0
    # Remove classifier pixel steps at source resolution, not after enlargement.
    contour = cv2.approxPolyDP(max(contours, key=cv2.contourArea), 1.0, True)
    cv2.drawContours(solid, [contour], -1, 255, -1)
    # The lid is a convex metal panel. Its broad specular highlight resembles
    # the backdrop in a few opening frames; preserve that surface geometrically.
    # Limit the constraint to the upper edge so the open side gaps stay clear.
    _, top, _, height = cv2.boundingRect(contour)
    band = solid[:top + min(130, int(height * .22))]
    points = cv2.findNonZero(band)
    cv2.fillConvexPoly(solid, cv2.convexHull(points), 255)
    # Subpixel edge, with edge colours extended from inside the box. This removes
    # the pastel spill without deleting enclosed white lettering or coin logos.
    opaque = cv2.erode(solid, np.ones((5, 5), np.uint8))
    _, nearest = cv2.distanceTransformWithLabels(255 - opaque, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    palette = rgb[opaque > 0]
    edge_rgb = palette[np.maximum(nearest - 1, 0)]
    alpha = cv2.GaussianBlur(solid, (5, 5), .8)
    colour = rgb.copy()
    edge = (alpha > 0) & (opaque == 0)
    colour[edge] = edge_rgb[edge]
    return np.dstack((colour, alpha)), cv2.boundingRect(contour)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    # Keep the genuinely closed first frame, compress the almost-still lead,
    # then retain every frame of the opening. Drop only the stationary tail.
    indices = list(range(0, 25, 6)) + list(range(25, 85))
    cells = []
    bounds = []
    # Read original 1080p pixels from a pipe, without creating a 600MB RGB file.
    decoder = subprocess.Popen([args.ffmpeg, '-v', 'error', '-i', str(SOURCE),
        '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], stdout=subprocess.PIPE)
    try:
        for n in range(97):
            data = decoder.stdout.read(WIDTH * HEIGHT * 3)
            if len(data) != WIDTH * HEIGHT * 3:
                raise RuntimeError(f'incomplete_source_frame_{n}')
            if n not in indices:
                continue
            rgb = np.frombuffer(data, np.uint8).reshape(HEIGHT, WIDTH, 3)
            rgba, (x, y, w, h) = isolate(rgb)
            # Premultiply before resampling: transparent pastel pixels cannot
            # bleed into a metal edge. Only the alpha contour is softened.
            pixels = rgba.astype(np.float32) / 255
            pixels[:, :, :3] *= pixels[:, :, 3:4]
            scale = .825
            matrix = np.float32([[scale, 0, TILE / 2 - (x + w / 2) * scale],
                                 [0, scale, TILE * 474 / 512 - (y + h) * scale]])
            pixels = np.clip(cv2.warpAffine(pixels, matrix, (TILE, TILE), flags=cv2.INTER_CUBIC), 0, 1)
            pixels[:, :, :3] /= np.maximum(pixels[:, :, 3:4], 1 / 255)
            cells.append(Image.fromarray(np.uint8(np.clip(pixels, 0, 1) * 255 + .5)))
            bounds.append([x, y, w, h])
            print(f'prepared {len(cells)}/{len(indices)}', flush=True)
    finally:
        decoder.stdout.close()
        decoder.wait()
    if decoder.returncode:
        raise RuntimeError('source_decode_failed')
    atlases = []
    boxes = [image.getbbox() for image in cells]
    crop = (min(box[0] for box in boxes), min(box[1] for box in boxes),
            max(box[2] for box in boxes), max(box[3] for box in boxes))
    cell_width, cell_height = crop[2] - crop[0], crop[3] - crop[1]
    capacity = COLUMNS * ROWS
    for page in range((len(cells) + capacity - 1) // capacity):
        selected = cells[page * capacity:(page + 1) * capacity]
        columns = min(COLUMNS, len(selected))
        rows = (len(selected) + columns - 1) // columns
        # Discard only shared transparent padding, retain each frame's exact
        # canvas coordinates. This reduces decoded memory without downsampling.
        atlas = Image.new('RGBA', (cell_width * columns, cell_height * rows))
        for cell, image in enumerate(selected):
            atlas.paste(image.crop(crop), ((cell % columns) * cell_width, (cell // columns) * cell_height))
        encoded = BytesIO()
        atlas.save(encoded, format='WEBP', quality=92, method=6, exact=True)
        data = encoded.getvalue()
        name = f'box-alpha-{page + 1:02d}-{hashlib.sha256(data).hexdigest()[:12]}.webp'
        (OUT / name).write_bytes(data)
        atlases.append({'file': name, 'frames': len(selected), 'columns': columns, 'rows': rows, 'bytes': len(data)})
    manifest = {'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                'sourceFrames': indices, 'frames': len(cells), 'tile': TILE, 'columns': COLUMNS,
                'rows': ROWS, 'cellWidth': cell_width, 'cellHeight': cell_height,
                'offsetX': crop[0], 'offsetY': crop[1],
                'durationMs': 1600, 'atlases': atlases, 'bounds': bounds}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    contact = Image.new('RGB', (TILE * 4, TILE * 2), '#f5f0ed')
    for i, n in enumerate([0, 10, 15, 20, 25, 30, 40, 64]):
        contact.paste(cells[n], ((i % 4) * TILE, (i // 4) * TILE), cells[n])
        ImageDraw.Draw(contact).text(((i % 4) * TILE + 15, (i // 4) * TILE + 15), f'frame {indices[n]}', fill='#86788e')
    contact.save(OUT / 'matte-review.jpg', quality=93)
    client_manifest = {key: manifest[key] for key in ['frames', 'tile', 'columns', 'rows',
        'cellWidth', 'cellHeight', 'offsetX', 'offsetY', 'durationMs', 'atlases']}
    (ROOT / 'src/components/RenaissHub/draw-effects/surf-box-motion.json').write_text(json.dumps(client_manifest, indent=2) + '\n')
    print(json.dumps({'frames': len(cells), 'atlases': atlases}, indent=2))


if __name__ == '__main__':
    main()
