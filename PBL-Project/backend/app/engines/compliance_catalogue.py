"""
Trade Compliance & Harmonized System (HS) Codebook Catalogue.
Defines international HS code classifications, customs regulatory rules,
and realistic test shipping documents for Western India & Global Corridors.
"""

from typing import List, Dict, Any

HS_CODE_CATALOGUE: List[Dict[str, Any]] = [
    {
        "hs_code": "8504.40.90",
        "description": "Static converters, power supply units, solar inverters, and rectifiers",
        "category": "Electronics & Electrical Machinery",
        "tariff_rate_pct": 7.5,
        "regulatory_restrictions": "Mandatory Bureau of Indian Standards (BIS) CRS certification required",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "BIS Certificate", "Certificate of Origin"],
        "keywords": ["inverter", "power supply", "converter", "rectifier", "solar inverter", "ups", "dc-to-ac", "mppt"]
    },
    {
        "hs_code": "8471.30.10",
        "description": "Portable automatic data processing machines, laptops, notebook computers and tablets",
        "category": "Information Technology",
        "tariff_rate_pct": 0.0,
        "regulatory_restrictions": "Import restricted under DGFT Notification; valid Import License and EPR registration mandatory",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "DGFT Import License", "EPR Certificate"],
        "keywords": ["laptop", "notebook", "tablet", "portable computer", "data processing", "macbook", "thinkpad"]
    },
    {
        "hs_code": "3004.90.99",
        "description": "Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses",
        "category": "Pharmaceuticals",
        "tariff_rate_pct": 10.0,
        "regulatory_restrictions": "CDSCO import permit and continuous cold-chain temperature telemetry logs mandatory",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "CDSCO Approval", "Cold Chain Log", "Certificate of Analysis"],
        "keywords": ["vaccine", "medicine", "pharmaceutical", "therapeutic", "medicament", "insulin", "antibiotic", "cold-chain"]
    },
    {
        "hs_code": "8708.29.00",
        "description": "Parts and accessories of motor vehicles, body assemblies, chassis components, stamped panels",
        "category": "Automotive",
        "tariff_rate_pct": 15.0,
        "regulatory_restrictions": "Country of Origin Certificate (COO) and Automotive Research Association (ARAI) compliance",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "Certificate of Origin", "ARAI Compliance"],
        "keywords": ["automotive part", "chassis", "car body", "vehicle accessory", "stamped panel", "axle", "suspension"]
    },
    {
        "hs_code": "8541.40.11",
        "description": "Photovoltaic cells, solar panels, and solar modules assembled in modules or panels",
        "category": "Green Energy & Semiconductors",
        "tariff_rate_pct": 20.0,
        "regulatory_restrictions": "Approved List of Models and Manufacturers (ALMM) and BIS certification mandatory",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "ALMM Registration", "BIS Certificate"],
        "keywords": ["solar cell", "photovoltaic", "pv module", "solar panel", "monocrystalline", "polycrystalline"]
    },
    {
        "hs_code": "1006.30.20",
        "description": "Semi-milled or wholly milled Basmati rice, whether or not polished or glazed",
        "category": "Agricultural Commodities",
        "tariff_rate_pct": 0.0,
        "regulatory_restrictions": "Mandatory Phytosanitary Certificate, APEDA export registration, and FSSAI clearance",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "Phytosanitary Certificate", "FSSAI Clearance", "APEDA Registration"],
        "keywords": ["rice", "basmati", "grain", "milled rice", "agricultural", "cereal", "crop"]
    },
    {
        "hs_code": "2902.50.00",
        "description": "Styrene monomer, aromatic hydrocarbons for industrial polymer synthesis",
        "category": "Chemicals",
        "tariff_rate_pct": 5.0,
        "regulatory_restrictions": "Petroleum and Explosives Safety Organization (PESO) permit and MSDS hazardous chemical clearance",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "PESO Permit", "Material Safety Data Sheet (MSDS)"],
        "keywords": ["styrene", "monomer", "chemical", "hydrocarbon", "polymer raw material", "solvent"]
    },
    {
        "hs_code": "8517.62.90",
        "description": "Machines for the reception, conversion and transmission or regeneration of voice, images or other data, routers and network switches",
        "category": "Telecommunications",
        "tariff_rate_pct": 0.0,
        "regulatory_restrictions": "Mandatory Testing and Certification of Telecom Equipment (MTCTE / TEC) certificate",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "TEC MTCTE Certificate", "WPC License"],
        "keywords": ["router", "network switch", "gateway", "telecom", "data transmission", "ethernet switch", "modem"]
    },
    {
        "hs_code": "9018.90.99",
        "description": "Instruments and appliances used in medical, surgical, dental or veterinary sciences",
        "category": "Medical Devices",
        "tariff_rate_pct": 7.5,
        "regulatory_restrictions": "CDSCO Medical Device Import License (Form MD-15) and ISO 13485 calibration certificate",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "CDSCO MD-15 License", "ISO 13485 Certificate"],
        "keywords": ["medical device", "surgical instrument", "diagnostic equipment", "monitoring system", "hospital appliance"]
    },
    {
        "hs_code": "3901.10.10",
        "description": "Polyethylene having a specific gravity of less than 0.94, linear low-density granules (LLDPE)",
        "category": "Plastics & Polymers",
        "tariff_rate_pct": 7.5,
        "regulatory_restrictions": "BIS Quality Control Order (QCO) compliance for virgin polymer resins",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "BIS QCO Certificate", "Certificate of Analysis"],
        "keywords": ["polyethylene", "lldpe", "polymer granules", "plastic resin", "raw plastic", "thermoplastic"]
    },
    {
        "hs_code": "7208.51.10",
        "description": "Flat-rolled products of iron or non-alloy steel, not in coils, hot-rolled plate > 10mm thickness",
        "category": "Metals & Metallurgy",
        "tariff_rate_pct": 15.0,
        "regulatory_restrictions": "Steel Import Monitoring System (SIMS) mandatory advance registration",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "SIMS Registration", "Mill Test Certificate"],
        "keywords": ["steel plate", "hot rolled steel", "carbon steel", "metal plate", "structural steel", "iron plate"]
    },
    {
        "hs_code": "8418.69.90",
        "description": "Industrial refrigerating and freezing equipment, heat pumps and compressor condensing units",
        "category": "Industrial Machinery",
        "tariff_rate_pct": 7.5,
        "regulatory_restrictions": "Ozone Depleting Substances (ODS) and Montreal Protocol non-CFC compliance declaration",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "Non-ODS Declaration", "Factory Test Report"],
        "keywords": ["refrigeration", "compressor", "chiller", "cold storage compressor", "heat pump", "freezing unit"]
    },
    {
        "hs_code": "6109.10.00",
        "description": "T-shirts, singlets and other vests, knitted or crocheted, of pure combed cotton",
        "category": "Textiles & Apparel",
        "tariff_rate_pct": 12.0,
        "regulatory_restrictions": "Textiles Committee inspection certificate and AZO dye test report",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "Certificate of Origin", "AZO Dye Test Certificate"],
        "keywords": ["t-shirt", "cotton apparel", "garment", "clothing", "knitted fabric", "textile"]
    },
    {
        "hs_code": "8507.60.00",
        "description": "Lithium-ion accumulators, rechargeable battery packs, EV battery modules and cells",
        "category": "Energy Storage",
        "tariff_rate_pct": 10.0,
        "regulatory_restrictions": "BIS IS 16046 safety certification and Extended Producer Responsibility (EPR) registration",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "BIS IS 16046", "UN 38.3 Test Summary", "EPR Certificate"],
        "keywords": ["lithium battery", "li-ion", "battery pack", "accumulator", "ev battery", "rechargeable cell", "bms"]
    },
    {
        "hs_code": "0902.40.20",
        "description": "Black tea (fermented) and partly fermented tea, organic orthodox whole leaf in packages",
        "category": "Agricultural Commodities",
        "tariff_rate_pct": 100.0,
        "regulatory_restrictions": "Tea Board of India non-objection certificate and FSSAI import clearance",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "Tea Board Permit", "FSSAI Clearance", "Phytosanitary Certificate"],
        "keywords": ["tea", "black tea", "organic tea", "tea leaf", "fermented tea", "darjeeling", "assam"]
    },
    {
        "hs_code": "8408.20.20",
        "description": "Compression-ignition internal combustion piston engines (diesel engines) for commercial hauler trucks",
        "category": "Heavy Machinery",
        "tariff_rate_pct": 15.0,
        "regulatory_restrictions": "Bharat Stage VI (BS-VI) emission compliance certificate and type approval",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "BS-VI Certificate", "ARAI Type Approval"],
        "keywords": ["diesel engine", "truck engine", "combustion engine", "piston engine", "hauler engine", "turbo diesel"]
    },
    {
        "hs_code": "8528.52.00",
        "description": "Monitors capable of directly connecting to and designed for use with an automatic data processing system",
        "category": "Electronics & Displays",
        "tariff_rate_pct": 10.0,
        "regulatory_restrictions": "BIS CRS registration and Bureau of Energy Efficiency (BEE) star labeling",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "BIS CRS", "BEE Star Rating Certificate"],
        "keywords": ["monitor", "display", "computer screen", "lcd monitor", "led display", "4k monitor", "screen"]
    },
    {
        "hs_code": "2710.19.90",
        "description": "Petroleum oils and oils obtained from bituminous minerals, lubricating oils and greases",
        "category": "Petroleum Products",
        "tariff_rate_pct": 5.0,
        "regulatory_restrictions": "Central Pollution Control Board (CPCB) hazardous waste and recycling authorization",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "CPCB Authorization", "MSDS"],
        "keywords": ["lubricant", "lubricating oil", "grease", "mineral oil", "engine oil", "hydraulic fluid"]
    },
    {
        "hs_code": "8802.20.00",
        "description": "Unmanned aircraft systems (cargo drones), airplanes and helicopters, of an unladen weight <= 2,000 kg",
        "category": "Aerospace & Drones",
        "tariff_rate_pct": 10.0,
        "regulatory_restrictions": "Directorate General of Civil Aviation (DGCA) import permit and WPC equipment clearance",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "DGCA Import Permit", "WPC ETA Clearance"],
        "keywords": ["drone", "uav", "unmanned aircraft", "cargo drone", "quadcopter", "aerial vehicle"]
    },
    {
        "hs_code": "7606.12.00",
        "description": "Aluminum plates, sheets and strip, of a thickness exceeding 0.2 mm, of aluminum alloys",
        "category": "Metals & Metallurgy",
        "tariff_rate_pct": 7.5,
        "regulatory_restrictions": "Non-Ferrous Metal Import Monitoring System (NFMIMS) advance registration",
        "required_documents": ["Bill of Lading", "Commercial Invoice", "NFMIMS Registration", "Mill Certificate"],
        "keywords": ["aluminum plate", "aluminum sheet", "alloy sheet", "structural aluminum", "aluminum strip"]
    }
]

