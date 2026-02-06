import { getStore } from '@/lib/store';
import Link from 'next/link';

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'FLY' ? 'bg-green-500' :
    status === 'LEAVE' ? 'bg-blue-400' :
    status === 'DNIF' ? 'bg-red-500' :
    status === 'TAD' ? 'bg-amber-500' :
    'bg-gray-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function NatopsBadge({ status }: { status: string }) {
  const style =
    status === 'CURRENT' ? 'bg-green-100 text-green-700' :
    status === 'DUE' ? 'bg-amber-100 text-amber-700' :
    status === 'EXPIRED' ? 'bg-red-100 text-red-700' :
    'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${style}`}>{status}</span>;
}

export default function CrewRoster() {
  const store = getStore();
  const allAircrew = Array.from(store.aircrew.values()).sort((a, b) => {
    // Sort by designator then rank then name
    const desOrder = { PILOT: 0, NFO: 1, NAC: 2, OTHER: 3 };
    if (desOrder[a.designator] !== desOrder[b.designator]) {
      return desOrder[a.designator] - desOrder[b.designator];
    }
    return a.lastName.localeCompare(b.lastName);
  });

  const pilots = allAircrew.filter((a) => a.designator === 'PILOT');
  const nfos = allAircrew.filter((a) => a.designator === 'NFO');
  const nacs = allAircrew.filter((a) => a.designator === 'NAC');

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#001f3f' }}>Crew Roster</h2>
          <p className="text-sm text-gray-500">
            VP-10 Red Lancers &bull; {allAircrew.length} personnel ({pilots.length} pilots, {nfos.length} NFOs, {nacs.length} enlisted aircrew)
          </p>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#001f3f' }}>
              <th className="text-left px-3 py-2 text-xs font-medium text-white">Status</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white">Grade</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white">Name</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white">Callsign</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white">Designator</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white">Positions</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-white">ACTC</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-white">NATOPS</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-white">Hrs (30d)</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-white">Hrs (90d)</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-white">Inst</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#dee2e6' }}>
            {allAircrew.map((member) => {
              const quals = store.qualifications.get(member.id);
              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={member.flightStatus} />
                      <span className="text-xs text-gray-500">{member.flightStatus}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium">{member.payGrade}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/crew/${member.id}`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: '#003B6F' }}
                    >
                      {member.lastName}, {member.firstName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{member.callsign || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      member.designator === 'PILOT' ? 'bg-blue-100 text-blue-700' :
                      member.designator === 'NFO' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {member.designator}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {member.qualifiedPositions.join(', ')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      member.actcLevel >= 400 ? 'bg-green-100 text-green-700' :
                      member.actcLevel >= 300 ? 'bg-blue-100 text-blue-700' :
                      member.actcLevel >= 200 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {member.actcLevel}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <NatopsBadge status={member.natopsStatus} />
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono">
                    {member.flightHours.last30Days}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono">
                    {member.flightHours.last90Days}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {member.isInstructor ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">IP</span>
                    ) : member.isNatopsEvaluator ? (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">NE</span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
