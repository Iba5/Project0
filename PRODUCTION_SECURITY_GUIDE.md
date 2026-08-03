# Production Security Guide

This guide outlines the security configurations and best practices for deploying the Voting Admin App to production.

## 🔒 Security Overview

The application has been configured with defense-in-depth security measures across multiple layers:

### **1. Environment Configuration**

#### **Required Production Environment Variables**

```bash
# Backend (.env.production)
DEBUG=false
JWT_SECRET_KEY=<strong-32-char-random-string>
ACCESS_TOKEN_EXPIRE_MINUTES=15
COOKIE_SECURE=true
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
ALLOWED_HOSTS=yourdomain.com,admin.yourdomain.com
PAYNOW_INTEGRATION_ID=<your-integration-id>
PAYNOW_INTEGRATION_KEY=<your-integration-key>
BOOTSTRAP_TOKEN=<strong-32-char-random-string>
```

#### **Security Validation**
- Application fails to start in production mode without required secrets
- CORS and allowed hosts must be explicitly configured (no wildcards)
- JWT secrets must be cryptographically strong

### **2. Authentication & Authorization**

#### **JWT Token Security**
- **Access Tokens**: 15 minutes expiration (configurable)
- **Refresh Tokens**: 7 days expiration with rotation support
- **Algorithm**: HS256 with strong secret keys
- **Token Storage**: HTTP-only, secure cookies in production

#### **Password Security**
- **Hashing**: Argon2 (memory-hard, GPU-resistant)
- **Minimum Length**: 8 characters enforced
- **Complexity**: No specific requirements (Argon2 is sufficient)

#### **Permission System**
- Role-based access control (RBAC)
- Granular permissions for different admin actions
- Permission checking on all sensitive endpoints

### **3. Rate Limiting**

#### **Production Rate Limits**
- **General API**: 60 requests per minute per IP
- **Payment Endpoints**: 5 payment attempts per minute per IP
- **Redis-backed**: Distributed rate limiting across multiple workers
- **Fallback**: In-memory rate limiting if Redis unavailable

#### **Configuration**
```bash
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=60
PAYMENT_RATE_LIMIT_WINDOW_SECONDS=60
PAYMENT_RATE_LIMIT_MAX_REQUESTS=5
```

### **4. Security Headers**

#### **Backend Headers**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (production only)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

#### **Content Security Policy**
- **Development**: More permissive for debugging
- **Production**: Strict CSP with limited external resources
- **No inline scripts** (except safe inline styles)
- **No eval()** in production

### **5. CORS Configuration**

#### **Production CORS**
- **Origins**: Explicit domains only (no wildcards)
- **Credentials**: Enabled for authenticated requests
- **Methods**: Restrict to necessary HTTP methods
- **Headers**: Restrict to necessary headers

#### **Socket.IO CORS**
- Uses same CORS configuration as HTTP API
- Development allows all origins for testing
- Production restricts to configured domains

### **6. Database Security**

#### **Connection Security**
- **SSL Required**: Use `postgresql://` with SSL in production
- **Connection Pooling**: Configured for production workloads
- **Password Strength**: Strong database passwords required

#### **Database Pool Settings**
```bash
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT=30
```

### **7. API Documentation Security**

#### **Production Configuration**
- **OpenAPI/Swagger**: Disabled in production (`DEBUG=false`)
- **ReDoc**: Disabled in production
- **API Docs**: Only available in development mode

### **8. Payment Security**

#### **Paynow Integration**
- **Credentials**: Stored securely in environment variables
- **Webhooks**: Verified for authenticity
- **Rate Limiting**: Strict limits on payment initiation
- **Validation**: Comprehensive payment validation

### **9. Frontend Security**

