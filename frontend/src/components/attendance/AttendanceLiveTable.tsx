'use client';
import React from 'react';

export default function AttendanceLiveTable({ records }: { records: any[] }) {
  if (!records || records.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
        No students have marked attendance yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow border">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
          <tr>
            <th className="px-6 py-3">Student Name</th>
            <th className="px-6 py-3">Identifier</th>
            <th className="px-6 py-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="bg-white border-b hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{record.student_name}</td>
              <td className="px-6 py-4 text-gray-600">{record.student_identifier}</td>
              <td className="px-6 py-4 text-gray-600">
                {new Date(record.marked_at).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
