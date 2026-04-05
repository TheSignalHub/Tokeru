#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║  Tokeru — Deploy to Base Sepolia          ║"
echo "╚══════════════════════════════════════════╝"

# Load env
[ -f .env.local ] && set -a && source .env.local 2>/dev/null && set +a

RPC="${RPC_URL:-https://sepolia.base.org}"
[ -z "${DEPLOYER_PRIVATE_KEY:-}" ] && echo "ERROR: Set DEPLOYER_PRIVATE_KEY in .env.local" && exit 1
[ -z "${PLATFORM_TREASURY:-}" ] && echo "ERROR: Set PLATFORM_TREASURY in .env.local" && exit 1

echo "Chain: Base Sepolia ($RPC)"
echo "Deployer: $(cast wallet address $DEPLOYER_PRIVATE_KEY 2>/dev/null || echo 'unknown')"
echo ""

# Build
echo "[1/3] Building contracts..."
cd contracts && forge build --quiet && cd ..
echo "  Done"

# Deploy
echo ""
echo "[2/3] Deploying ContractFactory + AgencyProfile + test USDC..."
DEPLOY_OUTPUT=$(cd contracts && forge script script/Deploy.s.sol \
  --rpc-url "$RPC" \
  --broadcast \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --verify \
  --etherscan-api-key "${BASESCAN_API_KEY:-}" \
  2>&1)

echo "$DEPLOY_OUTPUT" | grep -E "ContractFactory:|AgencyProfile:|Payment Token:|Test USDC:" || true

# Extract addresses
FACTORY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "ContractFactory:" | awk '{print $NF}')
PROFILE_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "AgencyProfile:" | awk '{print $NF}')
USDC_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -E "Payment Token:|Test USDC:" | awk '{print $NF}')

echo ""
echo "[3/3] Verifying contracts..."
# Verification happens automatically with --verify flag above

echo ""
echo "═══════════════════════════════════════"
echo "  Deployed to Base Sepolia!"
echo ""
echo "  Update .env.local with:"
echo ""
echo "  ENV=testnet"
echo "  CHAIN_ID=84532"
echo "  RPC_URL=https://sepolia.base.org"
echo "  NEXT_PUBLIC_CHAIN_ID=84532"
echo "  NEXT_PUBLIC_RPC_URL=https://sepolia.base.org"
[ -n "$FACTORY_ADDR" ] && echo "  CONTRACT_FACTORY_ADDRESS=$FACTORY_ADDR"
[ -n "$PROFILE_ADDR" ] && echo "  AGENCY_PROFILE_ADDRESS=$PROFILE_ADDR"
[ -n "$USDC_ADDR" ] && echo "  PAYMENT_TOKEN_ADDRESS=$USDC_ADDR"
echo ""
echo "  View on BaseScan:"
[ -n "$FACTORY_ADDR" ] && echo "  https://sepolia.basescan.org/address/$FACTORY_ADDR"
[ -n "$PROFILE_ADDR" ] && echo "  https://sepolia.basescan.org/address/$PROFILE_ADDR"
echo ""
echo "═══════════════════════════════════════"
