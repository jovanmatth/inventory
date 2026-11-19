/**
 * Helper to auto-calculate due date in local format (YYYY-MM-DDTHH:mm) for datetime-local input
 * Supports calculating relative to a base date (for scheduled reservations) or relative to now
 */
export const calculateDueDateLocal = (dur: string, baseDate?: Date | string): string => {
  const base = baseDate ? new Date(baseDate) : new Date();

  // Hari
  const dayMatch = dur.match(/(\d+)\s*Hari/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    const target = new Date(base);
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
    const target = new Date(base.getTime() + hours * 60 * 60 * 1000);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    const h = String(target.getHours()).padStart(2, '0');
    const m = String(target.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date}T${h}:${m}`;
  }

  // Minggu
  const weekMatch = dur.match(/(\d+)\s*Minggu/i);
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1], 10);
    const target = new Date(base);
    target.setDate(target.getDate() + weeks * 7);
    target.setHours(23, 59, 0, 0);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}T23:59`;
  }

  // Hari Ini EOD
  if (dur.toLowerCase().includes('hari ini')) {
    const target = new Date(base);
    target.setHours(23, 59, 0, 0);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}T23:59`;
  }

  // Default fallback: 1 day at 23:59
  const target = new Date(base);
  target.setDate(target.getDate() + 1);
  target.setHours(23, 59, 0, 0);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const date = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}T23:59`;
};

/**
 * Returns default pickup datetime string for future reservation (tomorrow at 08:00)
 */
export const getDefaultReservationPickup = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const date = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}T08:00`;
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
