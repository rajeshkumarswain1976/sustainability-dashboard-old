import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  X, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  Camera, 
  MapPin, 
  ExternalLink, 
  Building2, 
  Zap, 
  Droplets, 
  Trash2, 
  Wifi, 
  Wind, 
  AlertCircle 
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

const ISSUES = [
  { id: '', label: 'General / Any Issue' },
  { id: 'leak', label: 'Water · Leak or Tap' },
  { id: 'water-shortage', label: 'Water · Low Pressure / Supply' },
  { id: 'light', label: 'Electricity · Light Not Working' },
  { id: 'power', label: 'Electricity · Power Outage' },
  { id: 'fan', label: 'Electricity · Fan Malfunction' },
  { id: 'ac', label: 'Air · AC / Cooling Failure' },
  { id: 'bin-overflow', label: 'Waste · Bin Overflow' },
  { id: 'wifi', label: 'Wi-Fi · Network Outage' },
  { id: 'furniture', label: 'Assets · Furniture Repair' },
];

const DEFAULT_LOCATIONS = [
  { node_id: 'building:Academic', label: 'Academic Block A' },
  { node_id: 'F01', label: 'Academic Block A - Floor 1' },
  { node_id: 'F02', label: 'Academic Block A - Floor 2' },
  { node_id: 'F03', label: 'Academic Block A - Floor 3' },
  { node_id: 'building:Library', label: 'Central Library' },
  { node_id: 'building:Hostel_A', label: 'Hostel Block A' },
  { node_id: 'building:Cafeteria', label: 'Main Cafeteria' },
  { node_id: 'building:Sports', label: 'Sports & Recreation Complex' }
];

