import folder_paths
import torch
import os
from pathlib import Path
from PIL import Image
import numpy as np
from transformers import AutoModelForVision2Seq, AutoTokenizer, AutoProcessor, BitsAndBytesConfig
from qwen_vl_utils import process_vision_info
import psutil
from huggingface_hub import snapshot_download

def tensor2pil(image: torch.Tensor) -> Image.Image:
    """Convert tensor to PIL Image"""
    return Image.fromarray(np.clip(255. * image.cpu().numpy().squeeze(0), 0, 255).astype(np.uint8))

def pil2tensor(image: Image.Image) -> torch.Tensor:
    """Convert PIL Image to tensor"""
    return torch.from_numpy(np.array(image).astype(np.float32) / 255.0).unsqueeze(0)

def check_flash_attention():
    """Check if flash attention 2 is available"""
    try:
        import flash_attn
        return True
    except ImportError:
        return False

# Setup model directory
FLASH_ATTENTION_AVAILABLE = check_flash_attention()

# Ensure the QwenVL directory exists in ComfyUI's model structure
supported_qwen_extensions = set(['.safetensors', '.bin', '.gguf'])

try:
    # Try to extend existing LLava checkpoints folder to include Qwen models
    folder_paths.folder_names_and_paths["QwenVL"] = (
        folder_paths.folder_names_and_paths.get("LLavacheckpoints", ([],))[0] + 
        [os.path.join(folder_paths.models_dir, "QwenVL")], 
        supported_qwen_extensions
    )
except:
    # Create new QwenVL folder if needed
    qwen_dir = os.path.join(folder_paths.models_dir, "QwenVL")
    if not os.path.isdir(qwen_dir):
        os.makedirs(qwen_dir, exist_ok=True)
    folder_paths.folder_names_and_paths["QwenVL"] = ([qwen_dir], supported_qwen_extensions)

# Define available models and their configurations
QWEN2_5_VL_MODELS = {
    "Qwen2.5-VL-3B-Instruct": "Qwen/Qwen2.5-VL-3B-Instruct",
    "Qwen2.5-VL-7B-Instruct": "Qwen/Qwen2.5-VL-7B-Instruct",
    "Qwen2.5-VL-32B-Instruct": "Qwen/Qwen2.5-VL-32B-Instruct",
    "Qwen2.5-VL-72B-Instruct": "Qwen/Qwen2.5-VL-72B-Instruct",
}

# Memory optimization configurations
MEMORY_CONFIGS = {
    "Auto": {
        "load_in_8bit": False,
        "load_in_4bit": False,
        "cpu_offload": False,
    },
    "8-bit Quantization": {
        "load_in_8bit": True,
        "load_in_4bit": False,
        "cpu_offload": False,
    },
    "4-bit Quantization": {
        "load_in_8bit": False,
        "load_in_4bit": True,
        "cpu_offload": False,
    },
    "CPU Offload": {
        "load_in_8bit": False,
        "load_in_4bit": False,
        "cpu_offload": True,
    },
}

