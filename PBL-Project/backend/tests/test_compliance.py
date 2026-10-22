"""
Automated Test Suite for Trade Compliance & IDP Orchestrator Slice (Issue 05).
Verifies:
- Sub-second local vector RAG HS code retrieval (< 500ms SLA)
- Google Gemini IDP extraction schema fidelity
- Discrepancy validation engine (valuation errors, tariff mismatches, missing regulatory certs, weight anomalies)
- REST Endpoints (/api/v1/compliance/parse-doc, /api/v1/compliance/hs-classify, /samples, /hs-catalogue, /rules)
- RBAC permission enforcement (Customs & Admin allowed, Dispatcher forbidden with HTTP 403)
"""

import sys
import os
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.engines.rag_engine import rag_index
from app.engines.compliance_catalogue import SAMPLE_DOCUMENTS, HS_CODE_CATALOGUE, CUSTOMS_REGULATORY_RULES
from app.engines.compliance_engine import compliance_orchestrator


# ---------------------------------------------------------------------------
# Unit Tests: Local Vector Embeddings & RAG Engine
# ---------------------------------------------------------------------------

def test_hs_vector_rag_semantic_retrieval_and_subsecond_sla():
    """Verify semantic retrieval accuracy and sub-second SLA (< 500ms)."""
    test_cases = [
        ("high-voltage commercial solar inverters with mppt controller", "8504.40.90", "Electronics & Electrical Machinery"),
        ("laptops and portable automatic data processing machines", "8471.30.10", "Information Technology"),
        ("therapeutic vaccines and critical pharmaceutical medicaments", "3004.90.99", "Pharmaceuticals"),
        ("commercial hauler truck chassis and stamped body components", "8708.29.00", "Automotive"),
        ("polished and semi-milled export basmati rice bags", "1006.30.20", "Agricultural Commodities"),
        ("rechargeable lithium-ion battery packs and accumulator cells", "8507.60.00", "Energy Storage"),
    ]

    for query, expected_hs, expected_category in test_cases:
        results, latency_ms = rag_index.search(query=query, declared_hs_code=expected_hs, top_k=3)
        
        # Sub-second SLA assertion: must be < 500ms (typically < 5ms)
        assert latency_ms < 500.0, f"RAG retrieval exceeded 500ms SLA: {latency_ms}ms"
        assert len(results) >= 1
        
        top_match = results[0]
        assert top_match["hs_code"] == expected_hs
        assert top_match["category"] == expected_category
        assert top_match["similarity_score"] >= 0.50
        assert top_match["is_declared_match"] is True
        assert "tariff_rate_pct" in top_match
        assert "regulatory_restrictions" in top_match


# ---------------------------------------------------------------------------
# Unit Tests: Gemini IDP Schema & Discrepancy Engine
# ---------------------------------------------------------------------------

def test_gemini_idp_extraction_schema_fidelity():
    """Verify extracted document schema completeness for clean and discrepant docs."""
    clean_sample = SAMPLE_DOCUMENTS[0]
    extracted = compliance_orchestrator.gemini_client.extract_document_entities(
        clean_sample["raw_text"],
        sample_id=clean_sample["sample_id"]
    )

    required_keys = [
        "document_type", "document_number", "carrier", "port_of_loading",
        "port_of_discharge", "shipper", "consignee", "incoterms",
        "currency", "declared_total_value", "gross_weight_kg",
        "net_weight_kg", "container_numbers", "declared_certificates", "line_items"
    ]
    for key in required_keys:
        assert key in extracted, f"Missing required entity key: {key}"

    assert len(extracted["line_items"]) >= 1
    item = extracted["line_items"][0]
    item_keys = ["item_number", "description", "quantity", "unit_price", "total_price", "origin_country"]
    for ik in item_keys:
        assert ik in item, f"Missing line item key: {ik}"


