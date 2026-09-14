import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getTelegramConfig() {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let chatId = process.env.TELEGRAM_CHAT_ID || '';

  const configPath = path.resolve(process.cwd(), 'config', 'telegram.json');
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!botToken && data.botToken) botToken = data.botToken;
      if (!chatId && data.chatId) chatId = data.chatId;
    } catch (e) {
      console.warn('Lỗi đọc config/telegram.json:', e);
    }
  }

  return { botToken: botToken.trim(), chatId: chatId.trim() };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { botToken, chatId } = getTelegramConfig();

    if (!botToken || !chatId) {
      return NextResponse.json({
        success: false,
        message: 'Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID. Vui lòng cấu hình trong Cài đặt hệ thống hoặc file .env.local',
      });
    }

    let messageText = '';

    if (body.type === 'test') {
      messageText = [
        '🤖 <b>KIỂM TRA KẾT NỐI BOT TELEGRAM</b>',
        '━━━━━━━━━━━━━━━━━━━━',
        '🏫 <b>TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN</b>',
        '✅ <i>Kết nối thành công!</i> Hệ thống quản lý & điểm danh đã sẵn sàng tự động ghi log đơn xin nghỉ phép vào Telegram.',
        `⏰ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}`,
      ].join('\n');
    } else {
      const fromDate = body.fromDate || 'N/A';
      const toDate = body.toDate || 'N/A';
      const proofCount = body.proofCount || 0;
      const proofText = proofCount > 0 ? `${proofCount} tệp đính kèm` : 'Không có';

      messageText = [
        '📝 <b>THÔNG BÁO ĐƠN XIN NGHỈ PHÉP MỚI</b>',
        '━━━━━━━━━━━━━━━━━━━━',
        `👤 <b>Sinh viên:</b> ${body.studentName || 'Chưa rõ'}`,
        `🆔 <b>Mã SV:</b> <code>${body.studentCode || 'N/A'}</code>`,
        `🏫 <b>Lớp học:</b> ${body.className || 'N/A'}`,
        `📅 <b>Thời gian nghỉ:</b> <b>${fromDate}</b> ➡️ <b>${toDate}</b>`,
        `💬 <b>Lý do:</b> ${body.reason || 'Không nêu lý do'}`,
        `📎 <b>Minh chứng:</b> ${proofText}`,
        `⏰ <b>Thời điểm nộp:</b> ${new Date().toLocaleString('vi-VN')}`,
        '━━━━━━━━━━━━━━━━━━━━',
        'Trạng thái: ⏳ <i>Chờ phê duyệt trên hệ thống</i>',
      ].join('\n');
    }

    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    const tgResult = await res.json();
    if (!tgResult.ok) {
      console.error('Lỗi phản hồi từ Telegram API:', tgResult);
      return NextResponse.json({
        success: false,
        message: tgResult.description || 'Lỗi gửi tin nhắn qua Telegram',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã gửi thông báo đến Telegram Bot thành công',
      data: tgResult.result,
    });
  } catch (error: any) {
    console.error('Lỗi API telegram notify:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Lỗi hệ thống khi gửi tin nhắn Telegram',
    }, { status: 500 });
  }
}
