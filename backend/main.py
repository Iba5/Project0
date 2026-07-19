import os
import uvicorn

if __name__ == "__main__":
    # L2 FIX: Read reload setting from environment variable (default: True for dev, False for production)
    debug = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=debug
    )