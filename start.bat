@echo off

cd backend

SET has_error=0

call venv\Scripts\activate 2>nul
IF %ERRORLEVEL% NEQ 0 (
    SET has_error=1
)

python server.py
IF %ERRORLEVEL% NEQ 0 (
    SET has_error=1
)

IF %has_error% EQU 1 (
    echo.
    echo ========================================================
    echo PLEASE READ THIS
    echo ========================================================
    echo.
    echo Please follow the installation instructions in the readme
    echo to set up the environment properly before running this script.
    echo.
    echo This script is only for starting the program after
    echo the environment has been properly set up.
    echo.
    echo If you can't get it to work after following the instructions,
    echo please see if others have already had the same issue, and file an issue if not:
    echo https://github.com/0Xiaohei0/LocalAIVtuber2/issues
    echo.
    echo ========================================================
)

pause
