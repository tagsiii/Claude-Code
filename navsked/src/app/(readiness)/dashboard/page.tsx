import { getStore } from '@/lib/store';
import { calculateSquadronReadiness } from '@/lib/readiness/calculator';

export default function ReadinessDashboard() {
  const store = getStore();
  const allAircrew = Array.from(store.aircrew.values());

  const readiness = calculateSquadronReadiness(
    store.squadron,
    allAircrew,
    store.qualifications,
    store.trainingRecords,
    store.trainingDefinitions,
    142
  );

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#001f3f' }}>Readiness Dashboard</h2>
      <p className="text-sm text-gray-500 mb-4">VP-10 squadron readiness overview as of {readiness.asOfDate}</p>

      {/* T-Rating Gauge */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded shadow p-6 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">T-Rating (Ef x Pf)</p>
          <div className="relative inline-flex items-center justify-center w-32 h-32 rounded-full border-8" style={{
            borderColor: readiness.overallStatus === 'GREEN' ? '#16a34a' : readiness.overallStatus === 'AMBER' ? '#d97706' : '#dc2626'
          }}>
            <span className="text-3xl font-bold">{readiness.tRating.toFixed(2)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Experience (Ef)</p>
              <p className="font-bold">{readiness.experienceFactor.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Performance (Pf)</p>
              <p className="font-bold">{readiness.performanceFactor.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded shadow p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">ACTC Distribution</p>
          {readiness.actcDistribution.map((d) => (
            <div key={d.level} className="flex items-center gap-2 mb-2">
              <span className="text-xs w-14 text-right font-mono font-medium">ACTC {d.level}</span>
              <div className="flex-1 bg-gray-100 rounded h-4">
                <div
                  className="h-4 rounded text-xs text-white flex items-center justify-center font-medium"
                  style={{
                    width: `${Math.max(d.percentage, 8)}%`,
                    background: d.level >= 400 ? '#001f3f' : d.level >= 300 ? '#003B6F' : d.level >= 200 ? '#0055aa' : '#93c5fd',
                  }}
                >
                  {d.count}
                </div>
              </div>
              <span className="text-xs text-gray-500 w-8">{Math.round(d.percentage)}%</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t" style={{ borderColor: '#dee2e6' }}>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Combat Ready (ACTC 300+)</span>
              <span className="font-bold">{readiness.combatReadyPercentage}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded shadow p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Flight Hour Status</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Monthly Budget</span>
                <span className="font-medium">{readiness.flightHourStatus.allocated} hrs</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full flex items-center justify-center text-xs text-white font-medium"
                  style={{
                    width: `${Math.min(100, (readiness.flightHourStatus.executed / readiness.flightHourStatus.allocated) * 100)}%`,
                    background: readiness.flightHourStatus.executed > readiness.flightHourStatus.allocated * 0.9 ? '#dc2626' : '#003B6F',
                  }}
                >
                  {Math.round(readiness.flightHourStatus.executed)} used
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Remaining</span>
              <span className="font-bold">{Math.round(readiness.flightHourStatus.remaining)} hrs</span>
            </div>
            <div className="pt-2 border-t" style={{ borderColor: '#dee2e6' }}>
              <p className="text-xs text-gray-500">FRTP Phase</p>
              <p className="text-sm font-medium">{store.squadron.frtpPhase} (R+{store.squadron.rPlusMonth})</p>
            </div>
          </div>
        </div>
      </div>

      {/* MET Readiness */}
      <div className="bg-white rounded shadow">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6' }}>
          <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>Mission Essential Task (MET) Readiness</h3>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          {readiness.metReadiness.map((met) => (
            <div key={met.metCode} className="border rounded p-3" style={{ borderColor: '#dee2e6' }}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="text-xs font-mono text-gray-400">{met.metCode}</span>
                  <p className="text-sm font-medium">{met.metName}</p>
                </div>
                <span className={`text-lg font-bold ${
                  met.readinessScore >= 70 ? 'text-green-600' :
                  met.readinessScore >= 40 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {met.readinessScore}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${met.readinessScore}%`,
                    background: met.readinessScore >= 70 ? '#16a34a' : met.readinessScore >= 40 ? '#d97706' : '#dc2626',
                  }}
                />
              </div>
              <div className="mt-2 space-y-1">
                {met.subEvents.map((se) => (
                  <div key={se.eventCode} className="flex justify-between text-xs text-gray-500">
                    <span>{se.eventCode}</span>
                    <span>{se.completed}/{se.required} ({se.percentComplete}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
