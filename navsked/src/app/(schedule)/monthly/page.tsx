import { getStore } from '@/lib/store';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

export default function MonthlyOverview() {
  const store = getStore();
  const allFlights = Array.from(store.flights.values());

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Flight hours by day
  const hoursByDay = new Map<string, number>();
  const flightsByDay = new Map<string, number>();
  for (const flight of allFlights) {
    const day = flight.scheduledTakeoff.split('T')[0];
    hoursByDay.set(day, (hoursByDay.get(day) || 0) + flight.plannedDuration);
    flightsByDay.set(day, (flightsByDay.get(day) || 0) + 1);
  }

  const totalHours = allFlights.reduce((s, f) => s + f.plannedDuration, 0);
  const padStart = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1" style={{ color: '#001f3f' }}>Monthly Overview</h2>
      <p className="text-sm text-gray-500 mb-4">
        {format(monthStart, 'MMMM yyyy')} &bull; {allFlights.length} flights &bull; {totalHours} flight hours
      </p>

      <div className="bg-white rounded shadow p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold" style={{ color: '#001f3f' }}>Flight Hour Budget</h3>
          <span className="text-sm font-medium">{totalHours} / {store.squadron.monthlyFlightHourAllocation} hrs</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4">
          <div
            className="h-4 rounded-full flex items-center justify-center text-xs text-white font-medium"
            style={{
              width: `${Math.min(100, (totalHours / store.squadron.monthlyFlightHourAllocation) * 100)}%`,
              background: totalHours > store.squadron.monthlyFlightHourAllocation * 0.9 ? '#dc2626' : '#003B6F',
            }}
          >
            {Math.round((totalHours / store.squadron.monthlyFlightHourAllocation) * 100)}%
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded shadow">
        <div className="grid grid-cols-7">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-bold border-b" style={{ background: '#001f3f', color: '#C5A648', borderColor: '#dee2e6' }}>
              {d}
            </div>
          ))}
          {/* Padding for start of month */}
          {Array.from({ length: padStart }).map((_, i) => (
            <div key={`pad-${i}`} className="p-2 min-h-[80px] bg-gray-50 border" style={{ borderColor: '#dee2e6' }} />
          ))}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const hours = hoursByDay.get(dateStr) || 0;
            const flights = flightsByDay.get(dateStr) || 0;
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;

            return (
              <div
                key={dateStr}
                className={`p-2 min-h-[80px] border ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : 'bg-white'}`}
                style={{ borderColor: '#dee2e6' }}
              >
                <p className={`text-xs font-medium ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
                  {format(day, 'd')}
                </p>
                {flights > 0 && (
                  <div className="mt-1">
                    <p className="text-xs font-bold" style={{ color: '#001f3f' }}>{flights} flights</p>
                    <p className="text-xs text-gray-500">{hours} hrs</p>
                    <div className="mt-1 w-full bg-gray-200 rounded h-1.5">
                      <div
                        className="h-1.5 rounded"
                        style={{
                          width: `${Math.min(100, (hours / 15) * 100)}%`,
                          background: '#003B6F',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
