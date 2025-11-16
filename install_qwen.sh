#!/bin/bash

echo "Installing Qwen2.5-VL dependencies for ComfyUI..."
echo

# Check if we're in the right directory
if [ ! -f "requirements_qwen.txt" ]; then
    echo "Error: requirements_qwen.txt not found!"
    echo "Please run this script from the ComfyUI-enricos-nodes directory."
    exit 1
fi

echo "Installing core dependencies..."
pip install -r requirements_qwen.txt

echo
echo "Installation complete!"
echo
echo "Optional: For GGUF model support, run:"
echo "pip install llama-cpp-python"
echo "or for CUDA support:"
echo "pip install llama-cpp-python[cuda]"
echo
echo "See QWEN_INTEGRATION.md for usage instructions."