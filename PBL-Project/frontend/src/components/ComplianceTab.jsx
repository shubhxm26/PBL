import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileCheck2, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  UploadCloud, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Scale, 
  Cpu, 
  Copy, 
  Check, 
  Sparkles, 
  Clock, 
  RefreshCw, 
  ArrowRight,
  Terminal,
  FileSpreadsheet,
  FileCode,
  Tag,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Compass
} from 'lucide-react';
import { api } from '../services/api';
import { usePersona } from '../context/PersonaContext';
import { useWorkspace } from '../context/WorkspaceContext';

export default function ComplianceTab() {
  const { currentRole, profile, canPerform } = usePersona();
  const workspace = useWorkspace();
  const trigger3DFlyTo = workspace?.trigger3DFlyTo;
  const selectFacility = workspace?.selectFacility;

  const handleFlyToCustomsFacility = () => {
    const facId = 'PORT-JNPT-01';
    if (selectFacility) selectFacility(facId);
    if (trigger3DFlyTo) trigger3DFlyTo({ type: 'facility', id: facId });
  };

  // State
  const [samples, setSamples] = useState([]);
  const [selectedSampleId, setSelectedSampleId] = useState('SAMPLE-BOL-CLEAN-01');
  const [documentText, setDocumentText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [inputMode, setInputMode] = useState('sample'); // 'sample' | 'upload' | 'text'
  
  // Pipeline Processing States
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [error, setError] = useState(null);
  const [auditResult, setAuditResult] = useState(null);

  // Inspector / Preview Tabs
  const [resultTab, setResultTab] = useState('audit'); // 'audit' | 'entities' | 'items' | 'json' | 'raw'
  const [copiedJson, setCopiedJson] = useState(false);

  // Standalone HS Classifier state
  const [classifierQuery, setClassifierQuery] = useState('High power solar inverter with MPPT DC to AC converter');
  const [classifierResults, setClassifierResults] = useState(null);
  const [classifierLoading, setClassifierLoading] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);

  const fileInputRef = useRef(null);

  // Select and analyze a sample
  const handleSelectSample = useCallback(async (sampleId) => {
    setSelectedSampleId(sampleId);
    setInputMode('sample');
    setUploadedFileName('');
    setLoading(true);
    setError(null);
    setProcessingStage('Fetching trade consignment manifest...');

    try {
      // Fetch sample detail
      const detail = await api.getComplianceSampleDetail(sampleId);
      const text = detail?.sample?.raw_text || '';
      setDocumentText(text);

      setProcessingStage('Extracting entities via Gemini IDP & classifying HS codes...');
      // Execute document audit
      const result = await api.parseTradeDocument({ sample_id: sampleId, text_content: text });
      setAuditResult(result);
    } catch (err) {
      setError(err.message || 'Failed to process compliance document.');
    } finally {
      setLoading(false);
      setProcessingStage('');
    }
  }, []);

  // Load sample documents on mount
  useEffect(() => {
    async function loadSamples() {
      try {
        const data = await api.getComplianceSamples();
        if (data && data.samples) {
          setSamples(data.samples);
          // Auto-load and analyze the first clean sample for instant WOW factor
          if (data.samples.length > 0) {
            handleSelectSample(data.samples[0].sample_id);
          }
        }
      } catch (err) {
        console.error('Failed to load compliance samples:', err);
      }
    }
    loadSamples();
  }, [handleSelectSample]);

  // Run audit on custom text or uploaded payload
  const handleRunAudit = async () => {
    if (!documentText.trim()) {
      setError('Please provide document text or select a sample consignment.');
      return;
    }

    setLoading(true);
    setError(null);
    setProcessingStage('Ingesting unstructured shipping document payload...');

    try {
      setProcessingStage('Orchestrating Gemini IDP extraction & vector RAG classification...');
      const result = await api.parseTradeDocument({ text_content: documentText });
      setAuditResult(result);
    } catch (err) {
      setError(err.message || 'Document processing failed.');
    } finally {
      setLoading(false);
      setProcessingStage('');
    }
  };

  // File drag & drop handling
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file) => {
    setUploadedFileName(file.name);
    setInputMode('upload');
    setSelectedSampleId('');
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      setDocumentText(content);
      // Auto analyze uploaded file content
      setLoading(true);
      setProcessingStage(`Parsing ${file.name} via Gemini IDP...`);
      try {
        const result = await api.parseTradeDocument({ text_content: content });
        setAuditResult(result);
      } catch (err) {
        setError(err.message || 'Failed to parse uploaded document.');
      } finally {
        setLoading(false);
        setProcessingStage('');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please ensure it is a valid text/PDF/CSV file.');
    };
    reader.readAsText(file);
  };

  // Standalone HS classification test
  const handleTestClassifier = async () => {
    if (!classifierQuery.trim()) return;
    setClassifierLoading(true);
    try {
      const data = await api.classifyHSCode({
        description: classifierQuery,
        destination_country: 'IN',
        top_k: 5
      });
      setClassifierResults(data);
    } catch (err) {
      console.error('HS Classification error:', err);
    } finally {
      setClassifierLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!auditResult) return;
    navigator.clipboard.writeText(JSON.stringify(auditResult, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const audit = auditResult?.compliance_audit;
  const isApproved = audit?.clearance_status === 'APPROVED';
  const isConditional = audit?.clearance_status === 'CONDITIONAL_REVIEW';
  const isRejected = audit?.clearance_status === 'REJECTED_DISCREPANCIES';

  return (
    <div className="space-y-6">
      {/* Top Technology & Pipeline HUD Banner */}
      <div className="cyber-glass p-5 rounded-2xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-md shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileCheck2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-500/40">
                  Customs & Trade Compliance IDP
                </span>
                <span className="text-xs text-slate-600">•</span>
                <span className="text-xs font-bold text-slate-400">
                  Cross-Border Port & Inland Corridor Gatekeeper
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Automated Trade IDP & Local Vector RAG Orchestrator
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleFlyToCustomsFacility}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              title="Fly 3D Camera to JNPT Customs Port"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Fly 3D Customs Port</span>
            </button>
          </div>

          {/* Engine Specs Badges */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Extraction Engine</div>
                <div className="text-xs font-black text-slate-200">Google Gemini 3.8 Flash</div>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Semantic Index</div>
                <div className="text-xs font-black text-slate-200">Local PyTorch RAG &lt; 5ms</div>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-rose-400" />
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Discrepancy Cross-Check</div>
                <div className="text-xs font-black text-slate-200">Customs Act Sec 28 &amp; BIS/CDSCO</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Sample Consignments Showcase */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              1-Click Realistic Consignment Scenarios:
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Click any scenario to instantly trigger end-to-end IDP &amp; RAG audit
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {samples.map((s) => {
            const isSelected = selectedSampleId === s.sample_id && inputMode === 'sample';
            const isClean = !s.is_discrepant;

            return (
              <button
                key={s.sample_id}
                onClick={() => handleSelectSample(s.sample_id)}
                disabled={loading}
                className={`p-3.5 rounded-xl text-left transition-all duration-150 border-2 relative overflow-hidden group active:scale-[0.98] ${
                  isSelected
                    ? isClean 
                      ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-300 shadow-sm'
                      : 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    isClean
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : s.expected_risk === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {isClean ? 'Clean Consignment' : `${s.expected_risk} Discrepancy`}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    {s.document_type}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-amber-700 transition">
                  {s.title}
                </div>

                <p className="text-[11px] font-medium text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {s.description}
                </p>

                {isSelected && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Active Ingestion</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ingestion & Raw Input Studio */}
      <div className="bright-card p-5 sm:p-6 rounded-2xl bg-white border-2 border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-amber-600" />
              Document Ingestion &amp; Upload Studio
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Upload unstructured PDFs/images, commercial invoices, or bills of lading for automated entity extraction
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
              accept=".pdf,.txt,.csv,.json,.doc,.docx"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 active:scale-[0.98]"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
              <span>Upload Custom File</span>
            </button>

            <button
              onClick={() => setShowSandbox(!showSandbox)}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 border border-amber-200 active:scale-[0.98]"
            >
              <Search className="w-3.5 h-3.5 text-amber-600" />
              <span>{showSandbox ? 'Hide HS Lookup Sandbox' : 'Open HS Lookup Sandbox'}</span>
            </button>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
            isDragging 
              ? 'border-amber-500 bg-amber-50/50' 
              : uploadedFileName 
                ? 'border-emerald-300 bg-emerald-50/30' 
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          {uploadedFileName ? (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Loaded Document: <strong className="font-mono text-slate-900">{uploadedFileName}</strong></span>
              <button 
                onClick={() => { setUploadedFileName(''); setDocumentText(''); }}
                className="ml-2 text-slate-400 hover:text-rose-600"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2 text-slate-500 space-y-1">
              <span className="text-xs font-bold text-slate-700">
                Drag and drop shipping documents (PDF, BoL, Invoice, TXT) here, or browse files
              </span>
              <span className="text-[11px] text-slate-400">
                Sub-second OCR extraction powered by Google Gemini 3.8 Flash IDP wrapper
              </span>
            </div>
          )}
        </div>

        {/* Action Controls & Live Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAudit}
              disabled={loading || !documentText.trim()}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-slate-900/10 active:scale-[0.98] disabled:opacity-50"
            >
              <Cpu className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
              <span>{loading ? 'Processing Document...' : 'Run Trade Compliance Audit'}</span>
            </button>

            {loading && (
              <span className="text-xs font-bold text-amber-700 animate-pulse flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                {processingStage}
              </span>
            )}
          </div>

          {auditResult?.metrics && (
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 font-mono text-[11px] font-bold text-slate-700 border border-slate-200">
                Latency: {auditResult.metrics.total_processing_latency_ms} ms
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 font-mono text-[11px] font-bold text-emerald-800 border border-emerald-200">
                RAG Search: {auditResult.metrics.rag_retrieval_latency_ms} ms
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Standalone HS Code Classifier Sandbox (Collapsible) */}
      {showSandbox && (
        <div className="bright-card p-5 rounded-2xl bg-amber-50/40 border-2 border-amber-300 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-700" />
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                Interactive Sub-Second Harmonized System (HS) Classifier Sandbox
              </h4>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              Local PyTorch Cosine Similarity
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={classifierQuery}
              onChange={(e) => setClassifierQuery(e.target.value)}
              placeholder="Enter commodity description (e.g. lithium battery pack, basalt stone, diesel truck hauler engine)..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              onKeyDown={(e) => e.key === 'Enter' && handleTestClassifier()}
            />
            <button
              onClick={handleTestClassifier}
              disabled={classifierLoading}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm active:scale-[0.98]"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{classifierLoading ? 'Classifying...' : 'Classify HS Code'}</span>
            </button>
          </div>

          {/* Classifier Results */}
          {classifierResults && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Top Candidate Classifications (SLA: {classifierResults.retrieval_latency_ms} ms):</span>
                <span className="font-mono text-slate-500">Destination: {classifierResults.destination_country}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {classifierResults.candidate_matches?.map((m) => (
                  <div key={m.hs_code} className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                        HS {m.hs_code}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        {(m.similarity_score * 100).toFixed(1)}% Match
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 line-clamp-1">{m.description}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Tariff: <strong>{m.tariff_rate_pct}%</strong></span>
                      <span className="truncate max-w-[120px]">{m.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Compliance Audit Results HUD */}
      {auditResult && (
        <div className="space-y-5">
          {/* Top Clearance Status Banner */}
          <div className={`p-5 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
            isApproved
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : isConditional
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-start sm:items-center gap-3.5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                isApproved
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                  : isConditional
                    ? 'bg-amber-100 border-amber-300 text-amber-700'
                    : 'bg-rose-100 border-rose-300 text-rose-700'
              }`}>
                {isApproved && <ShieldCheck className="w-7 h-7 stroke-[2.2]" />}
                {isConditional && <AlertCircle className="w-7 h-7 stroke-[2.2]" />}
                {isRejected && <ShieldAlert className="w-7 h-7 stroke-[2.2]" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                    isApproved
                      ? 'bg-emerald-200/60 text-emerald-900 border-emerald-300'
                      : isConditional
                        ? 'bg-amber-200/60 text-amber-900 border-amber-300'
                        : 'bg-rose-200/60 text-rose-900 border-rose-300'
                  }`}>
                    {audit.clearance_status.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    Doc #{auditResult.document_metadata?.document_number}
                  </span>
                </div>
                <h3 className="text-xl font-black mt-0.5 tracking-tight">
                  {isApproved && 'Consignment Cleared for Customs Entry'}
                  {isConditional && 'Conditional Clearance — Regulatory Scrutiny Mandated'}
                  {isRejected && 'Customs Clearance Held — Statutory Discrepancies Flagged'}
                </h3>
                <p className="text-xs font-medium text-slate-600 mt-0.5">
                  Cross-checked against Indian Customs Act, Directorate General of Foreign Trade (DGFT), and BIS/CDSCO regulations.
                </p>
              </div>
            </div>

            {/* Score & Alert Counts Strip */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-3 rounded-xl bg-white/90 border border-slate-200 text-center min-w-[90px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Compliance Score</div>
                <div className="text-2xl font-black font-mono-num text-slate-900">
                  {audit.compliance_score}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/90 border border-slate-200 text-center min-w-[90px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Risk Level</div>
                <div className={`text-xs font-black uppercase mt-1 px-2 py-0.5 rounded ${
                  audit.risk_level === 'LOW'
                    ? 'bg-emerald-100 text-emerald-800'
                    : audit.risk_level === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                }`}>
                  {audit.risk_level}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/90 border border-slate-200 text-center min-w-[90px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Discrepancies</div>
                <div className="text-2xl font-black font-mono-num text-rose-600">
                  {audit.total_alerts_count}
                </div>
              </div>
            </div>
          </div>

          {/* Discrepancy Alerts List (Actionable Remediations) */}
          {audit.alerts && audit.alerts.length > 0 && (
            <div className="bright-card p-5 sm:p-6 rounded-2xl bg-white border-2 border-rose-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Active Compliance Discrepancy Alerts &amp; Remediation Orders ({audit.alerts.length})
                  </h3>
                </div>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  Customs Officer Review Required
                </span>
              </div>

              <div className="space-y-3">
                {audit.alerts.map((alert, idx) => {
                  const isCrit = alert.severity === 'CRITICAL';
                  const isHigh = alert.severity === 'HIGH';

                  return (
                    <div 
                      key={idx}
                      className={`p-4 rounded-xl border-2 space-y-2.5 transition-all ${
                        isCrit 
                          ? 'bg-rose-50/70 border-rose-300' 
                          : isHigh 
                            ? 'bg-amber-50/70 border-amber-300' 
                            : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                            isCrit 
                              ? 'bg-rose-600 text-white border-rose-700' 
                              : isHigh 
                                ? 'bg-amber-500 text-white border-amber-600' 
                                : 'bg-slate-600 text-white border-slate-700'
                          }`}>
                            {alert.severity} SEVERITY
                          </span>
                          <span className="text-xs font-black text-slate-900 font-mono">
                            {alert.category}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            [{alert.rule_id}]
                          </span>
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-slate-800 leading-relaxed">
                        {alert.issue}
                      </div>

                      {/* Actionable Remediation Callout Box */}
                      <div className="p-3 rounded-lg bg-white border border-slate-300 flex items-start gap-2.5 shadow-xs">
                        <ArrowRight className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Prescribed Statutory Remediation:
                          </span>
                          <span className="text-xs font-bold text-slate-900 block">
                            {alert.remediation}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Result Inspector Tabs Header */}
          <div className="flex items-center gap-1.5 border-b-2 border-slate-200 pb-1 overflow-x-auto">
            <button
              onClick={() => setResultTab('audit')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                resultTab === 'audit'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              HS Code Classifications &amp; Line Items ({auditResult.line_items?.length || 0})
            </button>

            <button
              onClick={() => setResultTab('entities')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                resultTab === 'entities'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Extracted Trade Entities
            </button>

            <button
              onClick={() => setResultTab('json')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                resultTab === 'json'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Structured JSON Inspector</span>
            </button>

            <button
              onClick={() => setResultTab('raw')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                resultTab === 'raw'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Raw Document Preview</span>
            </button>
          </div>

          {/* Tab 1: HS Classifications & Line Items Table */}
          {resultTab === 'audit' && (
            <div className="bright-card rounded-2xl bg-white border-2 border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Line Item Vector RAG HS Code Match Audit
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Automated sub-second classification cross-checking declared HS codes against international WCO nomenclature
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {auditResult.rag_classifications?.length} Items Verified
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase text-[10px] font-black border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Item #</th>
                      <th className="py-3 px-4">Commodity Description</th>
                      <th className="py-3 px-4">Declared HS</th>
                      <th className="py-3 px-4">Recommended HS (Vector RAG)</th>
                      <th className="py-3 px-4">Similarity Score</th>
                      <th className="py-3 px-4">Tariff Rate</th>
                      <th className="py-3 px-4">Statutory Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                    {auditResult.rag_classifications?.map((c, idx) => {
                      const item = auditResult.line_items?.[idx] || {};
                      const isMatch = c.is_match;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            #{c.item_number}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-bold text-slate-900 text-xs">{c.description}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Qty: {item.quantity} {item.unit} • Total: {auditResult.document_metadata?.currency} {item.total_price?.toLocaleString()}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800">
                              {c.declared_hs_code || 'UNDECLARED'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900">
                                {c.recommended_hs_code}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate max-w-[180px]">
                              {c.top_matches?.[0]?.category}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    c.confidence_score >= 0.75 
                                      ? 'bg-emerald-500' 
                                      : c.confidence_score >= 0.50 
                                        ? 'bg-amber-500' 
                                        : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.round(c.confidence_score * 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-bold text-slate-700">
                                {(c.confidence_score * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {c.tariff_rate_pct}%
                          </td>
                          <td className="py-3 px-4">
                            {isMatch ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> MATCH
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300">
                                <AlertTriangle className="w-3 h-3" /> MISMATCH
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Extracted Trade Entities Grid */}
          {resultTab === 'entities' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Shipper Card */}
              <div className="bright-card p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Shipper / Exporter</div>
                <div className="font-extrabold text-xs text-slate-900">{auditResult.shipper?.name || 'N/A'}</div>
                <div className="text-[11px] text-slate-500">{auditResult.shipper?.address || 'N/A'}</div>
                <div className="text-[11px] font-mono text-slate-600 font-semibold">
                  Tax / EORI: {auditResult.shipper?.tax_id || 'N/A'} • {auditResult.shipper?.country}
                </div>
              </div>

              {/* Consignee Card */}
              <div className="bright-card p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Consignee / Importer</div>
                <div className="font-extrabold text-xs text-slate-900">{auditResult.consignee?.name || 'N/A'}</div>
                <div className="text-[11px] text-slate-500">{auditResult.consignee?.address || 'N/A'}</div>
                <div className="text-[11px] font-mono text-slate-600 font-semibold">
                  IEC / VAT: {auditResult.consignee?.tax_id || 'N/A'} • {auditResult.consignee?.country}
                </div>
              </div>

              {/* Voyage & Routing */}
              <div className="bright-card p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Carrier &amp; Vessel Details</div>
                <div className="font-extrabold text-xs text-slate-900">{auditResult.document_metadata?.carrier}</div>
                <div className="text-[11px] font-mono text-slate-600">Vessel: {auditResult.document_metadata?.vessel_or_flight}</div>
                <div className="text-[11px] text-slate-500">
                  POL: {auditResult.document_metadata?.port_of_loading}
                </div>
                <div className="text-[11px] text-slate-500">
                  POD: {auditResult.document_metadata?.port_of_discharge}
                </div>
              </div>

              {/* Value & Incoterms */}
              <div className="bright-card p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Valuation &amp; Terms</div>
                <div className="text-xl font-black font-mono-num text-slate-900">
                  {auditResult.document_metadata?.currency} {auditResult.document_metadata?.declared_total_value?.toLocaleString()}
                </div>
                <div className="text-[11px] font-bold text-amber-700">
                  Incoterms: {auditResult.document_metadata?.incoterms}
                </div>
                <div className="text-[11px] text-slate-500">
                  Freight: {auditResult.document_metadata?.freight_charges} • Insurance: {auditResult.document_metadata?.insurance_charges}
                </div>
              </div>

              {/* Weights & Packages */}
              <div className="bright-card p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Weights &amp; Containers</div>
                <div className="text-xs font-bold text-slate-900">
                  Gross: {auditResult.document_metadata?.gross_weight_kg?.toLocaleString()} kg • Net: {auditResult.document_metadata?.net_weight_kg?.toLocaleString()} kg
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Packages: {auditResult.document_metadata?.packages_count}
                </div>
                <div className="text-[11px] font-mono text-slate-600 font-semibold truncate">
                  Containers: {auditResult.document_metadata?.container_numbers?.join(', ')}
                </div>
              </div>

              {/* Declared Certificates */}
              <div className="bright-card p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Declared Certificates</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {auditResult.document_metadata?.declared_certificates?.length > 0 ? (
                    auditResult.document_metadata.declared_certificates.map((cert, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-slate-800">
                        {cert}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-rose-600 font-bold">No regulatory certificates declared</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Structured JSON Inspector */}
          {resultTab === 'json' && (
            <div className="bright-card rounded-2xl bg-white border-2 border-slate-200 overflow-hidden">
              <div className="p-3.5 bg-slate-900 text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-bold">Normalized Trade IDP Schema Payload</span>
                </div>
                <button
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition flex items-center gap-1 active:scale-[0.98]"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-[450px] leading-relaxed">
                {JSON.stringify(auditResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Tab 4: Raw Document Text Preview */}
          {resultTab === 'raw' && (
            <div className="bright-card rounded-2xl bg-white border-2 border-slate-200 overflow-hidden">
              <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Unstructured Raw Shipping Payload (Pre-IDP)</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {documentText.length} characters
                </span>
              </div>
              <pre className="p-4 bg-slate-50 text-slate-800 font-mono text-xs overflow-x-auto max-h-[450px] leading-relaxed whitespace-pre-wrap">
                {documentText || 'No raw document text available.'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