class QwenVisionLoader:
    """
    Load Qwen2.5-VL models for vision-language processing.
    This loader integrates with ComfyUI's model management system.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_name": (list(QWEN2_5_VL_MODELS.keys()),),
                "memory_mode": (list(MEMORY_CONFIGS.keys()),),
            }
        }
    
    RETURN_TYPES = ("QWEN_VL_MODEL",)
    RETURN_NAMES = ("model",)
    FUNCTION = "load_model"
    CATEGORY = "💜 Enrico's Nodes/Vision Language"

    def __init__(self):
        self.model = None
        self.processor = None
        self.tokenizer = None
        self.current_model_name = None
        self.current_memory_mode = None

    def load_model(self, model_name, memory_mode):
        """Load or reuse Qwen2.5-VL model with specified configuration"""
        
        # Check if we can reuse the current model
        if (self.model is not None and 
            self.current_model_name == model_name and 
            self.current_memory_mode == memory_mode):
            print(f"Reusing loaded model: {model_name}")
            return ({"model": self.model, "processor": self.processor, "tokenizer": self.tokenizer},)
        
        # Clear previous model if needed
        if self.model is not None:
            print("Clearing previous model...")
            del self.model
            del self.processor
            del self.tokenizer
            torch.cuda.empty_cache()
        
        try:
            print(f"Loading Qwen2.5-VL model: {model_name} with {memory_mode} configuration")
            
            model_id = QWEN2_5_VL_MODELS[model_name]
            config = MEMORY_CONFIGS[memory_mode]
            
            # Check if model exists locally, otherwise download
            model_dir = os.path.join(folder_paths.folder_names_and_paths["QwenVL"][0][0], model_name)
            if not os.path.exists(model_dir) or not os.listdir(model_dir):
                print(f"Downloading model to: {model_dir}")
                model_path = snapshot_download(
                    model_id,
                    local_dir=model_dir,
                    force_download=False,
                    local_files_only=False,
                )
            else:
                print(f"Using local model from: {model_dir}")
                model_path = model_dir
            
            # Setup model kwargs based on memory configuration
            model_kwargs = {
                "trust_remote_code": True,
                "torch_dtype": torch.float16 if torch.cuda.is_available() else torch.float32,
            }
            
            # Configure quantization if specified
            quantization_config = None
            if config["load_in_8bit"]:
                quantization_config = BitsAndBytesConfig(load_in_8bit=True)
                model_kwargs["quantization_config"] = quantization_config
            elif config["load_in_4bit"]:
                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_use_double_quant=True,
                )
                model_kwargs["quantization_config"] = quantization_config
            
            if config["cpu_offload"]:
                model_kwargs["device_map"] = "auto"
            
            # Add flash attention if available
            if FLASH_ATTENTION_AVAILABLE:
                try:
                    model_kwargs["attn_implementation"] = "flash_attention_2"
                except Exception as e:
                    print(f"Flash Attention 2 not available: {e}")
            
            # Load the model
            self.model = AutoModelForVision2Seq.from_pretrained(model_path, **model_kwargs)
            self.processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)
            self.tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
            
            # Store current configuration
            self.current_model_name = model_name
            self.current_memory_mode = memory_mode
            
            print(f"Successfully loaded {model_name}")
            
            return ({"model": self.model, "processor": self.processor, "tokenizer": self.tokenizer},)
            
        except Exception as e:
            print(f"Error loading model {model_name}: {str(e)}")
            error_msg = f"Failed to load {model_name}: {str(e)}"
            if "out of memory" in str(e).lower():
                error_msg += "\nTry using a more aggressive memory optimization mode or a smaller model."
            raise RuntimeError(error_msg)

class QwenVisionProcessor:
    """
    Process images and text using loaded Qwen2.5-VL model.
    This node handles image captioning, visual question answering, and text extraction.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("QWEN_VL_MODEL",),
                "image": ("IMAGE",),
                "prompt": ("STRING", {
                    "multiline": True,
                    "default": "Describe this image in detail."
                }),
                "max_new_tokens": ("INT", {
                    "default": 512,
                    "min": 1,
                    "max": 2048,
                    "step": 1
                }),
                "temperature": ("FLOAT", {
                    "default": 0.7,
                    "min": 0.1,
                    "max": 2.0,
                    "step": 0.1
                }),
                "top_p": ("FLOAT", {
                    "default": 0.9,
                    "min": 0.1,
                    "max": 1.0,
                    "step": 0.1
                }),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("response",)
    FUNCTION = "process_image"
    CATEGORY = "💜 Enrico's Nodes/Vision Language"

    def process_image(self, model, image, prompt, max_new_tokens, temperature, top_p):
        """Process image with text prompt using Qwen2.5-VL"""
        
        try:
            # Extract model components
            qwen_model = model["model"]
            processor = model["processor"]
            tokenizer = model["tokenizer"]
            
            # Convert tensor image to PIL
            pil_image = tensor2pil(image)
            
            # Create temp file for image (Qwen models expect file path)
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
                pil_image.save(tmp_file.name)
                temp_image_path = tmp_file.name
            
            try:
                # Prepare messages for the model
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image", "image": temp_image_path},
                            {"type": "text", "text": prompt}
                        ]
                    }
                ]
                
                # Process the inputs
                text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
                image_inputs, video_inputs = process_vision_info(messages)
                
                inputs = processor(
                    text=[text],
                    images=image_inputs,
                    videos=video_inputs,
                    return_tensors="pt",
                    padding=True
                )
                
                # Move inputs to the same device as model
                device = next(qwen_model.parameters()).device
                inputs = {k: v.to(device) for k, v in inputs.items()}
                
                # Generate response
                with torch.no_grad():
                    output_ids = qwen_model.generate(
                        **inputs,
                        max_new_tokens=max_new_tokens,
                        temperature=temperature,
                        top_p=top_p,
                        do_sample=temperature > 0,
                        pad_token_id=tokenizer.pad_token_id,
                        eos_token_id=tokenizer.eos_token_id
                    )
                
                # Decode response
                generated_ids = output_ids[0][inputs["input_ids"].shape[1]:]
                response = tokenizer.decode(generated_ids, skip_special_tokens=True)
                
                return (response.strip(),)
                
            finally:
                # Clean up temp file
                try:
                    os.unlink(temp_image_path)
                except:
                    pass
                    
        except Exception as e:
            error_msg = f"Error processing image: {str(e)}"
            print(error_msg)
            return (error_msg,)

# Node registration
NODE_CLASS_MAPPINGS = {
    "QwenVisionLoader": QwenVisionLoader,
    "QwenVisionProcessor": QwenVisionProcessor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "QwenVisionLoader": "💜 Qwen Vision Loader",
    "QwenVisionProcessor": "💜 Qwen Vision Processor",
}