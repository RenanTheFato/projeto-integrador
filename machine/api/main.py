"""
FastAPI service that exposes the AI to the Node backend.

The Node side owns all business logic and persistence; this service only
answers two questions: "what is the best route between these points" and
"what is the state of the model".
"""

import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.engine import CITY, engine
from api.training import manager


class RouteRequest(BaseModel):
    origin_latitude: float = Field(ge=-90, le=90)
    origin_longitude: float = Field(ge=-180, le=180)
    destination_latitude: float = Field(ge=-90, le=90)
    destination_longitude: float = Field(ge=-180, le=180)
    critical_mode: bool = False


class TrainingRequest(BaseModel):
    epochs: int = Field(default=800, ge=10, le=5000)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Loading here rather than lazily means the first dispatch of the day is
    # as fast as the rest. A missing model is logged, not fatal: the training
    # endpoint has to stay reachable so the model can be produced.
    try:
        engine.load()
        nodes, edges = engine.graph_size
        print(f"Route engine ready: {nodes} nodes, {edges} edges from {CITY}")
    except Exception as error:
        print(f"Route engine unavailable: {error}")

    yield


app = FastAPI(
    title="Fire Department Routing AI",
    description="Neural routing service backing the Node API",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine_loaded": engine.loaded}


@app.get("/model")
def model_info() -> dict:
    nodes, edges = engine.graph_size

    return {
        "loaded": engine.loaded,
        "model_version": engine.model_version,
        "city": CITY,
        "graph_nodes": nodes,
        "graph_edges": edges,
        "bounds": engine.bounds,
    }


@app.post("/routes")
def calculate_route(request: RouteRequest) -> dict:
    if not engine.loaded:
        raise HTTPException(
            status_code=503,
            detail="The route engine is not loaded. Train the model and restart the service.",
        )

    try:
        return engine.calculate(
            (request.origin_latitude, request.origin_longitude),
            (request.destination_latitude, request.destination_longitude),
            critical_mode=request.critical_mode,
        )
    except ValueError as error:
        # Coordinates outside the graph or with no connecting path: the caller
        # sent something unusable, so this is a 400, not a server failure.
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))


@app.post("/training", status_code=202)
def start_training(request: TrainingRequest) -> dict:
    try:
        job = manager.start(request.epochs, on_finish=engine.reload)
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error))

    return job.to_dict()


@app.get("/training/{job_id}")
def get_training(job_id: str) -> dict:
    job = manager.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Training job not found")

    return job.to_dict()
