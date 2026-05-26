import os
import json
import urllib.request
from io import BytesIO
import torch
import numpy as np
from PIL import Image

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
    # Use name and copyright to create a unique display name
    display_name = f"{c.get('name', 'Unknown')} ({c.get('copyright_name', c.get('copyright', 'Unknown'))})"
    char_dict[display_name] = c

char_names = list(char_dict.keys())
if not char_names:
    char_names = ["No data loaded"]

class AnimadexCharacterNode:
    """
    A ComfyUI custom node that provides a dropdown of Animadex characters,
    outputting their image, trigger words, and prompt tags.
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
            # Fallback for empty data
            empty_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            return (empty_image, "", "")

        c = char_dict[character]
        trigger = c.get("trigger", "")
        tags_list = c.get("tags", [])
        tags = ", ".join(tags_list)
        
        # Determine image URL
        url = c.get("img_url") if use_high_res_image == "true" else c.get("thumb_url")
        if not url:
            url = c.get("thumb_url") or c.get("img_url")

        # Download image
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                image_data = response.read()
            i = Image.open(BytesIO(image_data))
            i = i.convert("RGB")
            # Convert PIL image to ComfyUI tensor format (Batch, Height, Width, Channels)
            image = np.array(i).astype(np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
        except Exception as e:
            print(f"[Animadex] Error downloading image from {url}: {e}")
            # Return a blank 64x64 image on failure
            image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)

        return (image, trigger, tags)

NODE_CLASS_MAPPINGS = {
    "AnimadexCharacterNode": AnimadexCharacterNode
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AnimadexCharacterNode": "Animadex Character Selector"
}
