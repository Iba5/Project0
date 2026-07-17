import uvicorn

if __name__ == "__main__":
    # Start uvicorn server pointing to the FastAPI app factory inside app.main
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
