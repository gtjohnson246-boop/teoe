#!/usr/bin/env python3

import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 800
HEIGHT = 200
TEXT = "i am coming"
FONT_FILE = "Creepster-Regular.ttf"
OUTPUT_PATH = Path("output.png")
FRAME_TEMPLATE = "frame_{:03d}.png"


def ensure_font() -> Path:
    font_path = Path(FONT_FILE)
    if font_path.exists():
        return font_path

    if Path("download_font.py").exists():
        subprocess.run(["python3", "download_font.py"], check=True)
        if font_path.exists():
            return font_path

    raise FileNotFoundError(f"Could not find {FONT_FILE}")


def render_frames() -> None:
    font_path = ensure_font()
    font = ImageFont.truetype(str(font_path), 54)
    alpha = 0
    fade_speed = 5
    loop_count = 0
    fading_in = True
    frames = []

    while loop_count < 2:
        if fading_in:
            alpha += fade_speed
            if alpha >= 255:
                alpha = 255
                fading_in = False
        else:
            alpha -= fade_speed
            if alpha <= 0:
                alpha = 0
                fading_in = True
                loop_count += 1

        frames.append(alpha)

    for index, alpha in enumerate(frames):
        image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
        draw = ImageDraw.Draw(image)
        draw.text((50, 50), TEXT, font=font, fill=(255, 255, 255, alpha))
        frame_path = Path(FRAME_TEMPLATE.format(index))
        image.save(frame_path)

    final_image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw = ImageDraw.Draw(final_image)
    draw.text((50, 50), TEXT, font=font, fill=(255, 255, 255, 255))
    final_image.save(OUTPUT_PATH)


if __name__ == "__main__":
    render_frames()
    print(f"Rendered {len(list(Path('.').glob('frame_*.png')))} frames and saved {OUTPUT_PATH}")
