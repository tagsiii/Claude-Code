import { getStore } from '@/lib/store';

export default function TrainingTracker() {
  const store = getStore();
  const allAircrew = Array.from(store.aircrew.values())
    .filter((a) => a.flightStatus === 'FLY')
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const trainingDefs = store.trainingDefinitions;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#001f3f' }}>Training & Readiness Tracker</h2>
      <p className="text-sm text-gray-500 mb-4">
        T&R event completion matrix &bull; {trainingDefs.length} events tracked
      </p>

      {/* Group by phase */}
      {(['CAT_I', 'CAT_II', 'CAT_III', 'CAT_IV'] as const).map((phase) => {
        const phaseEvents = trainingDefs.filter((d) => d.phase === phase);
        if (phaseEvents.length === 0) return null;

        const phaseLabel = {
          CAT_I: 'Category I - Safe for Flight',
          CAT_II: 'Category II - Basic Mission',
          CAT_III: 'Category III - Advanced Mission',
          CAT_IV: 'Category IV - Integrated Operations',
        }[phase];

        return (
          <div key={phase} className="mb-6">
            <h3 className="text-sm font-bold mb-2 px-2 py-1 rounded" style={{ background: '#001f3f', color: '#C5A648' }}>
              {phaseLabel}
            </h3>
            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-2 font-medium text-gray-600 sticky left-0 bg-gray-50" style={{ minWidth: '140px' }}>
                      Aircrew
                    </th>
                    {phaseEvents.map((evt) => (
                      <th key={evt.id} className="text-center px-1 py-2 font-medium text-gray-600 whitespace-nowrap" style={{ minWidth: '60px' }}>
                        <div className="truncate" title={evt.name}>
                          {evt.eventCode.split('-').pop()}
                        </div>
                        <div className="text-gray-400 font-normal truncate" title={evt.name}>
                          {evt.name.substring(0, 12)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#dee2e6' }}>
                  {allAircrew.slice(0, 15).map((member) => {
                    const records = store.trainingRecords.get(member.id) || [];
                    return (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-medium sticky left-0 bg-white whitespace-nowrap">
                          {member.payGrade} {member.lastName}
                        </td>
                        {phaseEvents.map((evt) => {
                          const matching = records.filter(
                            (r) => r.eventCode === evt.eventCode && r.grade !== 'U'
                          );
                          const completions = matching.length;
                          const required = evt.minimumPerPeriod;
                          const isComplete = completions >= required;

                          return (
                            <td key={evt.id} className="text-center px-1 py-1.5">
                              {completions > 0 ? (
                                <span className={`inline-block w-6 h-6 leading-6 rounded text-white font-medium ${
                                  isComplete ? 'bg-green-500' : 'bg-amber-400 text-amber-900'
                                }`}>
                                  {completions}
                                </span>
                              ) : (
                                <span className="inline-block w-6 h-6 leading-6 rounded bg-gray-100 text-gray-400">
                                  0
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-green-500 inline-block" />
          Meets requirement
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-amber-400 inline-block" />
          Partial completion
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-gray-100 inline-block" />
          No completions
        </div>
      </div>
    </div>
  );
}
