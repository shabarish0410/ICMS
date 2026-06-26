@echo off
echo Installing required backend dependencies for Excel and PDF processing...
pip install -r requirements.txt

echo.
echo Starting FastAPI server...
uvicorn app.main:app --reload