#### **Next.js Security Headers**
- `X-DNS-Prefetch-Control: on`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Strict-Transport-Security` (production only with HTTPS)

#### **Environment Variables**
- **Development**: NODE_ENV=development
- **Production**: NODE_ENV=production
- **API URL**: Configurable via BACKEND_API_URL

## 🚀 Deployment Checklist

### **Pre-Deployment**
- [ ] Generate strong JWT_SECRET_KEY using `openssl rand -hex 32`
- [ ] Generate strong BOOTSTRAP_TOKEN using `openssl rand -hex 32`
- [ ] Configure production database with SSL
- [ ] Set up Redis with SSL
- [ ] Configure domain names in CORS_ORIGINS and ALLOWED_HOSTS
- [ ] Update Paynow integration credentials
- [ ] Set DEBUG=false in production environment
- [ ] Review and update email configuration

### **Post-Deployment**
- [ ] Test authentication flow
- [ ] Test payment initiation with rate limiting
- [ ] Verify security headers are present
- [ ] Test admin permission system
- [ ] Verify API documentation is disabled
- [ ] Test database connectivity with SSL
- [ ] Monitor rate limiting effectiveness
- [ ] Review logs for security events

## 🔍 Security Monitoring

### **Key Metrics to Monitor**
- Failed authentication attempts
- Rate limit violations
- Unusual payment patterns
- Admin permission changes
- Database connection failures
- Redis connectivity issues

### **Log Monitoring**
- Request IDs for traceability
- User ID tracking in logs
- IP address logging
- Response time monitoring
- Error rate tracking

## 🛡️ Additional Security Recommendations

### **Infrastructure Security**
- Use HTTPS/TLS for all connections
- Implement firewall rules
- Regular security updates
- Network segmentation
- DDoS protection

### **Application Security**
- Regular dependency updates
- Security scanning (SAST/DAST)
- Penetration testing
- Code review processes
- Secret scanning

### **Operational Security**
- Backup encryption
- Secure backup storage
- Incident response plan
- Security team training
- Compliance monitoring

## 📝 Environment File Template

### **Backend (.env.production)**
```bash
PROJECT_NAME="Digital Entertainment Voting Platform API"
API_V1_STR="/api/v1"
DEBUG=false

DATABASE_URL=postgresql://user:strong_password@host:5432/database
REDIS_URL=rediss://user:strong_password@host:6379

JWT_SECRET_KEY=<generate-with-openssl-rand-hex-32>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
COOKIE_SECURE=true

CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
ALLOWED_HOSTS=yourdomain.com,admin.yourdomain.com

BOOTSTRAP_TOKEN=<generate-with-openssl-rand-hex-32>

PAYNOW_INTEGRATION_ID="your_integration_id"
PAYNOW_INTEGRATION_KEY="your_integration_key"
PAYNOW_RESULT_URL="https://yourdomain.com/api/v1/payments/paynow/callback"
PAYNOW_RETURN_URL="https://yourdomain.com/payments/status"

RESEND_API_KEY="your_resend_api_key"
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME="VibeWave"
FRONTEND_URL=https://yourdomain.com

DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT=30

DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100

RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=60
PAYMENT_RATE_LIMIT_WINDOW_SECONDS=60
PAYMENT_RATE_LIMIT_MAX_REQUESTS=5
```

### **Frontend (.env.production)**
```bash
NEXT_PUBLIC_API_URL=https://yourdomain.com/api/v1
BACKEND_API_URL=https://yourdomain.com
BOOTSTRAP_TOKEN=<same-as-backend>
NODE_ENV=production
```

## ⚠️ Security Warnings

1. **Never commit .env files** to version control
2. **Never use default secrets** in production
3. **Always use HTTPS** in production
4. **Never disable security headers** for convenience
5. **Always keep dependencies updated**
6. **Never share secrets** via unencrypted channels
7. **Always use strong passwords** for all services
8. **Never expose API documentation** in production

## 🔄 Regular Security Tasks

- **Weekly**: Review security logs
- **Monthly**: Update dependencies
- **Quarterly**: Security audit
- **Annually**: Penetration testing
- **Ongoing**: Monitor security advisories

---

**Last Updated**: 2026-08-02
**Version**: 1.0.0
