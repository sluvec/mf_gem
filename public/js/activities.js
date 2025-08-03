/**
 * @fileoverview Activities management module
 * @description Handles activities CRUD operations, scheduling, and calendar functionality
 */

import { db } from './database.js';
import { logDebug, logError, logInfo, generateId, validateFormData, formatDate, sanitizeHTML } from './utils.js';

/**
 * @description Activity status constants
 */
export const ACTIVITY_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

/**
 * @description Activity priority constants
 */
export const ACTIVITY_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

/**
 * @description Activity type constants
 */
export const ACTIVITY_TYPES = {
    SITE_SURVEY: 'site_survey',
    INSTALLATION: 'installation',
    MAINTENANCE: 'maintenance',
    INSPECTION: 'inspection',
    MEETING: 'meeting',
    ADMIN: 'admin'
};

/**
 * @description Activities class for managing activity operations
 */
export class Activities {
    constructor() {
        this.validationRules = {
            title: { required: true, minLength: 3, maxLength: 100 },
            type: { required: true },
            scheduledDate: { required: true },
            pcId: { required: true }
        };
    }

    /**
     * @description Create a new activity
     * @param {Object} activityData - Activity data
     * @returns {Promise<string>} Created activity ID
     */
    async createActivity(activityData) {
        try {
            // Validate input data
            const validation = validateFormData(activityData, this.validationRules);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Create activity object with defaults
            const activity = {
                id: generateId(),
                title: activityData.title.trim(),
                description: activityData.description?.trim() || '',
                type: activityData.type,
                pcId: activityData.pcId,
                scheduledDate: new Date(activityData.scheduledDate),
                scheduledTime: activityData.scheduledTime || '09:00',
                duration: parseInt(activityData.duration) || 60,
                status: activityData.status || ACTIVITY_STATUS.PENDING,
                priority: activityData.priority || ACTIVITY_PRIORITY.MEDIUM,
                assignedTo: activityData.assignedTo || null,
                resourcesRequired: activityData.resourcesRequired || [],
                notes: activityData.notes?.trim() || '',
                createdAt: new Date(),
                updatedAt: new Date(),
                isRecurring: activityData.isRecurring || false,
                recurringSettings: activityData.recurringSettings || null
            };

            // Save to database
            const id = await db.save('activities', activity);
            logInfo('Activity created:', id);
            
            return id;
        } catch (error) {
            logError('Failed to create activity:', error);
            throw error;
        }
    }

    /**
     * @description Update an existing activity
     * @param {string} id - Activity ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateActivity(id, updates) {
        try {
            const activity = await db.load('activities', id);
            if (!activity) {
                throw new Error('Activity not found');
            }

            // Merge updates with existing data
            const updatedActivity = {
                ...activity,
                ...updates,
                updatedAt: new Date()
            };

            // Validate updated data
            const validation = validateFormData(updatedActivity, this.validationRules);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            await db.save('activities', updatedActivity);
            logInfo('Activity updated:', id);
        } catch (error) {
            logError('Failed to update activity:', error);
            throw error;
        }
    }

    /**
     * @description Delete an activity
     * @param {string} id - Activity ID
     * @returns {Promise<void>}
     */
    async deleteActivity(id) {
        try {
            await db.delete('activities', id);
            logInfo('Activity deleted:', id);
        } catch (error) {
            logError('Failed to delete activity:', error);
            throw error;
        }
    }

    /**
     * @description Get activity by ID
     * @param {string} id - Activity ID
     * @returns {Promise<Object|null>} Activity or null
     */
    async getActivity(id) {
        try {
            return await db.load('activities', id);
        } catch (error) {
            logError('Failed to get activity:', error);
            throw error;
        }
    }

    /**
     * @description Get all activities
     * @returns {Promise<Array>} Array of activities
     */
    async getAllActivities() {
        try {
            return await db.loadAll('activities');
        } catch (error) {
            logError('Failed to get all activities:', error);
            throw error;
        }
    }

    /**
     * @description Get activities by PC number ID
     * @param {string} pcId - PC number ID
     * @returns {Promise<Array>} Array of activities
     */
    async getActivitiesByPcId(pcId) {
        try {
            return await db.queryByIndex('activities', 'pcId', pcId);
        } catch (error) {
            logError('Failed to get activities by PC ID:', error);
            throw error;
        }
    }

    /**
     * @description Get activities by status
     * @param {string} status - Activity status
     * @returns {Promise<Array>} Array of activities
     */
    async getActivitiesByStatus(status) {
        try {
            return await db.queryByIndex('activities', 'status', status);
        } catch (error) {
            logError('Failed to get activities by status:', error);
            throw error;
        }
    }

