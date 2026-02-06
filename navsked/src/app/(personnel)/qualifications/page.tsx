import { getStore } from '@/lib/store';

export default function QualificationsMatrix() {
  const store = getStore();
  const allAircrew = Array.from(store.aircrew.values()).sort((a, b) => {
    const desOrder = { PILOT: 0, NFO: 1, NAC: 2, OTHER: 3 };
    if (desOrder[a.designator] !== desOrder[b.designator]) {
      return desOrder[a.designator] - desOrder[b.designator];
    }
    return a.lastName.localeCompare(b.lastName);
  });

  // Collect all currency names
  const currencyNames = new Set<string>();
  for (const [, quals] of store.qualifications) {
    for (const c of quals.currencies) {
      currencyNames.add(c.name);
    }
  }
  const currencies = Array.from(currencyNames);

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#001f3f' }}>Qualification Matrix</h2>
      <p className="text-sm text-gray-500 mb-4">Currency and qualification status for all aircrew</p>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-xs schedule-table">
          <thead>
            <tr style={{ background: '#001f3f' }}>
              <th className="text-left px-2 py-2 text-white font-medium sticky left-0" style={{ background: '#001f3f', minWidth: '160px' }}>Name</th>
              <th className="text-center px-2 py-2 text-white font-medium">ACTC</th>
              <th className="text-center px-2 py-2 text-white font-medium">NATOPS</th>
              {currencies.map((name) => (
                <th key={name} className="text-center px-2 py-2 text-white font-medium whitespace-nowrap">
                  {name.replace(' Currency', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#dee2e6' }}>
            {allAircrew.map((member) => {
              const quals = store.qualifications.get(member.id);
              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 font-medium sticky left-0 bg-white">
                    {member.payGrade} {member.lastName}
                    <span className="text-gray-400 ml-1">({member.designator})</span>
                  </td>
                  <td className="text-center px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      member.actcLevel >= 400 ? 'bg-green-100 text-green-700' :
                      member.actcLevel >= 300 ? 'bg-blue-100 text-blue-700' :
                      member.actcLevel >= 200 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {member.actcLevel}
                    </span>
                  </td>
                  <td className="text-center px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded ${
                      member.natopsStatus === 'CURRENT' ? 'bg-green-100 text-green-700' :
                      member.natopsStatus === 'DUE' ? 'bg-amber-100 text-amber-700' :
                      member.natopsStatus === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {member.natopsStatus}
                    </span>
                  </td>
                  {currencies.map((name) => {
                    const currency = quals?.currencies.find((c) => c.name === name);
                    if (!currency) {
                      return <td key={name} className="text-center px-2 py-1.5 text-gray-300">N/A</td>;
                    }
                    const daysLeft = currency.expiryDate
                      ? Math.round((new Date(currency.expiryDate).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <td key={name} className="text-center px-2 py-1.5">
                        <span className={`inline-block w-6 h-6 rounded-full text-white text-xs leading-6 ${
                          !currency.isCurrent ? 'bg-red-500' :
                          daysLeft !== null && daysLeft < 15 ? 'bg-amber-500' :
                          daysLeft !== null && daysLeft < 30 ? 'bg-yellow-400 text-yellow-900' :
                          'bg-green-500'
                        }`}>
                          {currency.isCurrent ? (daysLeft !== null && daysLeft < 30 ? daysLeft : 'G') : 'X'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-green-500 inline-block" />
          Current
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-yellow-400 inline-block" />
          Expiring (&lt;30d)
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-amber-500 inline-block" />
          Critical (&lt;15d)
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-red-500 inline-block" />
          Expired
        </div>
      </div>
    </div>
  );
}
