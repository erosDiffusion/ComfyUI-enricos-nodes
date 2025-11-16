# Qwen2.5-VL Integration for ComfyUI

This implementation provides two approaches to integrate Qwen2.5-VL vision-language models into ComfyUI, each with different trade-offs:

## 🚀 Quick Start

### Option 1: Transformers Implementation (Recommended)

1. **Install Dependencies**:

   ```bash
   pip install -r requirements_qwen.txt
   ```

2. **Use the Nodes**:
   - Add "💜 Qwen Vision Loader" node
   - Add "💜 Qwen Vision Processor" node
   - Connect them in your workflow

### Option 2: GGUF Implementation (CPU/Lower Memory)

1. **Install llama-cpp-python**:

   ```bash
   pip install llama-cpp-python
   # Or for CUDA support:
   pip install llama-cpp-python[cuda]
   ```

2. **Download GGUF Models**:

   - Download Qwen2.5-VL GGUF files from Hugging Face
   - Download corresponding CLIP/mmproj files
   - Place them in `ComfyUI/models/LLavacheckpoints/`

3. **Use the Nodes**:
   - Add "💜 Qwen GGUF Loader" node
   - Add "💜 Qwen GGUF Processor" node

## 📋 Node Reference

### Qwen Vision Loader

**Purpose**: Loads Qwen2.5-VL models with memory optimization

**Inputs**:

- `model_name`: Choose from available Qwen2.5-VL models
- `memory_mode`: Memory optimization strategy

**Memory Modes**:

- `Auto`: Full precision (requires most VRAM)
- `8-bit Quantization`: ~50% memory reduction
- `4-bit Quantization`: ~75% memory reduction
- `CPU Offload`: Offload to system RAM

**Output**: `QWEN_VL_MODEL` - Loaded model object

### Qwen Vision Processor

**Purpose**: Process images with text prompts using loaded Qwen model

**Inputs**:

- `model`: Connected from Qwen Vision Loader
- `image`: Input image tensor
- `prompt`: Text instruction/question
- `max_new_tokens`: Maximum response length (1-2048)
- `temperature`: Response creativity (0.1-2.0)
- `top_p`: Nucleus sampling parameter (0.1-1.0)

**Output**: `STRING` - Generated text response

### Qwen GGUF Loader

**Purpose**: Loads Qwen models in GGUF format for CPU inference

**Inputs**:

- `model_file`: GGUF file from LLavacheckpoints folder
- `n_ctx`: Context window size (512-32768)
- `n_gpu_layers`: Layers to offload to GPU (0-100)
- `n_threads`: CPU threads for inference
- `clip_model_path`: Path to vision model (optional)

**Output**: `QWEN_GGUF_MODEL` - Loaded GGUF model

### Qwen GGUF Processor

**Purpose**: Process text/images with GGUF model

**Inputs**:

- `model`: Connected from Qwen GGUF Loader
- `prompt`: Text instruction
- `max_tokens`: Maximum response length
- `temperature`: Response creativity
- `top_p`: Nucleus sampling
- `image`: Optional image input

**Output**: `STRING` - Generated text response

## 🎯 Use Cases

### Image Captioning

```
Prompt: "Describe this image in detail."
```

### Visual Question Answering

```
Prompt: "What color is the car in the image?"
```

### OCR/Text Extraction

```
Prompt: "Extract all text visible in this image."
```

### Creative Description

```
Prompt: "Write a creative story inspired by this image."
```

### Technical Analysis

```
Prompt: "Analyze the technical aspects and composition of this photograph."
```

## ⚙️ Model Management

### ComfyUI Integration Benefits

1. **No Double Loading**: The nodes integrate with ComfyUI's model management system
2. **Memory Efficiency**: Models are cached and reused across workflow runs
3. **Automatic Cleanup**: Memory is properly managed when switching models
4. **Folder Integration**: Uses ComfyUI's standard model folder structure

### Model Storage

- **Transformers models**: Auto-downloaded to `ComfyUI/models/QwenVL/`
- **GGUF models**: Place manually in `ComfyUI/models/LLavacheckpoints/`

## 🔧 Troubleshooting

### Common Issues

1. **VRAM Out of Memory**:

   - Use more aggressive quantization (4-bit)
   - Choose smaller model (3B instead of 7B)
   - Enable CPU offload

2. **Slow Performance**:

   - Increase `n_gpu_layers` for GGUF models
   - Use transformers implementation for GPU inference
   - Ensure CUDA is properly installed

3. **Import Errors**:
   - Install all requirements: `pip install -r requirements_qwen.txt`
   - For GGUF: `pip install llama-cpp-python`

### Performance Tips

1. **First Run**: Models download automatically (may take time)
2. **Keep Loaded**: Leave models loaded between runs for better performance
3. **Batch Processing**: Process multiple images without reloading model
4. **GPU vs CPU**: Use transformers for GPU, GGUF for CPU/memory-constrained setups

## 🆚 Implementation Comparison

| Feature            | Transformers        | GGUF                  |
| ------------------ | ------------------- | --------------------- |
| Performance        | Fast (GPU)          | Moderate (CPU)        |
| Memory Usage       | High                | Low                   |
| Setup Complexity   | Easy                | Moderate              |
| Model Availability | All official models | Limited GGUF versions |
| Quantization       | 4/8-bit             | Multiple levels       |
| Platform Support   | CUDA required       | CPU + optional GPU    |

## 📚 Advanced Usage

### Custom Prompts

The models support various prompt formats:

```python
# System-style prompts
"You are a helpful assistant that describes images. Describe this image:"

# Direct questions
"What objects can you see in this image?"

# Specific instructions
"List all the text visible in this image, maintaining the original formatting."

# Creative tasks
"Create a detailed art analysis of this image, discussing composition, color theory, and artistic techniques."
```

### Integration with Other Nodes

These nodes output standard ComfyUI STRING types, making them compatible with:

- Text processing nodes
- Conditional logic nodes
- Output/save nodes
- Any node accepting string input

### Model Selection Guidelines

- **Qwen2.5-VL-3B**: Fastest, good for simple tasks
- **Qwen2.5-VL-7B**: Balanced performance and quality (recommended)
- **Qwen2.5-VL-32B/72B**: Best quality, requires significant VRAM

Choose quantized versions (AWQ/GPTQ) for reduced memory usage with minimal quality loss.
