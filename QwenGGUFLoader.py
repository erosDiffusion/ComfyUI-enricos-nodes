import folder_paths
import torch
import os
from pathlib import Path
from PIL import Image
import numpy as np
import tempfile

def tensor2pil(image: torch.Tensor) -> Image.Image:
    """Convert tensor to PIL Image"""
    return Image.fromarray(np.clip(255. * image.cpu().numpy().squeeze(0), 0, 255).astype(np.uint8))

def pil2tensor(image: Image.Image) -> torch.Tensor:
    """Convert PIL Image to tensor"""
    return torch.from_numpy(np.array(image).astype(np.float32) / 255.0).unsqueeze(0)

# Setup GGUF model directory (reuse LLava checkpoints)
try:
    supported_gguf_extensions = set(['.gguf'])
    if "LLavacheckpoints" in folder_paths.folder_names_and_paths:
        # Extend existing LLavacheckpoints to support GGUF
        existing_paths, existing_exts = folder_paths.folder_names_and_paths["LLavacheckpoints"]
        folder_paths.folder_names_and_paths["LLavacheckpoints"] = (
            existing_paths, 
            existing_exts.union(supported_gguf_extensions)
        )
    else:
        # Create LLavacheckpoints directory
        llava_dir = os.path.join(folder_paths.models_dir, "LLavacheckpoints")
        if not os.path.isdir(llava_dir):
            os.makedirs(llava_dir, exist_ok=True)
        folder_paths.folder_names_and_paths["LLavacheckpoints"] = ([llava_dir], supported_gguf_extensions)
except Exception as e:
    print(f"Error setting up GGUF directory: {e}")

