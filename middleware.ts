/**
 * Vercel Edge Middleware: HTTP Basic Auth for Staging
 * 
 * Protects the staging deployment from unauthorized access and bot traffic.
 * This runs BEFORE any static assets are served, preventing Mapbox abuse.
 * 
 * ============================================
 * HOW TO ENABLE (in Vercel Environment Variables):
 * ============================================
 * 
 * 1. Go to Vercel Dashboard → Project → Settings → Environment Variables
 * 2. Add these THREE variables (Server-side only, NOT prefixed with VITE_):
 * 
 *    VIBECHECK_STAGE_BASIC_AUTH_ENABLED = true
 *    VIBECHECK_STAGE_BASIC_AUTH_USER    = <your-username>
 *    VIBECHECK_STAGE_BASIC_AUTH_PASS    = <your-password>
 * 
 * 3. Set them for "Preview" environment only (not Production)
 * 4. Redeploy
 * 
 * ============================================
 * BEHAVIOR:
 * ============================================
 * 
 * - When ENABLED=true AND hostname contains 'vibecheck-sand.vercel.app':
 *   → Browser prompts for username/password
 *   → No HTML/JS/CSS loads until authenticated
 *   → Mapbox never touched by bots
 * 
 * - When ENABLED is not 'true' OR on localhost OR on production:
 *   → App loads normally without auth prompt
 * 
 * ⚠️ NEVER put credentials in VITE_* variables (those are exposed to client)
 */

export const config = {
  // Run on all routes except favicon and robots.txt
  matcher: ['/((?!favicon.ico|robots.txt).*)'],
};

export default function middleware(request: Request): Response | undefined {
  // ============================================
  // Check if basic auth is enabled
  // ============================================
  const authEnabled = process.env.VIBECHECK_STAGE_BASIC_AUTH_ENABLED === 'true';
  
  if (!authEnabled) {
    // Auth not enabled - let request through
    return undefined;
  }
  
  // ============================================
  // Check hostname - only apply to staging
  // ============================================
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  // Allow localhost to bypass auth for local development
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalhost) {
    return undefined;
  }
  
  // Only apply auth to staging domain
  // Adjust this pattern if your staging URL is different
  const isStaging = hostname.includes('vibecheck-sand.vercel.app') || 
                    hostname.includes('-vibecheck') ||  // Vercel preview deployments
                    hostname.endsWith('.vercel.app');   // Any Vercel preview
  
  // If not staging (e.g., production domain), skip auth
  if (!isStaging) {
    return undefined;
  }
  
  // ============================================
  // Validate Basic Auth credentials
  // ============================================
  const expectedUser = process.env.VIBECHECK_STAGE_BASIC_AUTH_USER;
  const expectedPass = process.env.VIBECHECK_STAGE_BASIC_AUTH_PASS;
  
  // If credentials not configured, fail open (allow through)
  // This prevents accidental lockout if env vars are missing
  if (!expectedUser || !expectedPass) {
    console.warn('[middleware] Basic auth enabled but credentials not configured');
    return undefined;
  }
  
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  
  if (authHeader) {
    // Parse "Basic base64(user:pass)"
    const [scheme, encoded] = authHeader.split(' ');
    
    if (scheme === 'Basic' && encoded) {
      try {
        // Decode base64 credentials
        const decoded = atob(encoded);
        const separatorIndex = decoded.indexOf(':');
        
        if (separatorIndex > 0) {
          const user = decoded.substring(0, separatorIndex);
          const pass = decoded.substring(separatorIndex + 1);
          
          // Constant-time comparison would be better, but for staging this is OK
          if (user === expectedUser && pass === expectedPass) {
            // ✅ Authenticated - allow request through
            return undefined;
          }
        }
      } catch {
        // Invalid base64 - fall through to 401
      }
    }
  }
  
  // ============================================
  // Not authenticated - return 401
  // ============================================
  return new Response('Authentication required for staging access', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="VibeCheck Staging"',
      'Content-Type': 'text/plain',
    },
  });
}