CUSTOMS_REGULATORY_RULES = [
    {
        "rule_id": "RULE-VAL-001",
        "name": "Line Item Total Value Discrepancy",
        "category": "VALUATION_MISMATCH",
        "description": "The declared invoice total must equal the arithmetic sum of individual line item values.",
        "tolerance": 1.0,
        "severity": "HIGH",
        "remediation": "Request revised commercial invoice reconciling unit prices, line item totals, and grand total."
    },
    {
        "rule_id": "RULE-WGT-001",
        "name": "Gross vs Net Weight Inversion",
        "category": "WEIGHT_ANOMALY",
        "description": "Gross weight must be strictly greater than or equal to net weight for all declared consignments.",
        "tolerance": 0.0,
        "severity": "CRITICAL",
        "remediation": "Halt clearance; mandate physical weighing and tare verification at container freight station."
    },
    {
        "rule_id": "RULE-WGT-002",
        "name": "Line Item Weight Aggregation Discrepancy",
        "category": "WEIGHT_ANOMALY",
        "description": "Total declared gross weight must correspond to the sum of line item gross weights within 5% tolerance.",
        "tolerance": 0.05,
        "severity": "MEDIUM",
        "remediation": "Verify packing list item weights against container manifest weighbridge ticket."
    },
    {
        "rule_id": "RULE-HS-MIS-001",
        "name": "Harmonized System Tariff Code Misdeclaration",
        "category": "TARIFF_MISMATCH",
        "description": "Declared HS code in document differs from semantic classification, resulting in potential duty evasion.",
        "severity": "CRITICAL",
        "remediation": "Reclassify commodity to verified HS code and issue differential duty demand under Section 28 of Customs Act."
    },
    {
        "rule_id": "RULE-DOC-BIS",
        "name": "Mandatory Bureau of Indian Standards (BIS) Certificate",
        "category": "MISSING_DOCUMENTATION",
        "applies_to_categories": ["Electronics & Electrical Machinery", "Green Energy & Semiconductors", "Plastics & Polymers", "Energy Storage", "Electronics & Displays"],
        "required_cert_keyword": "BIS",
        "severity": "HIGH",
        "remediation": "Hold consignment in bonded warehouse until valid BIS CRS registration certificate is provided."
    },
    {
        "rule_id": "RULE-DOC-CDSCO",
        "name": "Mandatory CDSCO Pharmaceutical Clearance & Cold-Chain Telemetry",
        "category": "MISSING_DOCUMENTATION",
        "applies_to_categories": ["Pharmaceuticals", "Medical Devices"],
        "required_cert_keyword": "CDSCO",
        "severity": "CRITICAL",
        "remediation": "Seal cargo in temperature-controlled zone; obtain CDSCO Port Health Officer NOC prior to release."
    },
    {
        "rule_id": "RULE-DOC-PHYTO",
        "name": "Mandatory Phytosanitary & Food Safety (FSSAI) Clearance",
        "category": "MISSING_DOCUMENTATION",
        "applies_to_categories": ["Agricultural Commodities"],
        "required_cert_keyword": "Phytosanitary",
        "severity": "HIGH",
        "remediation": "Submit samples to Plant Quarantine Station and FSSAI authorized laboratory for testing."
    },
    {
        "rule_id": "RULE-DOC-DGFT",
        "name": "Restricted Commodity DGFT Import License",
        "category": "REGULATORY_RESTRICTION",
        "applies_to_hs": ["8471.30.10"],
        "required_cert_keyword": "DGFT",
        "severity": "HIGH",
        "remediation": "Verify DGFT authorization portal for valid import authorization number."
    },
    {
        "rule_id": "RULE-INCO-CIF",
        "name": "CIF Incoterm Freight & Insurance Declarations",
        "category": "INCOTERMS_DISCREPANCY",
        "description": "When CIF terms are declared, separate freight and marine insurance values must be declared or included.",
        "severity": "MEDIUM",
        "remediation": "Verify whether freight charges and insurance premiums are itemized or factored into FOB value."
    }
]

