import { getStore } from '@/lib/store';
import { calculateSquadronReadiness } from '@/lib/readiness/calculator';
import { format, addDays } from 'date-fns';

function StatusBadge({ status }: { status: 'GREEN' | 'AMBER' | 'RED' }) {
  const colors = {
    GREEN: 'bg-green-600',
    AMBER: 'bg-amber-500',
    RED: 'bg-red-600',
  };
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${colors[status]}`} />
  );
}

export default function Dashboard() {
  const store = getStore();
  const allAircrew = Array.from(store.aircrew.values());
  const allFlights = Array.from(store.flights.values());
  const executedHours = 142;

  const readiness = calculateSquadronReadiness(
    store.squadron,
    allAircrew,
    store.qualifications,
    store.trainingRecords,
    store.trainingDefinitions,
    executedHours
  );

  // Get upcoming flights (next 48 hours)
  const now = new Date();
  const cutoff = addDays(now, 2);
  const upcomingFlights = allFlights
    .filter((f) => {
      const takeoff = new Date(f.scheduledTakeoff);
      return takeoff >= now && takeoff <= cutoff && f.status === 'SCHEDULED';
    })
    .sort((a, b) => a.scheduledTakeoff.localeCompare(b.scheduledTakeoff))
    .slice(0, 6);

  // Find expiring currencies
  const alerts: { name: string; message: string; severity: 'RED' | 'AMBER' }[] = [];
  for (const member of allAircrew) {
    const quals = store.qualifications.get(member.id);
    if (!quals) continue;
    for (const currency of quals.currencies) {
      if (currency.expiryDate) {
        const daysLeft = Math.round(
          (new Date(currency.expiryDate).getTime() - now.getTime()) / 86400000
        );
        if (daysLeft < 0) {
          alerts.push({
            name: `${member.payGrade} ${member.lastName}`,
            message: `${currency.name} EXPIRED`,
            severity: 'RED',
          });
        } else if (daysLeft < 15) {
          alerts.push({
            name: `${member.payGrade} ${member.lastName}`,
            message: `${currency.name} expires in ${daysLeft} days`,
            severity: 'AMBER',
          });
        }
      }
    }
    if (member.natopsStatus === 'DUE') {
      alerts.push({
        name: `${member.payGrade} ${member.lastName}`,
        message: `NATOPS eval DUE`,
        severity: 'AMBER',
      });
    } else if (member.natopsStatus === 'EXPIRED') {
      alerts.push({
        name: `${member.payGrade} ${member.lastName}`,
        message: `NATOPS EXPIRED`,
        severity: 'RED',
      });
    }
  }
  alerts.sort((a, b) => (a.severity === 'RED' ? -1 : 1) - (b.severity === 'RED' ? -1 : 1));
  const topAlerts = alerts.slice(0, 8);

  const flyCount = allAircrew.filter((a) => a.flightStatus === 'FLY').length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: '#001f3f' }}>
        VP-10 Red Lancers &mdash; Squadron Dashboard
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded shadow p-4 border-l-4 border-l-blue-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">T-Rating</p>
          <p className="text-2xl font-bold mt-1">{readiness.tRating.toFixed(2)}</p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={readiness.overallStatus} />
            <span className="text-xs text-gray-500">
              Ef: {readiness.experienceFactor.toFixed(2)} / Pf: {readiness.performanceFactor.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4 border-l-4 border-l-green-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Combat Ready</p>
          <p className="text-2xl font-bold mt-1">{readiness.combatReadyPercentage}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {readiness.actcDistribution.filter((d) => d.level >= 300).reduce((s, d) => s + d.count, 0)} of {allAircrew.length} crew
          </p>
        </div>

        <div className="bg-white rounded shadow p-4 border-l-4 border-l-amber-500">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Flight Hours (Month)</p>
          <p className="text-2xl font-bold mt-1">{executedHours} / {store.squadron.monthlyFlightHourAllocation}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-amber-500 h-2 rounded-full"
              style={{ width: `${Math.min(100, (executedHours / store.squadron.monthlyFlightHourAllocation) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded shadow p-4 border-l-4 border-l-purple-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Available Crew</p>
          <p className="text-2xl font-bold mt-1">{flyCount} / {allAircrew.length}</p>
          <p className="text-xs text-gray-500 mt-1">
            {allAircrew.filter((a) => a.flightStatus === 'LEAVE').length} on leave,{' '}
            {allAircrew.filter((a) => a.flightStatus === 'DNIF').length} DNIF
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Upcoming Flights */}
        <div className="col-span-2">
          <div className="bg-white rounded shadow">
            <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: '#dee2e6' }}>
              <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>
                Upcoming Flights (Next 48 Hours)
              </h3>
              <span className="text-xs text-gray-500">{upcomingFlights.length} flights</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#dee2e6' }}>
              {upcomingFlights.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No upcoming flights scheduled</p>
              ) : (
                upcomingFlights.map((flight) => {
                  const takeoff = new Date(flight.scheduledTakeoff);
                  return (
                    <div key={flight.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="w-20">
                        <p className="text-xs font-bold" style={{ color: '#001f3f' }}>
                          {format(takeoff, 'dd MMM')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(takeoff, 'HHmm')}L
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{flight.flightDesignator}</p>
                        <p className="text-xs text-gray-500">
                          {flight.aircraftSideNumber} &bull; {flight.flightArea} &bull; {flight.plannedDuration}hrs
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          flight.timeOfDay === 'NIGHT' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {flight.timeOfDay}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {flight.flightType}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {flight.crewAssignments.length} crew
                        </p>
                        <p className="text-xs text-gray-400">
                          PPC: {(() => {
                            const ppc = flight.crewAssignments.find((a) => a.position === 'PPC');
                            if (!ppc) return 'TBD';
                            const member = store.aircrew.get(ppc.aircrewId);
                            return member ? member.lastName : 'TBD';
                          })()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ACTC Distribution */}
          <div className="bg-white rounded shadow mt-6">
            <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6' }}>
              <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>ACTC Level Distribution</h3>
            </div>
            <div className="p-4">
              {readiness.actcDistribution.map((d) => (
                <div key={d.level} className="flex items-center gap-3 mb-2">
                  <span className="text-xs w-16 text-right font-mono">ACTC {d.level}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                    <div
                      className="h-5 rounded-full text-xs text-white flex items-center justify-center"
                      style={{
                        width: `${Math.max(d.percentage, 5)}%`,
                        background: d.level >= 400 ? '#001f3f' : d.level >= 300 ? '#003B6F' : d.level >= 200 ? '#0055aa' : '#93c5fd',
                      }}
                    >
                      {d.count}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-10">{Math.round(d.percentage)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts Panel */}
        <div>
          <div className="bg-white rounded shadow">
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#dee2e6' }}>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>
                Alerts &amp; Warnings
              </h3>
            </div>
            <div className="divide-y" style={{ borderColor: '#dee2e6' }}>
              {topAlerts.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No active alerts</p>
              ) : (
                topAlerts.map((alert, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                    <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      alert.severity === 'RED' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <div>
                      <p className="text-xs font-medium">{alert.name}</p>
                      <p className={`text-xs ${
                        alert.severity === 'RED' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {alert.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded shadow mt-6">
            <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6' }}>
              <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>This Week</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Scheduled Flights</span>
                <span className="font-medium">{allFlights.filter((f) => f.status === 'SCHEDULED').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Flight Hours</span>
                <span className="font-medium">
                  {allFlights.filter((f) => f.status === 'SCHEDULED').reduce((s, f) => s + f.plannedDuration, 0)}hrs
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Night Sorties</span>
                <span className="font-medium">
                  {allFlights.filter((f) => f.timeOfDay === 'NIGHT').length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Aircraft Type</span>
                <span className="font-medium">P-8A Poseidon</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Aircraft Available</span>
                <span className="font-medium">{store.squadron.assignedAircraft}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
