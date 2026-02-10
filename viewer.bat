@echo off
:: Image Viewer - drag a folder onto this, or edit DEFAULT_FOLDER below

set DEFAULT_FOLDER=C:\AI\ComfyUI\output

if "%~1"=="" (
    python "%~dp0viewer.py" "%DEFAULT_FOLDER%"
) else (
    python "%~dp0viewer.py" "%~1"
)
pause
