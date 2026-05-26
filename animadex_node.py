import os
import json
import urllib.request
import random
from io import BytesIO
import torch
import numpy as np
from PIL import Image
from aiohttp import web
import server

# Load the scraped characters
current_dir = os.path.dirname(os.path.realpath(__file__))
json_path = os.path.join(current_dir, "animadex_top_characters.json")
try:
    with open(json_path, "r", encoding="utf-8") as f:
        char_data = json.load(f)
except Exception as e:
    print(f"[Animadex] Error loading data: {e}")
    char_data = []

# Map character name + copyright to character dict
char_dict = {}
# Also build metadata for the sidebar
metadata_characters = []
copyright_counts = {}

for c in char_data:
    display_name = f"{c.get('name', 'Unknown')} ({c.get('copyright_name', c.get('copyright', 'Unknown'))})"
    c['_display_name'] = display_name
    char_dict[display_name] = c
    
    c_name = c.get('name', '')
    copy_name = c.get('copyright_name') or c.get('copyright') or 'Unknown'
    count = c.get('count', 0)
    
    metadata_characters.append({
        "name": c_name,
        "display_name": display_name,
        "copyright": copy_name,
        "count": count
    })
    
    if copy_name not in copyright_counts:
        copyright_counts[copy_name] = 0
    copyright_counts[copy_name] += count

# Sort characters and copyrights for the sidebar by count descending
metadata_characters.sort(key=lambda x: x['count'], reverse=True)
metadata_copyrights = [{"name": k, "count": v} for k, v in copyright_counts.items()]
metadata_copyrights.sort(key=lambda x: x['count'], reverse=True)

char_names = list(char_dict.keys())
if not char_names:
    char_names = ["No data loaded"]


# -------------------------------------------------------------
# API Routes for Frontend Gallery
# -------------------------------------------------------------
@server.PromptServer.instance.routes.get("/animadex/metadata")
async def get_metadata(request):
    return web.json_response({
        "characters": metadata_characters,
        "copyrights": metadata_copyrights
    })


@server.PromptServer.instance.routes.get("/animadex/search")
async def search_characters(request):
    query = request.rel_url.query.get("q", "").lower()
    copy_filter = request.rel_url.query.get("copyright", "").lower()
    page = int(request.rel_url.query.get("page", "1"))
    is_random = request.rel_url.query.get("random", "0") == "1"
    favorites = request.rel_url.query.get("favorites", "").split(",")
    fav_filter_only = request.rel_url.query.get("fav_only", "0") == "1"
    
    page_size = 50

    filtered = char_data
    
    # 1. Filter by favorites if toggled
    if fav_filter_only:
        filtered = [c for c in filtered if c.get('_display_name') in favorites]

    # 2. Filter by copyright exact match (case insensitive)
    if copy_filter:
        filtered = [c for c in filtered if (c.get('copyright_name') or c.get('copyright') or '').lower() == copy_filter]

    # 3. Filter by text search query
    if query:
        filtered = [
            c for c in filtered 
            if query in c.get('name', '').lower() 
            or query in (c.get('copyright_name') or c.get('copyright') or '').lower()
            or query in c.get('trigger', '').lower()
        ]

    # 4. Randomize or sort
    if is_random:
        # We copy the list before shuffling so we don't modify the global reference
        filtered = list(filtered)
        random.shuffle(filtered)

    # Pagination
    total = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    results = filtered[start_idx:end_idx]

    return web.json_response({
        "results": results,
        "total": total,
        "page": page,
        "pages": (total + page_size - 1) // page_size if total > 0 else 1
    })

# -------------------------------------------------------------
# Node Class
# -------------------------------------------------------------
class AnimadexCharacterNode:
    """
    A ComfyUI custom node that provides a custom WebUI gallery of Animadex characters.
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "character": (char_names,),
                "use_high_res_image": (["false", "true"], {"default": "false"}),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING", "STRING")
    RETURN_NAMES = ("image", "trigger_words", "prompt_tags")
    FUNCTION = "get_character"
    CATEGORY = "Animadex"

    def get_character(self, character, use_high_res_image):
        if character not in char_dict:
            empty_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            return (empty_image, "", "")

        c = char_dict[character]
        trigger = c.get("trigger", "")
        tags_list = c.get("tags", [])
        tags = ", ".join(tags_list)
        
        url = c.get("img_url") if use_high_res_image == "true" else c.get("thumb_url")
        if not url:
            url = c.get("thumb_url") or c.get("img_url")

        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                image_data = response.read()
            i = Image.open(BytesIO(image_data))
            i = i.convert("RGB")
            image = np.array(i).astype(np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
        except Exception as e:
            print(f"[Animadex] Error downloading image from {url}: {e}")
            image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)

        return (image, trigger, tags)

NODE_CLASS_MAPPINGS = {
    "AnimadexCharacterNode": AnimadexCharacterNode
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AnimadexCharacterNode": "Animadex Character Selector"
}
