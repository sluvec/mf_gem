/**
 * @fileoverview Resources management module
 * @description Handles resources CRUD operations, allocation tracking, and availability management
 */

import { db } from './database.js';
import { logDebug, logError, logInfo, generateId, validateFormData, formatCurrency, sanitizeHTML } from './utils.js';

/**
 * @description Resource type constants
 */
export const RESOURCE_TYPES = {
    EQUIPMENT: 'equipment',
    VEHICLE: 'vehicle',
    MATERIAL: 'material',
    TOOL: 'tool',
    PERSONNEL: 'personnel'
};

/**
 * @description Resource status constants
 */
export const RESOURCE_STATUS = {
    AVAILABLE: 'available',
    IN_USE: 'in-use',
    MAINTENANCE: 'maintenance',
    OUT_OF_ORDER: 'out-of-order',
    RESERVED: 'reserved'
};

/**
 * @description Resources class for managing resource operations
 */
export class Resources {
    constructor() {
        this.validationRules = {
            name: { required: true, minLength: 2, maxLength: 100 },
            type: { required: true },
            sku: { required: false, maxLength: 50 }
        };
    }

    /**
     * @description Create a new resource
     * @param {Object} resourceData - Resource data
     * @returns {Promise<string>} Created resource ID
     */
    async createResource(resourceData) {
        try {
            // Validate input data
            const validation = validateFormData(resourceData, this.validationRules);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Create resource object with defaults
            const resource = {
                id: generateId(),
                name: resourceData.name.trim(),
                description: resourceData.description?.trim() || '',
                type: resourceData.type,
                sku: resourceData.sku?.trim() || '',
                status: resourceData.status || RESOURCE_STATUS.AVAILABLE,
                costPerHour: parseFloat(resourceData.costPerHour) || 0,
                costPerUnit: parseFloat(resourceData.costPerUnit) || 0,
                quantity: parseInt(resourceData.quantity) || 1,
                availableQuantity: parseInt(resourceData.quantity) || 1,
                unit: resourceData.unit?.trim() || 'each',
                location: resourceData.location?.trim() || '',
                supplier: resourceData.supplier?.trim() || '',
                purchaseDate: resourceData.purchaseDate ? new Date(resourceData.purchaseDate) : null,
                warrantyExpiry: resourceData.warrantyExpiry ? new Date(resourceData.warrantyExpiry) : null,
                maintenanceSchedule: resourceData.maintenanceSchedule || null,
                specifications: resourceData.specifications || {},
                tags: resourceData.tags || [],
                createdAt: new Date(),
                updatedAt: new Date(),
                assignments: [], // Array of current assignments
                maintenanceHistory: [], // Array of maintenance records
                utilizationHistory: [] // Array of utilization records
            };

            // Save to database
            const id = await db.save('resources', resource);
            logInfo('Resource created:', id);
            
            return id;
        } catch (error) {
            logError('Failed to create resource:', error);
            throw error;
        }
    }

    /**
     * @description Update an existing resource
     * @param {string} id - Resource ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateResource(id, updates) {
        try {
            const resource = await db.load('resources', id);
            if (!resource) {
                throw new Error('Resource not found');
            }

            // Merge updates with existing data
            const updatedResource = {
                ...resource,
                ...updates,
                updatedAt: new Date()
            };

            // Validate updated data
            const validation = validateFormData(updatedResource, this.validationRules);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            await db.save('resources', updatedResource);
            logInfo('Resource updated:', id);
        } catch (error) {
            logError('Failed to update resource:', error);
            throw error;
        }
    }

    /**
     * @description Delete a resource
     * @param {string} id - Resource ID
     * @returns {Promise<void>}
     */
    async deleteResource(id) {
        try {
            // Check if resource is currently assigned
            const resource = await this.getResource(id);
            if (resource && resource.assignments.length > 0) {
                throw new Error('Cannot delete resource with active assignments');
            }

            await db.delete('resources', id);
            logInfo('Resource deleted:', id);
        } catch (error) {
            logError('Failed to delete resource:', error);
            throw error;
        }
    }

    /**
     * @description Get resource by ID
     * @param {string} id - Resource ID
     * @returns {Promise<Object|null>} Resource or null
     */
    async getResource(id) {
        try {
            return await db.load('resources', id);
        } catch (error) {
            logError('Failed to get resource:', error);
            throw error;
        }
    }

    /**
     * @description Get all resources
     * @returns {Promise<Array>} Array of resources
     */
    async getAllResources() {
        try {
            return await db.loadAll('resources');
        } catch (error) {
            logError('Failed to get all resources:', error);
            throw error;
        }
    }

    /**
     * @description Get resources by type
     * @param {string} type - Resource type
     * @returns {Promise<Array>} Array of resources
     */
    async getResourcesByType(type) {
        try {
            return await db.queryByIndex('resources', 'type', type);
        } catch (error) {
            logError('Failed to get resources by type:', error);
            throw error;
        }
    }

