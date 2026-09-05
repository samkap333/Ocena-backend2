const mongoose = require('mongoose');

// Schema for tracking visitor sessions
const AnalyticsSessionSchema = new mongoose.Schema(
  {
    site: {
      type: String,
      default: 'ocena',
      index: true,
      trim: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    visitorId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    isReturning: {
      type: Boolean,
      default: false,
    },
    hasConsent: {
      type: Boolean,
      default: false,
    },
    entryPage: {
      url: { type: String, default: '' },
      path: { type: String, default: '/' },
      title: { type: String, default: '' },
    },
    exitPage: {
      url: { type: String, default: '' },
      path: { type: String, default: '/' },
      title: { type: String, default: '' },
    },
    pageViewsCount: {
      type: Number,
      default: 1,
    },
    totalDuration: {
      type: Number,
      default: 0, // in seconds
    },
    isBounce: {
      type: Boolean,
      default: true,
    },
    referrer: {
      type: String,
      default: '',
    },
    trafficSource: {
      type: String,
      default: 'Direct',
      index: true,
    },
    utm: {
      source: { type: String, default: '' },
      medium: { type: String, default: '' },
      campaign: { type: String, default: '' },
      term: { type: String, default: '' },
      content: { type: String, default: '' },
    },
    device: {
      type: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'desktop',
        index: true,
      },
      browser: { type: String, default: 'Unknown' },
      os: { type: String, default: 'Unknown' },
      screen: { type: String, default: '' },
      language: { type: String, default: 'en' },
    },
    location: {
      country: { type: String, default: 'Unknown' },
      countryCode: { type: String, default: 'UN' },
      city: { type: String, default: 'Unknown' },
      region: { type: String, default: 'Unknown' },
    },
    ip: {
      type: String,
      select: false, // never expose IP in standard queries
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Schema for individual page views
const AnalyticsPageViewSchema = new mongoose.Schema(
  {
    site: {
      type: String,
      default: 'ocena',
      index: true,
      trim: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    visitorId: {
      type: String,
      default: null,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: '',
    },
    referrer: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0, // time spent on this page in seconds
    },
    scrollDepth: {
      type: Number,
      default: 0, // percentage 0 - 100
    },
    hasConsent: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast aggregation
AnalyticsSessionSchema.index({ site: 1, startedAt: -1 });
AnalyticsSessionSchema.index({ site: 1, trafficSource: 1 });
AnalyticsSessionSchema.index({ site: 1, 'device.type': 1 });
AnalyticsPageViewSchema.index({ site: 1, path: 1 });
AnalyticsPageViewSchema.index({ site: 1, timestamp: -1 });
AnalyticsPageViewSchema.index({ sessionId: 1, timestamp: -1 });

const AnalyticsSession = mongoose.model('AnalyticsSession', AnalyticsSessionSchema);
const AnalyticsPageView = mongoose.model('AnalyticsPageView', AnalyticsPageViewSchema);

module.exports = {
  AnalyticsSession,
  AnalyticsPageView,
};
