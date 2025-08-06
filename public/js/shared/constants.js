/**
 * @fileoverview Application constants and configuration
 * @description Centralized constants to avoid magic numbers and strings
 */

// Application Configuration
export const APP_CONFIG = {
    DB_NAME: 'CRM_Database',
    DB_VERSION: 6,
    VERSION: '1.0.0',
    INIT_TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    DEBUG: true
};

// UI Constants
export const UI_CONSTANTS = {
    MAX_DESCRIPTION_LENGTH: 1000,
    DEFAULT_ACTIVITY_DURATION: 60,
    LOADING_OVERLAY_DELAY: 500,
    TOAST_DURATION: 5000,
    PROGRESS_STEPS: {
        DATABASE_INIT: 20,
        UI_SETUP: 50,
        EVENT_LISTENERS: 75,
        NAVIGATION: 90,
        COMPLETE: 100
    }
};

// Form Field Lengths
export const FIELD_LIMITS = {
    PC_NUMBER_LENGTH: 6,
    QUOTE_NUMBER_LENGTH: 6,
    DESCRIPTION_MAX: 1000,
    TITLE_MAX: 200,
    NAME_MAX: 100,
    EMAIL_MAX: 255,
    PHONE_MAX: 20
};

// PC Number Generation
export const PC_NUMBER = {
    PREFIX: 'PC-',
    FORMAT_REGEX: /PC-(\d{6})/,
    DEFAULT_START: 'PC-000001'
};

// Quote Number Generation
export const QUOTE_NUMBER = {
    PREFIX: 'QT-',
    FORMAT_REGEX: /QT-(\d{6})/,
    DEFAULT_START: 'QT-000001',
    OLD_FORMAT_REGEX: /QT-(\d{4})-(\d{3})/
};

// Activity Constants
export const ACTIVITY_DEFAULTS = {
    STATUS: 'pending',
    PRIORITY: 'medium',
    DURATION: 60,
    TYPE: 'Survey'
};

// Resource Constants
export const RESOURCE_DEFAULTS = {
    STATUS: 'available',
    QUANTITY: 1,
    UNIT: 'each'
};

// Status Values
export const STATUS_VALUES = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    COMPLETED: 'completed',
    DRAFT: 'draft',
    APPROVED: 'approved',
    DECLINED: 'declined',
    URGENT: 'urgent',
    CANCELLED: 'cancelled'
};

// Priority Values
export const PRIORITY_VALUES = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

// DOM Element IDs (frequently used)
export const ELEMENT_IDS = {
    LOADING_OVERLAY: 'loading-overlay',
    PROGRESS_BAR: 'progress-bar',
    PROGRESS_TEXT: 'progress-text',
    TOAST_CONTAINER: 'toast-container',
    LOGIN_MODAL: 'login-modal',
    LOGIN_FORM: 'login-form',
    USER_SELECT: 'user-select',
    MOBILE_MENU_TOGGLE: 'mobile-menu-toggle',
    MAIN_NAVIGATION: 'main-navigation'
};

// Modal IDs
export const MODAL_IDS = {
    ACTIVITY: 'activity-modal',
    RESOURCE: 'resource-modal',
    QUOTE: 'quote-modal',
    PC_EDIT: 'pc-edit-modal',
    PRICE_LIST: 'pricelist-modal',
    PRICE_LIST_ITEM: 'pricelistitem-modal',
    LOGIN: 'login-modal'
};

// Page IDs
export const PAGE_IDS = {
    DASHBOARD: 'dashboard',
    PC_NUMBERS: 'pc-numbers',
    ACTIVITIES: 'activities',
    QUOTES: 'quotes',
    RESOURCES: 'resources',
    PRICE_LISTS: 'price-lists'
};

// Local Storage Keys
export const STORAGE_KEYS = {
    CURRENT_USER: 'currentUser',
    THEME: 'theme',
    PREFERENCES: 'userPreferences'
};

// Calendar Constants
export const CALENDAR = {
    VIEWS: {
        MONTH: 'month',
        WEEK: 'week',
        DAY: 'day'
    },
    MONTHS: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ],
    DAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
};

// Error Messages
export const ERROR_MESSAGES = {
    INIT_TIMEOUT: 'Application initialization timed out. Please refresh the page.',
    LOGIN_FAILED: 'Login failed. Please try again.',
    VALIDATION_FAILED: 'Please fill in all required fields.',
    SAVE_FAILED: 'Failed to save data. Please try again.',
    LOAD_FAILED: 'Failed to load data. Please refresh the page.',
    DELETE_FAILED: 'Failed to delete item. Please try again.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    SAVED: 'Successfully saved!',
    DELETED: 'Successfully deleted!',
    UPDATED: 'Successfully updated!',
    IMPORTED: 'Data imported successfully!',
    EXPORTED: 'Data exported successfully!'
};

// Form Validation Messages
export const VALIDATION_MESSAGES = {
    REQUIRED: 'This field is required',
    EMAIL_INVALID: 'Please enter a valid email address',
    PHONE_INVALID: 'Please enter a valid phone number',
    NUMBER_INVALID: 'Please enter a valid number',
    DATE_INVALID: 'Please enter a valid date',
    TOO_LONG: 'This field is too long',
    TOO_SHORT: 'This field is too short'
};

// CSS Classes
export const CSS_CLASSES = {
    ACTIVE: 'active',
    HIDDEN: 'hidden',
    ERROR: 'error',
    SUCCESS: 'success',
    WARNING: 'warning',
    INFO: 'info',
    LOADING: 'loading',
    DISABLED: 'disabled',
    FIELD_ERROR: 'field-error',
    FIELD_ERROR_MESSAGE: 'field-error-message',
    FORM_VALIDATION_SUMMARY: 'form-validation-summary'
};

// User Roles (for future use)
export const USER_ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    USER: 'user',
    VIEWER: 'viewer'
};

// Default Users
export const DEFAULT_USERS = [
    { id: 'slav', name: 'Slav', role: USER_ROLES.ADMIN, emoji: '👨‍💼' },
    { id: 'rob', name: 'Rob', role: USER_ROLES.MANAGER, emoji: '👨‍💻' },
    { id: 'kayleigh', name: 'Kayleigh', role: USER_ROLES.MANAGER, emoji: '👩‍💼' },
    { id: 'terry', name: 'Terry', role: USER_ROLES.USER, emoji: '👨‍🔧' },
    { id: 'phil', name: 'Phil', role: USER_ROLES.USER, emoji: '👨‍📊' }
];

// Resource Categories
export const RESOURCE_CATEGORIES = {
    LABOUR: 'labour',
    VEHICLES: 'vehicles',
    MATERIAL: 'material',
    CRATES: 'crates'
};

// Data Migration Constants
export const MIGRATION = {
    PC_NUMBER_BATCH_SIZE: 50,
    QUOTE_BATCH_SIZE: 50,
    MIGRATION_DELAY: 100 // ms between batches
};