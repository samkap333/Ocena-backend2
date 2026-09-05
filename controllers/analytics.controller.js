const geoip = require('geoip-lite');
const { AnalyticsSession, AnalyticsPageView } = require('../models/analytics');

// Helper to extract client IP
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = forwarded.split(',');
    return list[0].trim();
  }
  return req.headers['cf-connecting-ip'] || 
         req.headers['x-real-ip'] || 
         req.socket.remoteAddress || 
         '';
}

// Helper to parse User-Agent
function parseUserAgent(ua = '') {
  const lowerUA = ua.toLowerCase();
  
  // Device Type
  let deviceType = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(lowerUA)) {
    deviceType = 'tablet';
  } else if (/mobi|iphone|ipod|phone|blackberry|opera mini|iemobile|mobile/i.test(lowerUA)) {
    deviceType = 'mobile';
  }

  // Browser
  let browser = 'Unknown';
  if (lowerUA.includes('edg/')) {
    browser = 'Edge';
  } else if (lowerUA.includes('chrome') && !lowerUA.includes('chromium') && !lowerUA.includes('edg')) {
    browser = 'Chrome';
  } else if (lowerUA.includes('safari') && !lowerUA.includes('chrome')) {
    browser = 'Safari';
  } else if (lowerUA.includes('firefox')) {
    browser = 'Firefox';
  } else if (lowerUA.includes('opera') || lowerUA.includes('opr/')) {
    browser = 'Opera';
  }

  // OS
  let os = 'Unknown';
  if (lowerUA.includes('win')) {
    os = 'Windows';
  } else if (lowerUA.includes('macintosh') || lowerUA.includes('mac os')) {
    os = 'macOS';
  } else if (lowerUA.includes('android')) {
    os = 'Android';
  } else if (lowerUA.includes('iphone') || lowerUA.includes('ipad') || lowerUA.includes('ios')) {
    os = 'iOS';
  } else if (lowerUA.includes('linux')) {
    os = 'Linux';
  }

  return { deviceType, browser, os };
}

// Helper to categorize traffic source
function parseTrafficSource(referrer = '', utm = {}) {
  if (utm.source) {
    const src = utm.source.toLowerCase();
    if (src.includes('google')) return 'Google Ads / Campaign';
    if (src.includes('facebook') || src.includes('meta')) return 'Facebook Ads';
    if (src.includes('linkedin')) return 'LinkedIn Ads';
    if (src.includes('instagram')) return 'Instagram Ads';
    if (src.includes('email') || src.includes('newsletter')) return 'Email / Campaign';
    return `Campaign (${utm.source})`;
  }

  if (!referrer || referrer === '' || referrer === 'direct') {
    return 'Direct';
  }

  try {
    const parsedUrl = new URL(referrer);
    const host = parsedUrl.hostname.toLowerCase();

    if (host.includes('google.')) return 'Google Search';
    if (host.includes('bing.')) return 'Bing Search';
    if (host.includes('yahoo.')) return 'Yahoo Search';
    if (host.includes('duckduckgo.')) return 'DuckDuckGo';
    if (host.includes('linkedin.') || host.includes('lnkd.in')) return 'LinkedIn';
    if (host.includes('facebook.') || host.includes('fb.')) return 'Facebook';
    if (host.includes('instagram.')) return 'Instagram';
    if (host.includes('twitter.') || host.includes('t.co') || host.includes('x.com')) return 'Twitter / X';
    if (host.includes('youtube.') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('whatsapp.')) return 'WhatsApp';
    if (host.includes('reddit.')) return 'Reddit';
    if (host.includes('ocena.') || host.includes('uniportal.')) return 'Direct / Internal';

    return `Referral (${host.replace('www.', '')})`;
  } catch (e) {
    return 'Referral';
  }
}

