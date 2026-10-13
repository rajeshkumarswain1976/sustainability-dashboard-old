from functools import lru_cache
from pathlib import Path
import yaml
from app.config import settings

ROOT = Path(__file__).resolve().parents[1]

@lru_cache(maxsize=1)
def configuration():
    return yaml.safe_load((ROOT / 'config/terranexus.yaml').read_text(encoding='utf-8'))

def knowledge_directory():
    return ROOT / 'knowledge' / settings.sector
