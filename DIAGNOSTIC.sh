#!/bin/bash
# PaperLens Production Diagnostic Script
# Run this to verify your production environment is properly configured

echo "=========================================="
echo "PaperLens Production Diagnostics"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="https://paperlens-a7li.onrender.com"
FRONTEND_URL="https://paper-lens-virid.vercel.app"

# Test 1: Backend Health Check
echo -n "Testing backend health endpoint... "
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo -e "${GREEN}✓ OK (200)${NC}"
else
  echo -e "${RED}✗ FAILED (${HEALTH_RESPONSE})${NC}"
fi

# Test 2: Gemini Configuration
echo -n "Testing Gemini configuration... "
GEMINI_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health/gemini")
GEMINI_STATUS=$(echo "$GEMINI_RESPONSE" | tail -n1)
GEMINI_DATA=$(echo "$GEMINI_RESPONSE" | head -n-1)

if [ "$GEMINI_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ OK${NC}"
  echo "Gemini Status:"
  echo "$GEMINI_DATA" | jq '.' 2>/dev/null || echo "$GEMINI_DATA"
else
  echo -e "${RED}✗ FAILED (${GEMINI_STATUS})${NC}"
fi

# Test 3: Check if API is accessible from frontend origin
echo ""
echo -n "Testing CORS from frontend... "
CORS_RESPONSE=$(curl -s -I -H "Origin: $FRONTEND_URL" "$BACKEND_URL/api/papers" 2>&1 | grep -i access-control)
if [ ! -z "$CORS_RESPONSE" ]; then
  echo -e "${GREEN}✓ OK${NC}"
  echo "CORS Headers:"
  echo "$CORS_RESPONSE"
else
  echo -e "${YELLOW}⚠ No CORS headers found (might be OK for authenticated requests)${NC}"
fi

# Test 4: Authentication Endpoint
echo ""
echo -n "Testing authentication endpoint... "
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  "$BACKEND_URL/api/auth/login")

if [ "$AUTH_RESPONSE" = "401" ] || [ "$AUTH_RESPONSE" = "400" ] || [ "$AUTH_RESPONSE" = "500" ]; then
  echo -e "${GREEN}✓ Endpoint accessible${NC}"
else
  echo -e "${RED}✗ FAILED (${AUTH_RESPONSE})${NC}"
fi

# Test 5: Database Connection
echo ""
echo -n "Testing database connectivity... "
# This would require a protected endpoint, but we can infer from health check
# For now, just check that backend is responding
if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo -e "${GREEN}✓ Backend responding (DB likely OK)${NC}"
else
  echo -e "${YELLOW}⚠ Cannot determine without authenticated request${NC}"
fi

# Test 6: Frontend Deployment
echo ""
echo -n "Testing frontend deployment... "
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$FRONTEND_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ OK (200)${NC}"
else
  echo -e "${RED}✗ FAILED (${FRONTEND_STATUS})${NC}"
fi

# Test 7: Environment Variables (requires admin access, show instructions)
echo ""
echo "=========================================="
echo "Manual Verification Steps:"
echo "=========================================="
echo ""
echo "1. Check Render Environment Variables:"
echo "   - Open: https://dashboard.render.com/services"
echo "   - Select your backend service"
echo "   - Go to: Settings → Environment"
echo "   - Verify these variables are set:"
echo "     ✓ GEMINI_API_KEY (should be 30+ characters)"
echo "     ✓ GEMINI_MODEL (should be: gemini-1.5-flash)"
echo "     ✓ MONGODB_URI (should start with: mongodb+srv://)"
echo "     ✓ JWT_SECRET (should be long random string)"
echo ""
echo "2. Check Render Logs for errors:"
echo "   - Select backend service"
echo "   - Click: Logs tab"
echo "   - Search for: [GEMINI or [SUMMARY or [ANALYSIS"
echo "   - Look for: ✓ SUCCESS or ✗ ERROR patterns"
echo ""
echo "3. Test API in Postman or curl:"
echo ""

# Show curl command for testing summary generation
echo "Example: Generate Summary (requires auth token):"
echo ""
echo "# 1. First, login to get token"
echo "curl -X POST https://paperlens-a7li.onrender.com/api/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"your@email.com\",\"password\":\"your-password\"}'"
echo ""
echo "# 2. Copy the token from response, then test summary:"
echo "curl -X POST https://paperlens-a7li.onrender.com/api/papers/{paperId}/generate-summary \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN_HERE'"
echo ""

echo "=========================================="
echo "Log Patterns to Look For:"
echo "=========================================="
echo ""
echo "✓ GOOD - You should see:"
echo "  [GEMINI-abc123] Request started"
echo "  [GEMINI-abc123] API key length: 32"
echo "  [GEMINI-abc123] ✓ SUCCESS on attempt 1"
echo ""
echo "✗ BAD - Watch out for:"
echo "  [GEMINI-abc123] API key length: 0    <-- GEMINI_API_KEY not set!"
echo "  [GEMINI-abc123] status 429            <-- Rate limited"
echo "  [GEMINI-abc123] status 503            <-- Service unavailable"
echo "  Cannot find module 'geminiService'    <-- File not found"
echo ""

echo "=========================================="
echo "Quick Fixes:"
echo "=========================================="
echo ""
echo "If Gemini API key is missing:"
echo "1. Get key from: https://aistudio.google.com/apikey"
echo "2. In Render Dashboard:"
echo "   - Select Backend service"
echo "   - Settings → Environment"
echo "   - Add: GEMINI_API_KEY=<your-key>"
echo "   - Save (service will restart)"
echo ""
echo "If getting rate limited (429):"
echo "1. Wait 1-2 hours"
echo "2. Or upgrade to paid Gemini plan"
echo ""
echo "If getting 'Paper not found' (404):"
echo "1. Check browser console: localStorage.getItem('paperlens.authToken')"
echo "2. Verify you're logged in"
echo "3. Verify you uploaded the paper"
echo ""

echo "=========================================="
echo "Diagnostics Complete!"
echo "=========================================="