SAMPLE_DOCUMENTS: List[Dict[str, Any]] = [
    {
        "sample_id": "SAMPLE-BOL-CLEAN-01",
        "title": "Clean Electronics Bill of Lading (JNPT Import)",
        "document_type": "Bill of Lading",
        "description": "Compliant high-power solar inverters from Dubai to JNPT, properly declared with BIS CRS certificate and matching weights.",
        "is_discrepant": False,
        "expected_risk": "LOW",
        "raw_text": """================================================================================
OCEAN BILL OF LADING - MEDITERRANEAN SHIPPING COMPANY
B/L NUMBER: MSC-DXB-JNPT-2026-90412
DATE OF ISSUE: 2026-09-24
CARRIER: Mediterranean Shipping Company (MSC)
VESSEL / VOYAGE: MSC AURELIA V.204
PORT OF LOADING: Jebel Ali Port (AEJEA), Dubai, UAE
PORT OF DISCHARGE: Jawaharlal Nehru Port (INJNP), Navi Mumbai, India
FINAL DESTINATION: Thane Inland Freight Hub, Maharashtra, India

SHIPPER:
Gulf Solar Energy Systems FZE
Plot 14, Jebel Ali Free Zone, Dubai, UAE
TRN: 100293847500003

CONSIGNEE:
Maharastra CleanTech Solutions Pvt Ltd
Plot C-12, Thane Industrial Area, Thane, Maharashtra 400601, India
IEC: 0312049182 | GSTIN: 27AABCM9102K1ZX

NOTIFY PARTY:
SpeedLogistics Customs Brokers LLP
JNPT Terminal 2 CFS, Nhava Sheva, Navi Mumbai 400707

INCOTERMS: CIF JNPT
CURRENCY: USD
DECLARED TOTAL VALUE: 125000.00
FREIGHT CHARGES: 3200.00
INSURANCE CHARGES: 850.00
PACKAGES COUNT: 50 Wooden Crates
GROSS WEIGHT: 14500.00 KG
NET WEIGHT: 13200.00 KG
CONTAINER NO: MSCU-882910-4 (40ft High Cube)

DECLARED CERTIFICATES:
- COO-UAE-2026-88129
- BIS-CRS-REG-2025-99410

LINE ITEMS:
Item 1:
- Description: Static converters, power supply units and commercial solar inverters 50kW with DC-to-AC conversion units and MPPT controller
- Declared HS Code: 8504.40.90
- Quantity: 50 Units
- Unit Price: 2500.00 USD
- Total Price: 125000.00 USD
- Net Weight: 13200.00 KG
- Gross Weight: 14500.00 KG
- Country of Origin: UAE
================================================================================"""
    },
    {
        "sample_id": "SAMPLE-INV-AGRO-DISCREPANT-02",
        "title": "Discrepant Agro Commercial Invoice (Valuation Error & Missing Phytosanitary)",
        "document_type": "Commercial Invoice",
        "description": "Basmati rice consignment with math discrepancy ($48,000 line items sum vs $41,500 declared) and missing mandatory Phytosanitary/FSSAI certificates.",
        "is_discrepant": True,
        "expected_risk": "HIGH",
        "raw_text": """================================================================================
COMMERCIAL EXPORT INVOICE
INVOICE NUMBER: INV-NSK-EXP-2026-4402
DATE OF ISSUE: 2026-09-28
SHIPPER / EXPORTER:
Nashik Agri-Exports Co-operative Ltd
Godavari Warehouse Zone, Nashik, Maharashtra 422003, India
IEC: 0398102931 | GSTIN: 27AAACN4401M1Z5

CONSIGNEE / BUYER:
EuroBaltic Foodstuffs B.V.
Keizersgracht 420, 1016 EK Amsterdam, Netherlands
VAT NO: NL882019482B01

PORT OF LOADING: Jawaharlal Nehru Port (INJNP), Navi Mumbai, India
PORT OF DISCHARGE: Port of Rotterdam (NLRTM), Netherlands
CARRIER: Hapag-Lloyd AG
VESSEL: ROTTERDAM EXPRESS V.09

INCOTERMS: FOB JNPT
CURRENCY: USD
DECLARED TOTAL VALUE: 41500.00
FREIGHT CHARGES: 0.00
INSURANCE CHARGES: 0.00
PACKAGES COUNT: 1200 Bags
GROSS WEIGHT: 24600.00 KG
NET WEIGHT: 24000.00 KG
CONTAINER NO: HLBU-401928-1

DECLARED CERTIFICATES:
- COO-IN-2026-1102

LINE ITEMS:
Item 1:
- Description: Premium grade semi-milled and polished Basmati rice in 20kg moisture-barrier export sacks
- Declared HS Code: 1006.30.20
- Quantity: 1200 Bags
- Unit Price: 40.00 USD
- Total Price: 48000.00 USD
- Net Weight: 24000.00 KG
- Gross Weight: 24600.00 KG
- Country of Origin: India

REMARKS:
Invoice total reflects special promotional rebate not deducted from line items. Phytosanitary certificate pending state quarantine inspector visit.
================================================================================"""
    },
    {
        "sample_id": "SAMPLE-BOL-PHARMA-COLDCHAIN-03",
        "title": "Cold-Chain Pharma Consignment (Missing CDSCO Approval)",
        "document_type": "Bill of Lading",
        "description": "Therapeutic vaccines from Frankfurt to Mumbai Central Hub missing required CDSCO import permit and cold-chain temperature telemetry logs.",
        "is_discrepant": True,
        "expected_risk": "CRITICAL",
        "raw_text": """================================================================================
AIR WAYBILL / MULTIMODAL BILL OF LADING
WAYBILL NUMBER: AWB-LH-FRA-BOM-2026-7731
DATE OF ISSUE: 2026-09-30
CARRIER: Lufthansa Cargo AG
FLIGHT: LH8220
ORIGIN AIRPORT: Frankfurt Airport (FRA), Germany
DESTINATION AIRPORT: Chhatrapati Shivaji Maharaj International Airport (BOM), Mumbai, India
FINAL WAREHOUSE: Mumbai Central Logistics Park (WH-MUM-01)

SHIPPER:
BioPharm Deutschland GmbH
Industriepark Höchst, 65926 Frankfurt am Main, Germany
EORI: DE882049182

CONSIGNEE:
Maharashtra Lifesciences Distributorship Ltd
Unit 4, Mumbai Central Logistics Park, Mumbai 400008, India
IEC: 0305882910 | GSTIN: 27AABCM7701L1Z8

INCOTERMS: CIF Mumbai
CURRENCY: EUR
DECLARED TOTAL VALUE: 350000.00
FREIGHT CHARGES: 12000.00
INSURANCE CHARGES: 4500.00
PACKAGES COUNT: 12 Temperature-Controlled Shipper Containers
GROSS WEIGHT: 3200.00 KG
NET WEIGHT: 2800.00 KG

DECLARED CERTIFICATES:
- COO-GER-2026-9041
- ISO-9001-CERT

LINE ITEMS:
Item 1:
- Description: Medicaments consisting of mixed therapeutic products, critical viral vaccines requiring strict +2C to +8C cold chain storage
- Declared HS Code: 3004.90.99
- Quantity: 50000 Vials
- Unit Price: 7.00 EUR
- Total Price: 350000.00 EUR
- Net Weight: 2800.00 KG
- Gross Weight: 3200.00 KG
- Country of Origin: Germany
================================================================================"""
    },
    {
        "sample_id": "SAMPLE-INV-AUTO-TARIFF-MISMATCH-04",
        "title": "Automotive Components Invoice (HS Code Tariff Mismatch)",
        "document_type": "Commercial Invoice",
        "description": "Motor vehicle chassis & body stampings declared under zero-tariff HS 8471.30 (Portable Laptops) instead of 15% tariff HS 8708.29 (Automotive Components) - flagged for duty evasion.",
        "is_discrepant": True,
        "expected_risk": "CRITICAL",
        "raw_text": """================================================================================
COMMERCIAL INVOICE
INVOICE NUMBER: INV-STU-PUN-2026-5519
DATE OF ISSUE: 2026-10-01
SHIPPER / SELLER:
Bavaria Precision Autowerke AG
Mercedesstrasse 120, 70372 Stuttgart, Germany
VAT ID: DE147852369

CONSIGNEE / IMPORTER:
Pune Precision Haulers & Assembly Pvt Ltd
Talegaon MIDC, Auto Corridor, Pune, Maharashtra 410507, India
IEC: 0319882241 | GSTIN: 27AABCP5502P1Z3

PORT OF LOADING: Port of Hamburg (DEHAM), Germany
PORT OF DISCHARGE: Jawaharlal Nehru Port (INJNP), Navi Mumbai, India
DELIVERY LOCATION: Pune Auto-Corridor Fulfillment Center (WH-PUN-01)

INCOTERMS: CIF JNPT
CURRENCY: USD
DECLARED TOTAL VALUE: 85000.00
FREIGHT CHARGES: 4200.00
INSURANCE CHARGES: 1100.00
PACKAGES COUNT: 14 Steel Stillage Racks
GROSS WEIGHT: 9200.00 KG
NET WEIGHT: 8400.00 KG
CONTAINER NO: CMAU-772910-8

DECLARED CERTIFICATES:
- COO-GER-2026-44120

LINE ITEMS:
Item 1:
- Description: Stamped steel body assemblies, heavy vehicle chassis components, front subframes and suspension mounting brackets for commercial hauler trucks
- Declared HS Code: 8471.30.10
- Quantity: 200 Sets
- Unit Price: 425.00 USD
- Total Price: 85000.00 USD
- Net Weight: 8400.00 KG
- Gross Weight: 9200.00 KG
- Country of Origin: Germany
================================================================================"""
    }
]