class QwenGGUFLoader:
    """
    Load Qwen2.5-VL models in GGUF format using llama-cpp-python.
    This provides CPU-optimized inference and reduced memory usage.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_file": (folder_paths.get_filename_list("LLavacheckpoints"),),
                "n_ctx": ("INT", {
                    "default": 4096,
                    "min": 512,
                    "max": 32768,
                    "step": 256
                }),
                "n_gpu_layers": ("INT", {
                    "default": 0,
                    "min": 0,
                    "max": 100,
                    "step": 1
                }),
                "n_threads": ("INT", {
                    "default": 8,
                    "min": 1,
                    "max": 32,
                    "step": 1
                }),
            },
            "optional": {
                "clip_model_path": ("STRING", {
                    "default": "",
                    "tooltip": "Path to CLIP/vision model (mmproj) file if separate"
                })
            }
        }
    
    RETURN_TYPES = ("QWEN_GGUF_MODEL",)
    RETURN_NAMES = ("model",)
    FUNCTION = "load_gguf_model"
    CATEGORY = "💜 Enrico's Nodes/Vision Language"

    def __init__(self):
        self.model = None
        self.current_model_file = None

    def load_gguf_model(self, model_file, n_ctx, n_gpu_layers, n_threads, clip_model_path=""):
        """Load Qwen GGUF model using llama-cpp-python"""
        
        try:
            from llama_cpp import Llama
            from llama_cpp.llama_chat_format import Llava15ChatHandler
        except ImportError:
            raise RuntimeError(
                "llama-cpp-python not installed. Install with:\n"
                "pip install llama-cpp-python\n"
                "or for CUDA support:\n"
                "pip install llama-cpp-python[cuda]"
            )
        
        # Check if we can reuse current model
        if self.model is not None and self.current_model_file == model_file:
            print(f"Reusing loaded GGUF model: {model_file}")
            return ({"model": self.model, "model_file": model_file},)
        
        # Clear previous model
        if self.model is not None:
            print("Clearing previous GGUF model...")
            del self.model
            self.model = None
        
        try:
            print(f"Loading GGUF model: {model_file}")
            
            # Get full path to model
            model_path = folder_paths.get_full_path("LLavacheckpoints", model_file)
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found: {model_path}")
            
            # Setup chat handler for vision models if clip path provided
            chat_handler = None
            if clip_model_path and os.path.exists(clip_model_path):
                print(f"Loading vision capabilities from: {clip_model_path}")
                chat_handler = Llava15ChatHandler(clip_model_path=clip_model_path, verbose=False)
            
            # Load the model
            self.model = Llama(
                model_path=model_path,
                chat_handler=chat_handler,
                n_ctx=n_ctx,
                n_gpu_layers=n_gpu_layers,
                n_threads=n_threads,
                verbose=False,
                seed=-1,  # Random seed
                f16_kv=True,
                use_mlock=False,
                use_mmap=True,
                offload_kqv=True,
            )
            
            self.current_model_file = model_file
            print(f"Successfully loaded GGUF model: {model_file}")
            
            return ({"model": self.model, "model_file": model_file},)
            
        except Exception as e:
            error_msg = f"Error loading GGUF model {model_file}: {str(e)}"
            print(error_msg)
            if "CUDA" in str(e):
                error_msg += "\nTry reducing n_gpu_layers or install CUDA-enabled llama-cpp-python."
            raise RuntimeError(error_msg)

class QwenGGUFProcessor:
    """
    Process images and text using loaded Qwen GGUF model.
    Supports both pure text and vision-language capabilities.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("QWEN_GGUF_MODEL",),
                "prompt": ("STRING", {
                    "multiline": True,
                    "default": "Describe this image in detail."
                }),
                "max_tokens": ("INT", {
                    "default": 512,
                    "min": 1,
                    "max": 2048,
                    "step": 1
                }),
                "temperature": ("FLOAT", {
                    "default": 0.7,
                    "min": 0.0,
                    "max": 2.0,
                    "step": 0.1
                }),
                "top_p": ("FLOAT", {
                    "default": 0.9,
                    "min": 0.1,
                    "max": 1.0,
                    "step": 0.1
                }),
            },
            "optional": {
                "image": ("IMAGE", {"tooltip": "Image input for vision-language processing"}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("response",)
    FUNCTION = "process"
    CATEGORY = "💜 Enrico's Nodes/Vision Language"

    def process(self, model, prompt, max_tokens, temperature, top_p, image=None):
        """Process prompt with optional image using GGUF model"""
        
        try:
            llama_model = model["model"]
            
            if image is not None:
                # Vision-language processing
                if not hasattr(llama_model, 'chat_handler') or llama_model.chat_handler is None:
                    return ("Error: Vision processing requires a CLIP model. Please provide clip_model_path when loading the model.",)
                
                # Convert tensor to PIL and save temporarily
                pil_image = tensor2pil(image)
                
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
                    pil_image.save(tmp_file.name)
                    temp_image_path = tmp_file.name
                
                try:
                    # Create chat messages with image
                    messages = [
                        {
                            "role": "user",
                            "content": [
                                {"type": "image_url", "image_url": {"url": f"file://{temp_image_path}"}},
                                {"type": "text", "text": prompt}
                            ]
                        }
                    ]
                    
                    # Generate response
                    response = llama_model.create_chat_completion(
                        messages=messages,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=top_p,
                    )
                    
                    return (response['choices'][0]['message']['content'],)
                
                finally:
                    # Clean up temp file
                    try:
                        os.unlink(temp_image_path)
                    except:
                        pass
            
            else:
                # Text-only processing
                response = llama_model.create_completion(
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                )
                
                return (response['choices'][0]['text'].strip(),)
                
        except Exception as e:
            error_msg = f"Error processing with GGUF model: {str(e)}"
            print(error_msg)
            return (error_msg,)

# Node registration for GGUF nodes
GGUF_NODE_CLASS_MAPPINGS = {
    "QwenGGUFLoader": QwenGGUFLoader,
    "QwenGGUFProcessor": QwenGGUFProcessor,
}

GGUF_NODE_DISPLAY_NAME_MAPPINGS = {
    "QwenGGUFLoader": "💜 Qwen GGUF Loader",
    "QwenGGUFProcessor": "💜 Qwen GGUF Processor",
}