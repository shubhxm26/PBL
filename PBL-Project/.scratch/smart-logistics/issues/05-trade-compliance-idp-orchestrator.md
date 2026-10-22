# 05: Trade Compliance & IDP Orchestrator Slice

**What to build:** A Customs & Compliance Officer can upload unstructured shipping documents (Bills of Lading, Commercial Invoices) or pick from pre-loaded sample documents to automatically extract structured trade entities via Google Gemini IDP, perform sub-second Harmonized System (HS) code classification using local vector embeddings, and review automated discrepancy flags (tariff mismatches, missing certificates) with actionable remediation advice.

**Blocked by:** 01: Core Architecture, Database & Persona Shell

**Status:** done

- [x] International HS Codebook and customs rules catalogue indexed with local transformer embeddings for sub-second semantic retrieval.
- [x] Google Gemini client wrapper configured to extract structured JSON entities (shipper, consignee, declared value, line items, origin port, destination port) from uploaded documents or text payloads.
- [x] Local RAG engine compares extracted item descriptions against the vector index to return top HS code matches with similarity confidence scores and tariff rates.
- [x] Discrepancy validation engine cross-references document declarations against trade regulations to surface compliance risk alerts.
- [x] Endpoints `POST /api/v1/compliance/parse-doc` and `POST /api/v1/compliance/hs-classify` handle document analysis and standalone classification.
- [x] Frontend `ComplianceTab` provides 1-click sample document buttons (e.g. Clean Electronics BoL, Discrepant Agro Invoice), file drag-and-drop uploader, raw document preview, structured JSON inspector, HS match badges, and highlighted discrepancy alert cards.
- [x] Automated tests verify extraction schema fidelity, HS classification accuracy, and compliance flag generation for sample test documents.