// Helper to determine geo location
function parseLocation(ip, req) {
  // Cloudflare header override if available
  const cfCountry = req.headers['cf-ipcountry'];
  const cfCity = req.headers['cf-ipcity'];
  const cfRegion = req.headers['cf-region'];

  if (cfCountry && cfCountry.length === 2 && cfCountry !== 'XX') {
    return {
      country: cfCountry,
      countryCode: cfCountry,
      city: cfCity ? decodeURIComponent(cfCity) : 'Unknown',
      region: cfRegion ? decodeURIComponent(cfRegion) : 'Unknown',
    };
  }

  // GeoIP Lookup
  if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
    const geo = geoip.lookup(ip);
    if (geo) {
      return {
        country: geo.country || 'Unknown',
        countryCode: geo.country || 'UN',
        city: geo.city || 'Unknown',
        region: geo.region || 'Unknown',
      };
    }
  }

  return {
    country: 'India',
    countryCode: 'IN',
    city: 'Mumbai',
    region: 'Maharashtra',
  };
}

// Public Ingest Endpoint (receives pageviews, heartbeats, duration pings)
exports.collect = async (req, res) => {
  try {
    const {
      type = 'pageview',
      site = 'ocena',
      sessionId,
      visitorId,
      url,
      path = '/',
      title = '',
      referrer = '',
      utm = {},
      screen = '',
      language = 'en',
      duration = 0,
      scrollDepth = 0,
      hasConsent = false,
    } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const { deviceType, browser, os } = parseUserAgent(userAgent);
    const location = parseLocation(ip, req);
    const trafficSource = parseTrafficSource(referrer, utm);

    // Normalize site identifier
    const normalizedSite = (site || 'ocena').toLowerCase().trim();

    if (type === 'pageview') {
      let isReturning = false;

      // Check if returning visitor if consent was granted and visitorId exists
      if (hasConsent && visitorId) {
        const previousSession = await AnalyticsSession.findOne({
          site: normalizedSite,
          visitorId,
          sessionId: { $ne: sessionId },
        }).select('_id');
        if (previousSession) {
          isReturning = true;
        }
      }

      // Upsert Session
      let session = await AnalyticsSession.findOne({ sessionId, site: normalizedSite });
      if (!session) {
        session = new AnalyticsSession({
          site: normalizedSite,
          sessionId,
          visitorId: hasConsent ? visitorId : null,
          isReturning,
          hasConsent: Boolean(hasConsent),
          entryPage: { url, path, title },
          exitPage: { url, path, title },
          pageViewsCount: 1,
          totalDuration: 0,
          isBounce: true,
          referrer,
          trafficSource,
          utm: {
            source: utm.source || '',
            medium: utm.medium || '',
            campaign: utm.campaign || '',
            term: utm.term || '',
            content: utm.content || '',
          },
          device: {
            type: deviceType,
            browser,
            os,
            screen,
            language,
          },
          location,
          startedAt: new Date(),
          lastActiveAt: new Date(),
        });
        await session.save();
      } else {
        // Increment pageviews count and update exit page
        session.pageViewsCount += 1;
        session.exitPage = { url, path, title };
        session.isBounce = false; // More than 1 pageview means not a single-page bounce
        session.lastActiveAt = new Date();
        if (hasConsent && visitorId && !session.visitorId) {
          session.visitorId = visitorId;
          session.hasConsent = true;
        }
        await session.save();
      }

      // Create PageView record
      const pageView = new AnalyticsPageView({
        site: normalizedSite,
        sessionId,
        visitorId: hasConsent ? visitorId : null,
        url,
        path,
        title,
        referrer,
        duration: 0,
        scrollDepth: Number(scrollDepth) || 0,
        hasConsent: Boolean(hasConsent),
        timestamp: new Date(),
      });
      await pageView.save();

      return res.status(200).json({ status: 'success', recorded: 'pageview', sessionId });
    }

    if (type === 'heartbeat' || type === 'duration' || type === 'session_end') {
      const pingDuration = Math.max(0, Math.min(3600, Number(duration) || 0));
      const depth = Math.max(0, Math.min(100, Number(scrollDepth) || 0));

      // Update the latest pageview duration
      const latestPageView = await AnalyticsPageView.findOne({
        sessionId,
        site: normalizedSite,
        path,
      }).sort({ timestamp: -1 });

      if (latestPageView) {
        if (pingDuration > latestPageView.duration) {
          latestPageView.duration = pingDuration;
        }
        if (depth > latestPageView.scrollDepth) {
          latestPageView.scrollDepth = depth;
        }
        await latestPageView.save();
      }

      // Update Session totalDuration and bounce state
      const session = await AnalyticsSession.findOne({ sessionId, site: normalizedSite });
      if (session) {
        session.totalDuration = Math.max(session.totalDuration, pingDuration);
        session.lastActiveAt = new Date();
        if (session.pageViewsCount > 1 || session.totalDuration > 15) {
          session.isBounce = false;
        }
        if (type === 'session_end' && url) {
          session.exitPage = { url, path, title };
        }
        await session.save();
      }

      return res.status(200).json({ status: 'success', recorded: type });
    }

    return res.status(200).json({ status: 'ignored' });
  } catch (error) {
    console.error('Analytics collect error:', error);
    return res.status(500).json({ error: 'Failed to record analytics event' });
  }
};

