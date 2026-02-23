# Deployment & Testing Checklist

## Pre-Deployment Checklist

### Development Environment
- [ ] Node.js >= 18.0.0 installed
- [ ] pnpm installed (latest version)
- [ ] ANTHROPIC_API_KEY set in environment
- [ ] All dependencies installed (`pnpm install`)
- [ ] All packages build successfully (`pnpm build`)

### Code Quality
- [ ] No TypeScript compilation errors
- [ ] All linting passes (if configured)
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Input validation in place

### Documentation
- [ ] README.md complete
- [ ] QUICKSTART.md accurate
- [ ] Code comments for complex logic
- [ ] Environment variables documented
- [ ] API endpoints documented

## Testing Checklist

### Backend Testing
- [ ] MCP server starts without errors
- [ ] Connects successfully to stdio transport
- [ ] Responds to tool list requests
- [ ] Executes get_lending_markets tool
- [ ] Executes get_user_positions tool
- [ ] Executes get_deposit_calldata tool
- [ ] Executes get_withdraw_calldata tool
- [ ] Executes get_borrow_calldata tool
- [ ] Executes get_repay_calldata tool
- [ ] Executes get_token_balances tool
- [ ] Executes get_supported_chains tool
- [ ] Executes get_lender_ids tool
- [ ] Handles invalid parameters gracefully
- [ ] Returns error messages for API failures
- [ ] Handles timeouts properly

### Client Testing
- [ ] Client initializes MCP connection
- [ ] Retrieves tool list from backend
- [ ] Connects to Claude API
- [ ] Sends queries to Claude
- [ ] Executes tool calls on backend
- [ ] Processes tool results
- [ ] Continues conversation loop
- [ ] Generates final response
- [ ] Example queries work correctly
- [ ] Handles API errors gracefully
- [ ] Handles network timeouts
- [ ] ANTHROPIC_API_KEY validation works

### Frontend Testing
- [ ] Dev server starts on port 3000
- [ ] Chat interface renders correctly
- [ ] Messages display with correct styling
- [ ] User messages align right, agent messages align left
- [ ] Input field accepts text
- [ ] Send button works
- [ ] Loading indicator shows during processing
- [ ] Auto-scroll to latest message works
- [ ] Timestamps display correctly
- [ ] Empty messages are prevented
- [ ] Responsive design works on mobile
- [ ] Responsive design works on desktop

### Integration Testing
- [ ] Backend runs independently
- [ ] Client connects to backend
- [ ] Client connects to Claude
- [ ] Full agentic loop completes
- [ ] Tool execution returns correct data
- [ ] Multiple consecutive queries work
- [ ] Error in one tool doesn't crash system
- [ ] Can recover from temporary failures

### API Integration Testing
- [ ] 1Delta API endpoints are accessible
- [ ] Market data requests return valid data
- [ ] User position requests work
- [ ] Transaction calldata is properly formatted
- [ ] Token balance queries work
- [ ] Chain list returns supported chains
- [ ] Lender list returns protocol identifiers

## Manual Testing Scenarios

### Scenario 1: Basic Market Query
```
User: "What are the top lending markets on Ethereum?"

Expected:
1. Frontend receives input
2. Client sends to Claude
3. Claude selects get_lending_markets
4. Backend calls API
5. Data returned and formatted
6. Claude explains results
7. Frontend displays response
```

### Scenario 2: User Positions
```
User: "Show me my positions on Ethereum"

Expected:
1. Frontend receives input
2. Client sends to Claude
3. Claude selects get_user_positions
4. Backend calls API with user address
5. Position data returned
6. Claude summarizes positions
7. Frontend displays response
```

### Scenario 3: Error Handling
```
User: "Show positions for invalid address"

Expected:
1. Frontend receives input
2. Client sends to Claude
3. Claude attempts to call tool with bad data
4. Backend validates and returns error
5. Claude handles error gracefully
6. Frontend displays error message
```

### Scenario 4: Multiple Tool Calls
```
User: "What's the best deposit rate and how much USDC can I deposit?"

Expected:
1. Claude decides needs multiple tools
2. Calls get_lending_markets for rates
3. Calls get_token_balances for USDC amount
4. Combines results
5. Provides comprehensive answer
```

## Performance Testing

### Metrics to Monitor
- Backend startup time: < 1 second
- Tool execution time: < 2 seconds
- Claude API latency: 1-5 seconds
- Frontend render time: < 500ms
- End-to-end latency: < 10 seconds

### Load Testing
- [ ] Single concurrent user works
- [ ] Multiple queries in sequence work
- [ ] Rapid successive queries handled
- [ ] No memory leaks observed

## Security Testing

### Input Validation
- [ ] Invalid parameter types rejected
- [ ] Empty parameters handled
- [ ] Long strings truncated or rejected
- [ ] Special characters properly escaped
- [ ] SQL injection attempts fail

### Error Messages
- [ ] No API keys exposed in errors
- [ ] No sensitive data in error messages
- [ ] Stack traces only in development
- [ ] User-friendly error messages

### Environment Variables
- [ ] API key not logged to console
- [ ] API key not exposed in responses
- [ ] No secrets in version control
- [ ] Environment variables validated

## Browser Testing

### Desktop
- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari latest
- [ ] Edge latest

### Mobile
- [ ] iOS Safari
- [ ] Chrome Mobile
- [ ] Firefox Mobile

## Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG standards
- [ ] Screen reader compatible
- [ ] Focus indicators visible
- [ ] Messages readable by assistive tech

## Deployment Preparation

### Docker (Optional)
- [ ] Dockerfile created (if needed)
- [ ] Images built successfully
- [ ] Container runs without errors
- [ ] Volumes/networking configured

### Environment Configuration
- [ ] Production environment variables set
- [ ] API keys secured in secrets manager
- [ ] Database connections configured (if applicable)
- [ ] API rate limiting configured
- [ ] CORS policies set correctly

### Monitoring Setup
- [ ] Error tracking enabled
- [ ] Performance monitoring configured
- [ ] Logging aggregation set up
- [ ] Alerts configured for critical errors
- [ ] Health check endpoints available

### Backup & Recovery
- [ ] Backup strategy documented
- [ ] Recovery procedures tested
- [ ] Data retention policies defined
- [ ] Disaster recovery plan in place

## Post-Deployment Verification

### Initial Checks
- [ ] All services running
- [ ] Health checks passing
- [ ] No error logs in first 5 minutes
- [ ] Performance metrics normal
- [ ] Users can access system

### Smoke Testing
- [ ] Can send a basic query
- [ ] Tools execute successfully
- [ ] Frontend loads correctly
- [ ] No obvious errors

### Monitoring
- [ ] Error rates normal
- [ ] Latency within expected range
- [ ] CPU/Memory usage reasonable
- [ ] No suspicious patterns
- [ ] User behavior as expected

## Rollback Plan

If issues found:
1. [ ] Stop traffic to affected component
2. [ ] Switch to previous version
3. [ ] Verify functionality restored
4. [ ] Investigate issue
5. [ ] Fix and test thoroughly
6. [ ] Deploy again

## Documentation After Deployment

- [ ] Update deployment guide
- [ ] Document any manual steps
- [ ] Update troubleshooting guide
- [ ] Document infrastructure setup
- [ ] Create runbooks for common tasks

## Sign-Off

- [ ] All tests passed
- [ ] Performance acceptable
- [ ] Security review passed
- [ ] Stakeholder approval received
- [ ] Ready for production

---

**Use this checklist before deploying to production.**
