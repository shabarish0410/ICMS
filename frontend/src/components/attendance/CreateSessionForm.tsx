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
        
        console.log("========== GENERATOR LOCATION ==========");
        console.log("Latitude:", pos.coords.latitude);
        console.log("Longitude:", pos.coords.longitude);
        console.log("Accuracy:", pos.coords.accuracy);
        console.log("Captured At:", new Date().toISOString());
        console.log("========================================");
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
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100">
      <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Create Attendance Session</h3>
      
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Subject Name</label>
        <input 
          required 
          type="text"
          className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" 
          value={formData.subject_name}
          onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
          placeholder="e.g., Data Structures"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          Section <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">(required for ABSENT tracking)</span>
        </label>
        <input 
          type="text"
          className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" 
          value={formData.section}
          onChange={(e) => setFormData({...formData, section: e.target.value})}
          placeholder="e.g., CSE-A"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Must match the section set on student profiles for ABSENT detection.</p>
      </div>


      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Duration (Minutes)</label>
        <input 
          required 
          type="number"
          min="1"
          className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" 
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
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="gps_enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable GPS Restriction</label>
      </div>

      {formData.gps_enabled && (
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">GPS Radius (meters)</label>
          <input 
            required 
            type="number"
            min="10"
            className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" 
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
