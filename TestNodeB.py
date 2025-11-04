import os
import hashlib
from PIL import Image
import numpy as np
import torch
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io
import folder_paths
from server import PromptServer
from comfy_execution.graph import ExecutionBlocker


class TestNodeB(io.ComfyNode):
    """
    Test Node B: Receives image and seed, saves image to fixed location,
    blocks execution when seed changes, and auto-continues via frontend.
    the seed is given by the config node TestNodeA.
    """
    
    # Cache: node_id -> last_seed
    seedCache = {}
    
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="TestNodeB",
            display_name="Test Node B (Blocker)",
            category="test",
            description="Test blocker node - blocks when seed changes, auto-continues via frontend",
            inputs=[
                io.String.Input("seed", tooltip="Seed from TestNodeA"),
                io.String.Input("filename", tooltip="Original filename from TestNodeA"),
                io.Boolean.Input(
                    "grab_and_continue", 
                    tooltip="Auto-continue setting from TestNodeA"
                ),
                io.String.Input(
                    "uploaded_image",
                    default="",
                    tooltip="Fixed filename for uploaded image (set by frontend)"
                ),
                io.String.Input(
                    "snapshot_data",
                    default="{}",
                    tooltip="Cache invalidator - JSON with seed and timestamp"
                ),
            ],
            outputs=[
                io.String.Output(display_name="seed_out", tooltip="Pass-through seed"),
                io.String.Output(display_name="filename_out", tooltip="Pass-through filename"),
                io.String.Output(display_name="status", tooltip="Execution status"),
                io.Image.Output(display_name="composition", tooltip="Processed image"),
            ],
            hidden=[
                io.Hidden.unique_id,
            ],
        )

    @classmethod
    def execute(cls,  seed, filename, grab_and_continue, uploaded_image, snapshot_data) -> io.NodeOutput:
        
        node_id  = node_id=cls.hidden.unique_id
        print(f"\n[TestNodeB] ========== EXECUTE ==========")
        print(f"[TestNodeB] node_id={node_id}")
        print(f"[TestNodeB] seed={seed}")
        # input
        print(f"[TestNodeB] filename={filename}")
        print(f"[TestNodeB] grab_and_continue={grab_and_continue}")
        #frontend upload filename
        print(f"[TestNodeB] uploaded_image={uploaded_image}")
        print(f"[TestNodeB] snapshot_data={snapshot_data}")
        
        # Check if seed changed
        cached_seed = cls.seedCache.get(node_id)
        seed_changed = cached_seed != seed
        
        print(f"[TestNodeB] cached_seed={cached_seed}")
        print(f"[TestNodeB] seed_changed={seed_changed}")
        
        # Update cache
        cls.seedCache[node_id] = seed
        
        # Determine if we should block
        should_block = seed_changed
        
        if should_block:
            print(f"[TestNodeB] BLOCKING - Seed changed, sending init event")
            
            # Send init event to frontend BEFORE blocking
            PromptServer.instance.send_sync(
                "test_node_b_init",
                {
                    "node": node_id,
                    "output": {
                        "seed": [seed],
                        "filename": [filename],  # Send filename from TestNodeA
                        "seed_changed": [True],
                        "grab_and_continue": [grab_and_continue],
                    }
                }
            )
            
            # Block execution - return ExecutionBlocker for all 4 outputs
            return (
                ExecutionBlocker(None),  # seed_out
                ExecutionBlocker(None),  # filename_out
                ExecutionBlocker(None),  # status
                ExecutionBlocker(None),  # uploaded_image_out
            )
        else:
            # Not blocking - either seed didn't change or not in auto-continue mode
            print(f"[TestNodeB] NOT BLOCKING - continuing normally")
        
        # Try to load the uploaded image if it exists
        
        composition = None
        if uploaded_image:
            input_dir = folder_paths.get_input_directory()
            test_folder = os.path.join(input_dir, "test_node_b")
            uploaded_path = os.path.join(test_folder, "test_node_b_snapshot.png")
            if os.path.exists(uploaded_path):
                print(f"[TestNodeB] Loading uploaded image from: {uploaded_path}")
                try:
                    pil_uploaded = Image.open(uploaded_path).convert("RGB")
                    np_uploaded = np.array(pil_uploaded).astype(np.float32) / 255.0
                    tensor_uploaded = torch.from_numpy(np_uploaded)[None,]  # Add batch dimension
                    composition = tensor_uploaded
                    print(f"[TestNodeB] Loaded uploaded image successfully")
                except Exception as e:
                    print(f"[TestNodeB] Failed to load uploaded image: {e}")
        
        status = "SUCCESS - Continued after frontend processing"
        
        print(f"[TestNodeB] Returning: seed_out={seed}, status={status}")
        print(f"[TestNodeB] =============================\n")
        
        return io.NodeOutput(seed, filename, status, composition)


class TestNodeBExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [TestNodeB]


async def test_node_b_entrypoint() -> TestNodeBExtension:
    return TestNodeBExtension()