    /**
     * @description Get activities for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Array of activities
     */
    async getActivitiesInDateRange(startDate, endDate) {
        try {
            const allActivities = await this.getAllActivities();
            return allActivities.filter(activity => {
                const activityDate = new Date(activity.scheduledDate);
                return activityDate >= startDate && activityDate <= endDate;
            });
        } catch (error) {
            logError('Failed to get activities in date range:', error);
            throw error;
        }
    }

    /**
     * @description Calculate activity schedule (start and end times)
     * @param {Object} activity - Activity object
     * @returns {Object} Schedule with start and end times
     */
    calculateActivitySchedule(activity) {
        try {
            const scheduledDate = new Date(activity.scheduledDate);
            const [hours, minutes] = (activity.scheduledTime || '09:00').split(':');
            
            const startTime = new Date(scheduledDate);
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + (activity.duration || 60));
            
            return {
                start: startTime,
                end: endTime,
                duration: activity.duration || 60
            };
        } catch (error) {
            logError('Failed to calculate activity schedule:', error);
            return null;
        }
    }

    /**
     * @description Check for scheduling conflicts
     * @param {Object} activity - Activity to check
     * @param {Array} existingActivities - Existing activities
     * @returns {Array} Array of conflicting activities
     */
    checkSchedulingConflicts(activity, existingActivities) {
        try {
            const activitySchedule = this.calculateActivitySchedule(activity);
            if (!activitySchedule) return [];

            const conflicts = [];
            
            for (const existing of existingActivities) {
                if (existing.id === activity.id) continue; // Skip self
                
                const existingSchedule = this.calculateActivitySchedule(existing);
                if (!existingSchedule) continue;
                
                // Check for time overlap
                if (activitySchedule.start < existingSchedule.end && 
                    activitySchedule.end > existingSchedule.start) {
                    conflicts.push(existing);
                }
            }
            
            return conflicts;
        } catch (error) {
            logError('Failed to check scheduling conflicts:', error);
            return [];
        }
    }

    /**
     * @description Create recurring activities
     * @param {Object} baseActivity - Base activity data
     * @param {Object} recurringSettings - Recurring configuration
     * @returns {Promise<Array>} Array of created activity IDs
     */
    async createRecurringActivities(baseActivity, recurringSettings) {
        try {
            const { frequency, interval, endDate, occurrences } = recurringSettings;
            const createdIds = [];
            
            let currentDate = new Date(baseActivity.scheduledDate);
            let count = 0;
            
            while (count < (occurrences || 10) && (!endDate || currentDate <= new Date(endDate))) {
                if (count > 0) { // Skip first occurrence as it's the base activity
                    const recurringActivity = {
                        ...baseActivity,
                        id: generateId(),
                        scheduledDate: new Date(currentDate),
                        isRecurring: true,
                        recurringSettings: recurringSettings
                    };
                    
                    const id = await db.save('activities', recurringActivity);
                    createdIds.push(id);
                }
                
                // Calculate next occurrence
                switch (frequency) {
                    case 'daily':
                        currentDate.setDate(currentDate.getDate() + interval);
                        break;
                    case 'weekly':
                        currentDate.setDate(currentDate.getDate() + (7 * interval));
                        break;
                    case 'monthly':
                        currentDate.setMonth(currentDate.getMonth() + interval);
                        break;
                    case 'yearly':
                        currentDate.setFullYear(currentDate.getFullYear() + interval);
                        break;
                }
                
                count++;
            }
            
            logInfo('Created recurring activities:', createdIds.length);
            return createdIds;
        } catch (error) {
            logError('Failed to create recurring activities:', error);
            throw error;
        }
    }

    /**
     * @description Get activity statistics
     * @returns {Promise<Object>} Activity statistics
     */
    async getActivityStats() {
        try {
            const activities = await this.getAllActivities();
            
            const stats = {
                total: activities.length,
                pending: 0,
                inProgress: 0,
                completed: 0,
                cancelled: 0,
                overdue: 0,
                thisWeek: 0,
                thisMonth: 0,
                byType: {},
                byPriority: {}
            };
            
            const now = new Date();
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            
            activities.forEach(activity => {
                // Status counts
                stats[activity.status.replace('_', '')]++;
                
                // Overdue check
                const activityDate = new Date(activity.scheduledDate);
                if (activityDate < now && activity.status === ACTIVITY_STATUS.PENDING) {
                    stats.overdue++;
                }
                
                // Time-based counts
                if (activityDate >= weekStart) stats.thisWeek++;
                if (activityDate >= monthStart) stats.thisMonth++;
                
                // Type counts
                stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
                
                // Priority counts
                stats.byPriority[activity.priority] = (stats.byPriority[activity.priority] || 0) + 1;
            });
            
            return stats;
        } catch (error) {
            logError('Failed to get activity stats:', error);
            throw error;
        }
    }


}

// Create global activities instance
export const activities = new Activities();