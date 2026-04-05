#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║  Tokeru — Local Development Setup         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "This script deploys contracts to a local Anvil fork of Base Sepolia."
echo "You get Uniswap V3, real USDC addresses, and free gas."
echo ""

# Check if anvil is running
if ! curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' > /dev/null 2>&1; then
  echo "❌ Anvil is not running. Start it with:"
  echo ""
  echo "   anvil --fork-url https://sepolia.base.org"
  echo ""
  echo "This forks Base Sepolia so you get Uniswap V3 locally."
  exit 1
fi

CHAIN_ID=$(curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' | python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))")
echo "✓ Anvil running (chain ID: $CHAIN_ID)"

# Anvil default accounts
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
DEPLOYER_ADDR=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export DEPLOYER_PRIVATE_KEY=$DEPLOYER_KEY
export PLATFORM_TREASURY=$DEPLOYER_ADDR

# Build
echo ""
echo "[1/4] Building contracts..."
cd contracts && forge build --quiet && cd ..
echo "  ✓ Compiled"

# Deploy test USDC
echo ""
echo "[2/4] Deploying test USDC..."
USDC_OUTPUT=$(cd contracts && forge script script/Deploy.s.sol \
  --sig "deployTestToken()" \
  --rpc-url http://localhost:8545 \
  --broadcast --unlocked 2>&1)

USDC_ADDR=$(echo "$USDC_OUTPUT" | grep "Test USDC:" | awk '{print $NF}')
if [ -n "$USDC_ADDR" ]; then
  echo "  ✓ Test USDC: $USDC_ADDR"
  export PAYMENT_TOKEN_ADDRESS="$USDC_ADDR"
else
  echo "  ⚠ Could not extract USDC address"
  echo "$USDC_OUTPUT" | tail -5
  exit 1
fi

# Deploy ContractFactory + AgencyProfile
echo ""
echo "[3/4] Deploying ContractFactory + AgencyProfile..."
DEPLOY_OUTPUT=$(cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast --unlocked 2>&1)

FACTORY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "ContractFactory:" | awk '{print $NF}')
PROFILE_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "AgencyProfile:" | awk '{print $NF}')

if [ -n "$FACTORY_ADDR" ]; then
  echo "  ✓ ContractFactory:  $FACTORY_ADDR"
else
  echo "  ⚠ Could not extract Factory address. Output:"
  echo "$DEPLOY_OUTPUT" | tail -10
fi

if [ -n "$PROFILE_ADDR" ]; then
  echo "  ✓ AgencyProfile:   $PROFILE_ADDR"
fi

# Verify Uniswap is available (from fork)
echo ""
echo "[4/4] Checking Uniswap V3 (from fork)..."
UNI_CHECK=$(curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24","latest"],"id":1}' | python3 -c "import sys,json; c=json.load(sys.stdin)['result']; print(len(c)//2-1)")
if [ "$UNI_CHECK" -gt 0 ] 2>/dev/null; then
  echo "  ✓ Uniswap V3 Factory: available ($UNI_CHECK bytes)"
else
  echo "  ⚠ Uniswap V3 not found — make sure you started anvil with --fork-url"
fi

# Summary
echo ""
echo "════════════════════════════════════════════"
echo "  Update .env.local with:"
echo ""
echo "  CHAIN_ID=31337"
echo "  RPC_URL=http://localhost:8545"
echo "  NEXT_PUBLIC_CHAIN_ID=31337"
echo "  NEXT_PUBLIC_RPC_URL=http://localhost:8545"
echo "  DEPLOYER_PRIVATE_KEY=$DEPLOYER_KEY"
echo "  PLATFORM_TREASURY=$DEPLOYER_ADDR"
[ -n "$USDC_ADDR" ] && echo "  PAYMENT_TOKEN_ADDRESS=$USDC_ADDR"
[ -n "$FACTORY_ADDR" ] && echo "  CONTRACT_FACTORY_ADDRESS=$FACTORY_ADDR"
[ -n "$PROFILE_ADDR" ] && echo "  AGENCY_PROFILE_ADDRESS=$PROFILE_ADDR"
echo ""
echo "  Uniswap V3 (from Base Sepolia fork):"
echo "  UNISWAP_FACTORY=0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
echo "  UNISWAP_ROUTER=0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4"
echo "  UNISWAP_POSITION_MANAGER=0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2"
echo ""
echo "  Then: pnpm dev"
echo "════════════════════════════════════════════"
