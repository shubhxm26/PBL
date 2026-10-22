"""
Trade Compliance & IDP Orchestrator API Endpoints.
Provides endpoints for:
- Document entity extraction & compliance audit (/parse-doc)
- Standalone sub-second HS code classification (/hs-classify)
- Sample documents catalogue (/samples)
- HS codebook and customs rules catalogue (/hs-catalogue, /rules)
"""

import io
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form

from app.core.rbac import require_role, get_current_persona
from app.engines.compliance_engine import compliance_orchestrator
from app.engines.compliance_catalogue import (
    HS_CODE_CATALOGUE,
    CUSTOMS_REGULATORY_RULES,
    SAMPLE_DOCUMENTS
)

router = APIRouter(prefix="/compliance", tags=["Trade Compliance & IDP"])


class HSClassifyRequest(BaseModel):
    description: str = Field(..., min_length=2, description="Commodity textual description")
    destination_country: Optional[str] = Field(default="IN", description="Destination country code (ISO-2)")
    declared_hs_code: Optional[str] = Field(default=None, description="Optional declared HS code to cross-reference")
    top_k: Optional[int] = Field(default=5, ge=1, le=10, description="Number of top matches to return")


class ParseDocRequest(BaseModel):
    text_content: Optional[str] = Field(default=None, description="Raw text of shipping document")
    sample_id: Optional[str] = Field(default=None, description="Pre-loaded sample document identifier")


@router.get("/samples", summary="List pre-loaded trade compliance sample documents")
def list_sample_documents(
    persona: Dict[str, Any] = Depends(require_role(["customs", "admin", "director"]))
):
    """
    Returns pre-loaded sample documents demonstrating clean and discrepant trade consignments.
    """
    return {
        "status": "success",
        "count": len(SAMPLE_DOCUMENTS),
        "samples": [
            {
                "sample_id": s["sample_id"],
                "title": s["title"],
                "document_type": s["document_type"],
                "description": s["description"],
                "is_discrepant": s["is_discrepant"],
                "expected_risk": s["expected_risk"]
            }
            for s in SAMPLE_DOCUMENTS
        ]
    }


@router.get("/samples/{sample_id}", summary="Get full raw text and details of a sample document")
def get_sample_document(
    sample_id: str,
    persona: Dict[str, Any] = Depends(require_role(["customs", "admin", "director"]))
):
    """Fetch raw shipping document text for a sample."""
    for s in SAMPLE_DOCUMENTS:
        if s["sample_id"] == sample_id:
            return {
                "status": "success",
                "sample": s
            }
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Sample document '{sample_id}' not found."
    )


@router.get("/hs-catalogue", summary="Search and list international Harmonized System (HS) codebook entries")
def get_hs_catalogue(
    q: Optional[str] = None,
    persona: Dict[str, Any] = Depends(require_role(["customs", "admin", "director"]))
):
    """List international HS codes with tariff rates, categories, and regulatory restrictions."""
    items = HS_CODE_CATALOGUE
    if q and q.strip():
        term = q.strip().lower()
        items = [
            it for it in items
            if term in it["hs_code"].lower()
            or term in it["description"].lower()
            or term in it["category"].lower()
            or any(term in k for k in it.get("keywords", []))
        ]
    return {
        "status": "success",
        "count": len(items),
        "catalogue": items
    }


@router.get("/rules", summary="List customs regulatory compliance rules")
def get_customs_rules(
    persona: Dict[str, Any] = Depends(require_role(["customs", "admin", "director"]))
):
    """Returns statutory customs compliance and discrepancy detection rules catalogue."""
    return {
        "status": "success",
        "count": len(CUSTOMS_REGULATORY_RULES),
        "rules": CUSTOMS_REGULATORY_RULES
    }


@router.post("/hs-classify", summary="Standalone sub-second semantic HS code classification")
def classify_hs_code(
    payload: HSClassifyRequest,
    persona: Dict[str, Any] = Depends(require_role(["customs", "admin", "director"]))
):
    """
    Sub-second semantic vector similarity search against international HS Code catalogue.
    Returns ranked candidate HS codes with vector match confidence scores, tariff rates,
    and regulatory restrictions.
    """
    if not payload.description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Commodity description cannot be empty."
        )

    result = compliance_orchestrator.classify_single_hs(
        description=payload.description,
        destination_country=payload.destination_country or "IN",
        declared_hs_code=payload.declared_hs_code,
        top_k=payload.top_k or 5
    )
    return {
        "status": "success",
        **result
    }


@router.post("/parse-doc", summary="Intelligent Document Processing (IDP) and compliance audit orchestration")
async def parse_and_audit_document(
    request: Request,
    file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None),
    sample_id: Optional[str] = Form(None),
    persona: Dict[str, Any] = Depends(require_role(["customs", "admin", "director"]))
):
    """
    Parses unstructured trade documents (Bills of Lading, Commercial Invoices)
    via Google Gemini IDP, classifies all line items via local sub-second vector RAG,
    and cross-checks declarations against customs rules to surface discrepancy alerts.
    Supports JSON body payload, text Form field, sample_id, or uploaded file.
    """
    raw_doc_text = ""
    req_sample_id = sample_id

    # Check Content-Type for JSON body
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            raw_doc_text = body.get("text_content", "") or ""
            req_sample_id = body.get("sample_id") or req_sample_id
        except Exception:
            pass

    # If Form text_content provided
    if text_content and text_content.strip():
        raw_doc_text = text_content

    # If file was uploaded
    if file:
        content_bytes = await file.read()
        try:
            raw_doc_text = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # Fallback for binary / ascii
            raw_doc_text = content_bytes.decode("latin-1", errors="ignore")

    # If sample_id provided, fetch sample text if raw text not already provided
    if req_sample_id and not raw_doc_text.strip():
        for s in SAMPLE_DOCUMENTS:
            if s["sample_id"] == req_sample_id:
                raw_doc_text = s["raw_text"]
                break

    if not raw_doc_text.strip() and not req_sample_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document text, sample_id, or file payload is required for analysis."
        )

    result = compliance_orchestrator.process_document(
        raw_text=raw_doc_text,
        sample_id=req_sample_id
    )

    return result
