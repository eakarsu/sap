import { useState, useEffect } from 'react';
import { fetchAll, createItem } from '../api';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiPlus, FiClock, FiMapPin, FiX } from 'react-icons/fi';

const typeColors = { Meeting: '#0070F2', Call: '#498205', Email: '#E76500', Demo: '#004E8C', Task: '#D83B01' };
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [activities, setActivities] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'Meeting', subject: '', description: '', regarding: '', assigned_to: '', start_date: '', end_date: '', location: '' });

  useEffect(() => { fetchAll('activities').then(res => setActivities(res.data || [])).catch(() => {}); }, []);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDow = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Mon=0
  const paddingDays = Array.from({ length: firstDow }, (_, i) => i);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getActivitiesForDay = (day) =>
    activities.filter(a => {
      if (!a.start_date) return false;
      const d = new Date(a.start_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === day;
    });

  const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); setSelectedDay(null); };
  const goToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); setSelectedDay(today.getDate()); };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await createItem('activities', form);
      setActivities(prev => [...prev, res.data || form]);
      setShowForm(false);
      setForm({ type: 'Meeting', subject: '', description: '', regarding: '', assigned_to: '', start_date: '', end_date: '', location: '' });
    } catch {}
  };

  const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  const selectedActivities = selectedDay ? getActivitiesForDay(selectedDay) : [];
  const monthLabel = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16, padding: 24, fontFamily: "'72', Arial, sans-serif", background: '#f7f7f7', minHeight: 'calc(100vh - 80px)' }}>
      {/* Calendar */}
      <div style={{ flex: 1, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FiCalendar size={22} color="#0070F2" />
            <h2 style={{ margin: 0, fontSize: 20, color: '#1a1a1a' }}>{monthLabel}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goToday} style={{ padding: '6px 14px', border: '1px solid #0070F2', borderRadius: 6, background: '#fff', color: '#0070F2', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Today</button>
            <button onClick={prevMonth} style={{ padding: 6, border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex' }}><FiChevronLeft size={18} /></button>
            <button onClick={nextMonth} style={{ padding: 6, border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex' }}><FiChevronRight size={18} /></button>
            <button onClick={() => setShowForm(true)} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: '#0070F2', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><FiPlus size={14} /> New Activity</button>
          </div>
        </div>
        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 4 }}>
          {dayNames.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6a6a6a', padding: '6px 0' }}>{d}</div>)}
        </div>
        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flex: 1 }}>
          {paddingDays.map(i => <div key={`p${i}`} style={{ background: '#fafafa', borderRadius: 4, minHeight: 72 }} />)}
          {monthDays.map(day => {
            const dayActs = getActivitiesForDay(day);
            const sel = selectedDay === day;
            return (
              <div key={day} onClick={() => setSelectedDay(day)} style={{ background: sel ? '#e8f0fe' : '#fff', border: sel ? '2px solid #0070F2' : '1px solid #eee', borderRadius: 6, minHeight: 72, padding: 6, cursor: 'pointer', position: 'relative', transition: 'all 0.15s' }}>
                <span style={{ fontSize: 13, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? '#fff' : '#1a1a1a', background: isToday(day) ? '#0070F2' : 'transparent', borderRadius: '50%', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{day}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                  {dayActs.slice(0, 4).map((a, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: typeColors[a.type] || '#999' }} />)}
                  {dayActs.length > 4 && <span style={{ fontSize: 9, color: '#6a6a6a' }}>+{dayActs.length - 4}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side Panel */}
      {selectedDay && (
        <div style={{ width: 320, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#1a1a1a' }}>{new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
            <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><FiX size={16} color="#6a6a6a" /></button>
          </div>
          {selectedActivities.length === 0 ? (
            <p style={{ color: '#999', fontSize: 13, textAlign: 'center', marginTop: 40 }}>No activities for this day</p>
          ) : (
            selectedActivities.map((a, i) => (
              <div key={i} style={{ padding: 12, borderLeft: `3px solid ${typeColors[a.type] || '#999'}`, background: '#fafafa', borderRadius: '0 8px 8px 0', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: typeColors[a.type] || '#999', padding: '2px 8px', borderRadius: 10 }}>{a.type}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{a.subject}</p>
                {a.start_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: '#6a6a6a' }}>
                    <FiClock size={12} />
                    <span>{new Date(a.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{a.end_date ? ` - ${new Date(a.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                  </div>
                )}
                {a.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, color: '#6a6a6a' }}>
                    <FiMapPin size={12} /><span>{a.location}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* New Activity Overlay */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreate} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#1a1a1a' }}>New Activity</h3>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><FiX size={18} /></button>
            </div>
            {[
              { label: 'Type', key: 'type', type: 'select', options: ['Meeting', 'Call', 'Email', 'Demo', 'Task'] },
              { label: 'Subject', key: 'subject', type: 'text', required: true },
              { label: 'Description', key: 'description', type: 'textarea' },
              { label: 'Regarding', key: 'regarding', type: 'text' },
              { label: 'Assigned To', key: 'assigned_to', type: 'text' },
              { label: 'Start Date', key: 'start_date', type: 'datetime-local', required: true },
              { label: 'End Date', key: 'end_date', type: 'datetime-local' },
              { label: 'Location', key: 'location', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6a6a6a', marginBottom: 4 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13, resize: 'vertical' }} />
                ) : (
                  <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.required} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 20px', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#0070F2', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