    /**
     * @description Search resources by query
     * @param {string} query - Search query
     * @returns {Promise<Array>} Array of matching resources
     */
    async searchResources(query) {
        try {
            const resources = await this.getAllResources();
            const searchTerm = query.toLowerCase().trim();
            
            if (!searchTerm) return resources;
            
            return resources.filter(resource => {
                return (
                    resource.name.toLowerCase().includes(searchTerm) ||
                    resource.description.toLowerCase().includes(searchTerm) ||
                    resource.sku.toLowerCase().includes(searchTerm) ||
                    resource.type.toLowerCase().includes(searchTerm) ||
                    resource.location.toLowerCase().includes(searchTerm) ||
                    resource.supplier.toLowerCase().includes(searchTerm)
                );
            });
        } catch (error) {
            logError('Failed to search resources:', error);
            throw error;
        }
    }

    /**
     * @description Assign a resource to an activity
     * @param {string} resourceId - Resource ID
     * @param {string} activityId - Activity ID
     * @param {number} quantity - Quantity to assign
     * @param {Date} startDate - Assignment start date
     * @param {Date} endDate - Assignment end date
     * @returns {Promise<void>}
     */
    async assignResource(resourceId, activityId, quantity = 1, startDate, endDate) {
        try {
            const resource = await this.getResource(resourceId);
            if (!resource) {
                throw new Error('Resource not found');
            }

            // Check availability
            if (resource.availableQuantity < quantity) {
                throw new Error('Insufficient quantity available');
            }

            // Create assignment record
            const assignment = {
                id: generateId(),
                activityId,
                quantity,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                createdAt: new Date(),
                status: 'active'
            };

            // Update resource
            const updatedResource = {
                ...resource,
                availableQuantity: resource.availableQuantity - quantity,
                assignments: [...resource.assignments, assignment],
                updatedAt: new Date()
            };

            // Update status if fully allocated
            if (updatedResource.availableQuantity === 0) {
                updatedResource.status = RESOURCE_STATUS.IN_USE;
            }

            await db.save('resources', updatedResource);
            logInfo('Resource assigned:', resourceId, 'to activity:', activityId);
        } catch (error) {
            logError('Failed to assign resource:', error);
            throw error;
        }
    }

    /**
     * @description Release a resource from an activity
     * @param {string} resourceId - Resource ID
     * @param {string} activityId - Activity ID
     * @returns {Promise<void>}
     */
    async releaseResource(resourceId, activityId) {
        try {
            const resource = await this.getResource(resourceId);
            if (!resource) {
                throw new Error('Resource not found');
            }

            // Find and remove assignment
            const assignmentIndex = resource.assignments.findIndex(
                assignment => assignment.activityId === activityId && assignment.status === 'active'
            );

            if (assignmentIndex === -1) {
                throw new Error('Assignment not found');
            }

            const assignment = resource.assignments[assignmentIndex];
            
            // Update assignment status
            assignment.status = 'completed';
            assignment.endDate = new Date();

            // Update resource availability
            const updatedResource = {
                ...resource,
                availableQuantity: resource.availableQuantity + assignment.quantity,
                updatedAt: new Date()
            };

            // Update status if now available
            if (updatedResource.availableQuantity > 0 && updatedResource.status === RESOURCE_STATUS.IN_USE) {
                updatedResource.status = RESOURCE_STATUS.AVAILABLE;
            }

            await db.save('resources', updatedResource);
            logInfo('Resource released:', resourceId, 'from activity:', activityId);
        } catch (error) {
            logError('Failed to release resource:', error);
            throw error;
        }
    }

