/**
 * Dịch vụ gửi thông báo và lưu log tự động về Telegram Bot
 */

export interface TelegramAttendancePayload {
  studentName: string;
  studentCode: string;
  className: string;
  classCode?: string;
  sessionTitle: string;
  checkInTime?: string;
  phone?: string;
  gender?: string;
  cccd?: string;
  status?: string;
  method?: string;
}

/**
 * Gửi thông báo sinh viên điểm danh thành công đến Bot Telegram
 */
export async function sendAttendanceTelegramNotification(
  data: TelegramAttendancePayload
): Promise<void> {
  try {
    fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'attendance',
        ...data,
      }),
    }).catch((err) => {
      console.warn('Lỗi background khi gửi thông báo Telegram:', err);
    });
  } catch (err) {
    console.warn('Lỗi gọi API Telegram:', err);
  }
}
