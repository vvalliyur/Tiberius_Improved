#!/usr/bin/env python3
"""
Telegram Bot Server
Responds to commands to provide agent report data.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import pytz
from dotenv import load_dotenv

try:
    from telegram import Update  # type: ignore
    from telegram.ext import Application, CommandHandler, ContextTypes  # type: ignore
except ImportError as e:
    raise ImportError(
        "Failed to import from 'telegram'. Make sure 'python-telegram-bot==20.7' is installed. "
        "Run: pip install python-telegram-bot==20.7"
    ) from e

from supabase.client import create_client, Client

# Add backend directory to path
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from utils.datetime_utils import get_last_thursday_12am_texas

load_dotenv()

# Configuration
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')

if not TELEGRAM_BOT_TOKEN:
    raise ValueError('TELEGRAM_BOT_TOKEN must be set in environment variables')
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError('SUPABASE_URL and SUPABASE_KEY must be set in environment variables')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def format_agent_report_message(agent_data, detailed_data, period_label):
    """Format agent report data into a readable Telegram message."""
    if not agent_data or not detailed_data:
        return f"No data available for {period_label}."
    
    # Get agent info from aggregated data
    agent_info = agent_data[0] if agent_data else {}
    agent_name = agent_info.get('agent_name', 'Unknown Agent')
    total_profit = agent_info.get('total_profit', 0)
    total_tips = agent_info.get('total_tips', 0)
    agent_tips = agent_info.get('agent_tips', 0)
    
    # Format message
    message = f"<b>{agent_name} - {period_label} Report</b>\n\n"
    message += f"<b>Summary:</b>\n"
    message += f"Total Profit: ${total_profit:.2f}\n"
    message += f"Total Tips: ${total_tips:.2f}\n"
    message += f"Agent Tips: ${agent_tips:.2f}\n\n"
    
    if detailed_data:
        message += "<b>Player Details:</b>\n"
        message += "Player ID | Deal % | Total Tips | Agent Tips\n"
        message += "─" * 50 + "\n"
        
        for player in detailed_data[:20]:  # Limit to 20 players to avoid message length limits
            player_id = player.get('player_id', 'N/A')
            player_name = player.get('player_name', '')
            deal_percent = player.get('deal_percent', 0) * 100
            player_total_tips = player.get('total_tips', 0)
            player_agent_tips = player.get('agent_tips', 0)
            
            display_name = f"{player_id}"
            if player_name:
                display_name += f" ({player_name})"
            
            message += f"{display_name}\n"
            message += f"  Deal: {deal_percent:.2f}% | Tips: ${player_total_tips:.2f} | Agent: ${player_agent_tips:.2f}\n"
        
        if len(detailed_data) > 20:
            message += f"\n... and {len(detailed_data) - 20} more players"
    
    return message


async def get_agent_report_for_period(update: Update, start_date: datetime, end_date: datetime, period_label: str):
    """Get and send agent report for a given date range."""
    if not update.message:
        return
    
    chat_id = str(update.message.chat_id)
    
    try:
        # Get agent_id from chat_id
        mapping_response = supabase.table('agent_telegram_mapping').select('agent_id').eq('chat_id', chat_id).execute()
        
        if not mapping_response.data or len(mapping_response.data) == 0:
            await update.message.reply_text(
                "Sorry, this chat is not associated with an agent. Please contact an administrator."
            )
            return
        
        agent_id = mapping_response.data[0]['agent_id']
        
        # Convert to ISO format for database queries
        start_date_iso = start_date.isoformat()
        end_date_iso = end_date.isoformat()
        
        # Send "processing" message
        processing_msg = await update.message.reply_text("Fetching your report...")
        
        # Get aggregated agent report
        aggregated_response = supabase.rpc(
            'get_agent_report',
            {
                'start_date_param': start_date_iso,
                'end_date_param': end_date_iso
            }
        ).execute()
        
        # Filter for this specific agent
        agent_aggregated_data = [
            row for row in aggregated_response.data 
            if row.get('agent_id') == agent_id
        ]
        
        # Get detailed agent report
        detailed_response = supabase.rpc(
            'get_detailed_agent_report',
            {
                'start_date_param': start_date_iso,
                'end_date_param': end_date_iso
            }
        ).execute()
        
        # Filter for this specific agent
        agent_detailed_data = [
            row for row in detailed_response.data 
            if row.get('agent_id') == agent_id
        ]
        
        # Format and send response
        if agent_aggregated_data or agent_detailed_data:
            message = format_agent_report_message(agent_aggregated_data, agent_detailed_data, period_label)
            await processing_msg.edit_text(message, parse_mode='HTML')
        else:
            await processing_msg.edit_text(f"No data available for {period_label}.")
            
    except Exception as e:
        error_msg = f"Error fetching report: {str(e)}"
        if update.message:
            await update.message.reply_text(error_msg)
        print(f"Error in get_agent_report_for_period: {e}")


async def week_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /week command - returns report from beginning of week (last Thursday) to now."""
    texas_tz = pytz.timezone('America/Chicago')
    last_thursday_texas = get_last_thursday_12am_texas()
    now_texas = datetime.now(texas_tz)
    
    await get_agent_report_for_period(update, last_thursday_texas, now_texas, "Current Week")


async def month_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /month command - returns report for the entire current month."""
    texas_tz = pytz.timezone('America/Chicago')
    now_texas = datetime.now(texas_tz)
    
    # Get first day of current month at 12:00 AM
    start_of_month = now_texas.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    await get_agent_report_for_period(update, start_of_month, now_texas, "Current Month")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    if not update.message:
        return
    await update.message.reply_text(
        "Available commands:\n"
        "/week - Get your report from the beginning of the week (last Thursday) to now\n"
        "/month - Get your report for the entire current month\n"
        "/help - Show this help message"
    )


def main():
    print("Starting Telegram bot server...")
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("week", week_command))
    application.add_handler(CommandHandler("month", month_command))
    
    print("Bot is running. Press Ctrl+C to stop.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()

