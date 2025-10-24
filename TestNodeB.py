from server import PromptServer
from comfy_execution.graph import ExecutionBlocker
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io
import numpy as np
import torch
import random
import folder_paths
from PIL import Image, ImageOps


class TestNodeB(io.ComfyNode):
    """
    Test Node B: Receives seed and filename from Node A, sends init event, blocks execution.
    If grab_and_continue is true, auto-continues after simulated upload.
    """
    
    # Cache: node_id -> last_seed
    seedCache = {}
    
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="TestNodeB",
            display_name="Test Node B (Blocker)",
            category="test",
            description="Test blocker node - detects seed changes and blocks execution",
            inputs=[
                io.Int.Input("seed", tooltip="Seed from Node A"),
                io.String.Input("filename", tooltip="Filename from Node A"),
                io.Boolean.Input("grab_and_continue", default=False, tooltip="Auto-continue after blocking"),
                io.String.Input("uploaded_image", default="test_node_b_snapshot.png", multiline=False, tooltip="Fixed filename for uploaded snapshot"),
                io.String.Input("snapshot_data", default="{}", multiline=False, tooltip="JSON data with seed for cache invalidation"),
            ],
            outputs=[
                io.Int.Output(display_name="seed_out", tooltip="Seed value (passed through)"),
                io.String.Output(display_name="filename_out", tooltip="Filename (passed through)"),
                io.String.Output(display_name="status", tooltip="Status message"),
                io.Image.Output(display_name="uploaded_image_out", tooltip="Uploaded image loaded from disk"),
            ],
            hidden=[
                io.Hidden.unique_id,
            ],
            is_output_node=True,
        )

    @classmethod
    def execute(cls, seed, filename, grab_and_continue, uploaded_image, snapshot_data) -> io.NodeOutput:
        node_id = cls.hidden.unique_id if cls.hidden else None
        
        print(f"\n[TestNodeB] ========== EXECUTE ==========")
        print(f"[TestNodeB] node_id={node_id}")
        print(f"[TestNodeB] seed={seed}")
        print(f"[TestNodeB] filename={filename}")
        print(f"[TestNodeB] grab_and_continue={grab_and_continue}")
        print(f"[TestNodeB] uploaded_image={uploaded_image}")
        print(f"[TestNodeB] snapshot_data={snapshot_data}")
        
        # Check if seed changed
        cached_seed = cls.seedCache.get(node_id)
        seed_changed = cached_seed != seed
        
        print(f"[TestNodeB] cached_seed={cached_seed}")
        print(f"[TestNodeB] seed_changed={seed_changed}")
        
        # Update cache
        cls.seedCache[node_id] = seed
        
        # Send init event BEFORE blocking
        ui = {
            "seed": [seed],
            "filename": [filename],
            "seed_changed": [seed_changed],
            "grab_and_continue": [grab_and_continue],
            "uploaded_image": [uploaded_image],
            "snapshot_data": [snapshot_data],
        }
        
        print(f"[TestNodeB] Sending test_node_b_init event")
        detail = {"output": ui, "node": node_id}
        PromptServer.instance.send_sync("test_node_b_init", detail)
        
        # If seed changed, block execution
        if seed_changed:
            print(f"[TestNodeB] Seed changed - BLOCKING execution")
            print(f"[TestNodeB] ================================\n")
            blocker_result = tuple([ExecutionBlocker(None)] * 4)  # 4 outputs now
            return io.NodeOutput(*blocker_result, ui=ui)
        
        # Seed unchanged - continue normally
        # Load the uploaded image from disk
        uploaded_image_tensor = None
        if uploaded_image and uploaded_image != "":
            try:
                # Construct path to uploaded image in input folder
                image_path = folder_paths.get_annotated_filepath(f"test_node_b/{uploaded_image} [input]")
                print(f"[TestNodeB] Loading uploaded image from: {image_path}")
                
                i = Image.open(image_path)
                i = ImageOps.exif_transpose(i)
                if i.mode == 'I':
                    i = i.point(lambda i: i * (1 / 255))
                image = i.convert("RGB")
                image_array = np.array(image).astype(np.float32) / 255.0
                uploaded_image_tensor = torch.from_numpy(image_array)[None, ]
                print(f"[TestNodeB] Successfully loaded image: {uploaded_image}")
            except Exception as e:
                print(f"[TestNodeB] Failed to load image: {e}")
                # Generate fallback random colored image
                r = random.random()
                g = random.random()
                b = random.random()
                image_array = np.full((512, 512, 3), [r, g, b], dtype=np.float32)
                uploaded_image_tensor = torch.from_numpy(image_array)[None, ]
        else:
            # No uploaded image - generate random colored image
            print(f"[TestNodeB] No uploaded image, generating random color")
            r = random.random()
            g = random.random()
            b = random.random()
            image_array = np.full((512, 512, 3), [r, g, b], dtype=np.float32)
            uploaded_image_tensor = torch.from_numpy(image_array)[None, ]
        
        status = f"Success: seed={seed}, uploaded_image={uploaded_image}"
        print(f"[TestNodeB] Seed unchanged - continuing normally")
        print(f"[TestNodeB] status={status}")
        print(f"[TestNodeB] ================================\n")
        
        return io.NodeOutput(seed, filename, status, uploaded_image_tensor, ui=ui)


class TestNodeBExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [TestNodeB]


async def test_node_b_entrypoint() -> TestNodeBExtension:
    return TestNodeBExtension()
