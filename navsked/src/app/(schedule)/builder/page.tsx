'use client';

import { useState } from 'react';
import { format, addDays } from 'date-fns';

interface GeneratedSchedule {
  id: string;
  totalFlightHours: number;
  flights: Array<{
    id: string;
    flightDesignator: string;
    scheduledTakeoff: string;
    scheduledLand: string;
    plannedDuration: number;
    timeOfDay: string;
    flightType: string;
    crewAssignments: Array<{
      aircrewId: string;
      position: string;
      role: string;
    }>;
  }>;
  validationResult?: {
    isValid: boolean;
    fitnessScore: number;
    hardViolations: Array<{ message: string; ruleName: string }>;
    softViolations: Array<{ message: string; ruleName: string }>;
    summary: {
      totalFlightHours: number;
      crewUtilization: number;
      trainingEventsScheduled: number;
      fairnessDeviation: number;
    };
  };
}

export default function ScheduleBuilder() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 6), 'yyyy-MM-dd'));
  const [maxFlights, setMaxFlights] = useState(3);
  const [budget, setBudget] = useState(45);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          options: {
            maxFlightsPerDay: maxFlights,
            flightHourBudget: budget,
          },
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setSchedule(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#001f3f' }}>Schedule Builder</h2>
      <p className="text-sm text-gray-500 mb-4">
        Auto-generate a flight schedule using the constraint-based scheduling engine
      </p>

      {/* Controls */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <div className="grid grid-cols-5 gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
              style={{ borderColor: '#dee2e6' }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
              style={{ borderColor: '#dee2e6' }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Max Flights/Day</label>
            <input
              type="number"
              value={maxFlights}
              onChange={(e) => setMaxFlights(parseInt(e.target.value))}
              min={1}
              max={5}
              className="w-full border rounded px-2 py-1.5 text-sm"
              style={{ borderColor: '#dee2e6' }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hour Budget</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value))}
              min={10}
              max={200}
              className="w-full border rounded px-2 py-1.5 text-sm"
              style={{ borderColor: '#dee2e6' }}
            />
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="px-4 py-1.5 rounded text-sm font-medium text-white"
            style={{ background: loading ? '#6b7280' : '#001f3f' }}
          >
            {loading ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {schedule && (
        <>
          {/* Validation Summary */}
          {schedule.validationResult && (
            <div className={`rounded shadow p-4 mb-6 ${
              schedule.validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold">
                  {schedule.validationResult.isValid ? 'Schedule Valid' : 'Validation Issues Found'}
                </h3>
                <span className="text-lg font-bold">
                  Fitness: {schedule.validationResult.fitnessScore}/100
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Total Hours</p>
                  <p className="font-medium">{schedule.validationResult.summary.totalFlightHours}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Crew Utilization</p>
                  <p className="font-medium">{schedule.validationResult.summary.crewUtilization}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fairness Deviation</p>
                  <p className="font-medium">{schedule.validationResult.summary.fairnessDeviation}hrs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Hard Violations</p>
                  <p className={`font-medium ${schedule.validationResult.hardViolations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {schedule.validationResult.hardViolations.length}
                  </p>
                </div>
              </div>
              {schedule.validationResult.hardViolations.length > 0 && (
                <div className="mt-3 space-y-1">
                  {schedule.validationResult.hardViolations.map((v, i) => (
                    <p key={i} className="text-xs text-red-600">
                      [{v.ruleName}] {v.message}
                    </p>
                  ))}
                </div>
              )}
              {schedule.validationResult.softViolations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {schedule.validationResult.softViolations.map((v, i) => (
                    <p key={i} className="text-xs text-amber-600">
                      [{v.ruleName}] {v.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generated Flights */}
          <div className="bg-white rounded shadow">
            <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: '#dee2e6' }}>
              <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>
                Generated Schedule ({schedule.flights.length} flights, {schedule.totalFlightHours}hrs)
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">Flight</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">Time</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-500">Duration</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-500">Day/Night</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-500">Crew</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#dee2e6' }}>
                {schedule.flights.map((flight) => (
                  <tr key={flight.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-medium">{flight.flightDesignator}</td>
                    <td className="px-3 py-2 text-xs">{flight.scheduledTakeoff.split('T')[0]}</td>
                    <td className="px-3 py-2 text-xs">
                      {format(new Date(flight.scheduledTakeoff), 'HHmm')}-{format(new Date(flight.scheduledLand), 'HHmm')}
                    </td>
                    <td className="px-3 py-2 text-xs text-center">{flight.plannedDuration}hrs</td>
                    <td className="px-3 py-2 text-xs text-center">
                      <span className={`px-1.5 py-0.5 rounded ${
                        flight.timeOfDay === 'NIGHT' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {flight.timeOfDay}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-center">{flight.crewAssignments.length}</td>
                    <td className="px-3 py-2 text-xs">{flight.flightType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