// CRM Dashboard Stats Endpoint
exports.getStats = async (req, res) => {
  try {
    const {
      site = 'all',
      range = '7d',
      startDate,
      endDate,
    } = req.query;

    // Date range calculation
    let start = new Date();
    let end = new Date();

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === '7d') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (range === '30d') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (range === '90d') {
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
    } else if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default to 7d
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }

    // Match query for sessions and pageviews
    const sessionMatch = {
      startedAt: { $gte: start, $lte: end },
    };
    const pageViewMatch = {
      timestamp: { $gte: start, $lte: end },
    };

    if (site && site !== 'all') {
      sessionMatch.site = site.toLowerCase().trim();
      pageViewMatch.site = site.toLowerCase().trim();
    }

    // Run parallel aggregation queries
    const [
      summaryData,
      timelineData,
      topPagesData,
      sourcesData,
      devicesData,
      locationsData,
      recentLogsData,
    ] = await Promise.all([
      // 1. Overall Summary Metrics
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            totalDuration: { $sum: '$totalDuration' },
            totalPageViews: { $sum: '$pageViewsCount' },
            bounces: { $sum: { $cond: ['$isBounce', 1, 0] } },
            returningVisitors: { $sum: { $cond: ['$isReturning', 1, 0] } },
            uniqueVisitorIds: { $addToSet: { $ifNull: ['$visitorId', '$_id'] } },
            consentCount: { $sum: { $cond: ['$hasConsent', 1, 0] } },
          },
        },
      ]),

      // 2. Timeline Series (Hourly for today, Daily for others)
      range === 'today'
        ? AnalyticsPageView.aggregate([
            { $match: pageViewMatch },
            {
              $group: {
                _id: { $hour: '$timestamp' },
                pageViews: { $sum: 1 },
                uniqueVisitors: { $addToSet: { $ifNull: ['$visitorId', '$sessionId'] } },
                sessions: { $addToSet: '$sessionId' },
              },
            },
            { $sort: { '_id': 1 } },
          ])
        : AnalyticsPageView.aggregate([
            { $match: pageViewMatch },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                pageViews: { $sum: 1 },
                uniqueVisitors: { $addToSet: { $ifNull: ['$visitorId', '$sessionId'] } },
                sessions: { $addToSet: '$sessionId' },
              },
            },
            { $sort: { '_id': 1 } },
          ]),

      // 3. Top Visited Pages
      AnalyticsPageView.aggregate([
        { $match: pageViewMatch },
        {
          $group: {
            _id: '$path',
            title: { $first: '$title' },
            views: { $sum: 1 },
            uniqueVisitors: { $addToSet: { $ifNull: ['$visitorId', '$sessionId'] } },
            totalDuration: { $sum: '$duration' },
          },
        },
        {
          $project: {
            path: '$_id',
            title: 1,
            views: 1,
            uniqueVisitors: { $size: '$uniqueVisitors' },
            avgDuration: {
              $cond: [{ $gt: ['$views', 0] }, { $round: [{ $divide: ['$totalDuration', '$views'] }, 0] }, 0],
            },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 15 },
      ]),

      // 4. Traffic Sources Breakdown
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: '$trafficSource',
            count: { $sum: 1 },
            bounces: { $sum: { $cond: ['$isBounce', 1, 0] } },
            totalDuration: { $sum: '$totalDuration' },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // 5. Devices Breakdown
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: '$device.type',
            count: { $sum: 1 },
          },
        },
      ]),

      // 6. Countries & Cities Breakdown
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: {
              country: '$location.country',
              countryCode: '$location.countryCode',
              city: '$location.city',
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            country: '$_id.country',
            countryCode: '$_id.countryCode',
            city: '$_id.city',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // 7. Recent Visitor Sessions (Log table)
      AnalyticsSession.find(sessionMatch)
        .sort({ startedAt: -1 })
        .limit(50)
        .lean(),
    ]);

    // Format summary metrics
    const summaryRaw = summaryData[0] || {
      totalSessions: 0,
      totalDuration: 0,
      totalPageViews: 0,
      bounces: 0,
      returningVisitors: 0,
      uniqueVisitorIds: [],
      consentCount: 0,
    };

    const totalSessions = summaryRaw.totalSessions || 0;
    const totalPageViews = summaryRaw.totalPageViews || 0;
    const uniqueVisitors = summaryRaw.uniqueVisitorIds ? summaryRaw.uniqueVisitorIds.length : 0;
    const returningVisitors = summaryRaw.returningVisitors || 0;
    const newVisitors = Math.max(0, totalSessions - returningVisitors);
    const bounceRate = totalSessions > 0 ? Number(((summaryRaw.bounces / totalSessions) * 100).toFixed(1)) : 0;
    const avgSessionDuration = totalSessions > 0 ? Math.round(summaryRaw.totalDuration / totalSessions) : 0;
    const avgTimePerPage = totalPageViews > 0 ? Math.round(summaryRaw.totalDuration / totalPageViews) : 0;

    // Format timeline
    let formattedTimeline = [];
    if (range === 'today') {
      // 24 hours grid
      const hourMap = {};
      timelineData.forEach((item) => {
        hourMap[item._id] = {
          views: item.pageViews,
          visitors: item.uniqueVisitors.length,
          sessions: item.sessions.length,
        };
      });
      for (let h = 0; h < 24; h++) {
        const label = `${h.toString().padStart(2, '0')}:00`;
        formattedTimeline.push({
          label,
          views: hourMap[h]?.views || 0,
          visitors: hourMap[h]?.visitors || 0,
          sessions: hourMap[h]?.sessions || 0,
        });
      }
    } else {
      // Fill dates across range
      const dateMap = {};
      timelineData.forEach((item) => {
        dateMap[item._id] = {
          views: item.pageViews,
          visitors: item.uniqueVisitors.length,
          sessions: item.sessions.length,
        };
      });

      const curr = new Date(start);
      while (curr <= end) {
        const dateStr = curr.toISOString().split('T')[0];
        const monthDay = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        formattedTimeline.push({
          date: dateStr,
          label: monthDay,
          views: dateMap[dateStr]?.views || 0,
          visitors: dateMap[dateStr]?.visitors || 0,
          sessions: dateMap[dateStr]?.sessions || 0,
        });
        curr.setDate(curr.getDate() + 1);
      }
    }

    // Format sources
    const sources = sourcesData.map((s) => ({
      source: s._id || 'Direct',
      count: s.count,
      percentage: totalSessions > 0 ? Number(((s.count / totalSessions) * 100).toFixed(1)) : 0,
      avgDuration: s.count > 0 ? Math.round(s.totalDuration / s.count) : 0,
      bounceRate: s.count > 0 ? Number(((s.bounces / s.count) * 100).toFixed(1)) : 0,
    }));

    // Format devices
    const deviceMap = { desktop: 0, mobile: 0, tablet: 0 };
    devicesData.forEach((d) => {
      const key = d._id || 'desktop';
      if (deviceMap[key] !== undefined) {
        deviceMap[key] += d.count;
      } else {
        deviceMap.desktop += d.count;
      }
    });

    const devices = [
      { name: 'Desktop', count: deviceMap.desktop, percentage: totalSessions > 0 ? Number(((deviceMap.desktop / totalSessions) * 100).toFixed(1)) : 0 },
      { name: 'Mobile', count: deviceMap.mobile, percentage: totalSessions > 0 ? Number(((deviceMap.mobile / totalSessions) * 100).toFixed(1)) : 0 },
      { name: 'Tablet', count: deviceMap.tablet, percentage: totalSessions > 0 ? Number(((deviceMap.tablet / totalSessions) * 100).toFixed(1)) : 0 },
    ];

    return res.status(200).json({
      site,
      range,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      summary: {
        totalVisitors: totalSessions,
        uniqueVisitors,
        newVisitors,
        returningVisitors,
        totalPageViews,
        totalSessions,
        avgSessionDuration, // in seconds
        avgTimePerPage,     // in seconds
        bounceRate,         // in %
        consentRate: totalSessions > 0 ? Number(((summaryRaw.consentCount / totalSessions) * 100).toFixed(1)) : 0,
      },
      timeline: formattedTimeline,
      topPages: topPagesData,
      sources,
      devices,
      locations: locationsData,
      recentLogs: recentLogsData,
    });
  } catch (error) {
    console.error('Analytics getStats error:', error);
    return res.status(500).json({ error: 'Failed to retrieve analytics statistics' });
  }
};