def test_clean_bol_approved_clearance():
    """Verify clean electronics Bill of Lading achieves 100% compliance and APPROVED clearance."""
    clean_sample = SAMPLE_DOCUMENTS[0]
    result = compliance_orchestrator.process_document("", sample_id=clean_sample["sample_id"])

    audit = result["compliance_audit"]
    assert audit["clearance_status"] == "APPROVED"
    assert audit["risk_level"] == "LOW"
    assert audit["compliance_score"] == 100.0
    assert audit["total_alerts_count"] == 0
    assert audit["critical_count"] == 0
    assert result["metrics"]["total_processing_latency_ms"] < 500.0


def test_discrepant_agro_invoice_valuation_and_phytosanitary():
    """Verify detection of arithmetic valuation mismatch and missing Phytosanitary certificate."""
    agro_sample = SAMPLE_DOCUMENTS[1]
    result = compliance_orchestrator.process_document("", sample_id=agro_sample["sample_id"])

    audit = result["compliance_audit"]
    assert audit["clearance_status"] in ["CONDITIONAL_REVIEW", "REJECTED_DISCREPANCIES"]
    assert audit["risk_level"] in ["HIGH", "ELEVATED"]
    assert audit["compliance_score"] < 90.0

    categories = [a["category"] for a in audit["alerts"]]
    assert "VALUATION_MISMATCH" in categories
    assert "MISSING_DOCUMENTATION" in categories

    # Verify actionable remediation is provided
    for alert in audit["alerts"]:
        assert "remediation" in alert
        assert len(alert["remediation"]) > 10


def test_pharma_coldchain_missing_cdsco_critical():
    """Verify pharmaceutical consignment without CDSCO/temperature logs generates CRITICAL alert and rejection."""
    pharma_sample = SAMPLE_DOCUMENTS[2]
    result = compliance_orchestrator.process_document("", sample_id=pharma_sample["sample_id"])

    audit = result["compliance_audit"]
    assert audit["clearance_status"] == "REJECTED_DISCREPANCIES"
    assert audit["risk_level"] == "CRITICAL"
    assert audit["critical_count"] >= 1

    crit_alerts = [a for a in audit["alerts"] if a["severity"] == "CRITICAL"]
    assert any("CDSCO" in a["issue"] or "temperature" in a["issue"].lower() for a in crit_alerts)


def test_auto_parts_tariff_misclassification_critical():
    """Verify detection of potential duty evasion when 15% automotive parts are declared under 0% laptop HS code."""
    auto_sample = SAMPLE_DOCUMENTS[3]
    result = compliance_orchestrator.process_document("", sample_id=auto_sample["sample_id"])

    audit = result["compliance_audit"]
    assert audit["clearance_status"] == "REJECTED_DISCREPANCIES"
    assert audit["critical_count"] >= 1

    tariff_alerts = [a for a in audit["alerts"] if a["category"] == "TARIFF_MISMATCH"]
    assert len(tariff_alerts) >= 1
    assert "Section 28" in tariff_alerts[0]["remediation"]


def test_weight_inversion_validation():
    """Verify gross weight less than net weight triggers CRITICAL weight anomaly."""
    synthetic_doc = {
        "document_type": "Bill of Lading",
        "document_number": "BL-SYNTH-01",
        "declared_total_value": 50000.0,
        "gross_weight_kg": 4000.0,
        "net_weight_kg": 5000.0,  # Inverted: Gross < Net
        "declared_certificates": ["COO-IN-01", "BIS-01"],
        "line_items": [
            {
                "item_number": 1,
                "description": "Static converters and solar inverters",
                "declared_hs_code": "8504.40.90",
                "quantity": 10.0,
                "unit_price": 5000.0,
                "total_price": 50000.0,
                "gross_weight_kg": 4000.0,
                "net_weight_kg": 5000.0
            }
        ]
    }
    classifications = [
        {
            "top_matches": [
                {
                    "hs_code": "8504.40.90",
                    "category": "Electronics & Electrical Machinery",
                    "description": "Static converters",
                    "tariff_rate_pct": 7.5,
                    "similarity_score": 0.95
                }
            ]
        }
    ]
    report = compliance_orchestrator.validator.validate_document(synthetic_doc, classifications)
    assert report["clearance_status"] == "REJECTED_DISCREPANCIES"
    assert report["critical_count"] >= 1
    wgt_alerts = [a for a in report["alerts"] if a["category"] == "WEIGHT_ANOMALY"]
    assert len(wgt_alerts) >= 1
    assert wgt_alerts[0]["severity"] == "CRITICAL"


