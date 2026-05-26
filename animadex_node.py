import os
import json
import urllib.request
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
for c in char_data:
    display_name = f"{c.get('name', 'Unknown')} ({c.get('copyright_name', c.get('copyright', 'Unknown'))})"
    c['_display_name'] = display_name
    char_dict[display_name] = c

char_names = list(char_dict.keys())
if not char_names:
    char_names = ["No data loaded"]

# -------------------------------------------------------------
# API Route for Frontend Gallery
# -------------------------------------------------------------
@server.PromptServer.instance.routes.get("/animadex/search")
async def search_characters(request):
    query = request.rel_url.query.get("q", "").lower()
    page = int(request.rel_url.query.get("page", "1"))
    page_size = 50

    # Filter characters based on search query
    if query:
        filtered = [
            c for c in char_data 
            if query in c.get('name', '').lower() 
            or query in c.get('copyright_name', '').lower()
            or query in c.get('trigger', '').lower()
        ]
    else:
        filtered = char_data

    # Pagination
    total = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    results = filtered[start_idx:end_idx]

    return web.json_response({
        "results": results,
        "total": total,
        "page": page,
        "pages": (total + page_size - 1) // page_size
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
                # The dropdown list is still required for the backend graph logic, 
                # but we will hide it in the frontend using JS.
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
