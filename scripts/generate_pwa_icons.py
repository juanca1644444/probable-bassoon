from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

out_dir = Path("client/public")
out_dir.mkdir(parents=True, exist_ok=True)

def generate_icon(size, filename, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle or rounded rect
    margin = 0 if maskable else int(size * 0.05)
    bg_color = (0, 168, 132, 255) # Andean emerald #00a884
    
    if maskable:
        draw.rectangle([0, 0, size, size], fill=bg_color)
    else:
        draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=int(size * 0.22), fill=bg_color)
    
    # Inner dark emerald circle for depth
    center = size // 2
    r_inner = int(size * 0.36)
    draw.ellipse([center - r_inner, center - r_inner, center + r_inner, center + r_inner], fill=(17, 27, 33, 230))
    
    # Chasqui messenger lightning / speech shape
    poly = [
        (int(size * 0.52), int(size * 0.26)),
        (int(size * 0.38), int(size * 0.52)),
        (int(size * 0.49), int(size * 0.52)),
        (int(size * 0.44), int(size * 0.74)),
        (int(size * 0.63), int(size * 0.46)),
        (int(size * 0.52), int(size * 0.46)),
    ]
    draw.polygon(poly, fill=(0, 230, 180, 255))
    
    # Save
    out_path = out_dir / filename
    img.save(out_path, "PNG")
    print(f"Generated {out_path} ({size}x{size})")

generate_icon(192, "pwa-192x192.png")
generate_icon(512, "pwa-512x512.png")
generate_icon(512, "maskable-icon-512x512.png", maskable=True)
generate_icon(64, "favicon.png")
