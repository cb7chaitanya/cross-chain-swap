# Off-Chain Cross-Chain Swap: Solana → EVM

Solana (SVM) → EVM (e.g. Base) via Relay. TypeScript, SPL/Token-2022.

## Setup

```bash
pnpm install
```

Copy env and set your values:

```bash
cp .env.example .env
```

Edit `.env`: set `USER_SOLANA_ADDRESS`, `USER_ADDRESS`, `RELAY_API_KEY` ([Relay](https://relay.link)).

## Run

```bash
pnpm proof
```

Writes `proof-solana-to-base.json`. Optional: `pnpm cli --help` for options; `pnpm proof:status <requestId> --poll` to check status.
