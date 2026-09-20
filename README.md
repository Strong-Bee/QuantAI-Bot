# QuantAI-Bot — GMGN + Telegram

Telegram-controlled GMGN meme-coin scanner/trading service.

## Architecture

Telegram → Node.js/TypeScript → gmgn-cli → GMGN OpenAPI → on-chain execution.

The bot defaults to **PAPER mode**. Set `LIVE_TRADING=true` only after testing.

## Features

- GMGN trending-token scanner
- Safety filters for liquidity, volume, Top-10 concentration, dev holdings and Smart Money
- Telegram alerts
- `/scan`, `/token`, `/buy`, `/sell`, `/status`
- Paper/live execution switch
- Environment-only secrets

## Setup

```bash
npm install -g gmgn-cli
gmgn-cli --version
npm install
cp .env.example .env
npm run gmgn:bot
```

Create a Telegram bot with BotFather and set `TELEGRAM_BOT_TOKEN`. Set `TELEGRAM_CHAT_ID` to your own chat ID; commands from other chats are ignored.

### Commands

```
/status
/scan
/token <token-address>
/buy <token-address> <amount-smallest-unit>
/sell <token-address> <percent>
```

### Live trading

Keep `LIVE_TRADING=false` while testing. For live mode, use a dedicated wallet, small position sizes, a verified GMGN API key/private key, and an allowlisted Telegram chat. Never commit `.env` or API credentials.

GMGN's official CLI is the integration layer; its command syntax can change, so update `gmgn-cli` before deployment.

## Sources

- GMGN Skills: https://github.com/GMGNAI/gmgn-skills
- GMGN CLI docs: https://github.com/GMGNAI/gmgn-skills/blob/main/docs/cli-usage.md
