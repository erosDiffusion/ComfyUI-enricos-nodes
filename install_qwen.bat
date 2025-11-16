@echo off
echo Installing Qwen2.5-VL dependencies for ComfyUI...
echo.

REM Check if we're in the right directory
if not exist "requirements_qwen.txt" (
    echo Error: requirements_qwen.txt not found!
    echo Please run this script from the ComfyUI-enricos-nodes directory.
    pause
    exit /b 1
)

echo Installing core dependencies...
pip install -r requirements_qwen.txt

echo.
echo Installation complete!
echo.
echo Optional: For GGUF model support, run:
echo pip install llama-cpp-python
echo or for CUDA support:
echo pip install llama-cpp-python[cuda]
echo.
echo See QWEN_INTEGRATION.md for usage instructions.
pause