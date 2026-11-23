import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const configPath = path.resolve(process.cwd(), 'config', 'telegram.json');

function readConfig() {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let chatId = process.env.TELEGRAM_CHAT_ID || '';

  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.botToken) botToken = data.botToken;
      if (data.chatId) chatId = data.chatId;
    } catch {}
  }

  return { botToken: botToken.trim(), chatId: chatId.trim() };
}

export async function GET() {
  try {
    const config = readConfig();
    const isConfigured = !!(config.botToken && config.chatId);

    // Ẩn bớt token để bảo mật
    const maskedToken = config.botToken
      ? config.botToken.substring(0, 5) + '••••••••••••••••' + config.botToken.slice(-4)
      : '';

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      botToken: config.botToken,
      maskedToken,
      chatId: config.chatId,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const botToken = (body.botToken || '').trim();
    const chatId = (body.chatId || '').trim();

    // Lưu vào file config/telegram.json
    fs.writeFileSync(configPath, JSON.stringify({ botToken, chatId, updatedAt: new Date().toISOString() }, null, 2), 'utf8');

    // Cập nhật biến môi trường tạm thời trong tiến trình
    process.env.TELEGRAM_BOT_TOKEN = botToken;
    process.env.TELEGRAM_CHAT_ID = chatId;

    return NextResponse.json({
      success: true,
      message: 'Đã lưu cấu hình Bot Telegram thành công',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
