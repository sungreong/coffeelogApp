from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"

CANVAS = 1024
SCALE = 4

ESPRESSO = (36, 24, 20, 255)  # #241814
ESPRESSO_DEEP = (25, 13, 10, 255)  # #190D0A
ROASTED_LIGHT = (193, 116, 48, 255)  # #C17430
ROASTED = (166, 96, 43, 255)  # #A6602B
CREAM = (239, 218, 177, 255)  # #EFDAB1
TRANSPARENT = (0, 0, 0, 0)


def sc(value: float) -> int:
    return round(value * SCALE)


def resample(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.LANCZOS)


def paste_center(base: Image.Image, layer: Image.Image, center: tuple[int, int]) -> None:
    x = round(center[0] - layer.width / 2)
    y = round(center[1] - layer.height / 2)
    base.alpha_composite(layer, (x, y))


def rotate(layer: Image.Image, degrees: float) -> Image.Image:
    return layer.rotate(degrees, resample=Image.Resampling.BICUBIC, expand=True)


def draw_rounded_rect(size: tuple[int, int], radius: int, fill: tuple[int, int, int, int]) -> Image.Image:
    layer = Image.new("RGBA", size, TRANSPARENT)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill)
    return layer


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def gradient(size: tuple[int, int], start: tuple[int, int, int, int], end: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new("RGBA", size, TRANSPARENT)
    px = image.load()
    width, height = size
    for y in range(height):
        for x in range(width):
            t = (x / max(width - 1, 1) * 0.42) + (y / max(height - 1, 1) * 0.58)
            px[x, y] = tuple(lerp(start[i], end[i], t) for i in range(4))
    return image


def ellipse_gradient(
    size: tuple[int, int],
    bounds: tuple[int, int, int, int],
    start: tuple[int, int, int, int],
    end: tuple[int, int, int, int],
) -> Image.Image:
    layer = Image.new("RGBA", size, TRANSPARENT)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(bounds, fill=255)
    layer.alpha_composite(gradient(size, start, end))
    layer.putalpha(mask)
    return layer


def rounded_mask(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius=radius, fill=255)
    rounded = Image.new("RGBA", image.size, TRANSPARENT)
    rounded.alpha_composite(image)
    rounded.putalpha(mask)
    return rounded


def circle_mask(image: Image.Image) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, image.width - 1, image.height - 1), fill=255)
    rounded = Image.new("RGBA", image.size, TRANSPARENT)
    rounded.alpha_composite(image)
    rounded.putalpha(mask)
    return rounded


def cubic_points(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    steps: int = 64,
) -> list[tuple[int, int]]:
    points: list[tuple[int, int]] = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        points.append((round(x), round(y)))
    return points


def draw_round_line(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    width: int,
    fill: tuple[int, int, int, int],
) -> None:
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def make_mark(include_tag: bool = True) -> Image.Image:
    mark = Image.new("RGBA", (sc(CANVAS), sc(CANVAS)), TRANSPARENT)

    if include_tag:
        tag = draw_rounded_rect((sc(232), sc(170)), sc(36), CREAM)
        paste_center(mark, rotate(tag, -8), (sc(668), sc(316)))

    bean = Image.new("RGBA", (sc(520), sc(720)), TRANSPARENT)
    bean_draw = ImageDraw.Draw(bean)
    bean.alpha_composite(
        ellipse_gradient(
            bean.size,
            (sc(48), sc(24), sc(472), sc(696)),
            ROASTED_LIGHT,
            ROASTED,
        )
    )

    crease = cubic_points(
        (sc(288), sc(108)),
        (sc(190), sc(236)),
        (sc(338), sc(348)),
        (sc(242), sc(488)),
    )
    crease += cubic_points(
        (sc(242), sc(486)),
        (sc(184), sc(568)),
        (sc(245), sc(628)),
        (sc(214), sc(662)),
        steps=28,
    )[1:]
    draw_round_line(bean_draw, crease, sc(58), ESPRESSO_DEEP)

    paste_center(mark, rotate(bean, -8), (sc(512), sc(535)))
    return mark


def save_icon_assets() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    full = gradient((sc(CANVAS), sc(CANVAS)), ESPRESSO, ESPRESSO_DEEP)
    full.alpha_composite(make_mark())
    icon = resample(full, (CANVAS, CANVAS)).convert("RGBA")
    icon.save(OUT / "icon.png")

    adaptive = resample(make_mark(), (CANVAS, CANVAS)).convert("RGBA")
    adaptive.save(OUT / "adaptive-icon.png")

    splash = Image.new("RGBA", (sc(CANVAS), sc(CANVAS)), TRANSPARENT)
    tile = rounded_mask(resample(icon, (sc(760), sc(760))), sc(168))
    paste_center(splash, tile, (sc(512), sc(512)))
    resample(splash, (CANVAS, CANVAS)).save(OUT / "splash-icon.png")

    resample(icon, (256, 256)).save(OUT / "favicon.png")

    preview = Image.new("RGBA", (1200, 360), (255, 250, 244, 255))
    x = 40
    for size in (256, 128, 64, 48):
        sample = rounded_mask(resample(icon, (size, size)), max(8, round(size * 0.22)))
        preview.alpha_composite(sample, (x, 80 + (256 - size) // 2))
        x += size + 70
    preview.save(OUT / "logo-preview.png")

    save_android_assets(icon, adaptive)


def save_android_assets(icon: Image.Image, adaptive: Image.Image) -> None:
    launcher_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    foreground_sizes = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
    splash_sizes = {
        "drawable-mdpi": 288,
        "drawable-hdpi": 432,
        "drawable-xhdpi": 576,
        "drawable-xxhdpi": 864,
        "drawable-xxxhdpi": 1152,
    }

    for folder, size in launcher_sizes.items():
        target_dir = ANDROID_RES / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        legacy = rounded_mask(resample(icon, (size, size)), max(8, round(size * 0.22)))
        legacy.save(target_dir / "ic_launcher.webp", quality=95, method=6)
        circle_mask(resample(icon, (size, size))).save(target_dir / "ic_launcher_round.webp", quality=95, method=6)

    for folder, size in foreground_sizes.items():
        target_dir = ANDROID_RES / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        resample(adaptive, (size, size)).save(target_dir / "ic_launcher_foreground.webp", quality=95, method=6)

    for folder, size in splash_sizes.items():
        target_dir = ANDROID_RES / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        resample(icon, (size, size)).save(target_dir / "splashscreen_logo.png")


if __name__ == "__main__":
    save_icon_assets()