    /**
     * @description Check resource availability for a date range
     * @param {string} resourceId - Resource ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {number} quantityNeeded - Quantity needed
     * @returns {Promise<Object>} Availability information
     */
    async checkAvailability(resourceId, startDate, endDate, quantityNeeded = 1) {
        try {
            const resource = await this.getResource(resourceId);
            if (!resource) {
                throw new Error('Resource not found');
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

            // Calculate quantity in use during the requested period
            let quantityInUse = 0;
            resource.assignments.forEach(assignment => {
                if (assignment.status === 'active') {
                    const assignStart = new Date(assignment.startDate);
                    const assignEnd = new Date(assignment.endDate);
                    
                    // Check for overlap
                    if (start < assignEnd && end > assignStart) {
                        quantityInUse += assignment.quantity;
                    }
                }
            });

            const availableQuantity = resource.quantity - quantityInUse;
            const isAvailable = availableQuantity >= quantityNeeded;

            return {
                isAvailable,
                availableQuantity,
                quantityInUse,
                totalQuantity: resource.quantity,
                conflictingAssignments: resource.assignments.filter(assignment => {
                    if (assignment.status !== 'active') return false;
                    const assignStart = new Date(assignment.startDate);
                    const assignEnd = new Date(assignment.endDate);
                    return start < assignEnd && end > assignStart;
                })
            };
        } catch (error) {
            logError('Failed to check resource availability:', error);
            throw error;
        }
    }

    /**
     * @description Add maintenance record to a resource
     * @param {string} resourceId - Resource ID
     * @param {Object} maintenanceData - Maintenance record data
     * @returns {Promise<void>}
     */
    async addMaintenanceRecord(resourceId, maintenanceData) {
        try {
            const resource = await this.getResource(resourceId);
            if (!resource) {
                throw new Error('Resource not found');
            }

            const maintenanceRecord = {
                id: generateId(),
                type: maintenanceData.type || 'routine',
                description: maintenanceData.description || '',
                date: new Date(maintenanceData.date),
                cost: parseFloat(maintenanceData.cost) || 0,
                performedBy: maintenanceData.performedBy || '',
                notes: maintenanceData.notes || '',
                createdAt: new Date()
            };

            const updatedResource = {
                ...resource,
                maintenanceHistory: [...resource.maintenanceHistory, maintenanceRecord],
                updatedAt: new Date()
            };

            await db.save('resources', updatedResource);
            logInfo('Maintenance record added to resource:', resourceId);
        } catch (error) {
            logError('Failed to add maintenance record:', error);
            throw error;
        }
    }

    /**
     * @description Calculate resource utilization rate
     * @param {string} resourceId - Resource ID
     * @param {Date} startDate - Start date for calculation
     * @param {Date} endDate - End date for calculation
     * @returns {Promise<Object>} Utilization statistics
     */
    async calculateUtilization(resourceId, startDate, endDate) {
        try {
            const resource = await this.getResource(resourceId);
            if (!resource) {
                throw new Error('Resource not found');
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            
            let utilizationDays = 0;
            let totalCost = 0;
            let totalHours = 0;

            resource.assignments.forEach(assignment => {
                const assignStart = new Date(assignment.startDate);
                const assignEnd = new Date(assignment.endDate);
                
                // Check for overlap with the calculation period
                if (assignStart < end && assignEnd > start) {
                    const overlapStart = new Date(Math.max(start, assignStart));
                    const overlapEnd = new Date(Math.min(end, assignEnd));
                    const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
                    
                    utilizationDays += overlapDays * assignment.quantity;
                    
                    // Calculate cost if available
                    if (resource.costPerHour > 0) {
                        const hours = overlapDays * 8; // Assume 8 hours per day
                        totalHours += hours;
                        totalCost += hours * resource.costPerHour * assignment.quantity;
                    }
                }
            });

            const utilizationRate = totalDays > 0 ? (utilizationDays / (totalDays * resource.quantity)) * 100 : 0;

            return {
                utilizationRate: Math.round(utilizationRate * 100) / 100,
                totalDays,
                utilizationDays,
                totalHours,
                totalCost,
                efficiency: utilizationRate > 80 ? 'high' : utilizationRate > 50 ? 'medium' : 'low'
            };
        } catch (error) {
            logError('Failed to calculate resource utilization:', error);
            throw error;
        }
    }

    /**
     * @description Get resource statistics
     * @returns {Promise<Object>} Resource statistics
     */
    async getResourceStats() {
        try {
            const resources = await this.getAllResources();
            
            const stats = {
                total: resources.length,
                available: 0,
                inUse: 0,
                maintenance: 0,
                outOfOrder: 0,
                reserved: 0,
                byType: {},
                totalValue: 0,
                averageUtilization: 0
            };
            
            resources.forEach(resource => {
                // Status counts
                stats[resource.status.replace('-', '')]++;
                
                // Type counts
                stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1;
                
                // Calculate total value
                if (resource.costPerUnit > 0) {
                    stats.totalValue += resource.costPerUnit * resource.quantity;
                }
            });
            
            return stats;
        } catch (error) {
            logError('Failed to get resource stats:', error);
            throw error;
        }
    }

    /**
     * @description Get resources requiring maintenance
     * @returns {Promise<Array>} Array of resources needing maintenance
     */
    async getResourcesRequiringMaintenance() {
        try {
            const resources = await this.getAllResources();
            const today = new Date();
            
            return resources.filter(resource => {
                // Check warranty expiry
                if (resource.warrantyExpiry && resource.warrantyExpiry <= today) {
                    return true;
                }
                
                // Check maintenance schedule
                if (resource.maintenanceSchedule && resource.maintenanceSchedule.nextDue) {
                    const nextDue = new Date(resource.maintenanceSchedule.nextDue);
                    return nextDue <= today;
                }
                
                // Check if last maintenance was too long ago
                if (resource.maintenanceHistory.length > 0) {
                    const lastMaintenance = resource.maintenanceHistory
                        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                    const daysSinceLastMaintenance = (today - new Date(lastMaintenance.date)) / (1000 * 60 * 60 * 24);
                    
                    // Assume maintenance needed every 90 days if no schedule specified
                    return daysSinceLastMaintenance > 90;
                }
                
                return false;
            });
        } catch (error) {
            logError('Failed to get resources requiring maintenance:', error);
            throw error;
        }
    }
}

// Create global resources instance
export const resources = new Resources();