export default function QrCodeModal({ isOpen, onClose, initialNode = '', locations: propLocations }) {
  let contextData = null;
  try {
    contextData = useDashboard();
  } catch {
    // Called outside DashboardProvider
  }
  const rawLocations = (propLocations && propLocations.length > 0) ? propLocations : (contextData?.locations || []);
  const locations = rawLocations.length > 0 ? rawLocations : DEFAULT_LOCATIONS;
  const showToast = contextData?.showToast || ((msg) => console.log(msg));
  const [mode, setMode] = useState('generate'); // 'generate' | 'scan'
  const [selectedNode, setSelectedNode] = useState(initialNode || 'building:Academic');
  const [selectedIssue, setSelectedIssue] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (initialNode) setSelectedNode(initialNode);
  }, [initialNode]);

  // Construct the target URL for CampusCare
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const targetParams = new URLSearchParams();
  if (selectedNode) targetParams.set('node', selectedNode);
  if (selectedIssue) targetParams.set('issue', selectedIssue);
  const targetUrl = `${origin}/campus-care?${targetParams.toString()}`;

  // Generate QR Code image
  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }).then(setQrDataUrl).catch(err => console.error('QR generation error:', err));
  }, [targetUrl, isOpen]);

  // Camera handling for scan mode
  useEffect(() => {
    if (mode === 'scan' && isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, isOpen]);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access not supported on this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError('Camera permission denied or camera not found.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    showToast('Direct complaint QR URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadQr = () => {
    const link = document.createElement('a');
    link.download = `CampusCare_QR_${selectedNode.replace(/[:_]/g, '-')}.png`;
    link.href = qrDataUrl;
    link.click();
    showToast('QR Code image downloaded!');
  };

  const printPoster = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const locationObj = locations.find(l => l.node_id === selectedNode);
    const locationName = locationObj ? locationObj.label : selectedNode;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CampusCare Facility Sign - ${locationName}</title>
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              color: #111827;
              padding: 40px;
              border: 8px solid #0F172A;
              border-radius: 24px;
              max-width: 600px;
              margin: 0 auto;
            }
            .header {
              font-size: 32px;
              font-weight: 800;
              letter-spacing: -0.5px;
              color: #0F172A;
              margin-bottom: 4px;
            }
            .sub {
              font-size: 16px;
              color: #475569;
              margin-bottom: 24px;
            }
            .location-box {
              background: #F1F5F9;
              border-radius: 12px;
              padding: 14px;
              font-size: 18px;
              font-weight: 700;
              color: #0F172A;
              margin-bottom: 28px;
            }
            .qr-img {
              width: 280px;
              height: 280px;
              border: 3px solid #E2E8F0;
              border-radius: 16px;
              padding: 12px;
            }
            .instructions {
              margin-top: 28px;
              font-size: 15px;
              color: #334155;
              line-height: 1.6;
            }
            .instructions strong {
              color: #0F172A;
            }
            .footer {
              margin-top: 36px;
              font-size: 12px;
              color: #94A3B8;
              border-top: 1px solid #E2E8F0;
              padding-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="header">🏢 CampusCare</div>
          <div class="sub">Campus Facility & Maintenance Center</div>
          <div class="location-box">📍 Location: ${locationName}</div>
          <img class="qr-img" src="${qrDataUrl}" alt="CampusCare QR Code" />
          <div class="instructions">
            <strong>Notice a maintenance issue here?</strong><br/>
            1. Open your smartphone camera.<br/>
            2. Scan this QR code to open the report portal.<br/>
            3. Tap Submit — our team is notified instantly.
          </div>
          <div class="footer">
            Powered by Agenexus Sustainability Dashboard · Instant SLA Tracking
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSimulateScan = (nodeId, issueId = '') => {
    const params = new URLSearchParams();
    if (nodeId) params.set('node', nodeId);
    if (issueId) params.set('issue', issueId);
    window.location.href = `/campus-care?${params.toString()}`;
  };

  if (!isOpen) return null;

  const locationObj = locations.find(l => l.node_id === selectedNode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#14151B] border border-[#262838] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#22242E]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-orange/15 text-brand-orange">
              <QrCode className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Campus Location QR Codes</h2>
              <p className="text-xs text-dark-400">Scan or generate printable QR signs for rooms and bins</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-[#1E202B] transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#22242E] bg-[#101117] text-xs font-medium">
          <button
            onClick={() => setMode('generate')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              mode === 'generate'
                ? 'border-brand-orange text-brand-orange font-bold bg-[#14151B]'
                : 'border-transparent text-dark-400 hover:text-white'
            }`}
          >
            Generate & Print QR Signs
          </button>
          <button
            onClick={() => setMode('scan')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              mode === 'scan'
                ? 'border-brand-orange text-brand-orange font-bold bg-[#14151B]'
                : 'border-transparent text-dark-400 hover:text-white'
            }`}
          >
            Scan / Test QR Code
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {mode === 'generate' ? (
            <>
              {/* Location and Category Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-dark-300 font-medium mb-1">
                    1. Campus Location
                  </label>
                  <select
                    value={selectedNode}
                    onChange={e => setSelectedNode(e.target.value)}
                    className="w-full p-2.5 bg-[#191A24] border border-[#262835] rounded-xl text-white focus:outline-none focus:border-brand-orange"
                  >
                    {locations.length > 0 ? (
                      locations.map(loc => (
                        <option key={loc.node_id} value={loc.node_id}>
                          {loc.label} ({loc.level})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="building:Academic">Academic Block</option>
                        <option value="Academic_F0">Academic Block - Ground Floor</option>
                        <option value="Academic_F1">Academic Block - Floor 1</option>
                        <option value="F01">Main Campus Facility</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-dark-300 font-medium mb-1">
                    2. Specific Issue Shortcut <span className="text-dark-400">(Optional)</span>
                  </label>
                  <select
                    value={selectedIssue}
                    onChange={e => setSelectedIssue(e.target.value)}
                    className="w-full p-2.5 bg-[#191A24] border border-[#262835] rounded-xl text-white focus:outline-none focus:border-brand-orange"
                  >
                    {ISSUES.map(iss => (
                      <option key={iss.id} value={iss.id}>
                        {iss.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* QR Preview Card */}
              <div className="p-5 bg-gradient-to-b from-[#181A24] to-[#12131A] border border-[#282B3B] rounded-2xl flex flex-col sm:flex-row items-center gap-5">
                <div className="p-3 bg-white rounded-2xl shadow-lg shrink-0">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="Campus QR Code" 
                      className="w-40 h-40 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-xs text-dark-400">
                      Generating…
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-orange/15 text-brand-orange border border-brand-orange/20">
                    <MapPin className="w-3 h-3" />
                    {locationObj?.label || selectedNode}
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    Scan with any phone camera
                  </h3>
                  <p className="text-xs text-dark-300 leading-relaxed">
                    Directly opens CampusCare with this room pre-selected. Instant submission without searching campus directories.
                  </p>
                  <div className="pt-1 text-[11px] font-mono text-dark-400 break-all bg-[#0F1017] p-2 rounded-lg border border-[#222430]">
                    {targetUrl}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  onClick={printPoster}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl text-xs font-semibold shadow transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Poster
                </button>

                <button
                  onClick={downloadQr}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#1B1D28] hover:bg-[#252736] text-white border border-[#2D3042] rounded-xl text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </button>

                <button
                  onClick={copyUrl}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#1B1D28] hover:bg-[#252736] text-white border border-[#2D3042] rounded-xl text-xs font-semibold transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>

                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#1B1D28] hover:bg-[#252736] text-white border border-[#2D3042] rounded-xl text-xs font-semibold transition text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Test Portal ↗
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Scan / Simulator Mode */}
              <div className="space-y-4">
                <div className="p-4 bg-[#191A24] border border-[#262835] rounded-2xl text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-white font-bold text-sm">
                    <Camera className="w-4 h-4 text-brand-orange" />
                    Live Camera Scanner
                  </div>
                  
                  {cameraActive ? (
                    <div className="relative w-full max-w-sm mx-auto aspect-video bg-black rounded-xl overflow-hidden border border-[#333647]">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                      <div className="absolute inset-4 border-2 border-dashed border-brand-orange/70 rounded-xl pointer-events-none flex items-center justify-center">
                        <span className="text-[11px] bg-black/60 px-2 py-1 rounded text-white font-mono">
                          Point at QR code
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 border border-dashed border-[#2F3244] rounded-xl space-y-2">
                      <Camera className="w-8 h-8 mx-auto text-dark-400" />
                      <p className="text-xs text-dark-300">
                        {cameraError || 'Allow camera access to scan location posters directly.'}
                      </p>
                      <button
                        onClick={startCamera}
                        className="px-3.5 py-1.5 bg-brand-orange text-white text-xs font-semibold rounded-lg hover:bg-brand-orange/90 transition"
                      >
                        Start Camera
                      </button>
                    </div>
                  )}
                </div>

                {/* Instant Simulator Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    ⚡ Quick Test / Simulate QR Tap
                  </h4>
                  <p className="text-xs text-dark-400">
                    Click any location below to simulate scanning a real wall QR code:
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => handleSimulateScan('building:Academic', 'leak')}
                      className="p-3 bg-[#171822] hover:bg-[#1E202E] border border-[#262838] rounded-xl flex items-center justify-between text-left transition"
                    >
                      <div>
                        <div className="font-bold text-white">Academic Block</div>
                        <div className="text-[11px] text-dark-400">Water Leakage Poster</div>
                      </div>
                      <Droplets className="w-4 h-4 text-sky-400" />
                    </button>

                    <button
                      onClick={() => handleSimulateScan('Academic_F1', 'fan')}
                      className="p-3 bg-[#171822] hover:bg-[#1E202E] border border-[#262838] rounded-xl flex items-center justify-between text-left transition"
                    >
                      <div>
                        <div className="font-bold text-white">Floor 1 Classrooms</div>
                        <div className="text-[11px] text-dark-400">Electrical / Fan Issue</div>
                      </div>
                      <Zap className="w-4 h-4 text-amber-400" />
                    </button>

                    <button
                      onClick={() => handleSimulateScan('F01', 'bin-overflow')}
                      className="p-3 bg-[#171822] hover:bg-[#1E202E] border border-[#262838] rounded-xl flex items-center justify-between text-left transition"
                    >
                      <div>
                        <div className="font-bold text-white">Cafeteria / Courtyard</div>
                        <div className="text-[11px] text-dark-400">Waste Bin Poster</div>
                      </div>
                      <Trash2 className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      onClick={() => handleSimulateScan('Academic_F0', 'ac')}
                      className="p-3 bg-[#171822] hover:bg-[#1E202E] border border-[#262838] rounded-xl flex items-center justify-between text-left transition"
                    >
                      <div>
                        <div className="font-bold text-white">Ground Floor Lab</div>
                        <div className="text-[11px] text-dark-400">Air / AC Malfunction</div>
                      </div>
                      <Wind className="w-4 h-4 text-violet-400" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0F1017] border-t border-[#22242E] flex justify-between items-center text-xs text-dark-400">
          <span>Official Agenexus Campus QR System</span>
          <button 
            onClick={onClose}
            className="px-3 py-1.5 bg-[#1B1D28] text-white rounded-lg hover:bg-[#252736] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
