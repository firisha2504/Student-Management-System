@echo off
echo ========================================
echo Grade Hub - GitHub Push Script
echo ========================================
echo.

REM Check if git is initialized
if not exist ".git" (
    echo Initializing Git repository...
    git init
    echo.
)

REM Configure git (update with your email)
echo Configuring Git...
git config user.name "firisha2504"
REM git config user.email "your-email@example.com"
echo.

REM Add remote if not exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote repository...
    git remote add origin https://github.com/firisha2504/Student-Management-System.git
) else (
    echo Remote already exists, updating URL...
    git remote set-url origin https://github.com/firisha2504/Student-Management-System.git
)
echo.

REM Show status
echo Current status:
git status
echo.

REM Ask for confirmation
set /p confirm="Do you want to add all files and push? (y/n): "
if /i not "%confirm%"=="y" (
    echo Push cancelled.
    pause
    exit /b
)

REM Add all files
echo.
echo Adding files...
git add .
echo.

REM Commit
set /p message="Enter commit message (or press Enter for default): "
if "%message%"=="" (
    set message=Complete Grade Hub system with infrastructure setup
)
echo.
echo Committing with message: %message%
git commit -m "%message%"
echo.

REM Set main branch
echo Setting main branch...
git branch -M main
echo.

REM Push
echo Pushing to GitHub...
git push -u origin main
echo.

if errorlevel 1 (
    echo.
    echo ========================================
    echo Push failed! Common solutions:
    echo ========================================
    echo 1. Authentication: Use Personal Access Token instead of password
    echo 2. Conflicts: Try: git pull origin main --allow-unrelated-histories
    echo 3. Force push: git push -f origin main (use with caution!)
    echo.
    echo See GITHUB_PUSH_GUIDE.md for detailed help
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Successfully pushed to GitHub!
    echo ========================================
    echo.
    echo Repository: https://github.com/firisha2504/Student-Management-System
    echo.
)

pause
