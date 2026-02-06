import { getStore } from '@/lib/store';
import { format, addDays, startOfWeek } from 'date-fns';

export default function WeeklySchedule() {
  const store = getStore();
  const allFlights = Array.from(store.flights.values())
    .filter((f) => f.status !== 'CANCELLED')
    .sort((a, b) => a.scheduledTakeoff.localeCompare(b.scheduledTakeoff));

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group flights by day
  const flightsByDay = new Map<string, typeof allFlights>();
  for (const flight of allFlights) {
    const day = flight.scheduledTakeoff.split('T')[0];
    if (!flightsByDay.has(day)) flightsByDay.set(day, []);
    flightsByDay.get(day)!.push(flight);
  }

  const totalHours = allFlights.reduce((s, f) => s + f.plannedDuration, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#001f3f' }}>Weekly Flight Schedule</h2>
          <p className="text-sm text-gray-500">
            Week of {format(weekStart, 'dd MMM yyyy')} &bull; {allFlights.length} sorties &bull; {totalHours} flight hours
          </p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs px-3 py-1.5 rounded bg-amber-100 text-amber-700 font-medium">DRAFT</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayFlights = flightsByDay.get(dateStr) || [];
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div key={dateStr} className={`rounded shadow ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}>
              <div className="px-2 py-1.5 border-b text-center" style={{ background: '#001f3f' }}>
                <p className="text-xs font-bold text-white">{format(day, 'EEE')}</p>
                <p className="text-xs" style={{ color: '#C5A648' }}>{format(day, 'dd MMM')}</p>
              </div>
              <div className="p-1 min-h-[300px] space-y-1">
                {dayFlights.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No flights</p>
                ) : (
                  dayFlights.map((flight) => {
                    const takeoff = new Date(flight.scheduledTakeoff);
                    const land = new Date(flight.scheduledLand);
                    const ppc = flight.crewAssignments.find((a) => a.position === 'PPC');
                    const ppcName = ppc ? store.aircrew.get(ppc.aircrewId)?.lastName : 'TBD';

                    return (
                      <div
                        key={flight.id}
                        className={`rounded p-1.5 border text-xs ${
                          flight.timeOfDay === 'NIGHT'
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-sky-50 border-sky-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs" style={{ color: '#001f3f' }}>
                            {flight.flightDesignator}
                          </span>
                          <span className="text-gray-500">{flight.aircraftSideNumber}</span>
                        </div>
                        <div className="mt-0.5 text-gray-600">
                          {format(takeoff, 'HHmm')}-{format(land, 'HHmm')}L
                        </div>
                        <div className="mt-0.5 text-gray-500">
                          {flight.flightArea}
                        </div>
                        <div className="mt-1 border-t pt-1 space-y-0.5" style={{ borderColor: flight.timeOfDay === 'NIGHT' ? '#c7d2fe' : '#bae6fd' }}>
                          {flight.crewAssignments.slice(0, 4).map((a) => {
                            const member = store.aircrew.get(a.aircrewId);
                            return (
                              <div key={a.aircrewId} className="flex justify-between">
                                <span className="font-medium">{a.position}</span>
                                <span>{member?.lastName || '??'}</span>
                              </div>
                            );
                          })}
                          {flight.crewAssignments.length > 4 && (
                            <p className="text-gray-400 text-center">
                              +{flight.crewAssignments.length - 4} more
                            </p>
                          )}
                        </div>
                        <div className="mt-1 flex gap-1">
                          <span className={`px-1 rounded ${
                            flight.timeOfDay === 'NIGHT' ? 'bg-indigo-200 text-indigo-700' : 'bg-sky-200 text-sky-700'
                          }`}>
                            {flight.timeOfDay}
                          </span>
                          <span className="px-1 rounded bg-gray-200 text-gray-600">
                            {flight.plannedDuration}h
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
