'use client';
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function AttendanceQRCode({ sessionId }: { sessionId: string }) {
  const [scanUrl, setScanUrl] = React.useState('');

  React.useEffect(() => {
    // Use the actual hostname, but if it's localhost, swap it with the machine's LAN IP
    // so mobile devices can scan the QR code and connect to the dev server.
    let hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      hostname = '192.168.31.214';
    }
    const port = window.location.port;
    const protocol = window.location.protocol;
    const origin = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    setScanUrl(`${origin}/attendance/scan/?session=${sessionId}`);
  }, [sessionId]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm">
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        {scanUrl ? (
          <QRCodeSVG
            value={scanUrl}
            size={256}
            level="H"
            includeMargin={true}
          />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
      {scanUrl && (
        <p className="text-xs text-gray-400 mt-3 break-all max-w-[260px] text-center">
          {scanUrl}
        </p>
      )}
    </div>
  );
}
