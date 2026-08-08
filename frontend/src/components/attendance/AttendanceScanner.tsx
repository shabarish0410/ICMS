'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface AttendanceScannerProps {
  onScan: (sessionId: string) => void;
  isProcessing: boolean;
}

export default function AttendanceScanner({ onScan, isProcessing }: AttendanceScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Prevent re-initialization in React 18 strict mode
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          // Expected format: attendance:<session_uuid>
          if (decodedText.startsWith('attendance:')) {
            const sessionId = decodedText.replace('attendance:', '').trim();
            // Pause scanner immediately upon success to prevent duplicate events
            scannerRef.current?.pause(true);
            onScan(sessionId);
          } else {
            // Also allow just raw UUID if that was encoded
            // extremely basic UUID regex validation
            const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(decodedText);
            if (isUUID) {
              scannerRef.current?.pause(true);
              onScan(decodedText);
            } else {
              setError('Invalid attendance QR code.');
            }
          }
        },
        (errorMessage) => {
          // Ignore frequent "not found" frame errors to avoid spam
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center">
      <div id="qr-reader" className="w-full max-w-sm overflow-hidden rounded-xl border shadow-sm bg-white" />
      {error && <p className="text-red-500 mt-4 text-sm font-medium">{error}</p>}
      {isProcessing && (
        <div className="mt-4 flex items-center text-blue-600">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing Attendance...
        </div>
      )}
    </div>
  );
}
