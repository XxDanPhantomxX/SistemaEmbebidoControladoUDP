# Project Changes

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

## Organize Folders

- app/
- app/main.py
- app/api/ws.py
- app/services/udp_service.py
- app/services/multicast_service.py
- app/models/messages.py
- app/core/config.py
- web/
- web/index.py
- web/assets/css/dashboard.css
- web/assets/js/dashboard.js

## FastAPI Entry Point

- Route files only receive or send HTTP or WebSocket data.
- Service files do network and business logic
- Model files define data structure
