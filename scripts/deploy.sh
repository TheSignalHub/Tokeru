#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║  Tokeru — Deploy to Base Sepolia          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Load env (ignore errors from malformed lines)
if [ -f .env.local ]; then
  set +e
  while IFS='=' read -r key value; do
    # Skip comments, empty lines, lines with spaces at start
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ "$key" =~ ^[[:space:]]*// ]] && continue
    [[ -z "$key" ]] && continue
    [[ "$key" =~ ^[[:space:]] ]] && continue
    key=$(echo "$key" | tr -d '[:space:]')
    [ -n "$key" ] && [ -n "$value" ] && export "$key=$value" 2>/dev/null
  done < .env.local
  set -e
fi

RPC="${RPC_URL:-https://sepolia.base.org}"

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "ERROR: Set DEPLOYER_PRIVATE_KEY in .env.local"
  exit 1
fi
if [ -z "${PLATFORM_TREASURY:-}" ]; then
  echo "ERROR: Set PLATFORM_TREASURY in .env.local"
  exit 1
fi

DEPLOYER_ADDR=$(cast wallet address "$DEPLOYER_PRIVATE_KEY" 2>/dev/null || echo "unknown")
echo "Chain:    Base Sepolia"
echo "RPC:      $RPC"
echo "Deployer: $DEPLOYER_ADDR"
echo ""

# Check balance
BALANCE=$(cast balance "$DEPLOYER_ADDR" --rpc-url "$RPC" 2>/dev/null || echo "0")
echo "Balance:  $BALANCE wei"
if [ "$BALANCE" = "0" ]; then
  echo ""
  echo "WARNING: Deployer has 0 balance. Get Base Sepolia ETH from:"
  echo "  https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
  echo ""
fi

# Build
echo ""
echo "[1/3] Building contracts..."
cd contracts && forge build --quiet && cd ..
echo "  Done"

# Deploy
echo ""
echo "[2/3] Deploying ContractFactory + AgencyProfile + test USDC..."
echo "  This may take 30-60 seconds..."

VERIFY_FLAGS=""
if [ -n "${BASESCAN_API_KEY:-}" ]; then
  VERIFY_FLAGS="--verify --etherscan-api-key $BASESCAN_API_KEY"
fi

DEPLOY_OUTPUT=$(cd contracts && forge script script/Deploy.s.sol \
  --rpc-url "$RPC" \
  --broadcast \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  $VERIFY_FLAGS \
  2>&1) || {
  echo "  Deploy failed. Output:"
  echo "$DEPLOY_OUTPUT" | tail -20
  exit 1
}

# Show key output
echo "$DEPLOY_OUTPUT" | grep -E "Deployed|ContractFactory:|AgencyProfile:|Payment Token:|Test USDC:|=== " || true

# Extract addresses
FACTORY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "ContractFactory:" | awk '{print $NF}' || true)
PROFILE_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "AgencyProfile:" | awk '{print $NF}' || true)
USDC_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -E "Payment Token:|Test USDC:" | head -1 | awk '{print $NF}' || true)

echo ""
echo "[3/3] Done!"

echo ""
echo "═══════════════════════════════════════════"
echo "  Deployed to Base Sepolia!"
echo ""
echo "  Update .env.local with:"
echo ""
echo "  ENV=testnet"
echo "  CHAIN_ID=84532"
echo "  RPC_URL=https://sepolia.base.org"
echo "  NEXT_PUBLIC_CHAIN_ID=84532"
echo "  NEXT_PUBLIC_RPC_URL=https://sepolia.base.org"
echo "  DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY"
echo "  PLATFORM_TREASURY=$PLATFORM_TREASURY"
[ -n "$FACTORY_ADDR" ] && echo "  CONTRACT_FACTORY_ADDRESS=$FACTORY_ADDR"
[ -n "$PROFILE_ADDR" ] && echo "  AGENCY_PROFILE_ADDRESS=$PROFILE_ADDR"
[ -n "$USDC_ADDR" ] && echo "  PAYMENT_TOKEN_ADDRESS=$USDC_ADDR"
echo ""
if [ -n "$FACTORY_ADDR" ]; then
  echo "  View on BaseScan:"
  echo "  https://sepolia.basescan.org/address/$FACTORY_ADDR"
  [ -n "$PROFILE_ADDR" ] && echo "  https://sepolia.basescan.org/address/$PROFILE_ADDR"
fi
echo ""
echo "═══════════════════════════════════════════"
