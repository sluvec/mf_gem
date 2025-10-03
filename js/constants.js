/**
 * @fileoverview Application Constants
 * @description Central location for all magic numbers, strings, and business rules
 */

/**
 * Business Rules and Constraints
 */
export const BUSINESS_RULES = {
  DISCOUNT: {
    MAX_PERCENT: 100,
    MIN_PERCENT: 0,
    MIN_AMOUNT: 0
  },
  VAT: {
    DEFAULT_RATE: 20,
    MIN_RATE: 0,
    MAX_RATE: 100
  },
  PRICE: {
    DECIMAL_PLACES: 2,
    MIN_VALUE: 0
  },
  CACHE: {
    DURATION_MS: 5 * 60 * 1000, // 5 minutes
    MAX_SIZE: 100
  }
};

/**
 * Record Status Values
 */
export const STATUS = {
  // Quote statuses
  QUOTE: {
    DRAFT: 'draft',
    PENDING: 'pending',
    APPROVED: 'approved',
    DECLINED: 'declined',
    COMPLETED: 'completed'
  },
  // Activity statuses
  ACTIVITY: {
    PENDING: 'pending',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  // Price list statuses
  PRICE_LIST: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ARCHIVED: 'archived'
  }
};

/**
 * ID Prefixes for different entity types
 */
export const ID_PREFIXES = {
  PRICE_LIST_ITEM: 'pli',
  RECYCLING: 'rc',
  REBATE: 'rb',
  QUOTE: 'quote',
  ACTIVITY: 'act',
  PC_NUMBER: 'pc',
  RESOURCE: 'res'
};

/**
 * Database Configuration
 */
export const DATABASE = {
  NAME: 'CRM_Database',
  VERSION: 9,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  STORES: {
    PC_NUMBERS: 'pcNumbers',
    ACTIVITIES: 'activities',
    QUOTES: 'quotes',
    RESOURCES: 'resources',
    PRICE_LISTS: 'priceLists',
    ACCOUNT_MANAGERS: 'accountManagers'
  }
};

/**
 * UI Display Values
 */
export const DISPLAY = {
  NONE: 'none',
  BLOCK: 'block',
  FLEX: 'flex',
  GRID: 'grid'
};

/**
 * UI Colors
 */
export const COLORS = {
  PRIMARY: '#3b82f6',
  SECONDARY: '#6b7280',
  SUCCESS: '#10b981',
  DANGER: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#06b6d4',
  NEUTRAL: '#374151',
  TRANSPARENT: 'transparent',
  WHITE: 'white'
};

/**
 * View Types
 */
export const VIEWS = {
  ACTIVITY: ['list', 'calendar'],
  CALENDAR: ['month', 'week']
};

/**
 * Category Types
 */
export const CATEGORIES = {
  PRICE_LIST: {
    LABOUR: 'labour',
    VEHICLES: 'vehicles',
    MATERIALS: 'materials',
    OTHER: 'other'
  },
  RECYCLING: {
    GENERAL: 'general',
    POPS: 'pops',
    WEEE: 'weee',
    OTHER: 'other'
  },
  REBATE: {
    FURNITURE: 'furniture',
    IT: 'it',
    METAL: 'metal',
    OTHER: 'other'
  }
};

/**
 * Currency Configuration
 */
export const CURRENCY = {
  DEFAULT: 'GBP',
  SYMBOL: '£',
  LOCALE: 'en-GB'
};

/**
 * Date Format Options
 */
export const DATE_FORMAT = {
  SHORT: 'short',
  LONG: 'long',
  DATETIME: 'datetime'
};

/**
 * Discount Types
 */
export const DISCOUNT_TYPE = {
  PERCENT: 'percent',
  AMOUNT: 'amount'
};

/**
 * Calculation Modes
 */
export const CALCULATION_MODE = {
  BY_WEIGHT: 'byWeight',
  MANUAL: 'manual'
};

/**
 * Form Validation Rules
 */
export const VALIDATION = {
  PC_NUMBER: {
    REQUIRED_FIELDS: [
      'pcNumber',
      'company',
      'contactFirstName',
      'contactLastName',
      'contactPhone',
      'contactEmail',
      'address1',
      'address3', // city
      'addressPostcode'
    ]
  },
  EMAIL: {
    REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  UK_PHONE: {
    REGEX: /^(\+44|0)(7\d{9}|[1-9]\d{9})$/
  },
  UK_POSTCODE: {
    REGEX: /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i
  }
};

/**
 * Toast/Notification Durations
 */
export const TOAST = {
  DURATION: {
    SHORT: 2000,
    DEFAULT: 3000,
    LONG: 5000
  },
  TYPES: {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  }
};

/**
 * Loading Overlay Configuration
 */
export const LOADING = {
  INIT_TIMEOUT_MS: 30000, // 30 seconds
  PROGRESS_STEPS: {
    DATABASE: 20,
    UI_SETUP: 50,
    LISTENERS: 75,
    FINALIZE: 90,
    READY: 100
  }
};

/**
 * Available Users (for demo/development)
 */
export const USERS = {
  DEFAULT: ['Slav', 'Rob', 'Kayleigh', 'Terry', 'Phil']
};

/**
 * Page Names (Routes)
 */
export const PAGES = {
  DASHBOARD: 'dashboard',
  PC_NUMBERS: 'pcnumbers',
  PC_DETAIL: 'pc-detail',
  NEW_PC: 'new-pc',
  QUOTES: 'quotes',
  QUOTE_DETAIL: 'quote-detail',
  QUOTE_BUILDER: 'quote-builder',
  QUOTE_PREVIEW: 'quote-preview',
  ACTIVITIES: 'activities',
  RESOURCES: 'resources',
  PRICE_LISTS: 'pricelists',
  PRICE_LIST_DETAIL: 'pricelist-detail',
  NEW_PRICE_LIST: 'new-pricelist',
  SETTINGS: 'settings'
};

/**
 * Input Limits
 */
export const LIMITS = {
  QUANTITY: {
    MIN: 0,
    MAX: 999999
  },
  PRICE: {
    MIN: 0,
    MAX: 999999.99
  },
  HISTORY: {
    MAX_SIZE: 50
  }
};

/**
 * Default Values
 */
export const DEFAULTS = {
  QUANTITY: 1,
  VAT_RATE: 20,
  CURRENCY: 'GBP',
  DISCOUNT: {
    TYPE: 'percent',
    VALUE: 0
  }
};
