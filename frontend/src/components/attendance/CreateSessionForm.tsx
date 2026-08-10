'use client';
import React, { useState } from 'react';

interface CreateSessionProps {
  onCreate: (data: {
    subject_name: string;
    section: string;
    duration_minutes: number;
    generator_latitude?: number;
    generator_longitude?: number;
    generator_accuracy_meters?: number;
    allowed_radius_meters?: number;
    location_captured_at?: string;
  }) => Promise<void>;
}

export default function CreateSessionForm({ onCreate }: CreateSessionProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject_name: '',
    section: '',
    duration_minutes: 15,
  });

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  } | null>(null);
  
  const [allowedRadius, setAllowedRadius] = useState(100);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({
          latitude,
          longitude,
          accuracy,
          capturedAt: new Date().toISOString(),
        });
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission was denied. Please allow location access.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Unable to determine your current location.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out. Please try again.");
            break;
          default:
            setLocationError("Unable to capture your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!location) {
      setLocationError("Please capture the current location before generating the QR.");
      return;
    }

    if (location.accuracy > 100) {
      setLocationError(`GPS accuracy is too low (${Math.round(location.accuracy)}m). Please move to an area with better GPS signal.`);
      return;
    }

    setLoading(true);
    setLocationError(null);

    try {
      await onCreate({
        subject_name: formData.subject_name,
        section: formData.section,
        duration_minutes: formData.duration_minutes,
        generator_latitude: location.latitude,
        generator_longitude: location.longitude,
        generator_accuracy_meters: location.accuracy,
        allowed_radius_meters: allowedRadius,
        location_captured_at: location.capturedAt,
      });
    } catch (err: any) {
      console.error(err);
      setLocationError('Failed to create session. ' + (err.message || ''));
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
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Section (Optional)</label>
        <input 
          type="text"
          className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" 
          value={formData.section}
          onChange={(e) => setFormData({...formData, section: e.target.value})}
          placeholder="e.g., CSE-A"
        />
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

      <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Location Restriction</label>
        
        <button
          type="button"
          onClick={captureCurrentLocation}
          disabled={locationLoading}
          className="w-full mb-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 p-2 rounded border border-gray-300 dark:border-slate-600 transition flex justify-center items-center gap-2"
        >
          <span>📍</span>
          {locationLoading ? 'Capturing...' : 'Capture Current Location'}
        </button>

        {location && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded p-3 mb-4 text-sm">
            <div className="flex items-start text-blue-800 dark:text-blue-200">
              <span className="mr-2">✓</span>
              <div>
                <p>Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                <p>Accuracy: {Math.round(location.accuracy)} meters</p>
                <p className="text-xs mt-1 opacity-75">Captured: {new Date(location.capturedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Allowed Radius</label>
          <div className="flex flex-wrap gap-4">
            {[25, 50, 100, 150, 200].map((radius) => (
              <label key={radius} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="radius"
                  value={radius}
                  checked={allowedRadius === radius}
                  onChange={() => setAllowedRadius(radius)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{radius}m</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {locationError && (
        <div className="text-red-500 text-sm mt-2">{locationError}</div>
      )}

      <button 
        type="submit" 
        disabled={loading}
        className="w-full mt-6 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {loading ? 'Creating...' : 'Generate QR'}
      </button>
    </form>
  );
}
