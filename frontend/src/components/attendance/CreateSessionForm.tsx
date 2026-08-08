'use client';
import React, { useState } from 'react';

interface CreateSessionProps {
  onCreate: (data: {
    subject_name: string;
    section: string;
    duration_minutes: number;
    gps_latitude?: number;
    gps_longitude?: number;
    gps_radius?: number;
  }) => Promise<void>;
}

export default function CreateSessionForm({ onCreate }: CreateSessionProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject_name: '',
    section: '',
    duration_minutes: 15,
    gps_enabled: false,
    gps_radius: 100,
  });
  const [locationError, setLocationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLocationError('');

    try {
      let lat, lng;
      if (formData.gps_enabled) {
        // Get browser location
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      await onCreate({
        subject_name: formData.subject_name,
        section: formData.section,
        duration_minutes: formData.duration_minutes,
        gps_latitude: lat,
        gps_longitude: lng,
        gps_radius: formData.gps_enabled ? formData.gps_radius : undefined,
      });
    } catch (err: any) {
      console.error(err);
      if (err.code === 1 || err.message?.includes('User denied')) {
        setLocationError('Location permission denied. Cannot create GPS-enabled session.');
      } else {
        setLocationError('Failed to create session. ' + (err.message || ''));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow border">
      <h3 className="text-xl font-semibold mb-4">Create Attendance Session</h3>
      
      <div>
        <label className="block text-sm font-medium mb-1">Subject Name</label>
        <input 
          required 
          type="text"
          className="w-full p-2 border rounded" 
          value={formData.subject_name}
          onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
          placeholder="e.g., Data Structures"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Section (Optional)</label>
        <input 
          type="text"
          className="w-full p-2 border rounded" 
          value={formData.section}
          onChange={(e) => setFormData({...formData, section: e.target.value})}
          placeholder="e.g., CSE-A"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Duration (Minutes)</label>
        <input 
          required 
          type="number"
          min="1"
          className="w-full p-2 border rounded" 
          value={formData.duration_minutes}
          onChange={(e) => setFormData({...formData, duration_minutes: Number(e.target.value)})}
        />
      </div>

      <div className="flex items-center space-x-2">
        <input 
          type="checkbox"
          id="gps_enabled"
          checked={formData.gps_enabled}
          onChange={(e) => setFormData({...formData, gps_enabled: e.target.checked})}
        />
        <label htmlFor="gps_enabled" className="text-sm font-medium">Enable GPS Restriction</label>
      </div>

      {formData.gps_enabled && (
        <div>
          <label className="block text-sm font-medium mb-1">GPS Radius (meters)</label>
          <input 
            required 
            type="number"
            min="10"
            className="w-full p-2 border rounded" 
            value={formData.gps_radius}
            onChange={(e) => setFormData({...formData, gps_radius: Number(e.target.value)})}
          />
        </div>
      )}

      {locationError && (
        <div className="text-red-500 text-sm mt-2">{locationError}</div>
      )}

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Generate QR'}
      </button>
    </form>
  );
}