// Real-Time Active Visitors (Live Feed)
exports.getLive = async (req, res) => {
  try {
    const { site = 'all' } = req.query;
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const query = {
      lastActiveAt: { $gte: fifteenMinutesAgo },
    };

    if (site && site !== 'all') {
      query.site = site.toLowerCase().trim();
    }

    const [activeSessionsCount, activeSessions, topActivePages] = await Promise.all([
      AnalyticsSession.countDocuments(query),
      AnalyticsSession.find(query).sort({ lastActiveAt: -1 }).limit(10).lean(),
      AnalyticsPageView.aggregate([
        {
          $match: {
            timestamp: { $gte: fifteenMinutesAgo },
            ...(site && site !== 'all' ? { site: site.toLowerCase().trim() } : {}),
          },
        },
        {
          $group: {
            _id: '$path',
            title: { $first: '$title' },
            activeViews: { $sum: 1 },
          },
        },
        { $sort: { activeViews: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return res.status(200).json({
      activeVisitors: activeSessionsCount,
      activeSessions,
      topActivePages,
    });
  } catch (error) {
    console.error('Analytics getLive error:', error);
    return res.status(500).json({ error: 'Failed to retrieve live analytics' });
  }
};

// Public Embeddable Standalone Tracker Script Endpoint
exports.getTrackerScript = (req, res) => {
  const host = req.get('host') || 'localhost:8000';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}/api/v1/analytics/collect`;

  const script = `
(function() {
  'use strict';
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  var site = (currentScript && currentScript.getAttribute('data-site')) || 'ocena';
  var endpoint = '${baseUrl}';

  var sessionId = sessionStorage.getItem('_oa_sid');
  if (!sessionId) {
    sessionId = 'sid_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    sessionStorage.setItem('_oa_sid', sessionId);
  }

  function getConsent() {
    try {
      var saved = localStorage.getItem('ocena_cookie_consent') || localStorage.getItem('uniportal_cookie_consent');
      if (saved) {
        var parsed = JSON.parse(saved);
        return parsed.analytics === true;
      }
    } catch(e) {}
    return false;
  }

  function getVisitorId(hasConsent) {
    if (!hasConsent) return null;
    var vid = localStorage.getItem('_oa_vid');
    if (!vid) {
      vid = 'vid_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('_oa_vid', vid);
    }
    return vid;
  }

  var startTime = Date.now();
  var pageDuration = 0;

  function sendEvent(type, extra) {
    var hasConsent = getConsent();
    var visitorId = getVisitorId(hasConsent);
    var payload = Object.assign({
      type: type || 'pageview',
      site: site,
      sessionId: sessionId,
      visitorId: visitorId,
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      screen: window.screen.width + 'x' + window.screen.height,
      language: navigator.language,
      duration: Math.round((Date.now() - startTime) / 1000),
      scrollDepth: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1)) * 100),
      hasConsent: hasConsent
    }, extra || {});

    var data = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      var blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(data);
    }
  }

  // Track initial pageview
  sendEvent('pageview');

  // Heartbeat ping every 15s to record accurate duration
  setInterval(function() {
    sendEvent('heartbeat');
  }, 15000);

  // Page unload
  window.addEventListener('beforeunload', function() {
    sendEvent('session_end');
  });

  // Re-check when consent changes
  window.addEventListener('cookie_consent_updated', function() {
    sendEvent('pageview');
  });
})();
  `;

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(script.trim());
};
