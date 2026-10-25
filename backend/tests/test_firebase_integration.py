"""Automated verification test suite for Firebase Configuration, Security Rules, and Endpoints."""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
client = TestClient(app)


def test_firebase_rules_exist_and_secure():
    """Verify firestore.rules and storage.rules exist and enforce security boundaries."""
    firestore_rules = PROJECT_ROOT / "firestore.rules"
    storage_rules = PROJECT_ROOT / "storage.rules"
    firebase_json = PROJECT_ROOT / "firebase.json"

    assert firestore_rules.exists()
    assert storage_rules.exists()
    assert firebase_json.exists()

    rules_content = firestore_rules.read_text(encoding="utf-8")
    # Verify strict RBAC checks
    assert "isAdmin()" in rules_content
    assert "isStaff()" in rules_content
    assert "request.resource.data.role == 'student'" in rules_content
    assert "request.resource.data.role == resource.data.role" in rules_content  # No self-escalation
    assert "auditLogs" in rules_content
    assert "allow update, delete: if false;" in rules_content  # Audit logs immutable

    storage_content = storage_rules.read_text(encoding="utf-8")
    assert "10 * 1024 * 1024" in storage_content  # 10MB limit
    assert "application/pdf" in storage_content


def test_firebase_indexes():
    """Verify firestore.indexes.json defines compound query indexes for notices."""
    indexes_file = PROJECT_ROOT / "firestore.indexes.json"
    assert indexes_file.exists()
    data = json.loads(indexes_file.read_text(encoding="utf-8"))
    assert "indexes" in data
    assert len(data["indexes"]) >= 2


def test_frontend_firebase_scripts():
    """Verify frontend Firebase configuration and database clients exist."""
    scripts = [
        "frontend/js/firebase-config.js",
        "frontend/js/auth.js",
        "frontend/js/db.js"
    ]
    for s in scripts:
        path = PROJECT_ROOT / s
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert len(content) > 500


def test_unified_endpoints_status_200():
    """Verify all dashboard and static endpoints return HTTP 200 OK on single origin."""
    endpoints = [
        "/",
        "/login",
        "/forgot-password",
        "/student",
        "/staff",
        "/admin",
        "/js/firebase-config.js",
        "/js/auth.js",
        "/js/db.js",
        "/css/tokens.css",
        "/css/glass.css",
        "/css/layout.css",
        "/storage/uploads/sample_exam_schedule.pdf",
        "/api/health",
        "/api/stats",
        "/api/auth/demo-users"
    ]
    for ep in endpoints:
        response = client.get(ep)
        assert response.status_code == 200, f"Endpoint {ep} failed with status {response.status_code}"
        assert len(response.content) > 0


def test_api_health_payload():
    """Verify health endpoint JSON payload."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "CampusConnect"
