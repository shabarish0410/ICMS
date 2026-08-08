'use client';
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function AttendanceQRCode({ sessionId }: { sessionId: string }) {
  // Use a predictable pattern for the payload
  const qrPayload = `attendance:${sessionId}`;
  
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm">
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <QRCodeSVG 
          value={qrPayload} 
          size={256} 
          level="H"
          includeMargin={true}
        />
      </div>
      <p className="text-xs text-gray-400 mt-4 break-all max-w-[250px] text-center">
        ID: {sessionId}
      </p>
    </div>
  );
}