# ---------------------------------------------------------------------------
# Integration Tests: FastAPI Endpoints & RBAC Enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_api_hs_classify_endpoint():
    """Test POST /api/v1/compliance/hs-classify with customs persona."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/compliance/hs-classify",
            headers={"X-Persona-Role": "customs"},
            json={
                "description": "Industrial lithium-ion battery packs and rechargeable energy storage cells",
                "destination_country": "IN",
                "declared_hs_code": "8507.60.00",
                "top_k": 3
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["top_match"]["hs_code"] == "8507.60.00"
        assert data["is_declared_match"] is True
        assert data["retrieval_latency_ms"] < 500.0
        assert len(data["candidate_matches"]) == 3


@pytest.mark.asyncio
async def test_api_parse_doc_endpoint_sample_id():
    """Test POST /api/v1/compliance/parse-doc with sample_id payload."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/compliance/parse-doc",
            headers={"X-Persona-Role": "customs"},
            json={"sample_id": "SAMPLE-BOL-CLEAN-01"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["document_metadata"]["document_number"] == "MSC-DXB-JNPT-2026-90412"
        assert data["compliance_audit"]["clearance_status"] == "APPROVED"
        assert len(data["rag_classifications"]) >= 1
        assert data["metrics"]["total_processing_latency_ms"] < 500.0


@pytest.mark.asyncio
async def test_api_samples_and_catalogue_endpoints():
    """Test GET /samples, /hs-catalogue, and /rules endpoints."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Samples
        res_samples = await client.get(
            "/api/v1/compliance/samples",
            headers={"X-Persona-Role": "customs"}
        )
        assert res_samples.status_code == 200
        data_samples = res_samples.json()
        assert data_samples["count"] == 4

        # Specific sample
        res_sample_detail = await client.get(
            "/api/v1/compliance/samples/SAMPLE-BOL-CLEAN-01",
            headers={"X-Persona-Role": "customs"}
        )
        assert res_sample_detail.status_code == 200
        assert "raw_text" in res_sample_detail.json()["sample"]

        # HS Catalogue
        res_cat = await client.get(
            "/api/v1/compliance/hs-catalogue?q=solar",
            headers={"X-Persona-Role": "customs"}
        )
        assert res_cat.status_code == 200
        assert res_cat.json()["count"] >= 1

        # Rules
        res_rules = await client.get(
            "/api/v1/compliance/rules",
            headers={"X-Persona-Role": "customs"}
        )
        assert res_rules.status_code == 200
        assert res_rules.json()["count"] >= 5


@pytest.mark.asyncio
async def test_compliance_rbac_forbidden_for_dispatcher():
    """Verify Fleet Dispatcher is strictly forbidden (HTTP 403) from compliance operations."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Dispatcher attempting parse-doc
        res_parse = await client.post(
            "/api/v1/compliance/parse-doc",
            headers={"X-Persona-Role": "dispatcher"},
            json={"sample_id": "SAMPLE-BOL-CLEAN-01"}
        )
        assert res_parse.status_code == 403
        assert "is not authorized" in res_parse.json()["detail"]

        # Dispatcher attempting hs-classify
        res_classify = await client.post(
            "/api/v1/compliance/hs-classify",
            headers={"X-Persona-Role": "dispatcher"},
            json={"description": "Solar inverters 50kW"}
        )
        assert res_classify.status_code == 403


@pytest.mark.asyncio
async def test_compliance_rbac_allowed_for_admin_and_customs():
    """Verify Customs Officer and Admin can access compliance endpoints."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Customs Officer
        res_customs = await client.get(
            "/api/v1/compliance/samples",
            headers={"X-Persona-Role": "customs"}
        )
        assert res_customs.status_code == 200

        # Enterprise IT Admin
        res_admin = await client.get(
            "/api/v1/compliance/samples",
            headers={"X-Persona-Role": "admin"}
        )
        assert res_admin.status_code == 200
