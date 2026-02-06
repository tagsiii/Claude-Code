import { getStore } from '@/lib/store';
import { calculateCrewReadiness } from '@/lib/readiness/calculator';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function CrewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const member = store.aircrew.get(id);
  if (!member) notFound();

  const quals = store.qualifications.get(id);
  const trainingRecords = store.trainingRecords.get(id) || [];
  const constraints = store.constraints.get(id) || [];

  const readiness = quals
    ? calculateCrewReadiness(member, quals, trainingRecords, store.trainingDefinitions)
    : null;

  // Find flights this person is on
  const flights = Array.from(store.flights.values())
    .filter((f) => f.crewAssignments.some((a) => a.aircrewId === id))
    .sort((a, b) => b.scheduledTakeoff.localeCompare(a.scheduledTakeoff))
    .slice(0, 10);

  return (
    <div>
      <Link href="/roster" className="text-sm hover:underline mb-2 inline-block" style={{ color: '#003B6F' }}>
        &larr; Back to Roster
      </Link>

      <div className="flex items-start gap-6 mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ background: '#001f3f' }}>
          {member.firstName[0]}{member.lastName[0]}
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#001f3f' }}>
            {member.payGrade} {member.firstName} {member.lastName}
          </h2>
          {member.callsign && (
            <p className="text-sm text-gray-500">&ldquo;{member.callsign}&rdquo;</p>
          )}
          <div className="flex gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              member.designator === 'PILOT' ? 'bg-blue-100 text-blue-700' :
              member.designator === 'NFO' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {member.designator}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              member.flightStatus === 'FLY' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-700'
            }`}>
              {member.flightStatus}
            </span>
            {readiness && (
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                readiness.status === 'GREEN' ? 'bg-green-100 text-green-700' :
                readiness.status === 'AMBER' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {readiness.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Qualifications */}
        <div className="bg-white rounded shadow">
          <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6', background: '#001f3f' }}>
            <h3 className="text-sm font-bold text-white">Qualifications</h3>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500">ACTC Level</p>
              <p className="text-lg font-bold">{member.actcLevel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Qualified Positions</p>
              <div className="flex gap-1 mt-1">
                {member.qualifiedPositions.map((p) => (
                  <span key={p} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">NATOPS Status</p>
              <p className={`text-sm font-medium ${
                member.natopsStatus === 'CURRENT' ? 'text-green-600' :
                member.natopsStatus === 'DUE' ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {member.natopsStatus}
              </p>
              <p className="text-xs text-gray-400">Expires: {member.natopsExpiry}</p>
            </div>
            {member.isInstructor && (
              <div>
                <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-medium">
                  NATOPS Instructor (IP)
                </span>
              </div>
            )}
            {member.isNatopsEvaluator && (
              <div>
                <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">
                  NATOPS Evaluator (NE)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Currencies */}
        <div className="bg-white rounded shadow">
          <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6', background: '#001f3f' }}>
            <h3 className="text-sm font-bold text-white">Currency Status</h3>
          </div>
          <div className="p-4 space-y-3">
            {quals?.currencies.map((c) => {
              const daysLeft = c.expiryDate
                ? Math.round((new Date(c.expiryDate).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <div key={c.id}>
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-medium">{c.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      c.isCurrent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.isCurrent ? 'CURRENT' : 'EXPIRED'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${c.isCurrent ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, (c.currentCount / c.requiredCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {c.currentCount}/{c.requiredCount}
                    </span>
                  </div>
                  {daysLeft !== null && (
                    <p className={`text-xs mt-0.5 ${
                      daysLeft < 15 ? 'text-red-500' : daysLeft < 30 ? 'text-amber-500' : 'text-gray-400'
                    }`}>
                      {daysLeft > 0 ? `Expires in ${daysLeft} days` : 'EXPIRED'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Flight Hours */}
        <div className="bg-white rounded shadow">
          <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6', background: '#001f3f' }}>
            <h3 className="text-sm font-bold text-white">Flight Hours</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Career Total</span>
              <span className="text-sm font-bold">{member.flightHours.totalCareer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Type Total (P-8A)</span>
              <span className="text-sm font-bold">{member.flightHours.totalType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Last 30 Days</span>
              <span className="text-sm font-bold">{member.flightHours.last30Days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Last 90 Days</span>
              <span className="text-sm font-bold">{member.flightHours.last90Days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Night (90d)</span>
              <span className="text-sm font-bold">{member.flightHours.nightHours90Days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Instrument (90d)</span>
              <span className="text-sm font-bold">{member.flightHours.instrumentHours90Days}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Flights */}
      <div className="mt-6 bg-white rounded shadow">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6' }}>
          <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>Recent/Upcoming Flights</h3>
        </div>
        {flights.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No flights found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Flight</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Position</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Type</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Duration</th>
                <th className="text-center px-3 py-2 text-xs text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#dee2e6' }}>
              {flights.map((f) => {
                const assignment = f.crewAssignments.find((a) => a.aircrewId === id);
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs">{f.scheduledTakeoff.split('T')[0]}</td>
                    <td className="px-3 py-2 text-xs font-medium">{f.flightDesignator}</td>
                    <td className="px-3 py-2 text-xs">{assignment?.position}</td>
                    <td className="px-3 py-2 text-xs">{f.flightType}</td>
                    <td className="px-3 py-2 text-xs text-right">{f.plannedDuration}hrs</td>
                    <td className="px-3 py-2 text-xs text-center">
                      <span className={`px-1.5 py-0.5 rounded ${
                        f.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        f.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Constraints */}
      {constraints.length > 0 && (
        <div className="mt-6 bg-white rounded shadow">
          <div className="px-4 py-3 border-b" style={{ borderColor: '#dee2e6' }}>
            <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>Schedule Constraints</h3>
          </div>
          <div className="p-4 space-y-2">
            {constraints.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  c.type === 'LEAVE' ? 'bg-blue-100 text-blue-700' :
                  c.type === 'MEDICAL' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {c.type}
                </span>
                <span className="text-gray-600">{c.startDate} to {c.endDate}</span>
                <span className="text-xs text-gray-400">{c.notes}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
