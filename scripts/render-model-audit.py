"""Render the currently served botanical assets into one review sheet."""
from asset_geometry import load, render
from pathlib import Path
from PIL import Image
import math

root = Path(__file__).resolve().parents[1]
models = sorted((root / 'public' / 'models').glob('*.glb'))
thumbs = Path('/tmp/bloomroom-assets/model-audit-thumbs')
thumbs.mkdir(parents=True, exist_ok=True)
size = 300
sheet = Image.new('RGB', (size * 5, size * math.ceil(len(models) / 5)), (236, 233, 224))
for index, model in enumerate(models):
    thumb = thumbs / f'{model.stem}.png'
    render(load(model), thumb, model.stem, size=size)
    sheet.paste(Image.open(thumb), ((index % 5) * size, (index // 5) * size))
    print(model.stem, flush=True)
sheet.save(root / 'docs' / 'model-audit.jpg', quality=90)
