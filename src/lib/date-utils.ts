/**
 * Helper to auto-calculate due date in local format (YYYY-MM-DDTHH:mm) for datetime-local input
 */
export const calculateDueDateLocal = (dur: string): string => {
  const now = new Date();

  // Hari
  const dayMatch = dur.match(/(\d+)\s*Hari/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    target.setHours(23, 59, 0, 0);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}T23:59`;
  }

  // Jam
  const hourMatch = dur.match(/(\d+)\s*Jam/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    const target = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    const h = String(target.getHours()).padStart(2, '0');
    const m = String(target.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date}T${h}:${m}`;
  }

  // Hari Ini EOD
  if (dur.toLowerCase().includes('hari ini')) {
    const target = new Date(now);
    target.setHours(23, 59, 0, 0);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}T23:59`;
  }

  // Default fallback: 1 day at 23:59
  const target = new Date(now);
  target.setDate(target.getDate() + 1);
  target.setHours(23, 59, 0, 0);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const date = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}T23:59`;
};

/**
 * Format due date and time cleanly in Indonesian with full date and time (WIB)
 * Example: "18 Nov 2026, 18:48 WIB" or "19 Nov 2026, 23:59 WIB"
 */
export const formatDueDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Selesai Pakai';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const dateFormatted = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${dateFormatted}, ${hours}:${minutes} WIB`;
  } catch {
    return String(dateStr);
  }
};
